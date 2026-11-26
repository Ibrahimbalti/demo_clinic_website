import { z } from 'zod';
import {
  aiCancelAppointmentSchema,
  aiCreateAppointmentSchema,
  aiGetAppointmentDetailsSchema,
  aiGetAvailableSlotsSchema,
  aiGetDoctorDetailsSchema,
  aiGetPatientHistorySchema,
  aiRescheduleAppointmentSchema,
  aiTransferToHumanSchema,
  normalizePhone,
} from './schemas';
import { clinicStore } from './clinicDataStore';
import { formatDisplayTime } from './availabilityEngine';
import type { AvailableSlot, Conversation, WhatsAppMessage } from '../types/clinic';

export interface AIToolExecutionResult {
  toolName:
    | 'getClinicInformation'
    | 'getClinicServices'
    | 'getAvailableDoctors'
    | 'getDoctorDetails'
    | 'getAvailableSlots'
    | 'createAppointment'
    | 'getAppointmentDetails'
    | 'cancelAppointment'
    | 'rescheduleAppointment'
    | 'transferToHuman'
    | 'getClinicOpeningHours'
    | 'getPatientAppointmentHistory';
  args: Record<string, unknown>;
  output: unknown;
  validatedByZod: boolean;
}

/**
 * 12 Backend-Controlled AI Receptionist Tools
 * Every tool validates inputs with Zod and verifies data against the database store.
 */
