import type { Handler } from '@netlify/functions';
import { clinicStore } from '../../src/lib/clinicDataStore';
import {
  adminAppointmentSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
} from '../../src/lib/schemas';
import { errorResponse, jsonResponse } from './_shared/security';

export const handler: Handler = async (event) => {
  const subPath = event.path.replace(/^\/(\.netlify\/functions\/appointments|api\/appointments)/, '') || '/';
  const segments = subPath.split('/').filter(Boolean);

  // GET /api/appointments or GET /api/appointments/slots?date=YYYY-MM-DD
  if (event.httpMethod === 'GET') {
    if (segments[0] === 'slots') {
      const date = event.queryStringParameters?.date;
      if (!date) {
        return errorResponse(400, 'Query parameter "date" (YYYY-MM-DD) is required.', 'MISSING_DATE');
      }
      const slots = clinicStore.getAvailableSlots({
        date,
        doctorId: event.queryStringParameters?.doctorId,
        serviceId: event.queryStringParameters?.serviceId,
      });
      return jsonResponse(200, { success: true, date, slots });
    }

    if (segments.length === 1) {
      const appt = clinicStore.getState().appointments.find((a) => a.id === segments[0]);
      if (!appt) return errorResponse(404, 'Appointment not found', 'NOT_FOUND');
      return jsonResponse(200, { success: true, appointment: appt });
    }

    const { appointments } = clinicStore.getState();
    const dateFilter = event.queryStringParameters?.date;
    const doctorFilter = event.queryStringParameters?.doctorId;
    const statusFilter = event.queryStringParameters?.status;

    const filtered = appointments.filter((a) => {
      if (dateFilter && a.appointmentDate !== dateFilter) return false;
      if (doctorFilter && a.doctorId !== doctorFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });

    return jsonResponse(200, { success: true, appointments: filtered });
  }

  // POST /api/appointments (Create), /api/appointments/:id/cancel, /api/appointments/:id/reschedule
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');

      if (segments.length === 2 && segments[1] === 'cancel') {
        const parsed = cancelAppointmentSchema.parse({
          appointmentId: segments[0],
          reason: body.reason,
        });
        const result = clinicStore.cancelAppointment(parsed.appointmentId, parsed.reason);
        if (!result.success) {
          return errorResponse(400, result.error || 'Unable to cancel appointment', 'CANCEL_FAILED');
        }
        return jsonResponse(200, { success: true, appointment: result.appointment });
      }

      if (segments.length === 2 && segments[1] === 'reschedule') {
        const parsed = rescheduleAppointmentSchema.parse({
          appointmentId: segments[0],
          newDate: body.newDate,
          newStartTime: body.newStartTime,
          doctorId: body.doctorId,
          reason: body.reason,
        });
        const result = clinicStore.rescheduleAppointment({
          appointmentId: parsed.appointmentId,
          newDate: parsed.newDate,
          newStartTime: parsed.newStartTime,
          newDoctorId: parsed.doctorId,
          reason: parsed.reason,
        });
        if (!result.success) {
          return errorResponse(409, result.error || 'Slot conflict when rescheduling', 'SLOT_CONFLICT');
        }
        return jsonResponse(200, { success: true, appointment: result.appointment });
      }

      const parsed = adminAppointmentSchema.parse(body);
      const result = clinicStore.createAppointmentAtomic({
        patientName: parsed.patientName,
        patientPhone: parsed.patientPhone,
        patientEmail: parsed.patientEmail || undefined,
        doctorId: parsed.doctorId,
        serviceId: parsed.serviceId,
        appointmentDate: parsed.appointmentDate,
        startTime: parsed.startTime,
        status: parsed.status,
        source: body.source || 'admin',
        visitReason: parsed.visitReason,
        internalNotes: parsed.internalNotes || undefined,
      });

      if (!result.success) {
        return errorResponse(409, result.error || 'Slot unavailable', 'SLOT_CONFLICT');
      }

      return jsonResponse(201, { success: true, appointment: result.appointment });
    } catch (err) {
      return errorResponse(
        400,
        err instanceof Error ? err.message : 'Invalid appointment payload',
        'VALIDATION_ERROR'
      );
    }
  }

  // PATCH /api/appointments/:id
  if (event.httpMethod === 'PATCH' && segments.length === 1) {
    try {
      const body = JSON.parse(event.body || '{}');
      const updated = clinicStore.updateAppointmentStatus(
        segments[0],
        body.status,
        body.internalNotes
      );
      if (!updated) {
        return errorResponse(404, 'Appointment not found', 'NOT_FOUND');
      }
      return jsonResponse(200, { success: true, appointment: updated });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Invalid update payload');
    }
  }

  return errorResponse(405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
};
