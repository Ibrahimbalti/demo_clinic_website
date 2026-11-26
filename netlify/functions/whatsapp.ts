import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { handleInboundWhatsAppWebhookMessage } from '../../src/lib/aiReceptionistEngine';
import { clinicStore } from '../../src/lib/clinicDataStore';
import {
  errorResponse,
  jsonResponse,
  verifyWhatsAppWebhookSignature,
} from './_shared/security';

const sendPayloadSchema = z.object({
  conversationId: z.string().optional(),
  toPhone: z.string().min(7),
  messageType: z.enum(['text', 'template']).default('text'),
  text: z.string().optional(),
  templateName: z.string().optional(),
  templateLanguage: z.string().default('en_US'),
  templateParameters: z.array(z.string()).optional(),
});

/**
 * Dispatches an outbound message via the official Meta WhatsApp Cloud API v20.0.
 * If WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not configured,
 * logs in development mock mode without pretending a live Meta dispatch occurred.
 */
export async function sendMetaWhatsAppMessage(params: {
  toPhone: string;
  messageType: 'text' | 'template';
  text?: string;
  templateName?: string;
  templateLanguage?: string;
  templateParameters?: string[];
}): Promise<{
  sentLive: boolean;
  whatsappMessageId: string;
  status: 'sent' | 'failed';
  error?: string;
}> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const cleanRecipient = params.toPhone.replace(/[^\d]/g, '');

  if (!token || !phoneId) {
    return {
      sentLive: false,
      whatsappMessageId: `wamid.mock.${Date.now()}`,
      status: 'sent',
    };
  }

  const endpoint = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  const payload =
    params.messageType === 'template'
      ? {
          messaging_product: 'whatsapp',
          to: cleanRecipient,
          type: 'template',
          template: {
            name: params.templateName || process.env.WHATSAPP_REMINDER_TEMPLATE_NAME || 'appointment_reminder',
            language: { code: params.templateLanguage || 'en_US' },
            components: params.templateParameters?.length
              ? [
                  {
                    type: 'body',
                    parameters: params.templateParameters.map((p) => ({
                      type: 'text',
                      text: p,
                    })),
                  },
                ]
              : [],
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanRecipient,
          type: 'text',
          text: { preview_url: false, body: params.text || '' },
        };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };

    if (!res.ok) {
      // If free-form text fails (e.g. outside 24h customer care window), fallback to pre-approved template
      if (params.messageType === 'text') {
        const fallbackRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanRecipient,
            type: 'template',
            template: {
              name: params.templateName || 'hello_world',
              language: { code: params.templateLanguage || 'en_US' },
            },
          }),
        });
        const fallbackData = (await fallbackRes.json()) as {
          messages?: Array<{ id: string }>;
          error?: { message: string };
        };
        if (fallbackRes.ok && fallbackData.messages?.[0]?.id) {
          return {
            sentLive: true,
            whatsappMessageId: fallbackData.messages[0].id,
            status: 'sent',
          };
        }
      }

      return {
        sentLive: true,
        whatsappMessageId: '',
        status: 'failed',
        error: data.error?.message || `Meta API HTTP ${res.status}`,
      };
    }

    return {
      sentLive: true,
      whatsappMessageId: data.messages?.[0]?.id || `wamid.live.${Date.now()}`,
      status: 'sent',
    };
  } catch (err) {
    return {
      sentLive: true,
      whatsappMessageId: '',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Meta network error',
    };
  }
}

