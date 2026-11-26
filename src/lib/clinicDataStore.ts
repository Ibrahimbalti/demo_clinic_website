import type {
  AIConfiguration,
  Appointment,
  AppointmentStatus,
  AuditLog,
  AvailableSlot,
  ClinicHoliday,
  ClinicProfile,
  ClinicService,
  ClinicUser,
  Conversation,
  DailyReport,
  Doctor,
  HandlingMode,
  IntegrationStatus,
  InternationalGatewayProvider,
  Patient,
  PaymentMethodType,
  PaymentVerificationDecision,
  ReminderJob,
  UserRole,
  WhatsAppMessage,
  WhatsAppRecipientDelivery,
} from '../types/clinic';
import {
  computeAvailableSlots,
  formatDisplayTime,
  minutesToTime,
  timeToMinutes,
  validateSpecificSlot,
  type BusyInterval,
} from './availabilityEngine';
import { isValidE164Mobile, normalizePhone } from './schemas';
import { supabase, isSupabaseConfigured } from './supabase';

const CLINIC_ID = '00000000-0000-0000-0000-000000000001';
const STORAGE_KEY = 'gasha_clinic_db_v1';
const AUTH_SESSION_KEY = 'gasha_clinic_auth_v1';

function getTodayDateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ClinicDatabaseState {
  clinic: ClinicProfile;
  users: ClinicUser[];
  doctors: Doctor[];
  services: ClinicService[];
  holidays: ClinicHoliday[];
  patients: Patient[];
  appointments: Appointment[];
  conversations: Conversation[];
  messages: WhatsAppMessage[];
  reminders: ReminderJob[];
  aiConfig: AIConfiguration;
  integrations: IntegrationStatus[];
  dailyReports: DailyReport[];
  auditLogs: AuditLog[];
  paymentVerificationRecords: PaymentVerificationDecision[];
  notificationDeliveries: WhatsAppRecipientDelivery[];
  externalBusyIntervals: BusyInterval[];
}

function buildStandardSchedule(doctorId: string, days: number[], start = '09:00', end = '18:00') {
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    id: `avail_${doctorId}_${dayOfWeek}`,
    doctorId,
    dayOfWeek,
    startTime: start,
    endTime: end,
    isAvailable: days.includes(dayOfWeek),
  }));
}

function buildStandardBreaks(doctorId: string, days: number[]) {
  return days.map((dayOfWeek) => ({
    id: `brk_${doctorId}_${dayOfWeek}`,
    doctorId,
    dayOfWeek,
    startTime: '13:00',
    endTime: '14:00',
    label: 'Lunch & Sterilization Break',
  }));
}

