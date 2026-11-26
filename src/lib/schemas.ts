import { z } from 'zod';

/**
 * Supported Country Dial Codes for the Appointment Booking Mobile Selector
 */
export const COUNTRY_DIAL_CODES = [
  { code: '+92', country: 'Pakistan', flag: '🇵🇰', example: '3705621256' },
  { code: '+1', country: 'USA / Canada', flag: '🇺🇸', example: '5551803040' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', example: '7700900123' },
  { code: '+971', country: 'UAE', flag: '🇦🇪', example: '501234567' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', example: '501234567' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦', example: '33123456' },
  { code: '+61', country: 'Australia', flag: '🇦🇺', example: '412345678' },
  { code: '+49', country: 'Germany', flag: '🇩🇪', example: '15123456789' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷', example: '5321234567' },
] as const;

/**
 * Strict International E.164 Mobile Format Regex (+ followed by 8 to 15 digits)
 */
export const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

export function isValidE164Mobile(phone: string): boolean {
  return E164_PHONE_REGEX.test(phone.trim());
}

/**
 * Combines a country dial code (e.g., "+92") and a local mobile number (e.g., "0370-5621256")
 * into strict international E.164 format ("+923705621256").
 */
export function formatE164WithCountryCode(countryCode: string, rawLocal: string): string {
  const cleanCode = countryCode.replace(/[^\d+]/g, '');
  const prefix = cleanCode.startsWith('+') ? cleanCode : `+${cleanCode}`;
  const trimmedRaw = rawLocal.trim();

  // If user already pasted a full international + number matching E.164
  if (trimmedRaw.startsWith('+')) {
    const fullDigits = '+' + trimmedRaw.replace(/[^\d]/g, '');
    return fullDigits;
  }

  // Strip non-digits and leading trunk zero (e.g., 0370... -> 370...)
  let localDigits = trimmedRaw.replace(/[^\d]/g, '');
  localDigits = localDigits.replace(/^0+/, '');

  const codeDigitsOnly = prefix.slice(1);
  // Prevent duplicate country prefix if user typed "923705621256" with "+92" selected
  if (
    localDigits.startsWith(codeDigitsOnly) &&
    localDigits.length >= codeDigitsOnly.length + 9
  ) {
    return `+${localDigits}`;
  }

  return `${prefix}${localDigits}`;
}

export function normalizePhone(raw: string, defaultCountryCode = '+1'): string {
  if (!raw || !raw.trim()) return '';
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  const digits = cleaned.replace(/^0+/, '');
  if (digits.startsWith('92') && digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.startsWith('44') && digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `${defaultCountryCode}${digits}`;
  }
  return `+${digits}`;
}

export const publicAppointmentSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name is required (at least 2 characters)')
      .max(100),
    countryCode: z
      .string()
      .regex(/^\+\d{1,4}$/, 'Please select a valid country code'),
    phone: z
      .string()
      .trim()
      .min(1, 'Mobile number is required to book an appointment'),
    hasWhatsApp: z.boolean().default(true),
    email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
    serviceId: z.string().min(1, 'Please select a treatment'),
    doctorId: z.string().optional().or(z.literal('')),
    appointmentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please select a valid date (YYYY-MM-DD)'),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Please select a valid time slot (HH:mm)'),
    paymentMethod: z
      .enum([
        'CASH_AT_CLINIC',
        'MANUAL_EASYPAISA',
        'DEBIT_CREDIT_CARD',
        'APPLE_GOOGLE_PAY',
        'PAYPAL',
        'INTERNATIONAL_CARD',
      ])
      .default('CASH_AT_CLINIC'),
    cardRegionOrWallet: z
      .enum([
        'US_CARD',
        'UK_CARD',
        'APPLE_PAY',
        'GOOGLE_PAY',
        'PAYPAL_WALLET',
      ])
      .optional(),
    transactionReference: z.string().trim().max(120).optional().or(z.literal('')),
    receiptFileUrl: z.string().optional().or(z.literal('')),
    receiptFileName: z.string().optional().or(z.literal('')),
    visitReason: z.string().trim().max(500).optional().or(z.literal('')),
    consentGranted: z.boolean().refine((val) => val === true, {
      message:
        'You must consent to receive appointment confirmation, payment instructions, and reminder notifications on your mobile number.',
    }),
  })
  .superRefine((data, ctx) => {
    const localDigitsOnly = data.phone.replace(/[^\d]/g, '').replace(/^0+/, '');
    if (localDigitsOnly.length < 7 || localDigitsOnly.length > 13) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message:
          'Enter a valid mobile number (7–12 digits without spaces or invalid characters, e.g., 3705621256).',
      });
      return;
    }
    const e164 = formatE164WithCountryCode(data.countryCode, data.phone);
    if (!isValidE164Mobile(e164)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: `Invalid mobile number format (${e164}). Must be a valid international mobile number.`,
      });
    }

    // If Manual Easypaisa is selected, both transaction reference and receipt upload are required
    if (data.paymentMethod === 'MANUAL_EASYPAISA') {
      if (!data.transactionReference || data.transactionReference.trim().length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['transactionReference'],
          message:
            'Please enter your Easypaisa Transaction ID / Reference Number (at least 4 characters).',
        });
      }
      if (!data.receiptFileUrl || !data.receiptFileUrl.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['receiptFileUrl'],
          message: 'Please upload your Easypaisa payment receipt screenshot or image.',
        });
      }
    }
  });

