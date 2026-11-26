export type UserRole = 'super_admin' | 'clinic_admin' | 'receptionist' | 'doctor';

export type AppointmentStatus =
  | 'pending'
  | 'PENDING_PAYMENT_VERIFICATION'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type PaymentMethodType =
  | 'CASH_AT_CLINIC'
  | 'MANUAL_EASYPAISA'
  | 'DEBIT_CREDIT_CARD'
  | 'APPLE_GOOGLE_PAY'
  | 'PAYPAL'
  | 'INTERNATIONAL_CARD';

export type CardBrandOrWalletType =
  | 'visa_mastercard_amex_discover'
  | 'uk_debit_credit'
  | 'apple_pay'
  | 'google_pay'
  | 'paypal';

export type PaymentVerificationStatus =
  | 'UNPAID'
  | 'PENDING_VERIFICATION'
  | 'PAID'
  | 'REJECTED';

export type InternationalGatewayProvider =
  | 'safepay_pk'
  | 'payfast_pk'
  | '2checkout_verifone'
  | 'stripe_eligible_merchant'
  | 'paypal_eligible_merchant';

export interface ClinicPaymentSettings {
  cashAtClinicEnabled: boolean;
  manualEasypaisaEnabled: boolean;
  easypaisaAccountNumber: string;
  easypaisaAccountTitle: string;
  easypaisaInstructions: string;
  debitCreditCardEnabled: boolean;
  appleGooglePayEnabled: boolean;
  paypalEnabled: boolean;
  internationalCardEnabled: boolean;
  internationalGatewayProvider: InternationalGatewayProvider;
  hasEligibleInternationalMerchantAccount: boolean;
  currencyCode: string;
}

export interface PaymentVerificationDecision {
  id: string;
  appointmentId: string;
  decision: 'APPROVED' | 'REJECTED' | 'SUBMITTED' | 'RESUBMITTED';
  adminUserId: string | null;
  adminName: string;
  reason: string;
  transactionReference: string;
  timestamp: string;
}

export interface WhatsAppRecipientDelivery {
  id: string;
  appointmentId: string;
  recipientRole: 'patient' | 'doctor' | 'clinic';
  recipientName: string;
  recipientPhone: string;
  eventType:
    | 'appointment_confirmed'
    | 'payment_pending_verification'
    | 'payment_approved'
    | 'payment_rejected'
    | 'appointment_cancelled'
    | 'appointment_rescheduled';
  deliveryStatus: 'sent' | 'delivered' | 'failed';
  attempts: number;
  idempotencyKey: string;
  messageContent: string;
  lastError?: string | null;
  sentAt: string;
}

export type ConversationStatus = 'open' | 'closed';

export type HandlingMode = 'ai' | 'human';

export type MessageDirection = 'inbound' | 'outbound';

export type MessageDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export type ReminderType = '24h' | '1h';

export type ReminderStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface OpeningHoursDay {
  day: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday ... 6 = Saturday
  isOpen: boolean;
  openTime: string;  // "09:00"
  closeTime: string; // "20:00"
  note?: string;
}