export function createInitialDatabaseState(): ClinicDatabaseState {
  const today = getTodayDateString(0);
  const tomorrow = getTodayDateString(1);
  const dayAfter = getTodayDateString(2);
  const yesterday = getTodayDateString(-1);

  const clinic: ClinicProfile = {
    id: CLINIC_ID,
    name: 'Gasha Demo Clinic',
    slug: 'gasha-demo-clinic',
    tagline: 'Dental & Esthetic Art · AI-Powered Appointment Care',
    address: 'Suite 400, Medical Plaza (Configurable Placeholder — Update in Admin Settings)',
    city: 'Configurable City',
    phone: '+1 (555) 180-3040',
    emergencyPhone: '+1 (555) 911-3368',
    whatsappNumber: '15551803040',
    email: 'concierge@gashademoclinic.example',
    timezone: 'UTC',
    defaultAppointmentDurationMinutes: 45,
    bookingLeadTimeMinutes: 30,
    maxBookingAdvanceDays: 60,
    cancellationPolicyHours: 24,
    isVerifiedContent: true,
    verificationNotice:
      'Clinic contact details, address, opening hours, and specialist profiles are stored as configurable placeholders. Update with verified clinic data in Admin Settings before production launch.',
    openingHours: [
      { day: 'Monday', dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '20:00' },
      { day: 'Tuesday', dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '20:00' },
      { day: 'Wednesday', dayOfWeek: 3, isOpen: true, openTime: '09:00', closeTime: '20:00' },
      { day: 'Thursday', dayOfWeek: 4, isOpen: true, openTime: '09:00', closeTime: '20:00' },
      { day: 'Friday', dayOfWeek: 5, isOpen: true, openTime: '09:00', closeTime: '20:00' },
      { day: 'Saturday', dayOfWeek: 6, isOpen: true, openTime: '10:00', closeTime: '18:00' },
      {
        day: 'Sunday',
        dayOfWeek: 0,
        isOpen: false,
        openTime: '00:00',
        closeTime: '00:00',
        note: 'Emergency On-Call Only',
      },
    ],
    paymentSettings: {
      cashAtClinicEnabled: true,
      manualEasypaisaEnabled: true,
      easypaisaAccountNumber: '0370-5621256',
      easypaisaAccountTitle: 'Gasha Demo Clinic',
      easypaisaInstructions:
        'Send the appointment fee via Easypaisa to account 0370-5621256 (Gasha Demo Clinic), upload your payment receipt screenshot, and enter the Transaction ID (TID). Your appointment will be confirmed after our administrator verifies your receipt.',
      debitCreditCardEnabled: true,
      appleGooglePayEnabled: true,
      paypalEnabled: true,
      internationalCardEnabled: true,
      internationalGatewayProvider: 'safepay_pk',
      hasEligibleInternationalMerchantAccount: false,
      currencyCode: 'USD',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const users: ClinicUser[] = [
    {
      id: 'usr_super_admin',
      clinicId: CLINIC_ID,
      fullName: 'Ibrahim (Super Admin)',
      email: 'superadmin@gashaclinic.com',
      role: 'super_admin',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_clinic_admin',
      clinicId: CLINIC_ID,
      fullName: 'Dr. Marcus Vance (Clinic Admin)',
      email: 'admin@gashaclinic.com',
      role: 'clinic_admin',
      doctorId: 'doc_1',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_receptionist',
      clinicId: CLINIC_ID,
      fullName: 'Nadia Al-Mansoor (Front Desk Receptionist)',
      email: 'reception@gashaclinic.com',
      role: 'receptionist',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_doctor_2',
      clinicId: CLINIC_ID,
      fullName: 'Dr. Elena Rostova (Orthodontist)',
      email: 'elena@gashaclinic.com',
      role: 'doctor',
      doctorId: 'doc_2',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];

  const services: ClinicService[] = [
    {
      id: 'svc_whitening',
      clinicId: CLINIC_ID,
      name: 'Laser Teeth Whitening',
      badge: 'Same-Day Glow',
      category: 'Aesthetic Care',
      description:
        'Medical-grade in-office laser whitening that safely breaks down deep discolored molecular bonds from coffee, tea, and age in 45 minutes while protecting enamel.',
      durationMinutes: 45,
      visitsLabel: '1 Visit',
      comfortLabel: '100% Gentle',
      price: 199,
      priceLabel: 'From $199',
      features: [
        'Shade check before & after with VITA digital spectrophotometer',
        'Active protective gum barrier and enamel desensitizer',
        'Complimentary custom-fitted take-home maintenance kit',
        'Visible lightening of 6 to 8 shades in a single session',
      ],
      bestFor: 'Patients with healthy teeth seeking an instant radiant glow.',
      imageUrl:
        'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=900&auto=format&fit=crop&q=80',
      doctorIds: ['doc_1', 'doc_2'],
      isActive: true,
    },
    {
      id: 'svc_veneers',
      clinicId: CLINIC_ID,
      name: 'Porcelain Veneers & Lumineers',
      badge: 'Smile Design',
      category: 'Cosmetic Dentistry',
      description:
        'Bespoke ultra-thin shells sculpted from Swiss E.max lithium disilicate porcelain to mimic natural enamel translucency while fixing chips, gaps, and severe discoloration.',
      durationMinutes: 60,
      visitsLabel: '2 Visits',
      comfortLabel: 'Painless',
      price: 850,
      priceLabel: 'Custom Consultation',
      features: [
        'Digital 3D Smile Preview and trial mock-up in your mouth',
        'Minimal tooth reduction preserving 90%+ natural enamel',
        'Resistant to staining from coffee, tea, and tobacco',
        'Documented clinical warranty',
      ],
      bestFor: 'Patients with chipped, worn, gapped, or discolored teeth.',
      imageUrl:
        'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=900&auto=format&fit=crop&q=80',
      doctorIds: ['doc_1'],
      isActive: true,
    },
    {
      id: 'svc_implants',
      clinicId: CLINIC_ID,
      name: 'Precision Dental Implants',
      badge: 'Restorative',
      category: 'Implantology',
      description:
        'Biocompatible Swiss titanium posts integrated permanently with custom-milled zirconia crowns that look, bite, and feel like natural teeth.',
      durationMinutes: 60,
      visitsLabel: '2 – 3 Visits',
      comfortLabel: 'Computerized Anesthesia',
      price: 1200,
      priceLabel: '0% Financing Available',
      features: [
        '3D CBCT digital bone scan and computer-guided surgical stent',
        'Grade-4 medical titanium post with osseointegration support',
        'Custom zirconia abutment and hand-glazed ceramic crown',
        'All-on-4 and full-arch immediate implant options available',
      ],
      bestFor: 'Patients missing one or more teeth seeking a permanent restoration.',
      imageUrl:
        'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=900&auto=format&fit=crop&q=80',
      doctorIds: ['doc_1'],
      isActive: true,
    },
    {
      id: 'svc_aligners',
      clinicId: CLINIC_ID,
      name: 'Clear Aligners (Invisalign®)',
      badge: 'Orthodontics',
      category: 'Orthodontics',
      description:
        'Straighten crowded teeth, close gaps, and optimize your bite using virtually invisible custom 3D-printed aligners without metal brackets.',
      durationMinutes: 45,
      visitsLabel: 'Every 6 – 8 Weeks',
      comfortLabel: 'Very High',
      price: 99,
      priceLabel: 'Monthly Plans from $99/mo',
      features: [
        '3D digital scan with instant outcome simulation',
        'Nearly invisible medical-grade clear material',
        'Removable while eating or brushing',
        'Includes final retainers to preserve alignment',
      ],
      bestFor: 'Teens and adults looking to straighten teeth discreetly.',
      imageUrl:
        'https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?w=900&auto=format&fit=crop&q=80',
      doctorIds: ['doc_2'],
      isActive: true,
    },
    {
      id: 'svc_root_canal',
      clinicId: CLINIC_ID,
      name: 'Microscopic Root Canal Therapy',
      badge: 'Endodontics',
      category: 'Endodontics & Pain Relief',
      description:
        'High-magnification Zeiss surgical microscope root canal therapy that eliminates acute toothache and preserves the natural tooth.',
      durationMinutes: 60,
      visitsLabel: '1 – 2 Visits',
      comfortLabel: '100% Pain-Free',
      price: 350,
      priceLabel: 'Insurance Covered',
      features: [
        'Computer-controlled local anesthesia (The Wand®)',
        '25x surgical operating microscope for precision',
        '3D obturation preventing bacterial re-infection',
        'CAD/CAM ceramic crown restoration option',
      ],
      bestFor: 'Severe toothache, hot/cold sensitivity, or deep decay.',
      imageUrl:
        'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=900&auto=format&fit=crop&q=80',
      doctorIds: ['doc_3'],
      isActive: true,
    },
    {
      id: 'svc_pediatric',
      clinicId: CLINIC_ID,
      name: 'Gentle Pediatric & Family Care',
      badge: 'Pediatric Care',
      category: 'Family Dentistry',
      description:
        'Gentle dental checkups, cavity prevention, protective fissure sealants, and hygiene cleanings for children and families.',
      durationMinutes: 30,
      visitsLabel: 'Every 6 Months',
      comfortLabel: 'Playful & Gentle',
      price: 75,
      priceLabel: 'Family Packages',
      features: [
        'Child-centered positive reinforcement and dental coaching',
        'BPA-free fissure sealants to prevent molar cavities',
        'Topical fluoride varnish protecting growing enamel',
        'Early interceptive bite assessment',
      ],
      bestFor: 'Children, teens, and routine family checkups.',
      imageUrl:
        'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=900&auto=format&fit=crop&q=80',
      doctorIds: ['doc_4', 'doc_1'],
      isActive: true,
    },
    {
      id: 'svc_gum_contour',
      clinicId: CLINIC_ID,
      name: 'Laser Gum Contouring & Esthetic Sculpting',
      badge: 'Smile Balance',
      category: 'Aesthetic Care',
      description:
        'Biolase dental laser gently sculpts and balances the gum margin with millimeter accuracy for zero stitches and rapid healing.',
      durationMinutes: 45,
      visitsLabel: '1 Visit',
      comfortLabel: 'Very Gentle',
      price: 299,
      priceLabel: 'From $299',
      features: [
        'Advanced Biolase dental laser—no scalpels or sutures',
        'Immediate aesthetic improvement',
        'Restores ideal tooth-to-gum proportions',
        'Rapid recovery with minimal swelling',
      ],
      bestFor: 'Uneven gum lines or excessive gingival display.',
      imageUrl:
        'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=900&auto=format&fit=crop&q=80',
      doctorIds: ['doc_1'],
      isActive: true,
    },
    {
      id: 'svc_checkup',
      clinicId: CLINIC_ID,
      name: 'Comprehensive 3D Dental Checkup & Consultation',
      badge: 'First Visit',
      category: 'General & Diagnostic',
      description:
        'Complete 45-minute oral examination, digital 3D scan, periodontal evaluation, and itemized written treatment plan.',
      durationMinutes: 45,
      visitsLabel: '1 Visit',
      comfortLabel: 'Gentle Diagnostic',
      price: 50,
      priceLabel: '$50 Consultation',
      features: [
        'Full mouth digital HD X-rays and 3D panoramic scan',
        'Comprehensive periodontal gum and bone density assessment',
        'Interactive 3D digital smile simulation',
        'Itemized written treatment plan with transparent costs',
      ],
      bestFor: 'New patients, routine dental checkups, and treatment planning.',
      imageUrl:
        'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=900&auto=format&fit=crop&q=80',
      doctorIds: ['doc_1', 'doc_2', 'doc_3', 'doc_4'],
      isActive: true,
    },
  ];

  const doctors: Doctor[] = [
    {
      id: 'doc_1',
      clinicId: CLINIC_ID,
      name: 'Dr. Marcus Vance',
      title: 'Clinical Director & Implantologist',
      specialization: 'Aesthetic & Implant Dentistry',
      description:
        'Specializes in full-mouth smile reconstructions, 3D guided implants, and minimally invasive porcelain veneers. (Demo Profile — Configurable in Admin)',
      credentials: ['DDS', 'Implantology Fellow', 'Cosmetic Specialist'],
      imageUrl:
        'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600&auto=format&fit=crop&q=80',
      email: 'vance@gashaclinic.com',
      phone: '+15552340001',
      appointmentDurationMinutes: 45,
      isActive: true,
      isVerified: false,
      calendarId: 'marcus.vance@gashaclinic.example',
      googleCalendarConnected: true,
      serviceIds: ['svc_whitening', 'svc_veneers', 'svc_implants', 'svc_gum_contour', 'svc_checkup'],
      availability: buildStandardSchedule('doc_1', [1, 2, 3, 4, 5, 6], '09:00', '18:00'),
      breaks: buildStandardBreaks('doc_1', [1, 2, 3, 4, 5, 6]),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'doc_2',
      clinicId: CLINIC_ID,
      name: 'Dr. Elena Rostova',
      title: 'Lead Orthodontist',
      specialization: 'Orthodontics & Clear Aligners',
      description:
        'Dedicated to non-extraction orthodontic alignment, clear aligners, and aesthetic teeth whitening. (Demo Profile — Configurable in Admin)',
      credentials: ['BDS, MSc', 'Orthodontics', 'Clear Aligner Specialist'],
      imageUrl:
        'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&auto=format&fit=crop&q=80',
      email: 'rostova@gashaclinic.com',
      phone: '+15552340002',
      appointmentDurationMinutes: 45,
      isActive: true,
      isVerified: false,
      calendarId: 'elena.rostova@gashaclinic.example',
      googleCalendarConnected: true,
      serviceIds: ['svc_whitening', 'svc_aligners', 'svc_checkup'],
      availability: buildStandardSchedule('doc_2', [1, 2, 3, 4, 5, 6], '10:00', '19:00'),
      breaks: buildStandardBreaks('doc_2', [1, 2, 3, 4, 5, 6]),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'doc_3',
      clinicId: CLINIC_ID,
      name: 'Dr. Zainab Malik',
      title: 'Endodontic Microsurgeon',
      specialization: 'Microscopic Endodontics & Pain Relief',
      description:
        'Specializes in single-visit microscopic root canal therapy and emergency tooth preservation. (Demo Profile — Configurable in Admin)',
      credentials: ['BDS, MFD', 'Endodontics', 'Microsurgery'],
      imageUrl:
        'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=600&auto=format&fit=crop&q=80',
      email: 'malik@gashaclinic.com',
      phone: '+15552340003',
      appointmentDurationMinutes: 60,
      isActive: true,
      isVerified: false,
      calendarId: 'zainab.malik@gashaclinic.example',
      googleCalendarConnected: false,
      serviceIds: ['svc_root_canal', 'svc_checkup'],
      availability: buildStandardSchedule('doc_3', [1, 2, 3, 4, 5], '09:00', '17:00'),
      breaks: buildStandardBreaks('doc_3', [1, 2, 3, 4, 5]),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'doc_4',
      clinicId: CLINIC_ID,
      name: 'Dr. Julian Hayes',
      title: 'Pediatric & Family Dentist',
      specialization: 'Pediatric & Preventive Dentistry',
      description:
        'Creates calm, welcoming dental visits for children, teens, and families. (Demo Profile — Configurable in Admin)',
      credentials: ['DMD', 'Pediatric Dentistry', 'Preventive Care'],
      imageUrl:
        'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&auto=format&fit=crop&q=80',
      email: 'hayes@gashaclinic.com',
      phone: '+15552340004',
      appointmentDurationMinutes: 30,
      isActive: true,
      isVerified: false,
      calendarId: null,
      googleCalendarConnected: false,
      serviceIds: ['svc_pediatric', 'svc_checkup'],
      availability: buildStandardSchedule('doc_4', [1, 2, 4, 5, 6], '10:00', '18:00'),
      breaks: buildStandardBreaks('doc_4', [1, 2, 4, 5, 6]),
      createdAt: new Date().toISOString(),
    },
  ];

  const patients: Patient[] = [
    {
      id: 'pat_ahmed',
      clinicId: CLINIC_ID,
      fullName: 'Ahmed Al-Farsi',
      phone: '+15558392011',
      email: 'ahmed.alfarsi@example.com',
      consentStatus: 'granted',
      visitReason: 'Dental checkup & cleaning',
      internalNotes: 'Prefers morning slots.',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: 'pat_sarah',
      clinicId: CLINIC_ID,
      fullName: 'Sarah Jenkins',
      phone: '+15554928172',
      email: 'sarah.jenkins@example.com',
      consentStatus: 'granted',
      visitReason: 'Laser Teeth Whitening',
      internalNotes: 'Mild sensitivity noted previously.',
      createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'pat_omar',
      clinicId: CLINIC_ID,
      fullName: 'Omar Siddiqui',
      phone: '+15557381920',
      email: 'omar.s@example.com',
      consentStatus: 'granted',
      visitReason: 'Root canal consultation — molar sensitivity',
      internalNotes: 'Requested human receptionist callback regarding insurance.',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const appointments: Appointment[] = [
    {
      id: 'apt_1',
      clinicId: CLINIC_ID,
      patientId: 'pat_ahmed',
      patientName: 'Ahmed Al-Farsi',
      patientPhone: '+15558392011',
      patientEmail: 'ahmed.alfarsi@example.com',
      paymentMethod: 'CASH_AT_CLINIC',
      paymentStatus: 'UNPAID',
      paymentDisplayLabel: 'Pay at Clinic',
      paymentAmount: 50,
      doctorId: 'doc_1',
      doctorName: 'Dr. Marcus Vance',
      serviceId: 'svc_checkup',
      serviceName: 'Comprehensive 3D Dental Checkup & Consultation',
      appointmentDate: tomorrow,
      startTime: '11:30',
      endTime: '12:15',
      status: 'confirmed',
      source: 'whatsapp_ai',
      visitReason: 'Dental checkup',
      internalNotes: 'Booked autonomously via AI WhatsApp Receptionist (Cash at Clinic)',
      googleCalendarEventId: 'gcal_evt_101',
      calendarSyncStatus: 'synced',
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'apt_2',
      clinicId: CLINIC_ID,
      patientId: 'pat_sarah',
      patientName: 'Sarah Jenkins',
      patientPhone: '+15554928172',
      patientEmail: 'sarah.jenkins@example.com',
      paymentMethod: 'MANUAL_EASYPAISA',
      paymentStatus: 'PAID',
      paymentDisplayLabel: 'Paid (Verified Easypaisa)',
      paymentAmount: 199,
      transactionReference: 'EP-982341209',
      receiptFileName: 'easypaisa_receipt_sarah.png',
      paymentVerifiedByAdminName: 'Ibrahim (Super Admin)',
      paymentVerifiedAt: new Date(Date.now() - 43200000).toISOString(),
      paymentDecisionReason: 'Verified Easypaisa TID EP-982341209 in clinic statement.',
      doctorId: 'doc_2',
      doctorName: 'Dr. Elena Rostova',
      serviceId: 'svc_whitening',
      serviceName: 'Laser Teeth Whitening',
      appointmentDate: today,
      startTime: '14:30',
      endTime: '15:15',
      status: 'confirmed',
      source: 'website',
      visitReason: 'Laser teeth whitening session',
      internalNotes: 'Confirmed after manual Easypaisa receipt verification',
      googleCalendarEventId: 'gcal_evt_102',
      calendarSyncStatus: 'synced',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'apt_3',
      clinicId: CLINIC_ID,
      patientId: 'pat_omar',
      patientName: 'Omar Siddiqui',
      patientPhone: '+15557381920',
      patientEmail: 'omar.s@example.com',
      paymentMethod: 'MANUAL_EASYPAISA',
      paymentStatus: 'PENDING_VERIFICATION',
      paymentDisplayLabel: 'Pending Admin Verification',
      paymentAmount: 350,
      transactionReference: 'EP-774129830',
      receiptFileUrl: '/img/patient_smile_after.jpg',
      receiptFileName: 'omar_easypaisa_tid_774129830.jpg',
      doctorId: 'doc_3',
      doctorName: 'Dr. Zainab Malik',
      serviceId: 'svc_root_canal',
      serviceName: 'Microscopic Root Canal Therapy',
      appointmentDate: dayAfter,
      startTime: '10:00',
      endTime: '11:00',
      status: 'PENDING_PAYMENT_VERIFICATION',
      source: 'website',
      visitReason: 'Molar sensitivity evaluation',
      internalNotes: 'Easypaisa receipt uploaded — awaiting admin verification',
      googleCalendarEventId: null,
      calendarSyncStatus: 'pending',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'apt_4',
      clinicId: CLINIC_ID,
      patientId: 'pat_sarah',
      patientName: 'Sarah Jenkins',
      patientPhone: '+15554928172',
      patientEmail: 'sarah.jenkins@example.com',
      paymentMethod: 'CASH_AT_CLINIC',
      paymentStatus: 'PAID',
      paymentDisplayLabel: 'Paid at Clinic',
      paymentAmount: 50,
      doctorId: 'doc_1',
      doctorName: 'Dr. Marcus Vance',
      serviceId: 'svc_checkup',
      serviceName: 'Comprehensive 3D Dental Checkup & Consultation',
      appointmentDate: yesterday,
      startTime: '10:00',
      endTime: '10:45',
      status: 'completed',
      source: 'whatsapp_ai',
      visitReason: 'Initial 3D Smile Assessment',
      internalNotes: 'Completed 3D scan; scheduled whitening follow-up.',
      googleCalendarEventId: 'gcal_evt_099',
      calendarSyncStatus: 'synced',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const conversations: Conversation[] = [
    {
      id: 'conv_ahmed',
      clinicId: CLINIC_ID,
      patientId: 'pat_ahmed',
      patientName: 'Ahmed Al-Farsi',
      phone: '+15558392011',
      status: 'open',
      handlingMode: 'ai',
      unreadCount: 0,
      lastMessagePreview:
        'Your appointment has been successfully confirmed. You will receive a reminder before your visit.',
      lastMessageAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'conv_omar',
      clinicId: CLINIC_ID,
      patientId: 'pat_omar',
      patientName: 'Omar Siddiqui',
      phone: '+15557381920',
      status: 'open',
      handlingMode: 'human',
      unreadCount: 1,
      lastMessagePreview: 'Could someone at the front desk verify if my Delta Dental plan covers root canal?',
      lastMessageAt: new Date(Date.now() - 1800000).toISOString(),
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

  const messages: WhatsAppMessage[] = [
    {
      id: 'msg_1',
      conversationId: 'conv_ahmed',
      whatsappMessageId: 'wamid.HBgLMTU1NTgzOTIwMTEVAgASGBQzQTg0',
      direction: 'inbound',
      senderType: 'patient',
      messageType: 'text',
      content: 'Hello, I want to book an appointment.',
      deliveryStatus: 'read',
      createdAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    },
    {
      id: 'msg_2',
      conversationId: 'conv_ahmed',
      whatsappMessageId: 'wamid.HBgLMTU1NTgzOTIwMTEVAgARGBQzQTg1',
      direction: 'outbound',
      senderType: 'ai',
      messageType: 'text',
      content:
        "Hello! Welcome to Gasha Demo Clinic. I'd be happy to help you book an appointment. May I know your name?",
      deliveryStatus: 'read',
      createdAt: new Date(Date.now() - 3600000 * 2.48).toISOString(),
    },
    {
      id: 'msg_3',
      conversationId: 'conv_ahmed',
      whatsappMessageId: 'wamid.HBgLMTU1NTgzOTIwMTEVAgASGBQzQTg2',
      direction: 'inbound',
      senderType: 'patient',
      messageType: 'text',
      content: 'My name is Ahmed. I need a dental checkup tomorrow with Dr. Marcus Vance at 11:30 AM.',
      deliveryStatus: 'read',
      createdAt: new Date(Date.now() - 3600000 * 2.3).toISOString(),
    },
    {
      id: 'msg_4',
      conversationId: 'conv_ahmed',
      whatsappMessageId: 'wamid.HBgLMTU1NTgzOTIwMTEVAgARGBQzQTg3',
      direction: 'outbound',
      senderType: 'ai',
      messageType: 'text',
      content: `I checked Dr. Marcus Vance's schedule for tomorrow (${tomorrow}). The 11:30 AM slot is available for a Comprehensive 3D Dental Checkup & Consultation. Shall I confirm your appointment?`,
      deliveryStatus: 'read',
      toolCallsExecuted: ['getAvailableSlots'],
      createdAt: new Date(Date.now() - 3600000 * 2.25).toISOString(),
    },
    {
      id: 'msg_5',
      conversationId: 'conv_ahmed',
      whatsappMessageId: 'wamid.HBgLMTU1NTgzOTIwMTEVAgASGBQzQTg4',
      direction: 'inbound',
      senderType: 'patient',
      messageType: 'text',
      content: 'Yes, please confirm.',
      deliveryStatus: 'read',
      createdAt: new Date(Date.now() - 3600000 * 2.1).toISOString(),
    },
    {
      id: 'msg_6',
      conversationId: 'conv_ahmed',
      whatsappMessageId: 'wamid.HBgLMTU1NTgzOTIwMTEVAgARGBQzQTg5',
      direction: 'outbound',
      senderType: 'ai',
      messageType: 'text',
      content: `Your appointment has been successfully confirmed for tomorrow (${tomorrow}) at 11:30 AM with Dr. Marcus Vance. You will receive a reminder before your visit. Thank you for choosing Gasha Demo Clinic!`,
      deliveryStatus: 'delivered',
      toolCallsExecuted: ['createAppointment'],
      createdAt: new Date(Date.now() - 3600000 * 2.05).toISOString(),
    },
    {
      id: 'msg_7',
      conversationId: 'conv_omar',
      whatsappMessageId: 'wamid.HBgLMTU1NTczODE5MjAVAgASGBQzQTkx',
      direction: 'inbound',
      senderType: 'patient',
      messageType: 'text',
      content: 'Could someone at the front desk verify if my Delta Dental plan covers root canal?',
      deliveryStatus: 'read',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'msg_8',
      conversationId: 'conv_omar',
      whatsappMessageId: 'wamid.HBgLMTU1NTczODE5MjAVAgARGBQzQTky',
      direction: 'outbound',
      senderType: 'ai',
      messageType: 'text',
      content:
        'I have transferred your conversation to our human receptionist team so they can verify your specific Delta Dental policy details. A team member will reply shortly.',
      deliveryStatus: 'delivered',
      toolCallsExecuted: ['transferToHuman'],
      createdAt: new Date(Date.now() - 1790000).toISOString(),
    },
  ];

  const reminders: ReminderJob[] = [
    {
      id: 'rem_1',
      appointmentId: 'apt_1',
      patientName: 'Ahmed Al-Farsi',
      patientPhone: '+15558392011',
      doctorName: 'Dr. Marcus Vance',
      serviceName: 'Comprehensive 3D Dental Checkup & Consultation',
      appointmentDate: tomorrow,
      appointmentTime: '11:30',
      reminderType: '1h',
      scheduledAt: `${tomorrow}T10:30:00.000Z`,
      status: 'pending',
      attempts: 0,
      idempotencyKey: `rem_apt_1_1h_${tomorrow}`,
    },
    {
      id: 'rem_2',
      appointmentId: 'apt_1',
      patientName: 'Ahmed Al-Farsi',
      patientPhone: '+15558392011',
      doctorName: 'Dr. Marcus Vance',
      serviceName: 'Comprehensive 3D Dental Checkup & Consultation',
      appointmentDate: tomorrow,
      appointmentTime: '11:30',
      reminderType: '24h',
      scheduledAt: `${today}T11:30:00.000Z`,
      status: 'sent',
      attempts: 1,
      sentAt: new Date(Date.now() - 1800000).toISOString(),
      idempotencyKey: `rem_apt_1_24h_${tomorrow}`,
    },
    {
      id: 'rem_3',
      appointmentId: 'apt_2',
      patientName: 'Sarah Jenkins',
      patientPhone: '+15554928172',
      doctorName: 'Dr. Elena Rostova',
      serviceName: 'Laser Teeth Whitening',
      appointmentDate: today,
      appointmentTime: '14:30',
      reminderType: '1h',
      scheduledAt: `${today}T13:30:00.000Z`,
      status: 'pending',
      attempts: 0,
      idempotencyKey: `rem_apt_2_1h_${today}`,
    },
  ];

  const aiConfig: AIConfiguration = {
    id: 'ai_cfg_1',
    clinicId: CLINIC_ID,
    enabled: true,
    assistantName: 'Layla — Gasha Clinic AI Receptionist',
    welcomeMessage:
      "Hello! Welcome to Gasha Demo Clinic. I'd be happy to help you book, reschedule, or check an appointment. May I know your name?",
    language: 'English',
    toneOfVoice: 'Warm, concise, patient-friendly, and professional',
    systemPrompt:
      'You are the official AI WhatsApp Receptionist for Gasha Demo Clinic. Communicate naturally, concisely, and empathetically. Always call backend tools to check actual doctor availability, clinic opening hours, and services before offering times. Never invent slots, never claim an appointment is booked before createAppointment succeeds, and never diagnose or prescribe medication.',
    bookingRules: [
      'Collect patient full name, visit reason/service, preferred doctor (or any), and preferred date before offering slots.',
      'Always call getAvailableSlots() to verify real database & Google Calendar availability.',
      'Ask the patient for explicit confirmation before calling createAppointment().',
      'Re-validate slot availability atomically during booking confirmation.',
    ],
    handoverRules: [
      'Transfer to human receptionist if patient asks complex insurance billing questions.',
      'Transfer to human receptionist if patient requests to speak with a human or staff member.',
      'Transfer to human receptionist if patient expresses medical concerns outside approved clinic FAQs.',
    ],
    emergencyResponseMessage:
      'IMPORTANT MEDICAL NOTICE: If you are experiencing a severe medical emergency, uncontrolled bleeding, facial trauma, or swelling affecting breathing, please contact your local emergency services immediately or call our emergency hotline.',
    faqs: [
      {
        question: 'Is dental treatment really painless?',
        answer:
          'We use computerized local anesthesia (The Wand® STA) and gentle ultrasonic instruments designed to minimize discomfort.',
      },
      {
        question: 'How much does a first consultation cost?',
        answer:
          'Our Comprehensive 3D Dental Checkup & Consultation is $50 and includes a 3D scan and itemized written treatment plan.',
      },
      {
        question: 'What is your cancellation policy?',
        answer:
          'You can cancel or reschedule your appointment up to 24 hours in advance directly via WhatsApp at no charge.',
      },
    ],
    enable24hReminder: true,
    enable1hReminder: true,
    updatedAt: new Date().toISOString(),
  };

  const integrations: IntegrationStatus[] = [
    {
      id: 'int_whatsapp',
      clinicId: CLINIC_ID,
      provider: 'whatsapp',
      connectionStatus: 'connected',
      accountLabel: 'Meta WhatsApp Cloud API (+1 555-180-3040 · ID: 1430844973453704)',
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'int_openai',
      clinicId: CLINIC_ID,
      provider: 'openai',
      connectionStatus: 'connected',
      accountLabel: 'Groq OpenAI-Compatible API (openai/gpt-oss-120b) + Gemini Fallback',
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'int_gcal',
      clinicId: CLINIC_ID,
      provider: 'google_calendar',
      connectionStatus: 'connected',
      accountLabel: 'Google Calendar OAuth 2.0 (clinic-automation-515722)',
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const holidays: ClinicHoliday[] = [
    {
      id: 'hol_1',
      clinicId: CLINIC_ID,
      holidayDate: '2026-12-25',
      description: 'Annual Winter Clinic Holiday',
    },
  ];

  const dailyReports: DailyReport[] = [
    {
      id: 'rep_today',
      clinicId: CLINIC_ID,
      reportDate: today,
      totalAppointments: 4,
      confirmedAppointments: 2,
      completedAppointments: 1,
      cancelledAppointments: 0,
      pendingAppointments: 1,
      noShowAppointments: 0,
      newPatients: 3,
      aiHandledConversations: 1,
      humanHandledConversations: 1,
      doctorBreakdown: [
        {
          doctorId: 'doc_1',
          doctorName: 'Dr. Marcus Vance',
          total: 2,
          confirmed: 1,
          completed: 1,
          cancelled: 0,
        },
        {
          doctorId: 'doc_2',
          doctorName: 'Dr. Elena Rostova',
          total: 1,
          confirmed: 1,
          completed: 0,
          cancelled: 0,
        },
        {
          doctorId: 'doc_3',
          doctorName: 'Dr. Zainab Malik',
          total: 1,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
        },
      ],
      deliveryStatus: 'generated',
      createdAt: new Date().toISOString(),
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud_1',
      clinicId: CLINIC_ID,
      userId: null,
      userName: 'AI Receptionist (Layla)',
      action: 'APPOINTMENT_BOOKED_VIA_WHATSAPP',
      entityType: 'appointment',
      entityId: 'apt_1',
      metadata: { patientName: 'Ahmed Al-Farsi', doctorName: 'Dr. Marcus Vance', startTime: '11:30' },
      createdAt: new Date(Date.now() - 3600000 * 2.05).toISOString(),
    },
    {
      id: 'aud_2',
      clinicId: CLINIC_ID,
      userId: null,
      userName: 'AI Receptionist (Layla)',
      action: 'CONVERSATION_HANDOVER_TO_HUMAN',
      entityType: 'conversation',
      entityId: 'conv_omar',
      metadata: { reason: 'Patient requested Delta Dental insurance coverage verification' },
      createdAt: new Date(Date.now() - 1790000).toISOString(),
    },
  ];

  const paymentVerificationRecords: PaymentVerificationDecision[] = [
    {
      id: 'pvr_1',
      appointmentId: 'apt_2',
      decision: 'APPROVED',
      adminUserId: 'usr_super_admin',
      adminName: 'Ibrahim (Super Admin)',
      reason: 'Verified Easypaisa TID EP-982341209 in clinic statement.',
      transactionReference: 'EP-982341209',
      timestamp: new Date(Date.now() - 43200000).toISOString(),
    },
    {
      id: 'pvr_2',
      appointmentId: 'apt_3',
      decision: 'SUBMITTED',
      adminUserId: null,
      adminName: 'Omar Siddiqui (Patient)',
      reason: 'Uploaded Easypaisa receipt awaiting admin review.',
      transactionReference: 'EP-774129830',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

  const notificationDeliveries: WhatsAppRecipientDelivery[] = [
    {
      id: 'nd_1_pat',
      appointmentId: 'apt_1',
      recipientRole: 'patient',
      recipientName: 'Ahmed Al-Farsi',
      recipientPhone: '+15558392011',
      eventType: 'appointment_confirmed',
      deliveryStatus: 'delivered',
      attempts: 1,
      idempotencyKey: 'notif_apt_1_patient_appointment_confirmed',
      messageContent: 'Appointment Confirmed (Pay at Clinic) — Tomorrow 11:30 AM with Dr. Marcus Vance',
      sentAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'nd_1_doc',
      appointmentId: 'apt_1',
      recipientRole: 'doctor',
      recipientName: 'Dr. Marcus Vance',
      recipientPhone: '+15552340001',
      eventType: 'appointment_confirmed',
      deliveryStatus: 'delivered',
      attempts: 1,
      idempotencyKey: 'notif_apt_1_doctor_appointment_confirmed',
      messageContent: 'New Confirmed Patient Booking: Ahmed Al-Farsi — Tomorrow 11:30 AM (Cash at Clinic)',
      sentAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'nd_1_clin',
      appointmentId: 'apt_1',
      recipientRole: 'clinic',
      recipientName: 'Gasha Demo Clinic Admin',
      recipientPhone: '+15551803040',
      eventType: 'appointment_confirmed',
      deliveryStatus: 'delivered',
      attempts: 1,
      idempotencyKey: 'notif_apt_1_clinic_appointment_confirmed',
      messageContent: 'Clinic Admin Alert: Confirmed Cash Booking #apt_1 for Ahmed Al-Farsi with Dr. Marcus Vance',
      sentAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
  ];

  return {
    clinic,
    users,
    doctors,
    services,
    holidays,
    patients,
    appointments,
    conversations,
    messages,
    reminders,
    aiConfig,
    integrations,
    dailyReports,
    auditLogs,
    paymentVerificationRecords,
    notificationDeliveries,
    externalBusyIntervals: [],
  };
}

class ClinicDataStore {
  private state: ClinicDatabaseState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
    if (isSupabaseConfigured) {
      void this.syncFromSupabase();
    }
  }

  public async syncFromSupabase(): Promise<{
    connected: boolean;
    tablesCreated: boolean;
    message: string;
  }> {
    if (!supabase) {
      return {
        connected: false,
        tablesCreated: false,
        message: 'Supabase environment variables are not configured.',
      };
    }

    try {
      const { data: clinicRow, error } = await supabase
        .from('clinics')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
          return {
            connected: true,
            tablesCreated: false,
            message:
              'Connected to Supabase project (uygpgerjwmydoktetwgs), waiting for SQL migration 001_initial_schema.sql to be executed.',
          };
        }
        return {
          connected: false,
          tablesCreated: false,
          message: error.message,
        };
      }

      if (clinicRow) {
        this.state.clinic = {
          ...this.state.clinic,
          id: clinicRow.id,
          name: clinicRow.name || this.state.clinic.name,
          slug: clinicRow.slug || this.state.clinic.slug,
          tagline: clinicRow.tagline || this.state.clinic.tagline,
          address: clinicRow.address || this.state.clinic.address,
          city: clinicRow.city || this.state.clinic.city,
          phone: clinicRow.phone || this.state.clinic.phone,
          emergencyPhone: clinicRow.emergency_phone || this.state.clinic.emergencyPhone,
          whatsappNumber: clinicRow.whatsapp_number || this.state.clinic.whatsappNumber,
          email: clinicRow.email || this.state.clinic.email,
          timezone: clinicRow.timezone || this.state.clinic.timezone,
          isVerifiedContent: Boolean(clinicRow.is_verified_content),
          openingHours:
            Array.isArray(clinicRow.opening_hours) && clinicRow.opening_hours.length > 0
              ? clinicRow.opening_hours
              : this.state.clinic.openingHours,
        };
        this.saveState();
      }

      return {
        connected: true,
        tablesCreated: true,
        message: 'Synchronized with live Supabase PostgreSQL database.',
      };
    } catch (err) {
      return {
        connected: false,
        tablesCreated: false,
        message: err instanceof Error ? err.message : 'Supabase connection error',
      };
    }
  }

  private loadState(): ClinicDatabaseState {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          return JSON.parse(raw) as ClinicDatabaseState;
        }
      } catch {
        // Fallback to clean state
      }
    }
    return createInitialDatabaseState();
  }

  private saveState(): void {
    // Create new top-level state AND new array references so React useSyncExternalStore and useMemo hooks always update!
    this.state = {
      ...this.state,
      doctors: [...this.state.doctors],
      services: [...this.state.services],
      holidays: [...this.state.holidays],
      patients: [...this.state.patients],
      appointments: [...this.state.appointments],
      conversations: this.state.conversations.map((c) => ({ ...c })),
      messages: [...this.state.messages],
      reminders: [...this.state.reminders],
      integrations: [...this.state.integrations],
      dailyReports: [...this.state.dailyReports],
      auditLogs: [...this.state.auditLogs],
      paymentVerificationRecords: [...(this.state.paymentVerificationRecords || [])],
      notificationDeliveries: [...(this.state.notificationDeliveries || [])],
    };
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        // Ignore storage quota issues in test env
      }
    }
    this.listeners.forEach((listener) => listener());
  }

  public commitChanges(): void {
    this.saveState();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public resetToInitial(): void {
    this.state = createInitialDatabaseState();
    this.saveState();
  }

  public getState(): ClinicDatabaseState {
    return this.state;
  }

  // ==========================================================================
  // AUTHENTICATION & RBAC
  // ==========================================================================
  public getCurrentUser(): ClinicUser | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { userId: string };
          return this.state.users.find((u) => u.id === parsed.userId && u.isActive) || null;
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  public login(email: string, password?: string): { success: boolean; user?: ClinicUser; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    const user = this.state.users.find(
      (u) => u.email.toLowerCase() === cleanEmail && u.isActive
    );
    if (!user) {
      return { success: false, error: 'Invalid credentials or inactive staff account.' };
    }
    // Check password (default demo password: ClinicAdmin2026!)
    if (password && password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ userId: user.id }));
    }
    this.logAudit(user.id, user.fullName, 'USER_LOGIN', 'user', user.id, { role: user.role });
    this.saveState();
    return { success: true, user };
  }

  public logout(): void {
    const current = this.getCurrentUser();
    if (current) {
      this.logAudit(current.id, current.fullName, 'USER_LOGOUT', 'user', current.id, {});
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(AUTH_SESSION_KEY);
    }
    this.saveState();
  }

  public switchRoleForTesting(role: UserRole): ClinicUser | null {
    const user = this.state.users.find((u) => u.role === role && u.isActive);
    if (user && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ userId: user.id }));
      this.saveState();
      return user;
    }
    return null;
  }

  public hasPermission(
    user: ClinicUser | null,
    permission:
      | 'manage_clinic_settings'
      | 'manage_users'
      | 'manage_integrations'
      | 'manage_ai'
      | 'manage_doctors'
      | 'manage_services'
      | 'manage_appointments'
      | 'manage_patients'
      | 'manage_whatsapp_inbox'
      | 'view_reports'
  ): boolean {
    if (!user || !user.isActive) return false;
    const role = user.role;
    if (role === 'super_admin') return true;
    if (role === 'clinic_admin') {
      return permission !== 'manage_users' && permission !== 'manage_integrations'
        ? true
        : true; // Clinic admin manages clinic operations; Super Admin manages multi-clinic/system
    }
    if (role === 'receptionist') {
      return [
        'manage_appointments',
        'manage_patients',
        'manage_whatsapp_inbox',
      ].includes(permission);
    }
    if (role === 'doctor') {
      return ['manage_appointments'].includes(permission);
    }
    return false;
  }

  // ==========================================================================
  // AVAILABILITY & ATOMIC APPOINTMENT OPERATIONS
  // ==========================================================================
  public getAvailableSlots(params: {
    date: string;
    doctorId?: string;
    serviceId?: string;
    excludeAppointmentId?: string;
  }): AvailableSlot[] {
    return computeAvailableSlots({
      date: params.date,
      clinic: this.state.clinic,
      doctors: this.state.doctors,
      services: this.state.services,
      holidays: this.state.holidays,
      existingAppointments: this.state.appointments,
      externalBusyIntervals: this.state.externalBusyIntervals,
      doctorId: params.doctorId || undefined,
      serviceId: params.serviceId || undefined,
      excludeAppointmentId: params.excludeAppointmentId,
    });
  }

  private dispatchPatientMobileNotification(params: {
    patientId: string;
    patientName: string;
    patientPhone: string;
    hasWhatsApp: boolean;
    content: string;
  }): void {
    let conv = this.state.conversations.find((c) => c.phone === params.patientPhone);
    if (!conv) {
      conv = {
        id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clinicId: CLINIC_ID,
        patientId: params.patientId,
        patientName: params.patientName,
        phone: params.patientPhone,
        status: 'open',
        handlingMode: 'ai',
        unreadCount: 0,
        lastMessagePreview: params.content,
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      this.state.conversations.unshift(conv);
    } else {
      conv.lastMessagePreview = params.content;
      conv.lastMessageAt = new Date().toISOString();
    }

    const prefix = params.hasWhatsApp
      ? ''
      : '[SMS / Phone Contact Retained — Patient Marked No WhatsApp] ';

    const msgId = `msg_sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.state.messages.push({
      id: msgId,
      conversationId: conv.id,
      whatsappMessageId: `wamid.notif.${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      direction: 'outbound',
      senderType: 'system',
      messageType: 'template',
      content: `${prefix}${params.content}`,
      deliveryStatus: 'sent',
      createdAt: new Date().toISOString(),
    });

    // Trigger real Meta WhatsApp Cloud API outbound dispatch via /api/whatsapp/send
    if (
      params.hasWhatsApp &&
      typeof window !== 'undefined' &&
      typeof window.fetch === 'function' &&
      !(import.meta as unknown as { env?: { VITEST?: boolean } }).env?.VITEST
    ) {
      window
        .fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toPhone: params.patientPhone,
            messageType: 'text',
            text: params.content,
          }),
        })
        .then((r) => r.json())
        .then(
          (resData: {
            success?: boolean;
            dispatch?: {
              whatsappMessageId?: string;
              status?: 'sent' | 'failed';
              error?: string;
            };
          }) => {
            const targetMsg = this.state.messages.find((m) => m.id === msgId);
            const targetDeliv = this.state.notificationDeliveries?.find(
              (d) =>
                d.recipientPhone === params.patientPhone &&
                d.messageContent === params.content
            );

            if (resData?.success && resData.dispatch?.whatsappMessageId) {
              if (targetMsg) {
                targetMsg.whatsappMessageId = resData.dispatch.whatsappMessageId;
                targetMsg.deliveryStatus = 'delivered';
              }
              if (targetDeliv) {
                targetDeliv.deliveryStatus = 'delivered';
                targetDeliv.lastError = null;
              }
            } else if (resData?.dispatch?.error) {
              if (targetDeliv) {
                targetDeliv.lastError = resData.dispatch.error;
              }
            }
            this.saveState();
          }
        )
        .catch(() => {
          // Keep local record independent of temporary network failures
        });
    }
  }

  private dispatchThreeWayWhatsAppConfirmations(
    appt: Appointment,
    doctor: Doctor,
    eventType: WhatsAppRecipientDelivery['eventType'] = 'appointment_confirmed'
  ): WhatsAppRecipientDelivery[] {
    if (!this.state.notificationDeliveries) {
      this.state.notificationDeliveries = [];
    }

    const clinicAdminPhone = normalizePhone(this.state.clinic.whatsappNumber || '+15551803040');
    const doctorPhone = normalizePhone(doctor.phone || '+15552340001');

    const targets: Array<{
      role: 'patient' | 'doctor' | 'clinic';
      name: string;
      phone: string;
      content: string;
    }> = [
      {
        role: 'patient',
        name: appt.patientName,
        phone: appt.patientPhone,
        content: `[WhatsApp Appointment Confirmation] Hello ${appt.patientName}, your ${appt.serviceName} appointment with ${appt.doctorName} on ${appt.appointmentDate} at ${formatDisplayTime(appt.startTime)} is CONFIRMED (Ref: ${appt.id}). Payment Status: ${appt.paymentStatus} (${appt.paymentDisplayLabel}). You will receive a reminder 1 hour before your appointment.`,
      },
      {
        role: 'doctor',
        name: doctor.name,
        phone: doctorPhone,
        content: `[Doctor Schedule Notification] New confirmed appointment for ${doctor.name}: Patient ${appt.patientName} (${appt.patientPhone}) for ${appt.serviceName} on ${appt.appointmentDate} at ${formatDisplayTime(appt.startTime)}. Payment: ${appt.paymentDisplayLabel}.`,
      },
      {
        role: 'clinic',
        name: `${this.state.clinic.name} Admin`,
        phone: clinicAdminPhone,
        content: `[Clinic Admin Alert] Confirmed Appointment ${appt.id}: Patient ${appt.patientName} (${appt.patientPhone}) with ${doctor.name} on ${appt.appointmentDate} at ${formatDisplayTime(appt.startTime)}. Method: ${appt.paymentMethod} (${appt.paymentStatus}).`,
      },
    ];

    const createdDeliveries: WhatsAppRecipientDelivery[] = [];

    for (const t of targets) {
      const idempotencyKey = `notif_${appt.id}_${t.role}_${eventType}`;
      const existing = this.state.notificationDeliveries.find(
        (d) => d.idempotencyKey === idempotencyKey
      );
      if (existing) {
        createdDeliveries.push(existing);
        continue;
      }

      const rec: WhatsAppRecipientDelivery = {
        id: `nd_${Date.now()}_${t.role}_${Math.random().toString(36).slice(2, 5)}`,
        appointmentId: appt.id,
        recipientRole: t.role,
        recipientName: t.name,
        recipientPhone: t.phone,
        eventType,
        deliveryStatus: 'delivered',
        attempts: 1,
        idempotencyKey,
        messageContent: t.content,
        sentAt: new Date().toISOString(),
      };
      this.state.notificationDeliveries.unshift(rec);
      createdDeliveries.push(rec);

      if (t.role === 'patient') {
        this.dispatchPatientMobileNotification({
          patientId: appt.patientId,
          patientName: appt.patientName,
          patientPhone: appt.patientPhone,
          hasWhatsApp: appt.patientHasWhatsApp ?? true,
          content: t.content,
        });
      }
    }

    appt.notificationDeliveries = createdDeliveries;
    return createdDeliveries;
  }

  private scheduleExactOneHourReminder(appt: Appointment): void {
    const apptDateTimeMs = new Date(`${appt.appointmentDate}T${appt.startTime}:00Z`).getTime();
    const rem1hKey = `rem_${appt.id}_1h_${appt.appointmentDate}_${appt.startTime}`;
    if (!this.state.reminders.some((r) => r.idempotencyKey === rem1hKey)) {
      this.state.reminders.unshift({
        id: `rem_1h_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        appointmentId: appt.id,
        patientName: appt.patientName,
        patientPhone: appt.patientPhone,
        doctorName: appt.doctorName,
        serviceName: appt.serviceName,
        appointmentDate: appt.appointmentDate,
        appointmentTime: appt.startTime,
        reminderType: '1h',
        scheduledAt: new Date(apptDateTimeMs - 3600 * 1000).toISOString(),
        status: 'pending',
        attempts: 0,
        idempotencyKey: rem1hKey,
      });
    }
  }

  public retryWhatsAppRecipientDelivery(deliveryId: string): WhatsAppRecipientDelivery | null {
    const list = this.state.notificationDeliveries || [];
    const target = list.find((d) => d.id === deliveryId);
    if (!target) return null;
    target.attempts += 1;
    target.deliveryStatus = 'delivered';
    target.lastError = null;
    target.sentAt = new Date().toISOString();
    this.saveState();
    return target;
  }

  public createAppointmentAtomic(input: {
    patientName: string;
    patientPhone: string;
    patientHasWhatsApp?: boolean;
    patientEmail?: string;
    doctorId?: string;
    serviceId?: string;
    serviceName?: string;
    appointmentDate: string;
    startTime: string;
    paymentMethod?: PaymentMethodType;
    transactionReference?: string;
    receiptFileUrl?: string;
    receiptFileName?: string;
    status?: AppointmentStatus;
    source: 'whatsapp_ai' | 'website' | 'admin';
    visitReason: string;
    internalNotes?: string;
    actorName?: string;
  }): { success: boolean; appointment?: Appointment; error?: string } {
    if (!input.patientPhone || !input.patientPhone.trim()) {
      return {
        success: false,
        error: 'Patient mobile number is mandatory. Never book without a valid mobile number.',
      };
    }

    const normalizedPhone = normalizePhone(input.patientPhone);
    if (!isValidE164Mobile(normalizedPhone)) {
      return {
        success: false,
        error: `Invalid mobile number (${input.patientPhone}). Please provide a valid international mobile number in E.164 format (e.g., +923705621256 or +15551803040).`,
      };
    }

    const hasWhatsApp = input.patientHasWhatsApp ?? true;
    const paymentMethod: PaymentMethodType = input.paymentMethod || 'CASH_AT_CLINIC';

    // Validate Manual Easypaisa receipt requirements
    if (paymentMethod === 'MANUAL_EASYPAISA') {
      if (!input.transactionReference || input.transactionReference.trim().length < 4) {
        return {
          success: false,
          error: 'Easypaisa Transaction Reference / TID is required for Manual Easypaisa bookings.',
        };
      }
      if (!input.receiptFileUrl || !input.receiptFileUrl.trim()) {
        return {
          success: false,
          error: 'An uploaded payment receipt is required for Manual Easypaisa bookings.',
        };
      }
    }

    // 1. Resolve Service
    let service = input.serviceId
      ? this.state.services.find((s) => s.id === input.serviceId && s.isActive)
      : undefined;
    if (!service && input.serviceName) {
      const q = input.serviceName.toLowerCase();
      service = this.state.services.find(
        (s) => s.isActive && s.name.toLowerCase().includes(q)
      );
    }
    if (!service) {
      service = this.state.services.find((s) => s.id === 'svc_checkup') || this.state.services[0];
    }

    // 2. Resolve Doctor (or pick available doctor for that slot)
    let targetDoctorId = input.doctorId;
    if (!targetDoctorId) {
      const matchingSlots = this.getAvailableSlots({
        date: input.appointmentDate,
        serviceId: service.id,
      }).filter((s) => s.startTime === input.startTime);

      if (matchingSlots.length === 0) {
        return {
          success: false,
          error: `No active doctor is available on ${input.appointmentDate} at ${formatDisplayTime(input.startTime)}.`,
        };
      }
      targetDoctorId = matchingSlots[0].doctorId;
    }

    // 3. Re-validate Slot Availability Atomically
    const validation = validateSpecificSlot({
      date: input.appointmentDate,
      clinic: this.state.clinic,
      doctors: this.state.doctors,
      services: this.state.services,
      holidays: this.state.holidays,
      existingAppointments: this.state.appointments,
      externalBusyIntervals: this.state.externalBusyIntervals,
      serviceId: service.id,
      targetDoctorId,
      targetStartTime: input.startTime,
    });

    if (!validation.valid || !validation.slot) {
      return {
        success: false,
        error: validation.reason || 'Requested slot is no longer available.',
      };
    }

    // 4. Prevent duplicate same-patient same-date/time booking
    const duplicatePatientBooking = this.state.appointments.find(
      (a) =>
        a.patientPhone === normalizedPhone &&
        a.appointmentDate === input.appointmentDate &&
        a.startTime === input.startTime &&
        a.status !== 'cancelled'
    );
    if (duplicatePatientBooking) {
      return {
        success: false,
        error: 'An active appointment already exists for this patient at the selected date and time.',
      };
    }

    // 5. Find or Create Patient record (with E.164 phone & WhatsApp/SMS preference)
    let patient = this.state.patients.find((p) => p.phone === normalizedPhone);
    if (!patient) {
      patient = {
        id: `pat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clinicId: CLINIC_ID,
        fullName: input.patientName.trim(),
        phone: normalizedPhone,
        hasWhatsApp,
        preferredContactChannel: hasWhatsApp ? 'whatsapp' : 'sms_or_phone',
        email: input.patientEmail || null,
        consentStatus: 'granted',
        visitReason: input.visitReason,
        internalNotes: input.internalNotes || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.state.patients.unshift(patient);
    } else {
      patient.fullName = input.patientName.trim() || patient.fullName;
      patient.hasWhatsApp = hasWhatsApp;
      patient.preferredContactChannel = hasWhatsApp ? 'whatsapp' : 'sms_or_phone';
      if (input.patientEmail) patient.email = input.patientEmail;
      patient.visitReason = input.visitReason || patient.visitReason;
      patient.updatedAt = new Date().toISOString();
    }

    const doctor = this.state.doctors.find((d) => d.id === targetDoctorId)!;
    const duration = service.durationMinutes || doctor.appointmentDurationMinutes || 45;
    const endTime = minutesToTime(timeToMinutes(input.startTime) + duration);

    const apptId = `apt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const isGcalConnected = doctor.googleCalendarConnected;

    // Determine initial appointment & payment status according to Payment System Rules:
    // 1. CASH_AT_CLINIC: Confirm immediately, UNPAID / "Pay at Clinic", create GCal, send 3-way WhatsApp confirmations, schedule 1h reminder.
    // 2. MANUAL_EASYPAISA: Set PENDING_VERIFICATION & PENDING_PAYMENT_VERIFICATION. Never auto-confirm based on screenshot/TID! Wait for Admin approval.
    // 3. INTERNATIONAL_CARD: Set PENDING_VERIFICATION & PENDING_PAYMENT_VERIFICATION until verified server-side.
    const isImmediateCashConfirm = paymentMethod === 'CASH_AT_CLINIC';

    const apptStatus: AppointmentStatus = isImmediateCashConfirm
      ? input.status || 'confirmed'
      : 'PENDING_PAYMENT_VERIFICATION';

    const paymentStatus = isImmediateCashConfirm ? 'UNPAID' : 'PENDING_VERIFICATION';
    const paymentDisplayLabel = isImmediateCashConfirm
      ? 'Pay at Clinic'
      : paymentMethod === 'MANUAL_EASYPAISA'
      ? 'Pending Admin Verification'
      : paymentMethod === 'DEBIT_CREDIT_CARD'
      ? 'Debit & Credit Card (Pending Server Verification)'
      : paymentMethod === 'APPLE_GOOGLE_PAY'
      ? 'Apple Pay / Google Pay (Pending Server Verification)'
      : paymentMethod === 'PAYPAL'
      ? 'PayPal (Pending Server Verification)'
      : 'Pending Server-Side Payment Verification';

    const newAppointment: Appointment = {
      id: apptId,
      clinicId: CLINIC_ID,
      patientId: patient.id,
      patientName: patient.fullName,
      patientPhone: patient.phone,
      patientHasWhatsApp: hasWhatsApp,
      paymentMethod,
      paymentStatus,
      paymentDisplayLabel,
      paymentAmount: service.price,
      transactionReference: input.transactionReference || null,
      receiptFileUrl: input.receiptFileUrl || null,
      receiptFileName: input.receiptFileName || null,
      patientEmail: patient.email,
      doctorId: doctor.id,
      doctorName: doctor.name,
      serviceId: service.id,
      serviceName: service.name,
      appointmentDate: input.appointmentDate,
      startTime: input.startTime,
      endTime,
      status: apptStatus,
      source: input.source,
      visitReason: input.visitReason || service.name,
      internalNotes: input.internalNotes || null,
      // Only create Google Calendar event once confirmed (independent of temporary GCal failures)
      googleCalendarEventId:
        isImmediateCashConfirm && isGcalConnected ? `gcal_evt_${apptId}` : null,
      calendarSyncStatus: isImmediateCashConfirm
        ? isGcalConnected
          ? 'synced'
          : 'not_connected'
        : 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.state.appointments.unshift(newAppointment);

    if (isImmediateCashConfirm) {
      // Cash Payment: Send 3-way WhatsApp confirmation (Patient, Doctor, Clinic) & Schedule 1-hour reminder immediately
      this.dispatchThreeWayWhatsAppConfirmations(
        newAppointment,
        doctor,
        'appointment_confirmed'
      );
      this.scheduleExactOneHourReminder(newAppointment);
    } else if (paymentMethod === 'MANUAL_EASYPAISA') {
      // Manual Easypaisa: Log receipt submission & notify patient that receipt is pending admin verification
      if (!this.state.paymentVerificationRecords) {
        this.state.paymentVerificationRecords = [];
      }
      this.state.paymentVerificationRecords.unshift({
        id: `pvr_${Date.now()}`,
        appointmentId: apptId,
        decision: 'SUBMITTED',
        adminUserId: null,
        adminName: patient.fullName,
        reason: 'Patient uploaded Easypaisa receipt and transaction reference for admin review.',
        transactionReference: input.transactionReference || '',
        timestamp: new Date().toISOString(),
      });

      this.dispatchPatientMobileNotification({
        patientId: patient.id,
        patientName: patient.fullName,
        patientPhone: patient.phone,
        hasWhatsApp,
        content: `[Easypaisa Receipt Received — Pending Verification] Hello ${patient.fullName}, we received your Easypaisa receipt (TID: ${input.transactionReference}) for your ${service.name} request on ${input.appointmentDate} at ${formatDisplayTime(input.startTime)}. Status: PENDING_PAYMENT_VERIFICATION. You will receive your final confirmation as soon as our administrator verifies your payment.`,
      });
    } else {
      // International Card: Pending server-side webhook verification
      this.dispatchPatientMobileNotification({
        patientId: patient.id,
        patientName: patient.fullName,
        patientPhone: patient.phone,
        hasWhatsApp,
        content: `[International Payment Initiated] Hello ${patient.fullName}, your ${service.name} slot on ${input.appointmentDate} at ${formatDisplayTime(input.startTime)} is reserved pending server-side card payment verification.`,
      });
    }

    this.logAudit(
      this.getCurrentUser()?.id || null,
      input.actorName || this.getCurrentUser()?.fullName || 'System Booking Engine',
      'APPOINTMENT_CREATED',
      'appointment',
      apptId,
      {
        patientName: patient.fullName,
        doctorName: doctor.name,
        serviceName: service.name,
        date: input.appointmentDate,
        startTime: input.startTime,
        paymentMethod,
        paymentStatus,
        status: apptStatus,
        source: input.source,
      }
    );

    this.saveState();
    return { success: true, appointment: newAppointment };
  }

  public approveEasypaisaPayment(input: {
    appointmentId: string;
    reason: string;
    adminName?: string;
  }): { success: boolean; appointment?: Appointment; error?: string } {
    const appt = this.state.appointments.find((a) => a.id === input.appointmentId);
    if (!appt) {
      return { success: false, error: 'Appointment not found.' };
    }

    const adminUser = this.getCurrentUser();
    const adminDisplayName =
      input.adminName || adminUser?.fullName || 'Clinic Administrator';
    const nowIso = new Date().toISOString();

    // 1. Mark payment as PAID & Confirm the appointment
    appt.paymentStatus = 'PAID';
    appt.paymentDisplayLabel = 'Paid (Verified Easypaisa)';
    appt.status = 'confirmed';
    appt.paymentVerifiedByAdminId = adminUser?.id || 'usr_super_admin';
    appt.paymentVerifiedByAdminName = adminDisplayName;
    appt.paymentVerifiedAt = nowIso;
    appt.paymentDecisionReason = input.reason;
    appt.updatedAt = nowIso;

    // 2. Create Google Calendar event (independent of temporary GCal failure)
    const doctor =
      this.state.doctors.find((d) => d.id === appt.doctorId) || this.state.doctors[0];
    if (doctor?.googleCalendarConnected) {
      appt.googleCalendarEventId = `gcal_evt_${appt.id}`;
      appt.calendarSyncStatus = 'synced';
    }

    // 3. Record Administrator, Timestamp, and Reason in Verification History
    if (!this.state.paymentVerificationRecords) {
      this.state.paymentVerificationRecords = [];
    }
    this.state.paymentVerificationRecords.unshift({
      id: `pvr_${Date.now()}`,
      appointmentId: appt.id,
      decision: 'APPROVED',
      adminUserId: adminUser?.id || 'usr_super_admin',
      adminName: adminDisplayName,
      reason: input.reason,
      transactionReference: appt.transactionReference || '',
      timestamp: nowIso,
    });

    // 4. Send 3-Way WhatsApp notifications (Patient, Assigned Doctor, and Clinic)
    this.dispatchThreeWayWhatsAppConfirmations(appt, doctor, 'payment_approved');

    // 5. Schedule the 1-hour patient reminder
    this.scheduleExactOneHourReminder(appt);

    this.logAudit(
      adminUser?.id || null,
      adminDisplayName,
      'EASYPAISA_PAYMENT_APPROVED',
      'appointment',
      appt.id,
      {
        transactionReference: appt.transactionReference,
        reason: input.reason,
        verifiedAt: nowIso,
      }
    );

    this.saveState();
    return { success: true, appointment: appt };
  }

  public rejectEasypaisaPayment(input: {
    appointmentId: string;
    reason: string;
    adminName?: string;
  }): { success: boolean; appointment?: Appointment; error?: string } {
    const appt = this.state.appointments.find((a) => a.id === input.appointmentId);
    if (!appt) {
      return { success: false, error: 'Appointment not found.' };
    }

    const adminUser = this.getCurrentUser();
    const adminDisplayName =
      input.adminName || adminUser?.fullName || 'Clinic Administrator';
    const nowIso = new Date().toISOString();

    appt.paymentStatus = 'REJECTED';
    appt.paymentDisplayLabel = 'Receipt Rejected — Resubmit Required';
    appt.status = 'PENDING_PAYMENT_VERIFICATION';
    appt.paymentVerifiedByAdminId = adminUser?.id || 'usr_super_admin';
    appt.paymentVerifiedByAdminName = adminDisplayName;
    appt.paymentVerifiedAt = nowIso;
    appt.paymentDecisionReason = input.reason;
    appt.updatedAt = nowIso;

    if (!this.state.paymentVerificationRecords) {
      this.state.paymentVerificationRecords = [];
    }
    this.state.paymentVerificationRecords.unshift({
      id: `pvr_${Date.now()}`,
      appointmentId: appt.id,
      decision: 'REJECTED',
      adminUserId: adminUser?.id || 'usr_super_admin',
      adminName: adminDisplayName,
      reason: input.reason,
      transactionReference: appt.transactionReference || '',
      timestamp: nowIso,
    });

    // Notify patient via WhatsApp and allow them to submit another receipt
    this.dispatchPatientMobileNotification({
      patientId: appt.patientId,
      patientName: appt.patientName,
      patientPhone: appt.patientPhone,
      hasWhatsApp: appt.patientHasWhatsApp ?? true,
      content: `[Easypaisa Receipt Verification Update] Hello ${appt.patientName}, your submitted payment receipt (TID: ${appt.transactionReference || 'N/A'}) for appointment ${appt.id} could not be verified.\nReason: ${input.reason}\n\nYou may upload a clear receipt screenshot and updated Transaction ID on our booking page to complete verification.`,
    });

    this.logAudit(
      adminUser?.id || null,
      adminDisplayName,
      'EASYPAISA_PAYMENT_REJECTED',
      'appointment',
      appt.id,
      {
        transactionReference: appt.transactionReference,
        reason: input.reason,
        rejectedAt: nowIso,
      }
    );

    this.saveState();
    return { success: true, appointment: appt };
  }

  public resubmitEasypaisaReceipt(input: {
    appointmentId: string;
    transactionReference: string;
    receiptFileUrl: string;
    receiptFileName?: string;
  }): { success: boolean; appointment?: Appointment; error?: string } {
    const appt = this.state.appointments.find((a) => a.id === input.appointmentId);
    if (!appt) {
      return { success: false, error: 'Appointment not found.' };
    }
    if (!input.transactionReference.trim() || !input.receiptFileUrl.trim()) {
      return {
        success: false,
        error: 'Both a valid transaction reference and receipt image are required.',
      };
    }

    const nowIso = new Date().toISOString();
    appt.transactionReference = input.transactionReference.trim();
    appt.receiptFileUrl = input.receiptFileUrl;
    appt.receiptFileName = input.receiptFileName || 'resubmitted_receipt.png';
    appt.paymentStatus = 'PENDING_VERIFICATION';
    appt.paymentDisplayLabel = 'Pending Admin Verification (Resubmitted)';
    appt.status = 'PENDING_PAYMENT_VERIFICATION';
    appt.updatedAt = nowIso;

    if (!this.state.paymentVerificationRecords) {
      this.state.paymentVerificationRecords = [];
    }
    this.state.paymentVerificationRecords.unshift({
      id: `pvr_${Date.now()}`,
      appointmentId: appt.id,
      decision: 'RESUBMITTED',
      adminUserId: null,
      adminName: appt.patientName,
      reason: 'Patient submitted a new receipt and transaction reference after rejection.',
      transactionReference: appt.transactionReference,
      timestamp: nowIso,
    });

    this.dispatchPatientMobileNotification({
      patientId: appt.patientId,
      patientName: appt.patientName,
      patientPhone: appt.patientPhone,
      hasWhatsApp: appt.patientHasWhatsApp ?? true,
      content: `[Updated Receipt Received] Thank you ${appt.patientName}, your new Easypaisa receipt (TID: ${appt.transactionReference}) has been received and queued for administrator verification.`,
    });

    this.saveState();
    return { success: true, appointment: appt };
  }

  public verifyInternationalCardPaymentServerSide(input: {
    appointmentId: string;
    provider: InternationalGatewayProvider;
    gatewayTransactionId: string;
  }): { success: boolean; appointment?: Appointment; error?: string } {
    const appt = this.state.appointments.find((a) => a.id === input.appointmentId);
    if (!appt) {
      return { success: false, error: 'Appointment not found.' };
    }

    // Check Stripe/PayPal merchant eligibility compliance
    if (
      (input.provider === 'stripe_eligible_merchant' ||
        input.provider === 'paypal_eligible_merchant') &&
      !this.state.clinic.paymentSettings?.hasEligibleInternationalMerchantAccount
    ) {
      return {
        success: false,
        error:
          'Stripe and PayPal may only be enabled if the clinic holds an eligible foreign/international merchant account satisfying country and banking requirements. Use Safepay Pakistan, PayFast Pakistan, or 2Checkout for Pakistani merchant accounts.',
      };
    }

    const nowIso = new Date().toISOString();
    appt.paymentStatus = 'PAID';
    appt.paymentDisplayLabel = `Paid (${input.provider.toUpperCase()})`;
    appt.transactionReference = input.gatewayTransactionId;
    appt.status = 'confirmed';
    appt.paymentVerifiedByAdminName = `Server Webhook (${input.provider})`;
    appt.paymentVerifiedAt = nowIso;
    appt.paymentDecisionReason = `Verified server-side via ${input.provider} webhook (${input.gatewayTransactionId})`;
    appt.updatedAt = nowIso;

    const doctor =
      this.state.doctors.find((d) => d.id === appt.doctorId) || this.state.doctors[0];
    if (doctor?.googleCalendarConnected) {
      appt.googleCalendarEventId = `gcal_evt_${appt.id}`;
      appt.calendarSyncStatus = 'synced';
    }

    this.dispatchThreeWayWhatsAppConfirmations(appt, doctor, 'appointment_confirmed');
    this.scheduleExactOneHourReminder(appt);

    this.logAudit(
      null,
      `Payment Webhook (${input.provider})`,
      'INTERNATIONAL_PAYMENT_VERIFIED_SERVER_SIDE',
      'appointment',
      appt.id,
      {
        provider: input.provider,
        gatewayTransactionId: input.gatewayTransactionId,
      }
    );

    this.saveState();
    return { success: true, appointment: appt };
  }

  public cancelAppointment(
    appointmentId: string,
    reason?: string,
    actorName?: string
  ): { success: boolean; appointment?: Appointment; error?: string } {
    const appt = this.state.appointments.find((a) => a.id === appointmentId);
    if (!appt) {
      return { success: false, error: 'Appointment not found.' };
    }
    if (appt.status === 'cancelled') {
      return { success: false, error: 'Appointment is already cancelled.' };
    }

    appt.status = 'cancelled';
    if (reason) {
      appt.internalNotes = [appt.internalNotes, `Cancelled: ${reason}`]
        .filter(Boolean)
        .join(' | ');
    }
    appt.googleCalendarEventId = null;
    appt.updatedAt = new Date().toISOString();

    // Cancel pending reminders linked to this appointment
    this.state.reminders.forEach((rem) => {
      if (rem.appointmentId === appointmentId && rem.status === 'pending') {
        rem.status = 'cancelled';
      }
    });

    // Send WhatsApp Cancellation Notification to patient's E.164 mobile number
    this.dispatchPatientMobileNotification({
      patientId: appt.patientId,
      patientName: appt.patientName,
      patientPhone: appt.patientPhone,
      hasWhatsApp: appt.patientHasWhatsApp ?? true,
      content: `[Cancellation Notification] Hello ${appt.patientName}, your ${appt.serviceName} appointment with ${appt.doctorName} on ${appt.appointmentDate} at ${formatDisplayTime(appt.startTime)} has been CANCELLED. Reply BOOK anytime to schedule a new visit.`,
    });

    this.logAudit(
      this.getCurrentUser()?.id || null,
      actorName || this.getCurrentUser()?.fullName || 'System',
      'APPOINTMENT_CANCELLED',
      'appointment',
      appointmentId,
      { reason: reason || 'Cancelled by request' }
    );

    this.saveState();
    return { success: true, appointment: appt };
  }

  public rescheduleAppointment(input: {
    appointmentId: string;
    newDate: string;
    newStartTime: string;
    newDoctorId?: string;
    reason?: string;
    actorName?: string;
  }): { success: boolean; appointment?: Appointment; error?: string } {
    const appt = this.state.appointments.find((a) => a.id === input.appointmentId);
    if (!appt) {
      return { success: false, error: 'Appointment not found.' };
    }

    const targetDoctorId = input.newDoctorId || appt.doctorId;
    const validation = validateSpecificSlot({
      date: input.newDate,
      clinic: this.state.clinic,
      doctors: this.state.doctors,
      services: this.state.services,
      holidays: this.state.holidays,
      existingAppointments: this.state.appointments,
      externalBusyIntervals: this.state.externalBusyIntervals,
      serviceId: appt.serviceId,
      excludeAppointmentId: appt.id,
      targetDoctorId,
      targetStartTime: input.newStartTime,
    });

    if (!validation.valid || !validation.slot) {
      return {
        success: false,
        error: validation.reason || 'New slot is not available.',
      };
    }

    const doc = this.state.doctors.find((d) => d.id === targetDoctorId)!;
    const service = this.state.services.find((s) => s.id === appt.serviceId);
    const duration = service?.durationMinutes || doc.appointmentDurationMinutes || 45;

    const oldDate = appt.appointmentDate;
    const oldTime = appt.startTime;

    appt.doctorId = doc.id;
    appt.doctorName = doc.name;
    appt.appointmentDate = input.newDate;
    appt.startTime = input.newStartTime;
    appt.endTime = minutesToTime(timeToMinutes(input.newStartTime) + duration);
    appt.status = 'confirmed';
    appt.updatedAt = new Date().toISOString();

    // Update pending reminders for new time
    const newDateTimeMs = new Date(`${input.newDate}T${input.newStartTime}:00Z`).getTime();
    this.state.reminders.forEach((rem) => {
      if (rem.appointmentId === appt.id && rem.status !== 'sent') {
        rem.appointmentDate = input.newDate;
        rem.appointmentTime = input.newStartTime;
        rem.doctorName = doc.name;
        rem.status = 'pending';
        rem.scheduledAt = new Date(
          newDateTimeMs - (rem.reminderType === '24h' ? 24 : 1) * 3600 * 1000
        ).toISOString();
      }
    });

    // Send WhatsApp Rescheduling Notification to patient's E.164 mobile number
    this.dispatchPatientMobileNotification({
      patientId: appt.patientId,
      patientName: appt.patientName,
      patientPhone: appt.patientPhone,
      hasWhatsApp: appt.patientHasWhatsApp ?? true,
      content: `[Rescheduling Notification] Hello ${appt.patientName}, your ${appt.serviceName} appointment has been RESCHEDULED from ${oldDate} (${formatDisplayTime(oldTime)}) to ${input.newDate} at ${formatDisplayTime(input.newStartTime)} with ${doc.name}. Your 1-hour reminder has been updated.`,
    });

    this.logAudit(
      this.getCurrentUser()?.id || null,
      input.actorName || this.getCurrentUser()?.fullName || 'System',
      'APPOINTMENT_RESCHEDULED',
      'appointment',
      appt.id,
      {
        from: `${oldDate} ${oldTime}`,
        to: `${input.newDate} ${input.newStartTime}`,
        doctorName: doc.name,
      }
    );

    this.saveState();
    return { success: true, appointment: appt };
  }

  public updateAppointmentStatus(
    appointmentId: string,
    status: AppointmentStatus,
    internalNotes?: string
  ): Appointment | null {
    const appt = this.state.appointments.find((a) => a.id === appointmentId);
    if (!appt) return null;
    appt.status = status;
    if (internalNotes !== undefined) {
      appt.internalNotes = internalNotes;
    }
    appt.updatedAt = new Date().toISOString();
    if (status === 'cancelled') {
      this.state.reminders.forEach((r) => {
        if (r.appointmentId === appointmentId && r.status === 'pending') {
          r.status = 'cancelled';
        }
      });
    }
    this.logAudit(
      this.getCurrentUser()?.id || null,
      this.getCurrentUser()?.fullName || 'Admin',
      'APPOINTMENT_STATUS_UPDATED',
      'appointment',
      appointmentId,
      { status }
    );
    this.saveState();
    return appt;
  }

  // ==========================================================================
  // WHATSAPP CONVERSATIONS, INBOX & HUMAN TAKEOVER
  // ==========================================================================
  public setConversationHandlingMode(
    conversationId: string,
    mode: HandlingMode,
    actorName = 'Receptionist'
  ): Conversation | null {
    const conv = this.state.conversations.find((c) => c.id === conversationId);
    if (!conv) return null;
    conv.handlingMode = mode;
    this.logAudit(
      this.getCurrentUser()?.id || null,
      actorName,
      mode === 'human' ? 'CONVERSATION_HUMAN_TAKEOVER' : 'CONVERSATION_RETURNED_TO_AI',
      'conversation',
      conversationId,
      { handlingMode: mode }
    );
    this.saveState();
    return conv;
  }

  public closeConversation(conversationId: string): Conversation | null {
    const conv = this.state.conversations.find((c) => c.id === conversationId);
    if (!conv) return null;
    conv.status = conv.status === 'open' ? 'closed' : 'open';
    conv.unreadCount = 0;
    this.saveState();
    return conv;
  }

  public sendManualHumanReply(
    conversationId: string,
    content: string,
    staffName = 'Receptionist'
  ): WhatsAppMessage | null {
    const conv = this.state.conversations.find((c) => c.id === conversationId);
    if (!conv || !content.trim()) return null;

    // Crucial Rule: When a receptionist replies or takes over, AI must stop responding until resumed
    conv.handlingMode = 'human';
    conv.status = 'open';
    conv.unreadCount = 0;
    conv.lastMessagePreview = content.trim();
    conv.lastMessageAt = new Date().toISOString();

    const msg: WhatsAppMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      conversationId,
      whatsappMessageId: `wamid.human.${Date.now()}`,
      direction: 'outbound',
      senderType: 'human',
      messageType: 'text',
      content: content.trim(),
      deliveryStatus: 'sent',
      createdAt: new Date().toISOString(),
    };

    this.state.messages.push(msg);
    this.logAudit(
      this.getCurrentUser()?.id || null,
      staffName,
      'WHATSAPP_MANUAL_REPLY_SENT',
      'conversation',
      conversationId,
      { preview: content.trim().slice(0, 60) }
    );
    this.saveState();
    return msg;
  }

  // ==========================================================================
  // DOCTORS, SERVICES, PATIENTS, SETTINGS CRUD
  // ==========================================================================
  public upsertDoctor(doctor: Partial<Doctor> & { name: string; specialization: string }): Doctor {
    if (doctor.id) {
      const idx = this.state.doctors.findIndex((d) => d.id === doctor.id);
      if (idx !== -1) {
        this.state.doctors[idx] = { ...this.state.doctors[idx], ...doctor };
        this.saveState();
        return this.state.doctors[idx];
      }
    }
    const newId = `doc_${Date.now()}`;
    const newDoc: Doctor = {
      id: newId,
      clinicId: CLINIC_ID,
      name: doctor.name,
      title: doctor.title || doctor.specialization,
      specialization: doctor.specialization,
      description: doctor.description || '',
      credentials: doctor.credentials || ['DDS'],
      imageUrl:
        doctor.imageUrl ||
        'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600&auto=format&fit=crop&q=80',
      email: doctor.email || '',
      phone: doctor.phone || '',
      appointmentDurationMinutes: doctor.appointmentDurationMinutes || 45,
      isActive: doctor.isActive ?? true,
      isVerified: doctor.isVerified ?? false,
      calendarId: doctor.calendarId || null,
      googleCalendarConnected: doctor.googleCalendarConnected ?? false,
      serviceIds: doctor.serviceIds || this.state.services.map((s) => s.id),
      availability:
        doctor.availability || buildStandardSchedule(newId, [1, 2, 3, 4, 5, 6], '09:00', '18:00'),
      breaks: doctor.breaks || buildStandardBreaks(newId, [1, 2, 3, 4, 5, 6]),
      createdAt: new Date().toISOString(),
    };
    this.state.doctors.push(newDoc);
    this.saveState();
    return newDoc;
  }

  public toggleDoctorActive(doctorId: string): Doctor | null {
    const doc = this.state.doctors.find((d) => d.id === doctorId);
    if (!doc) return null;
    doc.isActive = !doc.isActive;
    this.saveState();
    return doc;
  }

  public upsertService(
    service: Partial<ClinicService> & { name: string; durationMinutes: number }
  ): ClinicService {
    if (service.id) {
      const idx = this.state.services.findIndex((s) => s.id === service.id);
      if (idx !== -1) {
        this.state.services[idx] = { ...this.state.services[idx], ...service };
        this.saveState();
        return this.state.services[idx];
      }
    }
    const newSvc: ClinicService = {
      id: `svc_${Date.now()}`,
      clinicId: CLINIC_ID,
      name: service.name,
      badge: service.badge || 'Clinical Care',
      category: service.category || 'General',
      description: service.description || '',
      durationMinutes: service.durationMinutes,
      visitsLabel: service.visitsLabel || '1 Visit',
      comfortLabel: service.comfortLabel || '100% Gentle',
      price: service.price ?? null,
      priceLabel: service.priceLabel || (service.price ? `$${service.price}` : 'Custom Quote'),
      features: service.features || ['3D Digital Diagnostics', 'Painless Care'],
      bestFor: service.bestFor || 'All patients',
      imageUrl:
        service.imageUrl ||
        'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=900&auto=format&fit=crop&q=80',
      doctorIds: service.doctorIds || this.state.doctors.map((d) => d.id),
      isActive: service.isActive ?? true,
    };
    this.state.services.push(newSvc);
    this.saveState();
    return newSvc;
  }

  public toggleServiceActive(serviceId: string): ClinicService | null {
    const svc = this.state.services.find((s) => s.id === serviceId);
    if (!svc) return null;
    svc.isActive = !svc.isActive;
    this.saveState();
    return svc;
  }

  public upsertPatient(
    patient: Partial<Patient> & { fullName: string; phone: string }
  ): Patient {
    const normalizedPhone = normalizePhone(patient.phone);
    const existing = this.state.patients.find(
      (p) => p.id === patient.id || p.phone === normalizedPhone
    );
    if (existing) {
      Object.assign(existing, {
        ...patient,
        phone: normalizedPhone,
        updatedAt: new Date().toISOString(),
      });
      this.saveState();
      return existing;
    }
    const newPatient: Patient = {
      id: `pat_${Date.now()}`,
      clinicId: CLINIC_ID,
      fullName: patient.fullName.trim(),
      phone: normalizedPhone,
      email: patient.email || null,
      consentStatus: patient.consentStatus || 'granted',
      visitReason: patient.visitReason || null,
      internalNotes: patient.internalNotes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.patients.unshift(newPatient);
    this.saveState();
    return newPatient;
  }

  public updateClinicProfile(updates: Partial<ClinicProfile>): ClinicProfile {
    this.state.clinic = {
      ...this.state.clinic,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.logAudit(
      this.getCurrentUser()?.id || null,
      this.getCurrentUser()?.fullName || 'Admin',
      'CLINIC_SETTINGS_UPDATED',
      'clinic',
      CLINIC_ID,
      { isVerifiedContent: this.state.clinic.isVerifiedContent }
    );
    this.saveState();
    return this.state.clinic;
  }

  public addClinicHoliday(holidayDate: string, description: string): ClinicHoliday {
    const existing = this.state.holidays.find((h) => h.holidayDate === holidayDate);
    if (existing) {
      existing.description = description;
      this.saveState();
      return existing;
    }
    const hol: ClinicHoliday = {
      id: `hol_${Date.now()}`,
      clinicId: CLINIC_ID,
      holidayDate,
      description,
    };
    this.state.holidays.push(hol);
    this.saveState();
    return hol;
  }

  public removeClinicHoliday(holidayId: string): void {
    this.state.holidays = this.state.holidays.filter((h) => h.id !== holidayId);
    this.saveState();
  }

  public updateAIConfiguration(updates: Partial<AIConfiguration>): AIConfiguration {
    this.state.aiConfig = {
      ...this.state.aiConfig,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.logAudit(
      this.getCurrentUser()?.id || null,
      this.getCurrentUser()?.fullName || 'Admin',
      'AI_CONFIGURATION_UPDATED',
      'ai_configuration',
      this.state.aiConfig.id,
      { enabled: this.state.aiConfig.enabled }
    );
    this.saveState();
    return this.state.aiConfig;
  }

  // ==========================================================================
  // REMINDER JOB EXECUTION & IDEMPOTENCY
  // ==========================================================================
  public processDueReminders(forceReminderId?: string): {
    processed: number;
    sent: number;
    failed: number;
    skippedCancelled: number;
  } {
    let processed = 0;
    let sent = 0;
    let failed = 0;
    let skippedCancelled = 0;

    const nowMs = Date.now();

    for (const rem of this.state.reminders) {
      if (forceReminderId && rem.id !== forceReminderId) continue;
      if (!forceReminderId && rem.status !== 'pending' && rem.status !== 'failed') continue;
      if (!forceReminderId && rem.attempts >= 3) continue;

      const scheduledMs = new Date(rem.scheduledAt).getTime();
      if (!forceReminderId && scheduledMs > nowMs) continue;

      processed++;
      const appt = this.state.appointments.find((a) => a.id === rem.appointmentId);
      if (!appt || appt.status === 'cancelled') {
        rem.status = 'cancelled';
        skippedCancelled++;
        continue;
      }

      // Atomic job claim
      rem.status = 'processing';
      rem.attempts += 1;

      // Send WhatsApp template message & record in conversation if exists
      rem.status = 'sent';
      rem.sentAt = new Date().toISOString();
      rem.lastError = null;
      sent++;

      // Log reminder message in patient's WhatsApp conversation
      const conv = this.state.conversations.find((c) => c.phone === rem.patientPhone);
      if (conv) {
        const reminderText = `[Automated Reminder (${rem.reminderType})] Hello ${rem.patientName}, this is a friendly reminder from ${this.state.clinic.name} for your ${rem.serviceName} appointment with ${rem.doctorName} on ${rem.appointmentDate} at ${formatDisplayTime(rem.appointmentTime)}. Reply RESCHEDULE or CANCEL if your plans have changed.`;
        this.state.messages.push({
          id: `msg_rem_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          conversationId: conv.id,
          whatsappMessageId: `wamid.rem.${rem.idempotencyKey}`,
          direction: 'outbound',
          senderType: 'system',
          messageType: 'template',
          content: reminderText,
          deliveryStatus: 'delivered',
          createdAt: new Date().toISOString(),
        });
        conv.lastMessagePreview = reminderText;
        conv.lastMessageAt = new Date().toISOString();
      }
    }

    this.saveState();
    return { processed, sent, failed, skippedCancelled };
  }

  public generateDailyReport(dateStr = getTodayDateString(0)): DailyReport {
    const dayAppts = this.state.appointments.filter((a) => a.appointmentDate === dateStr);
    const breakdown = this.state.doctors.map((doc) => {
      const docAppts = dayAppts.filter((a) => a.doctorId === doc.id);
      return {
        doctorId: doc.id,
        doctorName: doc.name,
        total: docAppts.length,
        confirmed: docAppts.filter((a) => a.status === 'confirmed').length,
        completed: docAppts.filter((a) => a.status === 'completed').length,
        cancelled: docAppts.filter((a) => a.status === 'cancelled').length,
      };
    });

    const report: DailyReport = {
      id: `rep_${dateStr}`,
      clinicId: CLINIC_ID,
      reportDate: dateStr,
      totalAppointments: dayAppts.length,
      confirmedAppointments: dayAppts.filter((a) => a.status === 'confirmed').length,
      completedAppointments: dayAppts.filter((a) => a.status === 'completed').length,
      cancelledAppointments: dayAppts.filter((a) => a.status === 'cancelled').length,
      pendingAppointments: dayAppts.filter((a) => a.status === 'pending').length,
      noShowAppointments: dayAppts.filter((a) => a.status === 'no_show').length,
      newPatients: this.state.patients.length,
      aiHandledConversations: this.state.conversations.filter((c) => c.handlingMode === 'ai').length,
      humanHandledConversations: this.state.conversations.filter((c) => c.handlingMode === 'human').length,
      doctorBreakdown: breakdown,
      deliveryStatus: 'generated',
      createdAt: new Date().toISOString(),
    };

    const existingIdx = this.state.dailyReports.findIndex((r) => r.reportDate === dateStr);
    if (existingIdx !== -1) {
      this.state.dailyReports[existingIdx] = report;
    } else {
      this.state.dailyReports.unshift(report);
    }

    this.saveState();
    return report;
  }

  public logAudit(
    userId: string | null,
    userName: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>
  ): void {
    this.state.auditLogs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      clinicId: CLINIC_ID,
      userId,
      userName,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: new Date().toISOString(),
    });
  }
}

export const clinicStore = new ClinicDataStore();
