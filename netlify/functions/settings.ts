import type { Handler } from '@netlify/functions';
import { clinicStore } from '../../src/lib/clinicDataStore';
import { errorResponse, jsonResponse } from './_shared/security';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'GET') {
    const { clinic, aiConfig, integrations, holidays, users } = clinicStore.getState();
    return jsonResponse(200, {
      success: true,
      clinic,
      aiConfig,
      integrations,
      holidays,
      users,
    });
  }

  if (event.httpMethod === 'PATCH') {
    try {
      const body = JSON.parse(event.body || '{}');
      if (body.clinic) {
        clinicStore.updateClinicProfile(body.clinic);
      }
      if (body.aiConfig) {
        clinicStore.updateAIConfiguration(body.aiConfig);
      }
      const { clinic, aiConfig } = clinicStore.getState();
      return jsonResponse(200, {
        success: true,
        clinic,
        aiConfig,
      });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Invalid settings update');
    }
  }

  return errorResponse(405, 'Method not allowed');
};
