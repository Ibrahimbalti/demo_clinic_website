import crypto from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clinicStore } from '../src/lib/clinicDataStore';
import {
  formatE164WithCountryCode,
  isValidE164Mobile,
  publicAppointmentSchema,
} from '../src/lib/schemas';
import {
  aiBackendTools,
  handleInboundWhatsAppWebhookMessage,
  processPatientMessageWithAI,
  resetAISessionDraft,
} from '../src/lib/aiReceptionistEngine';
import {
  decryptCredentials,
  encryptCredentials,
  verifyWhatsAppWebhookSignature,
} from '../netlify/functions/_shared/security';
import { handler as whatsappWebhookHandler } from '../netlify/functions/whatsapp';
import { buildPrivacySafeCalendarEvent } from '../netlify/functions/calendar';

function getFutureWorkingDate(daysAhead = 2): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  // Ensure we don't land on Sunday (0)
  if (d.getUTCDay() === 0) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

describe('Gasha Demo Clinic — Full-Stack Appointment, AI, WhatsApp & Security Suite', () => {
  beforeEach(() => {
    clinicStore.resetToInitial();
  });

  // 1. AUTHENTICATION & AUTHORIZATION (RBAC)
  it('authenticates active staff and enforces Role-Based Access Control (RBAC)', () => {
    const badLogin = clinicStore.login('unknown@example.com', 'wrongpass');
    expect(badLogin.success).toBe(false);

    const superLogin = clinicStore.login('superadmin@gashaclinic.com', 'ClinicAdmin2026!');
    expect(superLogin.success).toBe(true);
    expect(superLogin.user?.role).toBe('super_admin');
    expect(clinicStore.hasPermission(superLogin.user!, 'manage_users')).toBe(true);
    expect(clinicStore.hasPermission(superLogin.user!, 'manage_ai')).toBe(true);

    const receptionUser = clinicStore.switchRoleForTesting('receptionist');
    expect(receptionUser?.role).toBe('receptionist');
    expect(clinicStore.hasPermission(receptionUser, 'manage_whatsapp_inbox')).toBe(true);
    expect(clinicStore.hasPermission(receptionUser, 'manage_appointments')).toBe(true);
    expect(clinicStore.hasPermission(receptionUser, 'manage_users')).toBe(false);

    const doctorUser = clinicStore.switchRoleForTesting('doctor');
    expect(doctorUser?.role).toBe('doctor');
    expect(clinicStore.hasPermission(doctorUser, 'manage_appointments')).toBe(true);
    expect(clinicStore.hasPermission(doctorUser, 'manage_whatsapp_inbox')).toBe(false);

    clinicStore.logout();
    expect(clinicStore.getCurrentUser()).toBeNull();
  });

  // 2. PATIENT CREATION & DOCTOR AVAILABILITY (WORKING HOURS, BREAKS, HOLIDAYS)
  it('respects doctor working hours, break times (13:00-14:00), and clinic holidays', () => {
    const workDate = getFutureWorkingDate(3);
    const slots = clinicStore.getAvailableSlots({
      date: workDate,
      doctorId: 'doc_1',
      serviceId: 'svc_whitening',
    });

    expect(slots.length).toBeGreaterThan(0);
    // Doctor break is 13:00 - 14:00, so no 45-min slot can start at 12:30 or 13:00
    expect(slots.some((s) => s.startTime === '13:00')).toBe(false);
    expect(slots.some((s) => s.startTime === '12:30')).toBe(false);

    // Add a clinic holiday on workDate and confirm 0 slots are returned
    clinicStore.addClinicHoliday(workDate, 'Test Public Holiday');
    const holidaySlots = clinicStore.getAvailableSlots({
      date: workDate,
      doctorId: 'doc_1',
    });
    expect(holidaySlots).toHaveLength(0);
  });

  // 3. ATOMIC BOOKING & OVERLAPPING APPOINTMENT PREVENTION
  it('books valid appointments atomically and prevents overlapping bookings for the same doctor', () => {
    const workDate = getFutureWorkingDate(4);

    const firstBooking = clinicStore.createAppointmentAtomic({
      patientName: 'Fatima Zahra',
      patientPhone: '+15551112233',
      doctorId: 'doc_1',
      serviceId: 'svc_checkup',
      appointmentDate: workDate,
      startTime: '10:00',
      source: 'website',
      visitReason: 'Routine checkup',
    });

    expect(firstBooking.success).toBe(true);
    expect(firstBooking.appointment?.status).toBe('confirmed');
    expect(firstBooking.appointment?.googleCalendarEventId).toBeTruthy();

    // Attempt overlapping booking with the same doctor at 10:00 or 10:30 (since duration is 45m: 10:00-10:45)
    const overlappingBooking = clinicStore.createAppointmentAtomic({
      patientName: 'Second Patient',
      patientPhone: '+15554445566',
      doctorId: 'doc_1',
      serviceId: 'svc_checkup',
      appointmentDate: workDate,
      startTime: '10:00',
      source: 'admin',
      visitReason: 'Conflict test',
    });

    expect(overlappingBooking.success).toBe(false);
    expect(overlappingBooking.error).toMatch(/unavailable/i);
  });

  // 4. APPOINTMENT RESCHEDULING & CANCELLATION
  it('reschedules and cancels appointments while updating linked reminder jobs', () => {
    const workDate = getFutureWorkingDate(5);
    const created = clinicStore.createAppointmentAtomic({
      patientName: 'Tariq Mahmood',
      patientPhone: '+15557778899',
      doctorId: 'doc_2',
      serviceId: 'svc_whitening',
      appointmentDate: workDate,
      startTime: '11:00',
      source: 'website',
      visitReason: 'Whitening',
    });

    expect(created.success).toBe(true);
    const apptId = created.appointment!.id;

    // Reschedule to 15:00
    const rescheduled = clinicStore.rescheduleAppointment({
      appointmentId: apptId,
      newDate: workDate,
      newStartTime: '15:00',
    });
    expect(rescheduled.success).toBe(true);
    expect(rescheduled.appointment?.startTime).toBe('15:00');

    // Cancel appointment and verify linked reminders are automatically cancelled
    const cancelled = clinicStore.cancelAppointment(apptId, 'Patient travelling');
    expect(cancelled.success).toBe(true);
    expect(cancelled.appointment?.status).toBe('cancelled');

    const linkedReminders = clinicStore
      .getState()
      .reminders.filter((r) => r.appointmentId === apptId);
    expect(linkedReminders.every((r) => r.status === 'cancelled')).toBe(true);
  });

  // 5. WHATSAPP WEBHOOK VERIFICATION, HMAC SIGNATURE & IDEMPOTENCY
  it('verifies Meta WhatsApp GET webhook challenge, validates HMAC-SHA256 signatures, and blocks duplicate deliveries', async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'test_verify_secret';
    const verifyRes = await whatsappWebhookHandler(
      {
        httpMethod: 'GET',
        path: '/api/whatsapp/webhook',
        headers: {},
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_verify_secret',
          'hub.challenge': 'challenge_987654',
        },
        body: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
      },
      {} as never,
      () => {}
    );

    expect(verifyRes?.statusCode).toBe(200);
    expect(verifyRes?.body).toBe('challenge_987654');

    // Verify HMAC-SHA256 signature helper
    const secret = 'meta_app_secret_key_123';
    const payload = JSON.stringify({ object: 'whatsapp_business_account' });
    const validSig =
      'sha256=' + crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

    expect(verifyWhatsAppWebhookSignature(payload, validSig, secret)).toBe(true);
    expect(verifyWhatsAppWebhookSignature(payload, 'sha256=invalidhex', secret)).toBe(false);

    // Verify duplicate webhook delivery idempotency
    const firstDelivery = handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: 'wamid.UNIQUE_1001',
      fromPhone: '+15556007001',
      senderProfileName: 'Zayd',
      textContent: 'Hello, I want to book an appointment.',
    });
    expect(firstDelivery.duplicate).toBe(false);
    expect(firstDelivery.outboundMessage).toBeDefined();

    const duplicateDelivery = handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: 'wamid.UNIQUE_1001',
      fromPhone: '+15556007001',
      senderProfileName: 'Zayd',
      textContent: 'Hello, I want to book an appointment.',
    });
    expect(duplicateDelivery.duplicate).toBe(true);
    expect(duplicateDelivery.outboundMessage).toBeUndefined();
  });

  // 6. HUMAN RECEPTIONIST TAKEOVER SUPPRESSES AI RESPONSES
  it('stops AI from responding when a human receptionist takes over a conversation until resumed', () => {
    const phone = '+15556007002';
    const turn1 = handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: 'wamid.takeover.1',
      fromPhone: phone,
      senderProfileName: 'Layla Patient',
      textContent: 'Hello',
    });
    expect(turn1.conversation.handlingMode).toBe('ai');
    expect(turn1.outboundMessage).toBeDefined();

    // Receptionist sends manual reply -> automatically activates human takeover
    clinicStore.sendManualHumanReply(
      turn1.conversation.id,
      'Hello! This is Nadia at the front desk. I am taking over your chat.'
    );
    const updatedConv = clinicStore
      .getState()
      .conversations.find((c) => c.id === turn1.conversation.id);
    expect(updatedConv?.handlingMode).toBe('human');

    // Next patient message arrives -> AI must NOT respond
    const turn2 = handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: 'wamid.takeover.2',
      fromPhone: phone,
      senderProfileName: 'Layla Patient',
      textContent: 'Can I book tomorrow at 10am?',
    });
    expect(turn2.outboundMessage).toBeUndefined();
    expect(turn2.aiResponse?.suppressedBecauseHumanMode).toBe(true);

    // Receptionist returns conversation to AI -> AI resumes responding
    clinicStore.setConversationHandlingMode(turn1.conversation.id, 'ai');
    const turn3 = handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: 'wamid.takeover.3',
      fromPhone: phone,
      senderProfileName: 'Layla Patient',
      textContent: 'Hello, I want to book an appointment.',
    });
    expect(turn3.outboundMessage).toBeDefined();
  });

  // 7. MEDICAL SAFETY & ZOD TOOL VALIDATION
  it('enforces medical safety guardrails and Zod validation on AI backend tools', () => {
    const emergencyRes = processPatientMessageWithAI({
      patientPhone: '+15559110000',
      messageText: 'I have uncontrolled bleeding and difficulty breathing after tooth trauma',
    });
    expect(emergencyRes.handedOverToHuman).toBe(true);
    expect(emergencyRes.reply).toMatch(/emergency/i);

    const medicalDiagnosisRes = processPatientMessageWithAI({
      patientPhone: '+15559110001',
      messageText: 'Can you prescribe amoxicillin antibiotic dosage for my gum infection?',
    });
    expect(medicalDiagnosisRes.handedOverToHuman).toBe(true);
    expect(medicalDiagnosisRes.reply).toMatch(/cannot diagnose/i);

    // Zod validation rejects unconfirmed AI appointment creation
    expect(() =>
      aiBackendTools.createAppointment({
        patientName: 'Test',
        patientPhone: '+15551234567',
        appointmentDate: getFutureWorkingDate(2),
        startTime: '10:00',
        visitReason: 'Checkup',
        patientConfirmed: false,
      })
    ).toThrow();
  });

  // 8. GOOGLE CALENDAR PRIVACY & CREDENTIAL ENCRYPTION
  it('encrypts OAuth credentials with AES-256-GCM and minimizes patient PHI in Google Calendar events', () => {
    const rawTokens = JSON.stringify({
      refreshToken: '1//0g_secret_refresh_token',
      accessToken: 'ya29.secret_access_token',
    });
    const encrypted = encryptCredentials(rawTokens, 'test-32-byte-encryption-secret-key');
    expect(encrypted).not.toContain('secret_refresh_token');

    const decrypted = decryptCredentials(encrypted, 'test-32-byte-encryption-secret-key');
    expect(decrypted).toBe(rawTokens);

    const eventPayload = buildPrivacySafeCalendarEvent({
      appointmentId: 'apt_999',
      patientName: 'Ahmed Al-Farsi',
      serviceName: 'Dental Checkup',
      appointmentDate: '2026-11-26',
      startTime: '10:00',
      endTime: '10:45',
      timezone: 'UTC',
    });
    // Only first name is placed in external Google Calendar summary
    expect(eventPayload.summary).toContain('Ahmed');
    expect(eventPayload.summary).not.toContain('Al-Farsi');
  });

  // 9. COMPLETE 11-STEP PATIENT JOURNEY (END-TO-END)
  it('completes the full 11-step patient journey from WhatsApp greeting to booking, GCal sync, and reminder dispatch', () => {
    const journeyPhone = '+15558889900';
    resetAISessionDraft(journeyPhone);
    const targetDate = getFutureWorkingDate(2);

    // Step 1 & 2: Patient sends WhatsApp message -> AI responds asking for name
    const step1 = handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: 'wamid.journey.1',
      fromPhone: journeyPhone,
      textContent: 'Hello, I want to book an appointment.',
    });
    expect(step1.outboundMessage?.content).toMatch(/May I know your name/i);

    // Step 3a: Patient provides name -> AI asks visit reason
    const step2 = handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: 'wamid.journey.2',
      fromPhone: journeyPhone,
      textContent: 'My name is Ahmed.',
    });
    expect(step2.outboundMessage?.content).toMatch(/What would you like to visit us for/i);

    // Step 3b: Patient provides visit reason -> AI asks preferred doctor
    const step3 = handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: 'wamid.journey.3',
      fromPhone: journeyPhone,
      textContent: 'Dental checkup.',
    });
    expect(step3.outboundMessage?.content).toMatch(/preferred doctor/i);

    // Step 3c: Patient chooses any available doctor -> AI asks preferred date
    const step4 = handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: 'wamid.journey.4',
      fromPhone: journeyPhone,
      textContent: 'Any available doctor.',
    });
    expect(step4.outboundMessage?.content).toMatch(/What date would you prefer/i);

    // Step 4: Patient gives date -> AI executes getAvailableSlots() and offers real slots
    const step5 = handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: 'wamid.journey.5',
      fromPhone: journeyPhone,
      textContent: targetDate,
    });
    expect(step5.aiResponse?.toolsExecuted.some((t) => t.toolName === 'getAvailableSlots')).toBe(
      true
    );
    expect(step5.outboundMessage?.content).toMatch(/We have these available times/i);

    // Step 5: Patient selects slot option 1 -> AI asks for explicit confirmation
    const step6 = handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: 'wamid.journey.6',
      fromPhone: journeyPhone,
      textContent: '1',
    });
    expect(step6.outboundMessage?.content).toMatch(/Shall I confirm your appointment/i);

    // Step 6, 7, 8, 9, 10: Patient confirms "Yes" -> Backend validates slot, creates appointment, syncs GCal, sends WhatsApp confirmation, and schedules reminders
    const step7 = handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: 'wamid.journey.7',
      fromPhone: journeyPhone,
      textContent: 'Yes',
    });
    expect(step7.aiResponse?.toolsExecuted.some((t) => t.toolName === 'createAppointment')).toBe(
      true
    );
    expect(step7.outboundMessage?.content).toMatch(/successfully confirmed/i);

    const createdAppt = clinicStore
      .getState()
      .appointments.find((a) => a.patientPhone === journeyPhone && a.appointmentDate === targetDate);
    expect(createdAppt).toBeDefined();
    expect(createdAppt?.status).toBe('confirmed');
    expect(createdAppt?.googleCalendarEventId).toBeTruthy();

    const scheduledReminders = clinicStore
      .getState()
      .reminders.filter((r) => r.appointmentId === createdAppt!.id);
    expect(scheduledReminders.length).toBeGreaterThanOrEqual(1);

    // Step 11: Reminder is processed and sent idempotently
    const targetReminder = scheduledReminders[0];
    const remResult = clinicStore.processDueReminders(targetReminder.id);
    expect(remResult.sent).toBe(1);
    expect(targetReminder.status).toBe('sent');

    // Daily report includes the new booking
    const report = clinicStore.generateDailyReport(targetDate);
    expect(report.totalAppointments).toBeGreaterThanOrEqual(1);
  });

  // 10. MANDATORY E.164 MOBILE NUMBER, COUNTRY CODES, PAYMENT & SMS FALLBACK
  it('enforces mandatory E.164 patient mobile number with country codes (+92, +1, +44) and dispatches confirmation, payment, reminder, and SMS fallback notices', () => {
    expect(formatE164WithCountryCode('+92', '0370-5621256')).toBe('+923705621256');
    expect(formatE164WithCountryCode('+1', '555-180-3040')).toBe('+15551803040');
    expect(formatE164WithCountryCode('+44', '07700 900123')).toBe('+447700900123');
    expect(isValidE164Mobile('+923705621256')).toBe(true);
    expect(isValidE164Mobile('123')).toBe(false);

    // Frontend Zod schema rejects missing or invalid mobile numbers
    const invalidFrontend = publicAppointmentSchema.safeParse({
      fullName: 'Bilal Khan',
      countryCode: '+92',
      phone: '123',
      hasWhatsApp: true,
      serviceId: 'svc_checkup',
      appointmentDate: getFutureWorkingDate(3),
      startTime: '10:00',
      consentGranted: true,
    });
    expect(invalidFrontend.success).toBe(false);

    // Backend store rejects booking without a valid E.164 mobile number
    const missingMobileBooking = clinicStore.createAppointmentAtomic({
      patientName: 'Bilal Khan',
      patientPhone: '',
      doctorId: 'doc_1',
      serviceId: 'svc_checkup',
      appointmentDate: getFutureWorkingDate(3),
      startTime: '10:00',
      source: 'website',
      visitReason: 'Checkup',
    });
    expect(missingMobileBooking.success).toBe(false);
    expect(missingMobileBooking.error).toMatch(/mandatory/i);

    // Valid +92 Pakistan booking with hasWhatsApp = false retains SMS/Phone contact & sends payment instructions
    const pkDate = getFutureWorkingDate(4);
    const validBooking = clinicStore.createAppointmentAtomic({
      patientName: 'Bilal Khan',
      patientPhone: formatE164WithCountryCode('+92', '03705621256'),
      patientHasWhatsApp: false,
      doctorId: 'doc_1',
      serviceId: 'svc_checkup',
      appointmentDate: pkDate,
      startTime: '10:30',
      source: 'website',
      visitReason: 'Checkup',
    });

    expect(validBooking.success).toBe(true);
    expect(validBooking.appointment?.patientPhone).toBe('+923705621256');
    expect(validBooking.appointment?.paymentStatus).toBe('UNPAID');
    expect(validBooking.appointment?.paymentDisplayLabel).toBe('Pay at Clinic');

    const storedPatient = clinicStore
      .getState()
      .patients.find((p) => p.phone === '+923705621256');
    expect(storedPatient?.preferredContactChannel).toBe('sms_or_phone');

    const conv = clinicStore
      .getState()
      .conversations.find((c) => c.phone === '+923705621256');
    expect(conv).toBeDefined();
    expect(conv?.lastMessagePreview).toMatch(/Pay at Clinic/i);
  });

  // 11. PAYMENT SYSTEM: CASH AT CLINIC, MANUAL EASYPAISA VERIFICATION & 3-WAY WHATSAPP DELIVERIES
  it('handles Cash at Clinic immediate confirmation, Manual Easypaisa receipt verification workflow, 3-way WhatsApp delivery tracking, and international card rules', () => {
    const testDate = getFutureWorkingDate(5);

    // A. Cash at Clinic: Confirms immediately, UNPAID / "Pay at Clinic", GCal event, 3-way WhatsApp (patient, doctor, clinic), 1h reminder
    const cashRes = clinicStore.createAppointmentAtomic({
      patientName: 'Hamza Tariq',
      patientPhone: '+923001112233',
      doctorId: 'doc_1',
      serviceId: 'svc_whitening',
      appointmentDate: testDate,
      startTime: '09:00',
      paymentMethod: 'CASH_AT_CLINIC',
      source: 'website',
      visitReason: 'Teeth Whitening',
    });

    expect(cashRes.success).toBe(true);
    expect(cashRes.appointment?.status).toBe('confirmed');
    expect(cashRes.appointment?.paymentStatus).toBe('UNPAID');
    expect(cashRes.appointment?.paymentDisplayLabel).toBe('Pay at Clinic');
    expect(cashRes.appointment?.googleCalendarEventId).toBeTruthy();

    // Check 3 separate WhatsApp recipient deliveries (patient, doctor, clinic)
    const cashDeliveries = clinicStore
      .getState()
      .notificationDeliveries.filter((d) => d.appointmentId === cashRes.appointment!.id);
    expect(cashDeliveries).toHaveLength(3);
    expect(cashDeliveries.map((d) => d.recipientRole).sort()).toEqual([
      'clinic',
      'doctor',
      'patient',
    ]);

    // Check 1h reminder scheduled
    const cashReminder = clinicStore
      .getState()
      .reminders.find(
        (r) => r.appointmentId === cashRes.appointment!.id && r.reminderType === '1h'
      );
    expect(cashReminder).toBeDefined();

    // B. Manual Easypaisa: Never auto-confirms on upload; sets PENDING_VERIFICATION & PENDING_PAYMENT_VERIFICATION
    const epRes = clinicStore.createAppointmentAtomic({
      patientName: 'Ayesha Malik',
      patientPhone: '+923214445566',
      doctorId: 'doc_2',
      serviceId: 'svc_aligners',
      appointmentDate: testDate,
      startTime: '11:00',
      paymentMethod: 'MANUAL_EASYPAISA',
      transactionReference: 'TID-5544332211',
      receiptFileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
      receiptFileName: 'easypaisa_screenshot.png',
      source: 'website',
      visitReason: 'Clear Aligners',
    });

    expect(epRes.success).toBe(true);
    const epApptId = epRes.appointment!.id;
    expect(epRes.appointment?.status).toBe('PENDING_PAYMENT_VERIFICATION');
    expect(epRes.appointment?.paymentStatus).toBe('PENDING_VERIFICATION');
    // Must NOT create Google Calendar event or 1h reminder before Admin approval
    expect(epRes.appointment?.googleCalendarEventId).toBeNull();
    expect(
      clinicStore.getState().reminders.some((r) => r.appointmentId === epApptId)
    ).toBe(false);

    // C. Admin Rejects Receipt -> Notifies patient & allows resubmission
    const rejected = clinicStore.rejectEasypaisaPayment({
      appointmentId: epApptId,
      reason: 'Screenshot blurry, TID not readable',
      adminName: 'Ibrahim (Super Admin)',
    });
    expect(rejected.success).toBe(true);
    expect(rejected.appointment?.paymentStatus).toBe('REJECTED');
    expect(rejected.appointment?.status).toBe('PENDING_PAYMENT_VERIFICATION');

    // D. Patient Resubmits Receipt -> Returns to PENDING_VERIFICATION
    const resubmitted = clinicStore.resubmitEasypaisaReceipt({
      appointmentId: epApptId,
      transactionReference: 'TID-9988776655-CLEAR',
      receiptFileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUB',
      receiptFileName: 'clear_receipt.png',
    });
    expect(resubmitted.success).toBe(true);
    expect(resubmitted.appointment?.paymentStatus).toBe('PENDING_VERIFICATION');

    // E. Admin Approves Receipt -> Marks PAID, confirms appointment, creates GCal event, sends 3-way WhatsApp, schedules 1h reminder
    const approved = clinicStore.approveEasypaisaPayment({
      appointmentId: epApptId,
      reason: 'Verified TID-9988776655-CLEAR in Easypaisa statement',
      adminName: 'Ibrahim (Super Admin)',
    });
    expect(approved.success).toBe(true);
    expect(approved.appointment?.paymentStatus).toBe('PAID');
    expect(approved.appointment?.status).toBe('confirmed');
    expect(approved.appointment?.googleCalendarEventId).toBeTruthy();
    expect(approved.appointment?.paymentVerifiedByAdminName).toBe('Ibrahim (Super Admin)');
    expect(approved.appointment?.paymentVerifiedAt).toBeTruthy();

    const epDeliveries = clinicStore
      .getState()
      .notificationDeliveries.filter((d) => d.appointmentId === epApptId);
    expect(epDeliveries).toHaveLength(3);

    const epReminder = clinicStore
      .getState()
      .reminders.find((r) => r.appointmentId === epApptId && r.reminderType === '1h');
    expect(epReminder).toBeDefined();

    // F. International Card: Blocks Stripe/PayPal when Pakistani merchant lacks foreign entity eligibility, allows Safepay Pakistan server-side verification
    const intlRes = clinicStore.createAppointmentAtomic({
      patientName: 'Zainab International',
      patientPhone: '+447700900555',
      doctorId: 'doc_1',
      serviceId: 'svc_veneers',
      appointmentDate: testDate,
      startTime: '15:00',
      paymentMethod: 'INTERNATIONAL_CARD',
      source: 'website',
      visitReason: 'Veneers Consultation',
    });
    expect(intlRes.success).toBe(true);
    expect(intlRes.appointment?.status).toBe('PENDING_PAYMENT_VERIFICATION');

    const ineligibleStripe = clinicStore.verifyInternationalCardPaymentServerSide({
      appointmentId: intlRes.appointment!.id,
      provider: 'stripe_eligible_merchant',
      gatewayTransactionId: 'pi_12345',
    });
    expect(ineligibleStripe.success).toBe(false);

    const validSafepay = clinicStore.verifyInternationalCardPaymentServerSide({
      appointmentId: intlRes.appointment!.id,
      provider: 'safepay_pk',
      gatewayTransactionId: 'sfpy_live_987654',
    });
    expect(validSafepay.success).toBe(true);
    expect(validSafepay.appointment?.paymentStatus).toBe('PAID');
    expect(validSafepay.appointment?.status).toBe('confirmed');
  });
});
