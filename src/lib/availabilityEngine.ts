import type {
  Appointment,
  AvailableSlot,
  ClinicHoliday,
  ClinicProfile,
  ClinicService,
  Doctor,
} from '../types/clinic';

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDisplayTime(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function getDayOfWeekFromDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  return utcDate.getUTCDay();
}

export interface BusyInterval {
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface AvailabilityCheckInput {
  date: string; // "YYYY-MM-DD"
  clinic: ClinicProfile;
  doctors: Doctor[];
  services: ClinicService[];
  holidays: ClinicHoliday[];
  existingAppointments: Appointment[];
  externalBusyIntervals?: BusyInterval[];
  doctorId?: string;
  serviceId?: string;
  excludeAppointmentId?: string;
  slotStepMinutes?: number;
}

export function computeAvailableSlots(input: AvailabilityCheckInput): AvailableSlot[] {
  const {
    date,
    clinic,
    doctors,
    services,
    holidays,
    existingAppointments,
    externalBusyIntervals = [],
    doctorId,
    serviceId,
    excludeAppointmentId,
    slotStepMinutes = 30,
  } = input;

  // 1. Check Clinic Holidays
  const isHoliday = holidays.some((h) => h.holidayDate === date);
  if (isHoliday) {
    return [];
  }

  // 2. Check Clinic Opening Hours for this day of week
  const dayOfWeek = getDayOfWeekFromDateString(date);
  const clinicDay = clinic.openingHours.find((oh) => oh.dayOfWeek === dayOfWeek);
  if (!clinicDay || !clinicDay.isOpen) {
    return [];
  }

  const clinicOpenMin = timeToMinutes(clinicDay.openTime);
  const clinicCloseMin = timeToMinutes(clinicDay.closeTime);

  // 3. Determine appointment duration from service or clinic default
  const selectedService = serviceId ? services.find((s) => s.id === serviceId) : undefined;

  // 4. Filter eligible active doctors
  const candidateDoctors = doctors.filter((doc) => {
    if (!doc.isActive) return false;
    if (doctorId && doc.id !== doctorId) return false;
    if (serviceId && doc.serviceIds.length > 0 && !doc.serviceIds.includes(serviceId)) {
      return false;
    }
    return true;
  });

  const slots: AvailableSlot[] = [];

  for (const doc of candidateDoctors) {
    const docSchedule = doc.availability.find(
      (a) => a.dayOfWeek === dayOfWeek && a.isAvailable
    );
    if (!docSchedule) continue;

    const duration =
      selectedService?.durationMinutes ||
      doc.appointmentDurationMinutes ||
      clinic.defaultAppointmentDurationMinutes ||
      45;

    const workStartMin = Math.max(clinicOpenMin, timeToMinutes(docSchedule.startTime));
    const workEndMin = Math.min(clinicCloseMin, timeToMinutes(docSchedule.endTime));

    if (workEndMin - workStartMin < duration) continue;

    // Collect doctor breaks for this day
    const docBreaks = doc.breaks
      .filter((b) => b.dayOfWeek === dayOfWeek)
      .map((b) => ({
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime),
      }));

    // Collect doctor existing active appointments for this date
    const docAppts = existingAppointments
      .filter(
        (a) =>
          a.doctorId === doc.id &&
          a.appointmentDate === date &&
          a.status !== 'cancelled' &&
          a.id !== excludeAppointmentId
      )
      .map((a) => ({
        start: timeToMinutes(a.startTime),
        end: timeToMinutes(a.endTime),
      }));

    // Collect Google Calendar busy intervals for this doctor & date
    const gcalBusy = externalBusyIntervals
      .filter((b) => b.doctorId === doc.id && b.date === date)
      .map((b) => ({
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime),
      }));

    for (
      let cursor = workStartMin;
      cursor + duration <= workEndMin;
      cursor += slotStepMinutes
    ) {
      const slotStart = cursor;
      const slotEnd = cursor + duration;

      // Check break overlap
      const overlapsBreak = docBreaks.some(
        (b) => slotStart < b.end && slotEnd > b.start
      );
      if (overlapsBreak) continue;

      // Check appointment overlap
      const overlapsAppt = docAppts.some(
        (a) => slotStart < a.end && slotEnd > a.start
      );
      if (overlapsAppt) continue;

      // Check Google Calendar free/busy overlap
      const overlapsGcal = gcalBusy.some(
        (g) => slotStart < g.end && slotEnd > g.start
      );
      if (overlapsGcal) continue;

      const startTimeStr = minutesToTime(slotStart);
      const endTimeStr = minutesToTime(slotEnd);

      slots.push({
        doctorId: doc.id,
        doctorName: doc.name,
        date,
        startTime: startTimeStr,
        endTime: endTimeStr,
        displayTime: formatDisplayTime(startTimeStr),
      });
    }
  }

  return slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export function validateSpecificSlot(
  input: AvailabilityCheckInput & {
    targetDoctorId: string;
    targetStartTime: string;
  }
): {
  valid: boolean;
  reason?: string;
  slot?: AvailableSlot;
} {
  const { date, clinic, doctors, holidays, targetDoctorId, targetStartTime } = input;

  const holiday = holidays.find((h) => h.holidayDate === date);
  if (holiday) {
    return {
      valid: false,
      reason: `Clinic is closed on ${date} for ${holiday.description}.`,
    };
  }

  const dayOfWeek = getDayOfWeekFromDateString(date);
  const clinicDay = clinic.openingHours.find((oh) => oh.dayOfWeek === dayOfWeek);
  if (!clinicDay || !clinicDay.isOpen) {
    return {
      valid: false,
      reason: `Clinic is closed on ${clinicDay?.day || 'this day'}.`,
    };
  }

  const doc = doctors.find((d) => d.id === targetDoctorId && d.isActive);
  if (!doc) {
    return {
      valid: false,
      reason: 'Selected doctor is not active or does not exist.',
    };
  }

  const availableSlots = computeAvailableSlots({
    ...input,
    doctorId: targetDoctorId,
    slotStepMinutes: 15, // Allow 15-min granularity validation
  });

  const matchedSlot = availableSlots.find((s) => s.startTime === targetStartTime);
  if (!matchedSlot) {
    return {
      valid: false,
      reason: `The requested slot (${formatDisplayTime(targetStartTime)} on ${date}) with ${doc.name} is unavailable due to an existing appointment, break, or working hours limit.`,
    };
  }

  return {
    valid: true,
    slot: matchedSlot,
  };
}
