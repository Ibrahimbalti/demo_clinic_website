import type { Handler } from '@netlify/functions';
import { clinicStore } from '../../src/lib/clinicDataStore';
import { errorResponse, jsonResponse } from './_shared/security';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'GET') {
    return jsonResponse(200, {
      success: true,
      reminders: clinicStore.getState().reminders,
    });
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}') as { reminderId?: string };
      const stats = clinicStore.processDueReminders(body.reminderId);
      return jsonResponse(200, {
        success: true,
        ...stats,
      });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Failed to process reminders');
    }
  }

  return errorResponse(405, 'Method not allowed');
};