export const handler: Handler = async (event) => {
  const subPath = event.path.replace(/^\/(\.netlify\/functions\/whatsapp|api\/whatsapp)/, '') || '/';

  // ==========================================================================
  // 1. GET /api/whatsapp/webhook — Meta Webhook Challenge Verification
  // ==========================================================================
  if (event.httpMethod === 'GET' && subPath.startsWith('/webhook')) {
    const mode = event.queryStringParameters?.['hub.mode'];
    const token = event.queryStringParameters?.['hub.verify_token'];
    const challenge = event.queryStringParameters?.['hub.challenge'];
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'gasha_clinic_verify_token';

    if (mode === 'subscribe' && token === expectedToken && challenge) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: challenge,
      };
    }

    return errorResponse(403, 'Meta WhatsApp webhook verification failed.', 'WEBHOOK_VERIFY_FAILED');
  }

  // ==========================================================================
  // 2. POST /api/whatsapp/webhook — Incoming Messages & Delivery Status Updates
  // ==========================================================================
  if (event.httpMethod === 'POST' && subPath.startsWith('/webhook')) {
    const rawBody = event.body || '';
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    const signatureHeader =
      event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'];

    if (appSecret) {
      const validSig = verifyWhatsAppWebhookSignature(rawBody, signatureHeader, appSecret);
      if (!validSig) {
        return errorResponse(401, 'Invalid X-Hub-Signature-256 webhook signature', 'INVALID_SIGNATURE');
      }
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return errorResponse(400, 'Invalid JSON body', 'INVALID_JSON');
    }

    const entries = (payload.entry as Array<Record<string, unknown>>) || [];
    const processedEvents: Array<Record<string, unknown>> = [];

    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) || [];
      for (const change of changes) {
        const value = (change.value as Record<string, unknown>) || {};

        // A. Handle Message Status Webhooks (sent, delivered, read, failed)
        const statuses = (value.statuses as Array<Record<string, unknown>>) || [];
        for (const st of statuses) {
          const wamid = String(st.id || '');
          const statusVal = String(st.status || 'sent') as
            | 'sent'
            | 'delivered'
            | 'read'
            | 'failed';
          const msg = clinicStore
            .getState()
            .messages.find((m) => m.whatsappMessageId === wamid);
          if (msg) {
            msg.deliveryStatus = statusVal;
          }
          processedEvents.push({ type: 'status_update', whatsappMessageId: wamid, status: statusVal });
        }

        // B. Handle Incoming Patient Messages
        const contacts = (value.contacts as Array<Record<string, unknown>>) || [];
        const profileName =
          (contacts[0]?.profile as Record<string, string> | undefined)?.name ||
          'WhatsApp Patient';

        const incomingMessages = (value.messages as Array<Record<string, unknown>>) || [];
        for (const incoming of incomingMessages) {
          const wamid = String(incoming.id || `wamid.${Date.now()}`);
          const fromPhone = String(incoming.from || '');
          const msgType = String(incoming.type || 'text');

          let extractedText = '';
          let normalizedType: 'text' | 'interactive' | 'unsupported' = 'text';

          if (msgType === 'text') {
            extractedText = String(
              (incoming.text as Record<string, unknown>)?.body || ''
            );
          } else if (msgType === 'interactive') {
            normalizedType = 'interactive';
            const inter = incoming.interactive as Record<string, Record<string, string>> | undefined;
            extractedText =
              inter?.button_reply?.title ||
              inter?.list_reply?.title ||
              'Interactive selection';
          } else {
            normalizedType = 'unsupported';
            extractedText = `[Unsupported WhatsApp message type: ${msgType}]`;
          }

          const result = handleInboundWhatsAppWebhookMessage({
            whatsappMessageId: wamid,
            fromPhone,
            senderProfileName: profileName,
            messageType: normalizedType,
            textContent: extractedText,
          });

          // If not duplicate and AI generated an outbound reply, dispatch through Meta Cloud API
          if (!result.duplicate && result.outboundMessage) {
            await sendMetaWhatsAppMessage({
              toPhone: fromPhone,
              messageType: 'text',
              text: result.outboundMessage.content,
            });
          }

          processedEvents.push({
            type: 'inbound_message',
            whatsappMessageId: wamid,
            duplicate: result.duplicate,
            handlingMode: result.conversation.handlingMode,
            aiReplied: Boolean(result.outboundMessage),
          });
        }
      }
    }

    return jsonResponse(200, {
      success: true,
      processedEvents,
    });
  }

  // ==========================================================================
  // 3. POST /api/whatsapp/send — Outbound Manual Reply or Approved Template
  // ==========================================================================
  if (event.httpMethod === 'POST' && subPath.startsWith('/send')) {
    try {
      const parsed = sendPayloadSchema.parse(JSON.parse(event.body || '{}'));

      const dispatchResult = await sendMetaWhatsAppMessage({
        toPhone: parsed.toPhone,
        messageType: parsed.messageType,
        text: parsed.text,
        templateName: parsed.templateName,
        templateLanguage: parsed.templateLanguage,
        templateParameters: parsed.templateParameters,
      });

      if (parsed.conversationId && parsed.text) {
        clinicStore.sendManualHumanReply(parsed.conversationId, parsed.text);
      }

      return jsonResponse(200, {
        success: dispatchResult.status === 'sent',
        dispatch: dispatchResult,
      });
    } catch (err) {
      return errorResponse(
        400,
        err instanceof Error ? err.message : 'Invalid WhatsApp send request',
        'VALIDATION_ERROR'
      );
    }
  }

  return errorResponse(404, 'WhatsApp endpoint not found', 'NOT_FOUND');
};
