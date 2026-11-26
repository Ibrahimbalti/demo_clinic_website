import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { clinicStore } from '../../src/lib/clinicDataStore';
import { errorResponse, jsonResponse } from './_shared/security';

const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  badge: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  durationMinutes: z.number().min(10).max(360),
  price: z.number().nullable().optional(),
  priceLabel: z.string().optional(),
  doctorIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const handler: Handler = async (event) => {
  const subPath = event.path.replace(/^\/(\.netlify\/functions\/services|api\/services)/, '') || '/';
  const segments = subPath.split('/').filter(Boolean);

  if (event.httpMethod === 'GET') {
    return jsonResponse(200, {
      success: true,
      services: clinicStore.getState().services,
    });
  }

  if (event.httpMethod === 'POST') {
    try {
      const parsed = serviceSchema.parse(JSON.parse(event.body || '{}'));
      const service = clinicStore.upsertService(parsed);
      return jsonResponse(201, { success: true, service });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Invalid service payload');
    }
  }

  if (event.httpMethod === 'PATCH' && segments.length === 1) {
    try {
      const body = JSON.parse(event.body || '{}');
      const existing = clinicStore.getState().services.find((s) => s.id === segments[0]);
      if (!existing) return errorResponse(404, 'Service not found', 'NOT_FOUND');
      const service = clinicStore.upsertService({ ...existing, ...body, id: existing.id });
      return jsonResponse(200, { success: true, service });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Invalid service update');
    }
  }

  if (event.httpMethod === 'DELETE' && segments.length === 1) {
    const toggled = clinicStore.toggleServiceActive(segments[0]);
    if (!toggled) return errorResponse(404, 'Service not found', 'NOT_FOUND');
    return jsonResponse(200, { success: true, service: toggled });
  }

  return errorResponse(405, 'Method not allowed');
};