export const aiBackendTools = {
  getClinicInformation(args: unknown = {}) {
    z.object({}).passthrough().parse(args);
    const { clinic } = clinicStore.getState();
    return {
      name: clinic.name,
      tagline: clinic.tagline,
      address: clinic.address,
      city: clinic.city,
      phone: clinic.phone,
      emergencyPhone: clinic.emergencyPhone,
      whatsappNumber: clinic.whatsappNumber,
      email: clinic.email,
      timezone: clinic.timezone,
      cancellationPolicyHours: clinic.cancellationPolicyHours,
    };
  },

  getClinicOpeningHours(args: unknown = {}) {
    z.object({}).passthrough().parse(args);
    const { clinic, holidays } = clinicStore.getState();
    return {
      timezone: clinic.timezone,
      openingHours: clinic.openingHours,
      upcomingHolidays: holidays,
    };
  },

  getClinicServices(args: unknown = {}) {
    z.object({}).passthrough().parse(args);
    const { services } = clinicStore.getState();
    return services
      .filter((s) => s.isActive)
      .map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        durationMinutes: s.durationMinutes,
        priceLabel: s.priceLabel,
        description: s.description,
      }));
  },

  getAvailableDoctors(args: unknown = {}) {
    const parsed = z
      .object({ serviceId: z.string().optional(), specialization: z.string().optional() })
      .parse(args || {});
    const { doctors } = clinicStore.getState();
    return doctors
      .filter((d) => {
        if (!d.isActive) return false;
        if (parsed.serviceId && !d.serviceIds.includes(parsed.serviceId)) return false;
        if (
          parsed.specialization &&
          !d.specialization.toLowerCase().includes(parsed.specialization.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .map((d) => ({
        id: d.id,
        name: d.name,
        title: d.title,
        specialization: d.specialization,
        credentials: d.credentials,
      }));
  },

  getDoctorDetails(args: unknown) {
    const parsed = aiGetDoctorDetailsSchema.parse(args);
    const { doctors, services } = clinicStore.getState();
    const doc = doctors.find(
      (d) =>
        (parsed.doctorId && d.id === parsed.doctorId) ||
        (parsed.doctorName && d.name.toLowerCase().includes(parsed.doctorName.toLowerCase()))
    );
    if (!doc) {
      return { found: false, error: 'Doctor not found.' };
    }
    const assignedServices = services
      .filter((s) => doc.serviceIds.includes(s.id))
      .map((s) => s.name);
    return {
      found: true,
      id: doc.id,
      name: doc.name,
      title: doc.title,
      specialization: doc.specialization,
      description: doc.description,
      credentials: doc.credentials,
      assignedServices,
      workingDays: doc.availability
        .filter((a) => a.isAvailable)
        .map((a) => ({ dayOfWeek: a.dayOfWeek, hours: `${a.startTime} - ${a.endTime}` })),
    };
  },

  getAvailableSlots(args: unknown) {
    const parsed = aiGetAvailableSlotsSchema.parse(args);
    const slots = clinicStore.getAvailableSlots({
      date: parsed.date,
      doctorId: parsed.doctorId,
      serviceId: parsed.serviceId,
    });
    return {
      date: parsed.date,
      totalAvailable: slots.length,
      slots: slots.slice(0, 8),
    };
  },

  createAppointment(args: unknown) {
    const parsed = aiCreateAppointmentSchema.parse(args);
    return clinicStore.createAppointmentAtomic({
      patientName: parsed.patientName,
      patientPhone: parsed.patientPhone,
      patientEmail: parsed.patientEmail,
      doctorId: parsed.doctorId,
      serviceId: parsed.serviceId,
      serviceName: parsed.serviceName,
      appointmentDate: parsed.appointmentDate,
      startTime: parsed.startTime,
      status: 'confirmed',
      source: 'whatsapp_ai',
      visitReason: parsed.visitReason,
      actorName: 'AI Receptionist',
    });
  },

  getAppointmentDetails(args: unknown) {
    const parsed = aiGetAppointmentDetailsSchema.parse(args);
    const { appointments } = clinicStore.getState();
    if (parsed.appointmentId) {
      const appt = appointments.find((a) => a.id === parsed.appointmentId);
      return appt ? { found: true, appointment: appt } : { found: false };
    }
    if (parsed.patientPhone) {
      const norm = normalizePhone(parsed.patientPhone);
      const list = appointments.filter(
        (a) => a.patientPhone === norm && a.status !== 'cancelled'
      );
      return { found: list.length > 0, appointments: list };
    }
    return { found: false };
  },

  cancelAppointment(args: unknown) {
    const parsed = aiCancelAppointmentSchema.parse(args);
    const { appointments } = clinicStore.getState();
    const normPhone = normalizePhone(parsed.patientPhone);
    const target = appointments.find(
      (a) => a.id === parsed.appointmentId && a.patientPhone === normPhone
    );
    if (!target) {
      return {
        success: false,
        error: 'Could not verify appointment ownership for this phone number.',
      };
    }
    return clinicStore.cancelAppointment(
      parsed.appointmentId,
      parsed.reason || 'Cancelled by patient via WhatsApp AI',
      'AI Receptionist'
    );
  },

  rescheduleAppointment(args: unknown) {
    const parsed = aiRescheduleAppointmentSchema.parse(args);
    const { appointments } = clinicStore.getState();
    const normPhone = normalizePhone(parsed.patientPhone);
    const target = appointments.find(
      (a) => a.id === parsed.appointmentId && a.patientPhone === normPhone
    );
    if (!target) {
      return {
        success: false,
        error: 'Could not verify appointment ownership for this phone number.',
      };
    }
    return clinicStore.rescheduleAppointment({
      appointmentId: parsed.appointmentId,
      newDate: parsed.newDate,
      newStartTime: parsed.newStartTime,
      newDoctorId: parsed.doctorId,
      reason: 'Rescheduled by patient via WhatsApp AI',
      actorName: 'AI Receptionist',
    });
  },

  transferToHuman(args: unknown, conversationId?: string) {
    const parsed = aiTransferToHumanSchema.parse(args);
    if (conversationId) {
      clinicStore.setConversationHandlingMode(
        conversationId,
        'human',
        'AI Handover Trigger'
      );
    }
    return {
      handedOver: true,
      handlingMode: 'human',
      reason: parsed.reason,
      urgency: parsed.urgency,
    };
  },

  getPatientAppointmentHistory(args: unknown) {
    const parsed = aiGetPatientHistorySchema.parse(args);
    const norm = normalizePhone(parsed.patientPhone);
    const { appointments } = clinicStore.getState();
    const history = appointments.filter((a) => a.patientPhone === norm);
    return {
      patientPhone: norm,
      totalAppointments: history.length,
      appointments: history,
    };
  },
};

// ============================================================================
// CONVERSATIONAL STATE MEMORY PER PHONE NUMBER
// ============================================================================
interface PendingBookingDraft {
  step:
    | 'idle'
    | 'awaiting_name'
    | 'awaiting_service'
    | 'awaiting_doctor'
    | 'awaiting_date'
    | 'awaiting_time_selection'
    | 'awaiting_confirmation'
    | 'awaiting_reschedule_date'
    | 'awaiting_reschedule_time';
  patientName?: string;
  serviceId?: string;
  serviceName?: string;
  visitReason?: string;
  doctorId?: string;
  doctorName?: string;
  date?: string;
  offeredSlots?: AvailableSlot[];
  selectedSlot?: AvailableSlot;
  targetAppointmentId?: string;
}

const sessionDrafts = new Map<string, PendingBookingDraft>();

export function resetAISessionDraft(phone: string): void {
  sessionDrafts.delete(normalizePhone(phone));
}

function resolveRelativeDate(text: string): string | null {
  const lower = text.toLowerCase();
  const now = new Date();

  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  if (lower.includes('tomorrow')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (lower.includes('today')) {
    return now.toISOString().slice(0, 10);
  }
  if (lower.includes('day after tomorrow') || lower.includes('in 2 days')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  }

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < weekdays.length; i++) {
    if (lower.includes(weekdays[i])) {
      const d = new Date(now);
      const currentDay = d.getDay();
      let daysAhead = (i - currentDay + 7) % 7;
      if (daysAhead === 0) daysAhead = 7;
      d.setDate(d.getDate() + daysAhead);
      return d.toISOString().slice(0, 10);
    }
  }

  return null;
}

function matchTimeFromUserText(text: string, offeredSlots: AvailableSlot[]): AvailableSlot | null {
  const trimmed = text.trim();

  // Check if user selected option number (e.g., "1", "2", "3")
  if (/^[1-8]$/.test(trimmed)) {
    const idx = Number(trimmed) - 1;
    if (offeredSlots[idx]) return offeredSlots[idx];
  }

  // Check display time or HH:mm match (e.g. "11:30 AM", "11:30", "10:00", "2:00 PM")
  const normText = trimmed.toLowerCase().replace(/\./g, '');
  for (const slot of offeredSlots) {
    const disp = slot.displayTime.toLowerCase();
    if (normText.includes(disp) || normText.includes(slot.startTime.toLowerCase())) {
      return slot;
    }
    const hourOnly = disp.replace(':00', '');
    if (normText === hourOnly) {
      return slot;
    }
  }

  return null;
}

// ============================================================================
// MEDICAL SAFETY GUARDRAILS
// ============================================================================
const EMERGENCY_PATTERNS =
  /\b(bleeding heavily|uncontrolled bleeding|can't breathe|cannot breathe|difficulty breathing|chest pain|unconscious|fainted|facial fracture|broken jaw|life threatening|911)\b/i;

const MEDICAL_ADVICE_PATTERNS =
  /\b(prescribe|antibiotic|amoxicillin|dosage|diagnose my|what medication should i take|is this cancer|medical diagnosis)\b/i;

const HUMAN_HANDOVER_PATTERNS =
  /\b(talk to a human|speak to a person|real person|human receptionist|front desk|staff member|agent please|insurance claim dispute|billing manager)\b/i;

export interface AIProcessResponse {
  reply: string;
  toolsExecuted: AIToolExecutionResult[];
  handedOverToHuman: boolean;
  suppressedBecauseHumanMode?: boolean;
}

/**
 * Processes an incoming patient message via the AI Receptionist state machine & validated backend tools.
 */
export function processPatientMessageWithAI(input: {
  patientPhone: string;
  messageText: string;
  conversationId?: string;
}): AIProcessResponse {
  const normPhone = normalizePhone(input.patientPhone);
  const text = input.messageText.trim();
  const lower = text.toLowerCase();
  const state = clinicStore.getState();
  const toolsExecuted: AIToolExecutionResult[] = [];

  // 1. Check if conversation is currently handled by a human receptionist
  if (input.conversationId) {
    const conv = state.conversations.find((c) => c.id === input.conversationId);
    if (conv && conv.handlingMode === 'human') {
      return {
        reply: '',
        toolsExecuted: [],
        handedOverToHuman: true,
        suppressedBecauseHumanMode: true,
      };
    }
  }

  // 2. Check if AI Receptionist is globally disabled
  if (!state.aiConfig.enabled) {
    return {
      reply:
        'Thank you for messaging Gasha Demo Clinic. Our automated assistant is currently offline and a human receptionist will respond to your message shortly.',
      toolsExecuted: [],
      handedOverToHuman: true,
    };
  }

  // 3. Medical Emergency Guardrail
  if (EMERGENCY_PATTERNS.test(text)) {
    const handoverOut = aiBackendTools.transferToHuman(
      { reason: 'Emergency medical symptoms reported by patient', urgency: 'emergency' },
      input.conversationId
    );
    toolsExecuted.push({
      toolName: 'transferToHuman',
      args: { reason: 'Emergency medical symptoms reported by patient', urgency: 'emergency' },
      output: handoverOut,
      validatedByZod: true,
    });
    return {
      reply: `${state.aiConfig.emergencyResponseMessage} Emergency Hotline: ${state.clinic.emergencyPhone}. I have also flagged our clinical team immediately.`,
      toolsExecuted,
      handedOverToHuman: true,
    };
  }

  // 4. Medical Diagnosis / Prescription Guardrail
  if (MEDICAL_ADVICE_PATTERNS.test(text)) {
    const handoverOut = aiBackendTools.transferToHuman(
      { reason: 'Patient requested medical diagnosis or medication advice', urgency: 'high' },
      input.conversationId
    );
    toolsExecuted.push({
      toolName: 'transferToHuman',
      args: { reason: 'Patient requested medical diagnosis or medication advice', urgency: 'high' },
      output: handoverOut,
      validatedByZod: true,
    });
    return {
      reply:
        'As an AI administrative assistant, I cannot diagnose medical conditions or recommend medications. I have transferred your conversation to our clinical reception team so a qualified dental professional can assist you.',
      toolsExecuted,
      handedOverToHuman: true,
    };
  }

  // 5. Explicit Human Handover Request
  if (HUMAN_HANDOVER_PATTERNS.test(text)) {
    const handoverOut = aiBackendTools.transferToHuman(
      { reason: 'Patient requested human receptionist', urgency: 'normal' },
      input.conversationId
    );
    toolsExecuted.push({
      toolName: 'transferToHuman',
      args: { reason: 'Patient requested human receptionist', urgency: 'normal' },
      output: handoverOut,
      validatedByZod: true,
    });
    return {
      reply:
        'Certainly! I have transferred your chat to our front-desk receptionist. A team member will take over this conversation and reply shortly.',
      toolsExecuted,
      handedOverToHuman: true,
    };
  }

  const draft: PendingBookingDraft = sessionDrafts.get(normPhone) || { step: 'idle' };
  const existingPatient = state.patients.find((p) => p.phone === normPhone);
  if (existingPatient && !draft.patientName) {
    draft.patientName = existingPatient.fullName;
  }

  // 6. Check for Cancellation Intent
  if (/\b(cancel)\b/i.test(lower) && !lower.includes('policy')) {
    const historyOut = aiBackendTools.getPatientAppointmentHistory({ patientPhone: normPhone });
    toolsExecuted.push({
      toolName: 'getPatientAppointmentHistory',
      args: { patientPhone: normPhone },
      output: historyOut,
      validatedByZod: true,
    });

    const activeAppts = historyOut.appointments.filter(
      (a) => a.status === 'confirmed' || a.status === 'pending'
    );
    if (activeAppts.length === 0) {
      return {
        reply:
          'I checked your profile and could not find any upcoming active appointments to cancel. Would you like to book a new appointment?',
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    const target = activeAppts[0];
    const cancelOut = aiBackendTools.cancelAppointment({
      appointmentId: target.id,
      patientPhone: normPhone,
      reason: 'Cancelled by patient via WhatsApp',
    });
    toolsExecuted.push({
      toolName: 'cancelAppointment',
      args: { appointmentId: target.id, patientPhone: normPhone },
      output: cancelOut,
      validatedByZod: true,
    });

    sessionDrafts.delete(normPhone);
    return {
      reply: `Your ${target.serviceName} appointment with ${target.doctorName} on ${target.appointmentDate} at ${formatDisplayTime(target.startTime)} has been cancelled. Whenever you're ready to book again, just let me know!`,
      toolsExecuted,
      handedOverToHuman: false,
    };
  }

  // 7. Check for Reschedule Intent
  if (/\b(reschedule|change my appointment|move my appointment)\b/i.test(lower)) {
    const historyOut = aiBackendTools.getPatientAppointmentHistory({ patientPhone: normPhone });
    toolsExecuted.push({
      toolName: 'getPatientAppointmentHistory',
      args: { patientPhone: normPhone },
      output: historyOut,
      validatedByZod: true,
    });

    const activeAppts = historyOut.appointments.filter(
      (a) => a.status === 'confirmed' || a.status === 'pending'
    );
    if (activeAppts.length === 0) {
      return {
        reply:
          'I could not find an upcoming appointment under your phone number to reschedule. Would you like to book a new appointment instead?',
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    const target = activeAppts[0];
    draft.targetAppointmentId = target.id;
    draft.doctorId = target.doctorId;
    draft.doctorName = target.doctorName;
    draft.serviceId = target.serviceId;
    draft.serviceName = target.serviceName;
    draft.step = 'awaiting_reschedule_date';
    sessionDrafts.set(normPhone, draft);

    return {
      reply: `I found your ${target.serviceName} appointment with ${target.doctorName} on ${target.appointmentDate} at ${formatDisplayTime(target.startTime)}. What new date would you prefer to reschedule to? (e.g., Tomorrow or YYYY-MM-DD)`,
      toolsExecuted,
      handedOverToHuman: false,
    };
  }

  // Handle Reschedule Date & Time Steps
  if (draft.step === 'awaiting_reschedule_date') {
    const parsedDate = resolveRelativeDate(text);
    if (!parsedDate) {
      return {
        reply: 'Please let me know the date you would prefer (for example, "Tomorrow" or "2026-11-26").',
        toolsExecuted,
        handedOverToHuman: false,
      };
    }
    const slotsOut = aiBackendTools.getAvailableSlots({
      date: parsedDate,
      doctorId: draft.doctorId,
      serviceId: draft.serviceId,
    });
    toolsExecuted.push({
      toolName: 'getAvailableSlots',
      args: { date: parsedDate, doctorId: draft.doctorId, serviceId: draft.serviceId },
      output: slotsOut,
      validatedByZod: true,
    });

    if (slotsOut.slots.length === 0) {
      return {
        reply: `We don't have open slots on ${parsedDate} for ${draft.doctorName}. Would you like to try another date?`,
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    draft.date = parsedDate;
    draft.offeredSlots = slotsOut.slots.slice(0, 4);
    draft.step = 'awaiting_reschedule_time';
    sessionDrafts.set(normPhone, draft);

    const listStr = draft.offeredSlots
      .map((s, idx) => `${idx + 1}. ${s.displayTime}`)
      .join('\n');
    return {
      reply: `We have these available times on ${parsedDate} with ${draft.doctorName}:\n\n${listStr}\n\nWhich time would you prefer?`,
      toolsExecuted,
      handedOverToHuman: false,
    };
  }

  if (draft.step === 'awaiting_reschedule_time' && draft.offeredSlots && draft.targetAppointmentId && draft.date) {
    const picked = matchTimeFromUserText(text, draft.offeredSlots);
    if (!picked) {
      return {
        reply: 'Please reply with one of the available times listed above (for example, "1" or "10:00 AM").',
        toolsExecuted,
        handedOverToHuman: false,
      };
    }
    const resOut = aiBackendTools.rescheduleAppointment({
      appointmentId: draft.targetAppointmentId,
      patientPhone: normPhone,
      newDate: draft.date,
      newStartTime: picked.startTime,
      doctorId: picked.doctorId,
    });
    toolsExecuted.push({
      toolName: 'rescheduleAppointment',
      args: {
        appointmentId: draft.targetAppointmentId,
        patientPhone: normPhone,
        newDate: draft.date,
        newStartTime: picked.startTime,
      },
      output: resOut,
      validatedByZod: true,
    });

    sessionDrafts.delete(normPhone);
    if (!resOut.success) {
      return {
        reply: `I wasn't able to reschedule to that slot: ${resOut.error}`,
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    return {
      reply: `Your appointment has been rescheduled to ${draft.date} at ${picked.displayTime} with ${picked.doctorName}. Your updated reminder is scheduled!`,
      toolsExecuted,
      handedOverToHuman: false,
    };
  }

  // 8. Information Queries (Opening Hours, Services, Doctors, Clinic Info) work at any step
  if (draft.step !== 'awaiting_confirmation') {
    if (/\b(opening hours|what time do you open|hours|open on)\b/i.test(lower)) {
      const hoursOut = aiBackendTools.getClinicOpeningHours({});
      toolsExecuted.push({
        toolName: 'getClinicOpeningHours',
        args: {},
        output: hoursOut,
        validatedByZod: true,
      });
      const summary = hoursOut.openingHours
        .map((d) => (d.isOpen ? `${d.day}: ${d.openTime} – ${d.closeTime}` : `${d.day}: Closed (${d.note || ''})`))
        .join('\n');
      return {
        reply: `Here are our opening hours at ${state.clinic.name}:\n\n${summary}\n\nWould you like to book an appointment?`,
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    if (/\b(where are you located|address|location|phone number|contact)\b/i.test(lower)) {
      const infoOut = aiBackendTools.getClinicInformation({});
      toolsExecuted.push({
        toolName: 'getClinicInformation',
        args: {},
        output: infoOut,
        validatedByZod: true,
      });
      return {
        reply: `${infoOut.name} is located at ${infoOut.address}. You can reach us at ${infoOut.phone}. Would you like to book a visit?`,
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    if (/\b(what services|services do you offer|treatments do you offer|prices|how much|cost)\b/i.test(lower)) {
      const svcsOut = aiBackendTools.getClinicServices({});
      toolsExecuted.push({
        toolName: 'getClinicServices',
        args: {},
        output: svcsOut,
        validatedByZod: true,
      });
      const list = svcsOut.map((s) => `• ${s.name} (${s.durationMinutes} mins) — ${s.priceLabel}`).join('\n');
      return {
        reply: `We offer the following treatments at ${state.clinic.name}:\n\n${list}\n\nWhich treatment would you like to book?`,
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    if (/\b(who are the doctors|which doctors|specialists|dentists)\b/i.test(lower)) {
      const docsOut = aiBackendTools.getAvailableDoctors({});
      toolsExecuted.push({
        toolName: 'getAvailableDoctors',
        args: {},
        output: docsOut,
        validatedByZod: true,
      });
      const list = docsOut.map((d) => `• ${d.name} — ${d.specialization}`).join('\n');
      return {
        reply: `Our clinical specialists include:\n\n${list}\n\nWould you like to check available appointment times with one of our doctors?`,
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    if (/\b(my appointments|check my appointment|appointment status)\b/i.test(lower)) {
      const detailsOut = aiBackendTools.getAppointmentDetails({ patientPhone: normPhone });
      toolsExecuted.push({
        toolName: 'getAppointmentDetails',
        args: { patientPhone: normPhone },
        output: detailsOut,
        validatedByZod: true,
      });
      const list = detailsOut.appointments || [];
      if (list.length === 0) {
        return {
          reply: 'You do not have any upcoming active appointments under this number. Would you like to book one now?',
          toolsExecuted,
          handedOverToHuman: false,
        };
      }
      const next = list[0];
      return {
        reply: `Your upcoming appointment is for ${next.serviceName} with ${next.doctorName} on ${next.appointmentDate} at ${formatDisplayTime(next.startTime)} (Status: ${next.status.toUpperCase()}). Let me know if you need to reschedule or cancel.`,
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    // Direct Time Slot Query (e.g., "plz share your time slot", "available slots", "what times are available")
    if (/\b(time slot|time slots|available slot|available slots|available time|share your time|free slot|open slot)\b/i.test(lower)) {
      const targetDate =
        resolveRelativeDate(text) ||
        new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const slotsOut = aiBackendTools.getAvailableSlots({
        date: targetDate,
        doctorId: draft.doctorId,
        serviceId: draft.serviceId,
      });
      toolsExecuted.push({
        toolName: 'getAvailableSlots',
        args: { date: targetDate, doctorId: draft.doctorId, serviceId: draft.serviceId },
        output: slotsOut,
        validatedByZod: true,
      });

      const distinctSlots: AvailableSlot[] = [];
      for (const s of slotsOut.slots) {
        if (!distinctSlots.some((x) => x.displayTime === s.displayTime)) {
          distinctSlots.push(s);
        }
        if (distinctSlots.length >= 5) break;
      }

      if (distinctSlots.length === 0) {
        return {
          reply: `We don't have open slots on ${targetDate}. Which date would you like me to check for you?`,
          toolsExecuted,
          handedOverToHuman: false,
        };
      }

      draft.date = targetDate;
      draft.offeredSlots = distinctSlots;
      if (!draft.serviceId) {
        const defaultSvc =
          state.services.find((s) => s.id === 'svc_checkup') || state.services[0];
        draft.serviceId = defaultSvc?.id;
        draft.serviceName = defaultSvc?.name;
      }
      draft.step = 'awaiting_time_selection';
      sessionDrafts.set(normPhone, draft);

      const formattedList = distinctSlots
        .map((s, idx) => `${idx + 1}. ${s.displayTime} (${s.doctorName})`)
        .join('\n');

      return {
        reply: `Here are our available appointment time slots for ${targetDate}:\n\n${formattedList}\n\nReply with a slot number (1–${distinctSlots.length}) or time (e.g. "${distinctSlots[0].displayTime}") to reserve it!`,
        toolsExecuted,
        handedOverToHuman: false,
      };
    }
  }

  // ==========================================================================
  // MULTI-TURN BOOKING WORKFLOW (Section 7 Exact Flow)
  // ==========================================================================
  // Step 1: Greeting / Booking Initiation (or restart if user explicitly says "want to book an appointment")
  if (draft.step === 'idle' || /\b(want to book an appointment|book an appointment|start over)\b/i.test(lower)) {
    draft.step = 'awaiting_name';
    sessionDrafts.set(normPhone, draft);
    return {
      reply: `Hello! Welcome to ${state.clinic.name}. I'd be happy to help you book an appointment. May I know your name?`,
      toolsExecuted,
      handedOverToHuman: false,
    };
  }

  // Step 2: Collect Patient Name
  if (draft.step === 'awaiting_name') {
    const cleanedName = text
      .replace(/^(my name is|i am|i'm|this is|it's)\s+/i, '')
      .replace(/[.!]+$/, '')
      .trim();
    draft.patientName = cleanedName || 'Valued Patient';
    draft.step = 'awaiting_service';
    sessionDrafts.set(normPhone, draft);
    return {
      reply: `Thank you, ${draft.patientName}. What would you like to visit us for?`,
      toolsExecuted,
      handedOverToHuman: false,
    };
  }

  // Step 3: Collect Visit Reason / Service
  if (draft.step === 'awaiting_service') {
    const svcsOut = aiBackendTools.getClinicServices({});
    toolsExecuted.push({
      toolName: 'getClinicServices',
      args: {},
      output: svcsOut,
      validatedByZod: true,
    });

    const matchedSvc = state.services.find(
      (s) =>
        s.isActive &&
        (lower.includes(s.name.toLowerCase()) ||
          (lower.includes('whitening') && s.id === 'svc_whitening') ||
          (lower.includes('veneer') && s.id === 'svc_veneers') ||
          (lower.includes('implant') && s.id === 'svc_implants') ||
          ((lower.includes('aligner') || lower.includes('invisalign') || lower.includes('brace')) &&
            s.id === 'svc_aligners') ||
          ((lower.includes('root canal') || lower.includes('pain') || lower.includes('toothache')) &&
            s.id === 'svc_root_canal') ||
          ((lower.includes('kid') || lower.includes('child') || lower.includes('pediatric')) &&
            s.id === 'svc_pediatric') ||
          ((lower.includes('checkup') || lower.includes('cleaning') || lower.includes('consult') || lower.includes('exam')) &&
            s.id === 'svc_checkup'))
    );

    const chosenService = matchedSvc || state.services.find((s) => s.id === 'svc_checkup') || state.services[0];
    draft.serviceId = chosenService.id;
    draft.serviceName = chosenService.name;
    draft.visitReason = text;
    draft.step = 'awaiting_doctor';
    sessionDrafts.set(normPhone, draft);

    return {
      reply: 'Certainly. Do you have a preferred doctor, or would you like me to check the available doctors?',
      toolsExecuted,
      handedOverToHuman: false,
    };
  }

  // Step 4: Collect Preferred Doctor or Any Available Doctor
  if (draft.step === 'awaiting_doctor') {
    const docsOut = aiBackendTools.getAvailableDoctors({ serviceId: draft.serviceId });
    toolsExecuted.push({
      toolName: 'getAvailableDoctors',
      args: { serviceId: draft.serviceId },
      output: docsOut,
      validatedByZod: true,
    });

    const matchedDoc = state.doctors.find(
      (d) =>
        d.isActive &&
        d.name
          .toLowerCase()
          .split(' ')
          .some((part) => part.length > 3 && lower.includes(part))
    );

    if (matchedDoc) {
      draft.doctorId = matchedDoc.id;
      draft.doctorName = matchedDoc.name;
    } else {
      draft.doctorId = undefined;
      draft.doctorName = 'Any available doctor';
    }

    draft.step = 'awaiting_date';
    sessionDrafts.set(normPhone, draft);

    return {
      reply: 'I can help with that. What date would you prefer?',
      toolsExecuted,
      handedOverToHuman: false,
    };
  }

  // Step 5: Collect Preferred Date & Check Real Availability via getAvailableSlots()
  if (draft.step === 'awaiting_date') {
    const parsedDate = resolveRelativeDate(text);
    if (!parsedDate) {
      return {
        reply: 'Could you please specify the date you prefer? (For example, "Tomorrow", "Monday", or "2026-11-26")',
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    const slotsOut = aiBackendTools.getAvailableSlots({
      date: parsedDate,
      doctorId: draft.doctorId,
      serviceId: draft.serviceId,
    });
    toolsExecuted.push({
      toolName: 'getAvailableSlots',
      args: { date: parsedDate, doctorId: draft.doctorId, serviceId: draft.serviceId },
      output: slotsOut,
      validatedByZod: true,
    });

    if (slotsOut.slots.length === 0) {
      return {
        reply: `We don't have any available slots on ${parsedDate} due to existing bookings or clinic hours. What other date would work for you?`,
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    // Pick 3-4 distinct well-spaced slots to present cleanly
    const distinctSlots: AvailableSlot[] = [];
    for (const s of slotsOut.slots) {
      if (!distinctSlots.some((x) => x.displayTime === s.displayTime)) {
        distinctSlots.push(s);
      }
      if (distinctSlots.length >= 4) break;
    }

    draft.date = parsedDate;
    draft.offeredSlots = distinctSlots;
    draft.step = 'awaiting_time_selection';
    sessionDrafts.set(normPhone, draft);

    const formattedList = distinctSlots
      .map((s, idx) => `${idx + 1}. ${s.displayTime}.`)
      .join('\n');

    return {
      reply: `Let me check the available appointments for you.\n\nWe have these available times:\n\n${formattedList}\n\nWhich time would you prefer?`,
      toolsExecuted,
      handedOverToHuman: false,
    };
  }

  // Step 6: Patient Selects a Slot -> Ask for Explicit Confirmation
  if (draft.step === 'awaiting_time_selection' && draft.offeredSlots) {
    const picked = matchTimeFromUserText(text, draft.offeredSlots);
    if (!picked) {
      const optionsText = draft.offeredSlots.map((s) => s.displayTime).join(', ');
      return {
        reply: `Please choose one of our available times (${optionsText}), or reply with the option number (1–${draft.offeredSlots.length}).`,
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    draft.selectedSlot = picked;
    draft.doctorId = picked.doctorId;
    draft.doctorName = picked.doctorName;
    draft.step = 'awaiting_confirmation';
    sessionDrafts.set(normPhone, draft);

    const visitLabel = (draft.visitReason || draft.serviceName || 'dental consultation').toLowerCase();
    return {
      reply: `Just to confirm, you would like to book a ${visitLabel} on ${draft.date} at ${picked.displayTime} with ${picked.doctorName}. Shall I confirm your appointment?`,
      toolsExecuted,
      handedOverToHuman: false,
    };
  }

  // Step 7: Patient Confirms -> Backend Re-Validates & Atomically Creates Appointment
  if (draft.step === 'awaiting_confirmation' && draft.selectedSlot && draft.date) {
    if (/\b(no|cancel|change|different|wait)\b/i.test(lower)) {
      draft.step = 'awaiting_date';
      sessionDrafts.set(normPhone, draft);
      return {
        reply: 'No problem at all! What date would you prefer instead?',
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    if (/\b(yes|yeah|yep|confirm|sure|ok|okay|please|book it)\b/i.test(lower)) {
      const createArgs = {
        patientName: draft.patientName || 'Valued Patient',
        patientPhone: normPhone,
        doctorId: draft.selectedSlot.doctorId,
        serviceId: draft.serviceId,
        serviceName: draft.serviceName,
        appointmentDate: draft.date,
        startTime: draft.selectedSlot.startTime,
        visitReason: draft.visitReason || draft.serviceName || 'Dental appointment',
        patientConfirmed: true as const,
      };

      const createOut = aiBackendTools.createAppointment(createArgs);
      toolsExecuted.push({
        toolName: 'createAppointment',
        args: createArgs,
        output: createOut,
        validatedByZod: true,
      });

      sessionDrafts.delete(normPhone);

      if (!createOut.success || !createOut.appointment) {
        return {
          reply: `I'm sorry, that slot just became unavailable (${createOut.error}). Would you like me to check other times for ${draft.date}?`,
          toolsExecuted,
          handedOverToHuman: false,
        };
      }

      return {
        reply: `Your appointment has been successfully confirmed.\n\n• Treatment: ${createOut.appointment.serviceName}\n• Doctor: ${createOut.appointment.doctorName}\n• Date & Time: ${createOut.appointment.appointmentDate} at ${formatDisplayTime(createOut.appointment.startTime)}\n\nYou will receive an automated reminder before your visit. Thank you for choosing ${state.clinic.name}!`,
        toolsExecuted,
        handedOverToHuman: false,
      };
    }

    return {
      reply: `Please reply "Yes" to confirm your appointment on ${draft.date} at ${draft.selectedSlot.displayTime}, or "No" if you would like to choose a different time.`,
      toolsExecuted,
      handedOverToHuman: false,
    };
  }

  return {
    reply: `Welcome to ${state.clinic.name}! Would you like to book, reschedule, or check an appointment?`,
    toolsExecuted,
    handedOverToHuman: false,
  };
}

/**
 * Simulates or processes an inbound WhatsApp message end-to-end:
 * 1. Idempotency check on whatsappMessageId
 * 2. Finds/creates patient and conversation
 * 3. Stores inbound message
 * 4. Checks human takeover mode
 * 5. Runs AI receptionist and saves outbound response
 */
export function handleInboundWhatsAppWebhookMessage(input: {
  whatsappMessageId: string;
  fromPhone: string;
  senderProfileName?: string;
  messageType?: 'text' | 'interactive' | 'template' | 'unsupported';
  textContent: string;
}): {
  duplicate: boolean;
  conversation: Conversation;
  inboundMessage?: WhatsAppMessage;
  outboundMessage?: WhatsAppMessage;
  aiResponse?: AIProcessResponse;
} {
  const normPhone = normalizePhone(input.fromPhone);

  // 1. Idempotency check: prevent duplicate processing of the same WhatsApp webhook delivery
  const initialState = clinicStore.getState();
  const existingMsg = initialState.messages.find(
    (m) => m.whatsappMessageId === input.whatsappMessageId
  );
  const existingConv = initialState.conversations.find((c) => c.phone === normPhone);
  if (existingMsg && existingConv) {
    return {
      duplicate: true,
      conversation: existingConv,
      inboundMessage: existingMsg,
    };
  }

  // 2. Find or create Patient (Note: upsertPatient calls saveState, so re-read getState() afterwards!)
  const patient = clinicStore.upsertPatient({
    fullName: input.senderProfileName || 'WhatsApp Patient',
    phone: normPhone,
  });

  const state = clinicStore.getState();

  // 3. Find or create Conversation
  let conv = state.conversations.find((c) => c.phone === normPhone);
  if (!conv) {
    conv = {
      id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      clinicId: state.clinic.id,
      patientId: patient.id,
      patientName: patient.fullName,
      phone: normPhone,
      status: 'open',
      handlingMode: 'ai',
      unreadCount: 0,
      lastMessagePreview: input.textContent,
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    clinicStore.getState().conversations.unshift(conv);
  } else {
    conv.status = 'open';
    conv.patientName = patient.fullName;
    conv.lastMessagePreview = input.textContent;
    conv.lastMessageAt = new Date().toISOString();
    if (conv.handlingMode === 'human') {
      conv.unreadCount += 1;
    }
  }

  // 4. Store Inbound Message
  const inboundMsg: WhatsAppMessage = {
    id: `msg_in_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    conversationId: conv.id,
    whatsappMessageId: input.whatsappMessageId,
    direction: 'inbound',
    senderType: 'patient',
    messageType: input.messageType || 'text',
    content: input.textContent,
    deliveryStatus: 'read',
    createdAt: new Date().toISOString(),
  };
  clinicStore.getState().messages.push(inboundMsg);

  // 5. Handle unsupported message types gracefully
  if (input.messageType === 'unsupported') {
    if (conv.handlingMode === 'human') {
      clinicStore.commitChanges();
      return {
        duplicate: false,
        conversation:
          clinicStore.getState().conversations.find((c) => c.id === conv!.id) || conv,
        inboundMessage: inboundMsg,
      };
    }
    const unsupportedReply: WhatsAppMessage = {
      id: `msg_out_${Date.now()}_unsup`,
      conversationId: conv.id,
      whatsappMessageId: `wamid.out.${Date.now()}`,
      direction: 'outbound',
      senderType: 'ai',
      messageType: 'text',
      content:
        'I received your attachment, but I can currently only process text messages. Please reply with a text message or type "HUMAN" to connect with our reception desk.',
      deliveryStatus: 'sent',
      createdAt: new Date().toISOString(),
    };
    clinicStore.getState().messages.push(unsupportedReply);
    conv.lastMessagePreview = unsupportedReply.content;
    clinicStore.commitChanges();
    return {
      duplicate: false,
      conversation:
        clinicStore.getState().conversations.find((c) => c.id === conv!.id) || conv,
      inboundMessage: inboundMsg,
      outboundMessage: unsupportedReply,
    };
  }

  // 6. Check if human receptionist has taken over
  if (conv.handlingMode === 'human') {
    clinicStore.commitChanges();
    return {
      duplicate: false,
      conversation:
        clinicStore.getState().conversations.find((c) => c.id === conv!.id) || conv,
      inboundMessage: inboundMsg,
      aiResponse: {
        reply: '',
        toolsExecuted: [],
        handedOverToHuman: true,
        suppressedBecauseHumanMode: true,
      },
    };
  }

  // 7. Process with AI Receptionist (Note: tools inside AI may call saveState, so always read fresh getState() after!)
  const aiRes = processPatientMessageWithAI({
    patientPhone: normPhone,
    messageText: input.textContent,
    conversationId: conv.id,
  });

  const postAiConv =
    clinicStore.getState().conversations.find((c) => c.id === conv!.id) || conv;

  if (aiRes.suppressedBecauseHumanMode || !aiRes.reply) {
    clinicStore.commitChanges();
    return {
      duplicate: false,
      conversation:
        clinicStore.getState().conversations.find((c) => c.id === conv!.id) || postAiConv,
      inboundMessage: inboundMsg,
      aiResponse: aiRes,
    };
  }

  // Update patient name if AI collected it
  const updatedPatient = clinicStore
    .getState()
    .patients.find((p) => p.phone === normPhone);
  const currentDraft = sessionDrafts.get(normPhone);
  if (
    updatedPatient &&
    currentDraft?.patientName &&
    updatedPatient.fullName === 'WhatsApp Patient'
  ) {
    updatedPatient.fullName = currentDraft.patientName;
    postAiConv.patientName = currentDraft.patientName;
  }

  // 8. Save Outbound AI Message
  const outboundMsg: WhatsAppMessage = {
    id: `msg_out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    conversationId: postAiConv.id,
    whatsappMessageId: `wamid.ai.${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    direction: 'outbound',
    senderType: 'ai',
    messageType: 'text',
    content: aiRes.reply,
    deliveryStatus: 'delivered',
    toolCallsExecuted: aiRes.toolsExecuted.map((t) => t.toolName),
    createdAt: new Date().toISOString(),
  };

  clinicStore.getState().messages.push(outboundMsg);
  postAiConv.lastMessagePreview = outboundMsg.content;
  postAiConv.lastMessageAt = outboundMsg.createdAt;
  clinicStore.commitChanges();

  return {
    duplicate: false,
    conversation:
      clinicStore.getState().conversations.find((c) => c.id === postAiConv.id) ||
      postAiConv,
    inboundMessage: inboundMsg,
    outboundMessage: outboundMsg,
    aiResponse: aiRes,
  };
}
