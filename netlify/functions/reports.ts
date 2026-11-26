import type { Handler } from '@netlify/functions';
import { clinicStore } from '../../src/lib/clinicDataStore';
import { errorResponse, jsonResponse } from './_shared/security';

export const handler: Handler = async (event) => {
  const subPath = event.path.replace(/^\/(\.netlify\/functions\/reports|api\/reports)/, '') || '/';

  if (event.httpMethod === 'GET') {
    const state = clinicStore.getState();
    const dateParam = event.queryStringParameters?.date || new Date().toISOString().slice(0, 10);

    if (subPath.startsWith('/daily')) {
      const report = clinicStore.generateDailyReport(dateParam);
      return jsonResponse(200, { success: true, period: 'daily', report });
    }

    if (subPath.startsWith('/weekly')) {
      return jsonResponse(200, {
        success: true,
        period: 'weekly',
        totalAppointments: state.appointments.length,
        confirmed: state.appointments.filter((a) => a.status === 'confirmed').length,
        completed: state.appointments.filter((a) => a.status === 'completed').length,
        cancelled: state.appointments.filter((a) => a.status === 'cancelled').length,
        pending: state.appointments.filter((a) => a.status === 'pending').length,
        appointments: state.appointments,
      });
    }

    if (subPath.startsWith('/monthly')) {
      return jsonResponse(200, {
        success: true,
        period: 'monthly',
        totalAppointments: state.appointments.length,
        totalPatients: state.patients.length,
        aiConversations: state.conversations.filter((c) => c.handlingMode === 'ai').length,
        humanConversations: state.conversations.filter((c) => c.handlingMode === 'human').length,
        appointments: state.appointments,
      });
    }

    return jsonResponse(200, {
      success: true,
      dailyReports: state.dailyReports,
    });
  }

  return errorResponse(405, 'Method not allowed');
};
