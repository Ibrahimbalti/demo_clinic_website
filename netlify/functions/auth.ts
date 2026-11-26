import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { clinicStore } from '../../src/lib/clinicDataStore';
import { errorResponse, getSupabaseServiceAdmin, jsonResponse } from './_shared/security';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const handler: Handler = async (event) => {
  const path = event.path.replace(/^\/(\.netlify\/functions\/auth|api\/auth)/, '') || '/';

  if (event.httpMethod === 'POST' && (path === '/login' || path === '')) {
    try {
      const body = JSON.parse(event.body || '{}');
      const parsed = loginSchema.parse(body);

      const supabaseAdmin = getSupabaseServiceAdmin();
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.auth.signInWithPassword({
          email: parsed.email,
          password: parsed.password,
        });
        if (error || !data.user) {
          return errorResponse(401, 'Invalid email or password.', 'AUTH_FAILED');
        }
        const { data: staffProfile } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', parsed.email)
          .eq('is_active', true)
          .single();

        if (!staffProfile) {
          return errorResponse(403, 'User is not an active clinic staff member.', 'FORBIDDEN');
        }

        return jsonResponse(200, {
          success: true,
          user: {
            id: staffProfile.id,
            clinicId: staffProfile.clinic_id,
            fullName: staffProfile.full_name,
            email: staffProfile.email,
            role: staffProfile.role,
            isActive: staffProfile.is_active,
          },
          accessToken: data.session?.access_token,
        });
      }

      const localResult = clinicStore.login(parsed.email, parsed.password);
      if (!localResult.success) {
        return errorResponse(401, localResult.error || 'Authentication failed', 'AUTH_FAILED');
      }

      return jsonResponse(200, {
        success: true,
        user: localResult.user,
      });
    } catch (err) {
      return errorResponse(400, err instanceof Error ? err.message : 'Invalid login payload', 'VALIDATION_ERROR');
    }
  }

  if (event.httpMethod === 'POST' && path === '/logout') {
    clinicStore.logout();
    return jsonResponse(200, { success: true, message: 'Logged out successfully.' });
  }

  if (event.httpMethod === 'GET' && path === '/me') {
    const user = clinicStore.getCurrentUser();
    if (!user) {
      return errorResponse(401, 'Not authenticated', 'UNAUTHENTICATED');
    }
    return jsonResponse(200, { success: true, user });
  }

  return errorResponse(404, 'Auth endpoint not found', 'NOT_FOUND');
};
