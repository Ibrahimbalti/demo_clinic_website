import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { clinicStore } from '../../src/lib/clinicDataStore';
import { errorResponse, jsonResponse } from './_shared/security';

const patientSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(22),
  email: z.string().email().optional().or(z.literal('')),
  consentStatus: z.enum(['granted', 'pending', 'revoked']).optional(),
  visitReason: z.string().max(500).optional(),
  internalNotes: z.string().max(1000).optional(),
});

export const handler: Handler = async (event) => {
  const subPath = event.path.replace(/^\/(\.netlify\/functions\/patients|api\/patients)/, '') || '/';
  const segments = subPath.split('/').filter(Boolean);

  if (event.httpMethod === 'GET') {
    const { patients, appointments } = clinicStore.getState();
    if (segments.length === 1) {
      const pat = patients.find((p) => p.id === segments[0]);
      if (!pat) return errorResponse(404, 'Patient not found', 'NOT_FOUND');
      const history = appointments.filter((a) => a.patientId === pat.id);
      return jsonResponse(200, { success: true, patient: pat, appointments: history });
    }
    return jsonResponse(200, { success: true, patients });
  }

  if (event.httpMethod === 'POST') {
    try {
      const parsed = patientSchema.parse(JSON.parse(event.body || '{}'));
      const patient = clinicStore.upsertPatient({
        fullName: parsed.fullName,
        phone: parsed.phone,
        email: parsed.email || null,
        consentStatus: parsed.consentStatus,
        visitReason: parsed.visitReason,
        internalNotes: parsed.internalNotes,
      });
      return jsonResponse(201, { success: true, patient });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Invalid patient data');
    }
  }

  if (event.httpMethod === 'PATCH' && segments.length === 1) {
    try {
      const body = JSON.parse(event.body || '{}');
      const existing = clinicStore.getState().patients.find((p) => p.id === segments[0]);
      if (!existing) return errorResponse(404, 'Patient not found', 'NOT_FOUND');
      const updated = clinicStore.upsertPatient({
        ...existing,
        ...body,
        id: existing.id,
      });
      return jsonResponse(200, { success: true, patient: updated });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Invalid update payload');
    }
  }

  return errorResponse(405, 'Method not allowed');
};
