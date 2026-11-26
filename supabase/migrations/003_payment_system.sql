-- ============================================================================
-- GASHA DEMO CLINIC — PAYMENT SYSTEM & 3-WAY WHATSAPP NOTIFICATION MIGRATION
-- File: supabase/migrations/003_payment_system.sql
--Note: Do NOT integrate the Easypaisa payment gateway or Easypaisa API.
-- Supports:
-- 1. Cash at Clinic (Immediate confirmation, UNPAID / "Pay at Clinic", GCal + 3-way WhatsApp + 1h Reminder)
-- 2. Manual Easypaisa (Receipt upload + Transaction ref -> PENDING_VERIFICATION / PENDING_PAYMENT_VERIFICATION -> Admin Approve/Reject)
-- 3. International Online Card Payments (Configurable provider with strict server-side verification)
-- ============================================================================

-- 1. Add payment_settings to public.clinics
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS payment_settings JSONB NOT NULL DEFAULT '{
    "cashAtClinicEnabled": true,
    "manualEasypaisaEnabled": true,
    "easypaisaAccountNumber": "0370-5621256",
    "easypaisaAccountTitle": "Gasha Demo Clinic",
    "easypaisaInstructions": "Send the appointment fee via Easypaisa to the clinic account number above, take a screenshot of the receipt, and enter the Transaction ID (TID) below. Your appointment will be confirmed once our administrator verifies your payment receipt.",
    "internationalCardEnabled": true,
    "internationalGatewayProvider": "safepay_pk",
    "hasEligibleInternationalMerchantAccount": false,
    "currencyCode": "USD"
  }'::jsonb;

-- 2. Update appointments status constraint and add payment columns
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'PENDING_PAYMENT_VERIFICATION', 'confirmed', 'completed', 'cancelled', 'no_show'));

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'CASH_AT_CLINIC'
    CHECK (payment_method IN ('CASH_AT_CLINIC', 'MANUAL_EASYPAISA', 'INTERNATIONAL_CARD')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'UNPAID'
    CHECK (payment_status IN ('UNPAID', 'PENDING_VERIFICATION', 'PAID', 'REJECTED')),
  ADD COLUMN IF NOT EXISTS payment_display_label TEXT NOT NULL DEFAULT 'Pay at Clinic',
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
  ADD COLUMN IF NOT EXISTS receipt_file_url TEXT,
  ADD COLUMN IF NOT EXISTS receipt_file_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_verified_by_admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_verified_by_admin_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_decision_reason TEXT;

-- 3. Create payment_verification_records table (Audit trail of receipt submissions, approvals, and rejections)
CREATE TABLE IF NOT EXISTS public.payment_verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('SUBMITTED', 'RESUBMITTED', 'APPROVED', 'REJECTED')),
  admin_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  admin_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  transaction_reference TEXT NOT NULL DEFAULT '',
  receipt_file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_verifications_appt ON public.payment_verification_records(appointment_id, created_at DESC);

-- 4. Create notification_deliveries table (Tracks WhatsApp delivery separately for Patient, Doctor, and Clinic)
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('patient', 'doctor', 'clinic')),
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  event_type TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL UNIQUE,
  message_content TEXT NOT NULL,
  last_error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_appt ON public.notification_deliveries(appointment_id, recipient_role);

ALTER TABLE public.payment_verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff access payment verification records" ON public.payment_verification_records
  FOR ALL USING (clinic_id = public.current_user_clinic_id());

CREATE POLICY "Staff access notification deliveries" ON public.notification_deliveries
  FOR ALL USING (clinic_id = public.current_user_clinic_id());

NOTIFY pgrst, 'reload schema';