export type PublicAppointmentFormValues = z.infer<typeof publicAppointmentSchema>;

const backendMobileValidator = z
  .string()
  .trim()
  .min(1, 'Patient mobile number is mandatory.')
  .transform((val) => normalizePhone(val))
  .refine((val) => isValidE164Mobile(val), {
    message:
      'Invalid patient mobile number. Must be a valid international E.164 number (e.g., +923705621256 or +15551803040).',
  });

export const adminAppointmentSchema = z.object({
  patientName: z.string().trim().min(2, 'Patient name is required').max(100),
  patientPhone: backendMobileValidator,
  patientHasWhatsApp: z.boolean().optional().default(true),
  patientEmail: z.string().trim().email().optional().or(z.literal('')),
  doctorId: z.string().min(1, 'Doctor is required'),
  serviceId: z.string().min(1, 'Service is required'),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:mm'),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).default('confirmed'),
  visitReason: z.string().trim().min(2, 'Visit reason is required').max(500),
  internalNotes: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const rescheduleAppointmentSchema = z.object({
  appointmentId: z.string().min(1),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  newStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:mm'),
  doctorId: z.string().optional(),
  reason: z.string().trim().max(300).optional(),
});

export const cancelAppointmentSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().trim().max(300).optional(),
});

// ============================================================================
// AI TOOL CALLING ZOD SCHEMAS (Backend-Enforced Validation)
// ============================================================================
export const aiGetDoctorDetailsSchema = z.object({
  doctorId: z.string().optional(),
  doctorName: z.string().optional(),
});

export const aiGetAvailableSlotsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  doctorId: z.string().optional(),
  serviceId: z.string().optional(),
});

export const aiCreateAppointmentSchema = z.object({
  patientName: z.string().trim().min(2).max(100),
  patientPhone: backendMobileValidator,
  patientEmail: z.string().email().optional(),
  doctorId: z.string().optional(),
  serviceId: z.string().optional(),
  serviceName: z.string().optional(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  visitReason: z.string().trim().min(2).max(500),
  patientConfirmed: z.literal(true, {
    errorMap: () => ({
      message: 'Patient must explicitly confirm the slot details before createAppointment is called.',
    }),
  }),
});

export const aiGetAppointmentDetailsSchema = z.object({
  appointmentId: z.string().optional(),
  patientPhone: z.string().optional(),
});

export const aiCancelAppointmentSchema = z.object({
  appointmentId: z.string().min(1),
  patientPhone: backendMobileValidator,
  reason: z.string().optional(),
});

export const aiRescheduleAppointmentSchema = z.object({
  appointmentId: z.string().min(1),
  patientPhone: backendMobileValidator,
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  doctorId: z.string().optional(),
});

export const aiTransferToHumanSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  urgency: z.enum(['normal', 'high', 'emergency']).default('normal'),
});

export const aiGetPatientHistorySchema = z.object({
  patientPhone: backendMobileValidator,
});
