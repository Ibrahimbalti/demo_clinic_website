import crypto from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '../../../src/types/clinic';

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

export function jsonResponse(statusCode: number, data: unknown) {
  return {
    statusCode,
    headers: SECURITY_HEADERS,
    body: JSON.stringify(data),
  };
}

export function errorResponse(statusCode: number, message: string, code = 'API_ERROR', details?: unknown) {
  return {
    statusCode,
    headers: SECURITY_HEADERS,
    body: JSON.stringify({
      success: false,
      error: {
        code,
        message,
        details,
      },
    }),
  };
}

/**
 * Initializes the Supabase Service-Role Admin Client ONLY inside server-side functions.
 * Never exposed to frontend code.
 */
export function getSupabaseServiceAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Verifies Meta WhatsApp Cloud API X-Hub-Signature-256 HMAC-SHA256 header.
 */
export function verifyWhatsAppWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  appSecret: string | undefined
): boolean {
  if (!appSecret) {
    // When WHATSAPP_APP_SECRET is configured, strictly enforce signature check
    return false;
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const providedHex = signatureHeader.slice('sha256='.length);
  const expectedHex = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  try {
    const a = Buffer.from(providedHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * AES-256-GCM Encryption for OAuth Refresh Tokens and Integration Credentials.
 */
function deriveKey(rawSecret: string): Buffer {
  return crypto.createHash('sha256').update(rawSecret).digest();
}

export function encryptCredentials(plaintextJson: string, secret = process.env.ENCRYPTION_KEY || 'dev-fallback-32byte-key-change-me'): string {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextJson, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptCredentials(ciphertext: string, secret = process.env.ENCRYPTION_KEY || 'dev-fallback-32byte-key-change-me'): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential format');
  }
  const [ivHex, tagHex, dataHex] = parts;
  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Server-Side RBAC Verification
 */
export function verifyRolePermission(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}
