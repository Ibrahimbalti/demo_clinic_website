import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { clinicStore } from '../../src/lib/clinicDataStore';
import { errorResponse, jsonResponse } from './_shared/security';

const doctorSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(100),
  title: z.string().trim().optional(),
  specialization: z.string().trim().min(2).max(120),
  description: z.string().optional(),
  credentials: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  appointmentDurationMinutes: z.number().min(15).max(240).optional(),
  isActive: z.boolean().optional(),
  serviceIds: z.array(z.string()).optional(),
});

export const handler: Handler = async (event) => {
  const subPath = event.path.replace(/^\/(\.netlify\/functions\/doctors|api\/doctors)/, '') || '/';
  const segments = subPath.split('/').filter(Boolean);

  if (event.httpMethod === 'GET') {
    return jsonResponse(200, {
      success: true,
      doctors: clinicStore.getState().doctors,
    });
  }

  if (event.httpMethod === 'POST') {
    try {
      const parsed = doctorSchema.parse(JSON.parse(event.body || '{}'));
      const doctor = clinicStore.upsertDoctor(parsed);
      return jsonResponse(201, { success: true, doctor });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Invalid doctor payload');
    }
  }

  if (event.httpMethod === 'PATCH' && segments.length === 1) {
    try {
      const body = JSON.parse(event.body || '{}');
      const existing = clinicStore.getState().doctors.find((d) => d.id === segments[0]);
      if (!existing) return errorResponse(404, 'Doctor not found', 'NOT_FOUND');
      const doctor = clinicStore.upsertDoctor({ ...existing, ...body, id: existing.id });
      return jsonResponse(200, { success: true, doctor });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Invalid doctor update');
    }
  }

  if (event.httpMethod === 'DELETE' && segments.length === 1) {
    const toggled = clinicStore.toggleDoctorActive(segments[0]);
    if (!toggled) return errorResponse(404, 'Doctor not found', 'NOT_FOUND');
    return jsonResponse(200, { success: true, doctor: toggled });
  }

  return errorResponse(405, 'Method not allowed');
};
