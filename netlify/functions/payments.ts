import crypto from 'crypto';
import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { clinicStore } from '../../src/lib/clinicDataStore';
import { errorResponse, jsonResponse } from './_shared/security';

const verifyReceiptDecisionSchema = z.object({
  appointmentId: z.string().min(1),
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().min(3, 'A clear decision reason is required'),
  adminName: z.string().trim().optional(),
});

const resubmitReceiptSchema = z.object({
  appointmentId: z.string().min(1),
  transactionReference: z.string().trim().min(4),
  receiptFileUrl: z.string().min(5),
  receiptFileName: z.string().optional(),
});

const internationalWebhookSchema = z.object({
  appointmentId: z.string().min(1),
  provider: z.enum([
    'safepay_pk',
    'payfast_pk',
    '2checkout_verifone',
    'stripe_eligible_merchant',
    'paypal_eligible_merchant',
  ]),
  gatewayTransactionId: z.string().min(4),
  signature: z.string().min(8),
});

/**
 * Netlify Serverless Function: /api/payments/*
 * Handles:
 * 1. Manual Easypaisa Receipt Admin Approval / Rejection (/api/payments/verify-easypaisa)
 * 2. Patient Receipt Resubmission after Rejection (/api/payments/resubmit-easypaisa)
 * 3. Server-Side International Card Webhook Verification (/api/payments/verify-international)
 *    (Never trusts a browser redirect as proof of payment!)
 * 4. Retry Failed WhatsApp Recipient Notification (/api/payments/retry-notification)
 */
export const handler: Handler = async (event) => {
  const subPath = event.path.replace(/^\/(\.netlify\/functions\/payments|api\/payments)/, '') || '/';

  if (event.httpMethod === 'POST' && subPath.startsWith('/verify-easypaisa')) {
    try {
      const parsed = verifyReceiptDecisionSchema.parse(JSON.parse(event.body || '{}'));
      if (parsed.decision === 'APPROVE') {
        const res = clinicStore.approveEasypaisaPayment({
          appointmentId: parsed.appointmentId,
          reason: parsed.reason,
          adminName: parsed.adminName,
        });
        if (!res.success) return errorResponse(400, res.error || 'Approval failed');
        return jsonResponse(200, { success: true, appointment: res.appointment });
      } else {
        const res = clinicStore.rejectEasypaisaPayment({
          appointmentId: parsed.appointmentId,
          reason: parsed.reason,
          adminName: parsed.adminName,
        });
        if (!res.success) return errorResponse(400, res.error || 'Rejection failed');
        return jsonResponse(200, { success: true, appointment: res.appointment });
      }
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Invalid verification payload');
    }
  }

  if (event.httpMethod === 'POST' && subPath.startsWith('/resubmit-easypaisa')) {
    try {
      const parsed = resubmitReceiptSchema.parse(JSON.parse(event.body || '{}'));
      const res = clinicStore.resubmitEasypaisaReceipt({
        appointmentId: parsed.appointmentId,
        transactionReference: parsed.transactionReference,
        receiptFileUrl: parsed.receiptFileUrl,
        receiptFileName: parsed.receiptFileName || 'easypaisa_receipt_resubmitted.png',
      });
      if (!res.success) return errorResponse(400, res.error || 'Resubmission failed');
      return jsonResponse(200, { success: true, appointment: res.appointment });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Invalid resubmission payload');
    }
  }

  // Server-Side International Card Payment Verification (Never trusts browser redirects)
  if (event.httpMethod === 'POST' && subPath.startsWith('/verify-international')) {
    try {
      const parsed = internationalWebhookSchema.parse(JSON.parse(event.body || '{}'));
      const webhookSecret =
        process.env.SAFEPAY_WEBHOOK_SECRET ||
        process.env.PAYFAST_SECURED_KEY ||
        process.env.STRIPE_WEBHOOK_SECRET ||
        process.env.ENCRYPTION_KEY ||
        'gasha-demo-clinic-32-byte-encryption-vault-key';

      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${parsed.appointmentId}:${parsed.gatewayTransactionId}`, 'utf8')
        .digest('hex');

      if (parsed.signature !== expectedSig) {
        return errorResponse(
          401,
          'Server-side payment signature verification failed. Browser redirect alone is never accepted as proof of payment.',
          'INVALID_PAYMENT_SIGNATURE'
        );
      }

      const res = clinicStore.verifyInternationalCardPaymentServerSide({
        appointmentId: parsed.appointmentId,
        provider: parsed.provider,
        gatewayTransactionId: parsed.gatewayTransactionId,
      });

      if (!res.success) return errorResponse(400, res.error || 'Payment verification failed');
      return jsonResponse(200, { success: true, appointment: res.appointment });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Invalid webhook payload');
    }
  }

  if (event.httpMethod === 'POST' && subPath.startsWith('/retry-notification')) {
    try {
      const body = JSON.parse(event.body || '{}') as { deliveryId: string };
      const retried = clinicStore.retryWhatsAppRecipientDelivery(body.deliveryId);
      if (!retried) return errorResponse(404, 'Notification delivery record not found');
      return jsonResponse(200, { success: true, delivery: retried });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Retry failed');
    }
  }

  return errorResponse(404, 'Payment endpoint not found');
};
