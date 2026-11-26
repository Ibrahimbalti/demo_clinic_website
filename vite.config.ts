import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function metaWhatsAppDevMiddleware(): Plugin {
  let envVars: Record<string, string> = {};

  return {
    name: 'meta-whatsapp-dev-middleware',
    configResolved(config) {
      envVars = loadEnv(config.mode, process.cwd(), '');
    },
    configureServer(server) {
      server.middlewares.use('/api/whatsapp/send', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk;
        });

        req.on('end', async () => {
          try {
            const parsed = JSON.parse(rawBody || '{}') as {
              toPhone?: string;
              messageType?: 'text' | 'template';
              text?: string;
              templateName?: string;
              templateLanguage?: string;
            };

            const token = envVars.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
            const phoneId =
              envVars.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
            const cleanRecipient = String(parsed.toPhone || '').replace(/[^\d]/g, '');

            if (!token || !phoneId || !cleanRecipient) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  dispatch: {
                    sentLive: false,
                    status: 'failed',
                    error: 'Missing WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, or recipient number in .env',
                  },
                })
              );
              return;
            }

            const endpoint = `https://graph.facebook.com/v20.0/${phoneId}/messages`;

            // 1. First attempt: Send custom confirmation text body
            const textPayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanRecipient,
              type: 'text',
              text: { preview_url: false, body: parsed.text || 'Appointment Confirmed at Gasha Demo Clinic.' },
            };

            const metaRes = await fetch(endpoint, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(textPayload),
            });

            const metaData = (await metaRes.json()) as {
              messages?: Array<{ id: string }>;
              error?: { message: string; code?: number; error_subcode?: number };
            };

            if (metaRes.ok && metaData.messages?.[0]?.id) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: true,
                  dispatch: {
                    sentLive: true,
                    whatsappMessageId: metaData.messages[0].id,
                    status: 'sent',
                    mode: 'text',
                  },
                })
              );
              return;
            }

            // 2. If free-form text is blocked by Meta's 24-hour customer service window (e.g. code 131047),
            // automatically fall back to Meta's pre-approved 'hello_world' template so business-initiated outreach succeeds
            const templateRes = await fetch(endpoint, {
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
                  name: parsed.templateName || 'hello_world',
                  language: { code: parsed.templateLanguage || 'en_US' },
                },
              }),
            });

            const templateData = (await templateRes.json()) as {
              messages?: Array<{ id: string }>;
              error?: { message: string; code?: number };
            };

            if (templateRes.ok && templateData.messages?.[0]?.id) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: true,
                  dispatch: {
                    sentLive: true,
                    whatsappMessageId: templateData.messages[0].id,
                    status: 'sent',
                    mode: 'template_fallback',
                  },
                })
              );
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                dispatch: {
                  sentLive: true,
                  whatsappMessageId: '',
                  status: 'failed',
                  error:
                    metaData.error?.message ||
                    templateData.error?.message ||
                    `Meta API HTTP ${metaRes.status}`,
                  errorCode: metaData.error?.code || templateData.error?.code,
                },
              })
            );
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                dispatch: {
                  sentLive: false,
                  status: 'failed',
                  error: err instanceof Error ? err.message : 'Server error dispatching WhatsApp message',
                },
              })
            );
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), metaWhatsAppDevMiddleware()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
