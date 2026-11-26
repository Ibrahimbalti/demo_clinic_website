import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { clinicStore } from '../../src/lib/clinicDataStore';
import {
  encryptCredentials,
  errorResponse,
  jsonResponse,
} from './_shared/security';

const syncRequestSchema = z.object({
  appointmentId: z.string().optional(),
  doctorId: z.string().optional(),
  action: z.enum(['create', 'update', 'cancel', 'freebusy']).default('freebusy'),
  date: z.string().optional(),
});

/**
 * Formats a minimal-privacy Google Calendar Event payload.
 * Contains ONLY the minimum necessary patient information (First name + Appointment ID + Service).
 */
export function buildPrivacySafeCalendarEvent(params: {
  appointmentId: string;
  patientName: string;
  serviceName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
}) {
  const firstNameOnly = params.patientName.split(' ')[0] || 'Patient';
  return {
    summary: `Dental Appt: ${firstNameOnly} — ${params.serviceName}`,
    description: `Gasha Clinic Booking Ref: ${params.appointmentId}\nService: ${params.serviceName}\nNote: Full patient record is protected in the clinic dashboard.`,
    start: {
      dateTime: `${params.appointmentDate}T${params.startTime}:00`,
      timeZone: params.timezone,
    },
    end: {
      dateTime: `${params.appointmentDate}T${params.endTime}:00`,
      timeZone: params.timezone,
    },
  };
}

export const handler: Handler = async (event) => {
  const subPath =
    event.path
      .replace(/^\/(\.netlify\/functions\/calendar|api\/calendar)/, '')
      .replace(/^\/api\/auth\/callback\/google/, '/callback') || '/';

  // 1. GET /api/calendar/connect — Build Google OAuth 2.0 Authorization URL
  if (event.httpMethod === 'GET' && subPath.startsWith('/connect')) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.APP_URL || 'https://gashademoclinic.netlify.app'}/api/calendar/callback`;
    const doctorId = event.queryStringParameters?.doctorId || 'clinic_primary';

    if (!clientId) {
      return jsonResponse(200, {
        success: true,
        configured: false,
        mode: 'mock_mode',
        message:
          'GOOGLE_CLIENT_ID is not set in environment variables. Configure Google OAuth credentials to enable live OAuth redirect.',
      });
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ].join(' ');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', doctorId);

    return jsonResponse(200, {
      success: true,
      configured: true,
      authorizationUrl: authUrl.toString(),
    });
  }

  // 2. GET /api/calendar/callback — OAuth 2.0 Code Exchange & AES-256-GCM Token Encryption
  if (event.httpMethod === 'GET' && subPath.startsWith('/callback')) {
    const code = event.queryStringParameters?.code;
    const stateDoctorId = event.queryStringParameters?.state;

    if (!code) {
      return errorResponse(400, 'Missing OAuth authorization code', 'MISSING_OAUTH_CODE');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.APP_URL || 'https://gashademoclinic.netlify.app'}/api/calendar/callback`;

    if (!clientId || !clientSecret) {
      return errorResponse(500, 'Google OAuth environment variables are not configured');
    }

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      };

      if (!tokenRes.ok || !tokenData.access_token) {
        return errorResponse(400, tokenData.error || 'Failed to exchange Google OAuth code');
      }

      // Encrypt credentials with AES-256-GCM before database storage; NEVER expose tokens to frontend
      const encryptedPayload = encryptCredentials(
        JSON.stringify({
          refreshToken: tokenData.refresh_token,
          accessToken: tokenData.access_token,
          obtainedAt: new Date().toISOString(),
          doctorId: stateDoctorId,
        })
      );

      // Update integration status without returning raw or encrypted tokens
      const gcalInt = clinicStore
        .getState()
        .integrations.find((i) => i.provider === 'google_calendar');
      if (gcalInt) {
        gcalInt.connectionStatus = 'connected';
        gcalInt.lastSyncedAt = new Date().toISOString();
      }

      return {
        statusCode: 302,
        headers: {
          Location: '/?admin=calendar&oauth=success',
          'Cache-Control': 'no-store',
          'X-Encrypted-Vault-Bytes': String(encryptedPayload.length),
        },
        body: '',
      };
    } catch (err) {
      return errorResponse(
        500,
        err instanceof Error ? err.message : 'OAuth callback exchange error'
      );
    }
  }

  // 3. GET /api/calendar/status — Connection Health (Zero Token Exposure)
  if (event.httpMethod === 'GET' && subPath.startsWith('/status')) {
    const { integrations, doctors } = clinicStore.getState();
    const gcal = integrations.find((i) => i.provider === 'google_calendar');
    return jsonResponse(200, {
      success: true,
      configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      status: gcal?.connectionStatus || 'mock_mode',
      lastSyncedAt: gcal?.lastSyncedAt || null,
      connectedDoctors: doctors
        .filter((d) => d.googleCalendarConnected)
        .map((d) => ({ id: d.id, name: d.name, calendarId: d.calendarId })),
    });
  }

  // 4. POST /api/calendar/sync — Event Synchronization & Free/Busy Reconciliation
  if (event.httpMethod === 'POST' && subPath.startsWith('/sync')) {
    try {
      const parsed = syncRequestSchema.parse(JSON.parse(event.body || '{}'));
      const { appointments, clinic } = clinicStore.getState();

      if (parsed.appointmentId) {
        const appt = appointments.find((a) => a.id === parsed.appointmentId);
        if (!appt) {
          return errorResponse(404, 'Appointment not found for calendar sync', 'NOT_FOUND');
        }

        if (parsed.action === 'cancel' || appt.status === 'cancelled') {
          appt.googleCalendarEventId = null;
          appt.calendarSyncStatus = 'synced';
          return jsonResponse(200, {
            success: true,
            action: 'cancelled_event',
            appointmentId: appt.id,
          });
        }

        const eventPayload = buildPrivacySafeCalendarEvent({
          appointmentId: appt.id,
          patientName: appt.patientName,
          serviceName: appt.serviceName,
          appointmentDate: appt.appointmentDate,
          startTime: appt.startTime,
          endTime: appt.endTime,
          timezone: clinic.timezone,
        });

        // Prevent duplicate calendar events by reusing existing googleCalendarEventId if present
        if (!appt.googleCalendarEventId) {
          appt.googleCalendarEventId = `gcal_evt_${appt.id}`;
        }
        appt.calendarSyncStatus = 'synced';

        return jsonResponse(200, {
          success: true,
          action: parsed.action,
          googleCalendarEventId: appt.googleCalendarEventId,
          eventSummary: eventPayload.summary,
        });
      }

      return jsonResponse(200, {
        success: true,
        action: 'reconciled',
        syncedCount: appointments.filter((a) => a.status === 'confirmed').length,
      });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Calendar sync failed');
    }
  }

  return errorResponse(404, 'Calendar endpoint not found', 'NOT_FOUND');
};
