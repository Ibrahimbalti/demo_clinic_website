import type { Config, Handler } from '@netlify/functions';
import { clinicStore } from '../../src/lib/clinicDataStore';
import { sendMetaWhatsAppMessage } from './whatsapp';
import { jsonResponse } from './_shared/security';
import { formatDisplayTime } from '../../src/lib/availabilityEngine';

/**
 * Netlify Scheduled Function: Automated Appointment Reminders
 * Runs every 5 minutes without external workflow services (no n8n/Zapier/node-cron).
 * Responsibilities:
 * 1. Find appointments approaching their reminder time (1h default, 24h optional)
 * 2. Check appointment status !== cancelled
 * 3. Atomically claim the reminder job
 * 4. Send the WhatsApp reminder template
 * 5. Save message response & mark reminder sent or failed
 */
export const handler: Handler = async () => {
  const state = clinicStore.getState();
  const nowMs = Date.now();
  let claimed = 0;
  let sentCount = 0;
  let failedCount = 0;
  let cancelledSkipped = 0;

  for (const rem of state.reminders) {
    if (rem.status !== 'pending' && !(rem.status === 'failed' && rem.attempts < 3)) {
      continue;
    }

    const scheduledMs = new Date(rem.scheduledAt).getTime();
    if (scheduledMs > nowMs) {
      continue;
    }

    const appt = state.appointments.find((a) => a.id === rem.appointmentId);
    if (!appt || appt.status === 'cancelled') {
      rem.status = 'cancelled';
      cancelledSkipped++;
      continue;
    }

    // Atomically claim the reminder job
    claimed++;
    rem.status = 'processing';
    rem.attempts += 1;

    const dispatch = await sendMetaWhatsAppMessage({
      toPhone: rem.patientPhone,
      messageType: 'template',
      templateName: process.env.WHATSAPP_REMINDER_TEMPLATE_NAME || 'appointment_reminder',
      templateLanguage: process.env.WHATSAPP_LANGUAGE_CODE || 'en_US',
      templateParameters: [
        rem.patientName,
        state.clinic.name,
        rem.serviceName,
        rem.doctorName,
        rem.appointmentDate,
        formatDisplayTime(rem.appointmentTime),
      ],
    });

    if (dispatch.status === 'sent') {
      rem.status = 'sent';
      rem.sentAt = new Date().toISOString();
      rem.lastError = null;
      sentCount++;
    } else {
      rem.status = 'failed';
      rem.lastError = dispatch.error || 'Meta WhatsApp template send failed';
      failedCount++;
    }
  }

  return jsonResponse(200, {
    success: true,
    executedAt: new Date().toISOString(),
    claimed,
    sentCount,
    failedCount,
    cancelledSkipped,
  });
};

export const config: Config = {
  schedule: '*/5 * * * *',
};