export interface ClinicProfile {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  emergencyPhone: string;
  whatsappNumber: string; // E.164 digits e.g. "15552347645"
  email: string;
  timezone: string;
  defaultAppointmentDurationMinutes: number;
  bookingLeadTimeMinutes: number;
  maxBookingAdvanceDays: number;
  cancellationPolicyHours: number;
  isVerifiedContent: boolean;
  verificationNotice: string;
  openingHours: OpeningHoursDay[];
  paymentSettings: ClinicPaymentSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicUser {
  id: string;
  clinicId: string;
  fullName: string;
  email: string;
  role: UserRole;
  doctorId?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DoctorWorkingDay {
  id: string;
  doctorId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // "09:00"
  endTime: string;   // "18:00"
  isAvailable: boolean;
}

export interface DoctorBreak {
  id: string;
  doctorId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // "13:00"
  endTime: string;   // "14:00"
  label?: string;
}

export interface Doctor {
  id: string;
  clinicId: string;
  name: string;
  title: string;
  specialization: string;
  description: string;
  credentials: string[];
  imageUrl: string;
  email?: string;
  phone?: string;
  appointmentDurationMinutes: number;
  isActive: boolean;
  isVerified: boolean;
  calendarId?: string | null;
  googleCalendarConnected: boolean;
  serviceIds: string[];
  availability: DoctorWorkingDay[];
  breaks: DoctorBreak[];
  createdAt: string;
}

export interface ClinicService {
  id: string;
  clinicId: string;
  name: string;
  badge: string;
  category: string;
  description: string;
  durationMinutes: number;
  visitsLabel: string;
  comfortLabel: string;
  price: number | null;
  priceLabel: string;
  features: string[];
  bestFor: string;
  imageUrl: string;
  doctorIds: string[];
  isActive: boolean;
}

export interface ClinicHoliday {
  id: string;
  clinicId: string;
  holidayDate: string; // "YYYY-MM-DD"
  description: string;
}

export interface Patient {
  id: string;
  clinicId: string;
  fullName: string;
  phone: string; // Mandatory International E.164 format (e.g. +923705621256)
  hasWhatsApp?: boolean;
  preferredContactChannel?: 'whatsapp' | 'sms_or_phone';
  email?: string | null;
  consentStatus: 'granted' | 'pending' | 'revoked';
  visitReason?: string | null;
  internalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  patientPhone: string; // Mandatory International E.164 format
  patientHasWhatsApp?: boolean;
  paymentMethod: PaymentMethodType;
  paymentStatus: PaymentVerificationStatus;
  paymentDisplayLabel: string; // e.g. "Pay at Clinic", "Pending Admin Verification", "Paid"
  paymentAmount: number | null;
  transactionReference?: string | null;
  receiptFileUrl?: string | null;
  receiptFileName?: string | null;
  paymentVerifiedByAdminId?: string | null;
  paymentVerifiedByAdminName?: string | null;
  paymentVerifiedAt?: string | null;
  paymentDecisionReason?: string | null;
  verificationHistory?: PaymentVerificationDecision[];
  notificationDeliveries?: WhatsAppRecipientDelivery[];
  patientEmail?: string | null;
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
  appointmentDate: string; // "YYYY-MM-DD"
  startTime: string;       // "HH:mm"
  endTime: string;         // "HH:mm"
  status: AppointmentStatus;
  source: 'whatsapp_ai' | 'website' | 'admin';
  visitReason: string;
  internalNotes?: string | null;
  googleCalendarEventId?: string | null;
  calendarSyncStatus?: 'synced' | 'pending' | 'failed' | 'not_connected';
  createdAt: string;
  updatedAt: string;
}

export interface AvailableSlot {
  doctorId: string;
  doctorName: string;
  date: string;      // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  displayTime: string; // "10:00 AM"
}

export interface Conversation {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  phone: string;
  status: ConversationStatus;
  handlingMode: HandlingMode;
  unreadCount: number;
  lastMessagePreview: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface WhatsAppMessage {
  id: string;
  conversationId: string;
  whatsappMessageId: string;
  direction: MessageDirection;
  senderType: 'patient' | 'ai' | 'human' | 'system';
  messageType: 'text' | 'interactive' | 'template' | 'unsupported';
  content: string;
  deliveryStatus: MessageDeliveryStatus;
  toolCallsExecuted?: string[];
  createdAt: string;
}

export interface ReminderJob {
  id: string;
  appointmentId: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  reminderType: ReminderType;
  scheduledAt: string; // ISO timestamp
  status: ReminderStatus;
  attempts: number;
  sentAt?: string | null;
  lastError?: string | null;
  idempotencyKey: string;
}

export interface AIConfiguration {
  id: string;
  clinicId: string;
  enabled: boolean;
  assistantName: string;
  welcomeMessage: string;
  language: string;
  toneOfVoice: string;
  systemPrompt: string;
  bookingRules: string[];
  handoverRules: string[];
  emergencyResponseMessage: string;
  faqs: Array<{ question: string; answer: string }>;
  enable24hReminder: boolean;
  enable1hReminder: boolean;
  updatedAt: string;
}

export interface IntegrationStatus {
  id: string;
  clinicId: string;
  provider: 'whatsapp' | 'openai' | 'google_calendar';
  connectionStatus: 'connected' | 'disconnected' | 'mock_mode' | 'error';
  accountLabel?: string;
  lastSyncedAt?: string | null;
  updatedAt: string;
}

export interface DailyReport {
  id: string;
  clinicId: string;
  reportDate: string;
  totalAppointments: number;
  confirmedAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  pendingAppointments: number;
  noShowAppointments: number;
  newPatients: number;
  aiHandledConversations: number;
  humanHandledConversations: number;
  doctorBreakdown: Array<{
    doctorId: string;
    doctorName: string;
    total: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  }>;
  deliveryStatus: 'generated' | 'sent' | 'failed';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  clinicId: string;
  userId?: string | null;
  userName?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
