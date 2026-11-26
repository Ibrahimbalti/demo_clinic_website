-- ============================================================================
-- GASHA DEMO CLINIC — SUPABASE POSTGRESQL SCHEMA & RLS MIGRATION
-- File: supabase/migrations/001_initial_schema.sql
-- ============================================================================

-- Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- 1. CLINICS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT NOT NULL DEFAULT 'AI-Powered Luxury Dental & Esthetic Care',
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  emergency_phone TEXT NOT NULL DEFAULT '',
  whatsapp_number TEXT NOT NULL,
  email TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  default_appointment_duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK (default_appointment_duration_minutes BETWEEN 10 AND 240),
  booking_lead_time_minutes INTEGER NOT NULL DEFAULT 60,
  max_booking_advance_days INTEGER NOT NULL DEFAULT 60,
  cancellation_policy_hours INTEGER NOT NULL DEFAULT 24,
  is_verified_content BOOLEAN NOT NULL DEFAULT FALSE,
  verification_notice TEXT NOT NULL DEFAULT 'Configurable clinic profile — verify contact details before production launch.',
  opening_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. USERS (Staff & Role-Based Access Control)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'clinic_admin', 'receptionist', 'doctor')),
  doctor_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON public.users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(clinic_id, role);

-- ============================================================================
-- 3. DOCTORS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  specialization TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  credentials JSONB NOT NULL DEFAULT '[]'::jsonb,
  image_url TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  appointment_duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK (appointment_duration_minutes BETWEEN 15 AND 240),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  calendar_id TEXT,
  google_calendar_connected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctors_clinic_id ON public.doctors(clinic_id, is_active);

-- ============================================================================
-- 4. PATIENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  consent_status TEXT NOT NULL DEFAULT 'granted' CHECK (consent_status IN ('granted', 'pending', 'revoked')),
  visit_reason TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_patients_clinic_phone UNIQUE (clinic_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone ON public.patients(clinic_id, phone);

-- ============================================================================
-- 5. SERVICES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  badge TEXT NOT NULL DEFAULT 'Clinical Care',
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK (duration_minutes BETWEEN 10 AND 360),
  visits_label TEXT NOT NULL DEFAULT '1 Visit',
  comfort_label TEXT NOT NULL DEFAULT '100% Gentle',
  price NUMERIC(10, 2),
  price_label TEXT NOT NULL DEFAULT 'Custom Consultation',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  best_for TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON public.services(clinic_id, is_active);

-- Doctor <-> Service Join Table
CREATE TABLE IF NOT EXISTS public.doctor_services (
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  PRIMARY KEY (doctor_id, service_id)
);

-- ============================================================================
-- 6. DOCTOR AVAILABILITY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.doctor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_availability_time_order CHECK (end_time > start_time),
  CONSTRAINT uq_doctor_day UNIQUE (doctor_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_doctor_availability_doctor ON public.doctor_availability(doctor_id, day_of_week);

-- ============================================================================
-- 7. DOCTOR BREAKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.doctor_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT DEFAULT 'Break',
  CONSTRAINT chk_break_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_doctor_breaks_doctor ON public.doctor_breaks(doctor_id, day_of_week);

-- ============================================================================
-- 8. CLINIC HOLIDAYS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.clinic_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  description TEXT NOT NULL,
  CONSTRAINT uq_clinic_holiday_date UNIQUE (clinic_id, holiday_date)
);

-- ============================================================================
-- 9. APPOINTMENTS (With Database-Level Overlap Protection)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_range TSRANGE GENERATED ALWAYS AS (
    tsrange(
      (appointment_date + start_time)::timestamp,
      (appointment_date + end_time)::timestamp,
      '[)'
    )
  ) STORED,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  source TEXT NOT NULL DEFAULT 'whatsapp_ai' CHECK (source IN ('whatsapp_ai', 'website', 'admin')),
  visit_reason TEXT NOT NULL DEFAULT '',
  internal_notes TEXT,
  google_calendar_event_id TEXT,
  calendar_sync_status TEXT NOT NULL DEFAULT 'not_connected' CHECK (calendar_sync_status IN ('synced', 'pending', 'failed', 'not_connected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_appointment_time_order CHECK (end_time > start_time),
  -- Prevent overlapping active appointments for the same doctor at the PostgreSQL engine level
  CONSTRAINT excl_doctor_overlapping_appointments EXCLUDE USING gist (
    doctor_id WITH =,
    slot_range WITH &&
  ) WHERE (status NOT IN ('cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date ON public.appointments(clinic_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON public.appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(clinic_id, status);

-- ============================================================================
-- 10. CONVERSATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  handling_mode TEXT NOT NULL DEFAULT 'ai' CHECK (handling_mode IN ('ai', 'human')),
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_preview TEXT NOT NULL DEFAULT '',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_conversation_clinic_phone UNIQUE (clinic_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_conversations_clinic_last_msg ON public.conversations(clinic_id, last_message_at DESC);

-- ============================================================================
-- 11. MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  whatsapp_message_id TEXT NOT NULL UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type TEXT NOT NULL DEFAULT 'patient' CHECK (sender_type IN ('patient', 'ai', 'human', 'system')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'interactive', 'template', 'unsupported')),
  content TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at ASC);

-- ============================================================================
-- 12. REMINDERS (Database-Backed Idempotent Job Queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '1h')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON public.reminders(status, scheduled_at) WHERE status IN ('pending', 'failed');

-- ============================================================================
-- 13. INTEGRATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('whatsapp', 'openai', 'google_calendar')),
  encrypted_credentials TEXT,
  connection_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'mock_mode', 'error')),
  account_label TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_clinic_provider UNIQUE (clinic_id, provider)
);

-- ============================================================================
-- 14. AI CONFIGURATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  assistant_name TEXT NOT NULL DEFAULT 'Layla (Gasha AI Concierge)',
  system_prompt TEXT NOT NULL,
  welcome_message TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'English',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 15. DAILY REPORTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  report_data JSONB NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'generated' CHECK (delivery_status IN ('generated', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_clinic_report_date UNIQUE (clinic_id, report_date)
);

-- ============================================================================
-- 16. AUDIT LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic_created ON public.audit_logs(clinic_id, created_at DESC);

-- ============================================================================
-- 17. ATOMIC BOOKING RPC FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.book_appointment_atomic(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_doctor_id UUID,
  p_service_id UUID,
  p_appointment_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_status TEXT,
  p_source TEXT,
  p_visit_reason TEXT,
  p_internal_notes TEXT DEFAULT NULL,
  p_schedule_24h BOOLEAN DEFAULT TRUE,
  p_schedule_1h BOOLEAN DEFAULT TRUE
) RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appt public.appointments;
  v_appt_ts TIMESTAMPTZ;
BEGIN
  -- Lock the doctor row to serialize concurrent bookings for the same doctor
  PERFORM 1 FROM public.doctors WHERE id = p_doctor_id AND clinic_id = p_clinic_id AND is_active = TRUE FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCTOR_NOT_AVAILABLE: Selected doctor is inactive or does not exist.';
  END IF;

  -- Check clinic holiday
  PERFORM 1 FROM public.clinic_holidays WHERE clinic_id = p_clinic_id AND holiday_date = p_appointment_date;
  IF FOUND THEN
    RAISE EXCEPTION 'CLINIC_HOLIDAY: Clinic is closed on the requested holiday date.';
  END IF;

  -- Insert appointment (Exclusion constraint excl_doctor_overlapping_appointments also protects at engine level)
  INSERT INTO public.appointments (
    clinic_id, patient_id, doctor_id, service_id,
    appointment_date, start_time, end_time,
    status, source, visit_reason, internal_notes
  ) VALUES (
    p_clinic_id, p_patient_id, p_doctor_id, p_service_id,
    p_appointment_date, p_start_time, p_end_time,
    p_status, p_source, p_visit_reason, p_internal_notes
  )
  RETURNING * INTO v_appt;

  -- Schedule Reminders atomically
  v_appt_ts := (p_appointment_date + p_start_time)::timestamptz;

  IF p_schedule_1h AND v_appt_ts - INTERVAL '1 hour' > NOW() THEN
    INSERT INTO public.reminders (appointment_id, reminder_type, scheduled_at, status, idempotency_key)
    VALUES (
      v_appt.id,
      '1h',
      v_appt_ts - INTERVAL '1 hour',
      'pending',
      'rem_' || v_appt.id::text || '_1h_' || extract(epoch from v_appt_ts)::bigint::text
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  IF p_schedule_24h AND v_appt_ts - INTERVAL '24 hours' > NOW() THEN
    INSERT INTO public.reminders (appointment_id, reminder_type, scheduled_at, status, idempotency_key)
    VALUES (
      v_appt.id,
      '24h',
      v_appt_ts - INTERVAL '24 hours',
      'pending',
      'rem_' || v_appt.id::text || '_24h_' || extract(epoch from v_appt_ts)::bigint::text
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_appt;
END;
$$;

-- ============================================================================
-- 18. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS evaluation
CREATE OR REPLACE FUNCTION public.current_user_clinic_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT clinic_id FROM public.users WHERE auth_user_id = auth.uid() AND is_active = TRUE LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.users WHERE auth_user_id = auth.uid() AND is_active = TRUE LIMIT 1;
$$;

-- Public Read Policies for Public Website (Clinic profile, active doctors, active services, availability, holidays)
CREATE POLICY "Public can view clinics" ON public.clinics FOR SELECT USING (true);
CREATE POLICY "Public can view active doctors" ON public.doctors FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view active services" ON public.services FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view doctor services" ON public.doctor_services FOR SELECT USING (true);
CREATE POLICY "Public can view doctor availability" ON public.doctor_availability FOR SELECT USING (true);
CREATE POLICY "Public can view doctor breaks" ON public.doctor_breaks FOR SELECT USING (true);
CREATE POLICY "Public can view clinic holidays" ON public.clinic_holidays FOR SELECT USING (true);

-- Authenticated Staff Policies (Enforcing clinic_id tenant isolation & RBAC)
CREATE POLICY "Staff view own clinic users" ON public.users
  FOR SELECT USING (clinic_id = public.current_user_clinic_id());

CREATE POLICY "Super and Clinic Admins manage users" ON public.users
  FOR ALL USING (
    clinic_id = public.current_user_clinic_id()
    AND public.current_user_role() IN ('super_admin', 'clinic_admin')
  );

CREATE POLICY "Staff view clinic patients" ON public.patients
  FOR SELECT USING (clinic_id = public.current_user_clinic_id());

CREATE POLICY "Admin and Receptionist manage patients" ON public.patients
  FOR ALL USING (
    clinic_id = public.current_user_clinic_id()
    AND public.current_user_role() IN ('super_admin', 'clinic_admin', 'receptionist')
  );

CREATE POLICY "Staff view clinic appointments" ON public.appointments
  FOR SELECT USING (clinic_id = public.current_user_clinic_id());

CREATE POLICY "Staff manage clinic appointments" ON public.appointments
  FOR ALL USING (
    clinic_id = public.current_user_clinic_id()
    AND public.current_user_role() IN ('super_admin', 'clinic_admin', 'receptionist', 'doctor')
  );

CREATE POLICY "Staff access conversations" ON public.conversations
  FOR ALL USING (
    clinic_id = public.current_user_clinic_id()
    AND public.current_user_role() IN ('super_admin', 'clinic_admin', 'receptionist')
  );

CREATE POLICY "Staff access messages" ON public.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.clinic_id = public.current_user_clinic_id()
    )
    AND public.current_user_role() IN ('super_admin', 'clinic_admin', 'receptionist')
  );

CREATE POLICY "Admin access integrations" ON public.integrations
  FOR ALL USING (
    clinic_id = public.current_user_clinic_id()
    AND public.current_user_role() IN ('super_admin', 'clinic_admin')
  );

CREATE POLICY "Admin access AI config" ON public.ai_configurations
  FOR ALL USING (
    clinic_id = public.current_user_clinic_id()
    AND public.current_user_role() IN ('super_admin', 'clinic_admin')
  );

CREATE POLICY "Admin access daily reports" ON public.daily_reports
  FOR SELECT USING (
    clinic_id = public.current_user_clinic_id()
    AND public.current_user_role() IN ('super_admin', 'clinic_admin')
  );

CREATE POLICY "Admin access audit logs" ON public.audit_logs
  FOR SELECT USING (
    clinic_id = public.current_user_clinic_id()
    AND public.current_user_role() IN ('super_admin', 'clinic_admin')
  );


-- ============================================================================
-- GASHA DEMO CLINIC — INITIAL CONFIGURABLE SEED DATA
-- File: supabase/migrations/002_seed_clinic_data.sql
-- Note: Contact details and specialist profiles are marked is_verified_content = false
-- so administrators can update them with verified clinic data before production launch.
-- ============================================================================

INSERT INTO public.clinics (
  id, name, slug, tagline, address, city, phone, emergency_phone,
  whatsapp_number, email, timezone, default_appointment_duration_minutes,
  is_verified_content, verification_notice, opening_hours
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Gasha Demo Clinic',
  'gasha-demo-clinic',
  'Dental & Esthetic Art · AI-Powered WhatsApp Appointment Platform',
  '[Configurable Address Placeholder — Update in Admin Settings]',
  '[Configurable City]',
  '+15552347645',
  '+15559113368',
  '15552347645',
  'concierge@gashademoclinic.example',
  'UTC',
  45,
  FALSE,
  'Clinic address, phone numbers, opening hours, and doctor credentials are currently configured as editable placeholders. Verify and mark as verified in Admin Settings before production launch.',
  '[
    {"day": "Monday", "dayOfWeek": 1, "isOpen": true, "openTime": "09:00", "closeTime": "20:00"},
    {"day": "Tuesday", "dayOfWeek": 2, "isOpen": true, "openTime": "09:00", "closeTime": "20:00"},
    {"day": "Wednesday", "dayOfWeek": 3, "isOpen": true, "openTime": "09:00", "closeTime": "20:00"},
    {"day": "Thursday", "dayOfWeek": 4, "isOpen": true, "openTime": "09:00", "closeTime": "20:00"},
    {"day": "Friday", "dayOfWeek": 5, "isOpen": true, "openTime": "09:00", "closeTime": "20:00"},
    {"day": "Saturday", "dayOfWeek": 6, "isOpen": true, "openTime": "10:00", "closeTime": "18:00"},
    {"day": "Sunday", "dayOfWeek": 0, "isOpen": false, "openTime": "00:00", "closeTime": "00:00", "note": "Emergency On-Call Only"}
  ]'::jsonb
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.ai_configurations (
  clinic_id, enabled, assistant_name, welcome_message, language, system_prompt, settings
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  TRUE,
  'Layla — Gasha Clinic AI Receptionist',
  'Hello! Welcome to Gasha Demo Clinic. I''d be happy to help you book, reschedule, or check an appointment. May I know your name?',
  'English',
  'You are the official AI WhatsApp Receptionist for Gasha Demo Clinic. Communicate naturally, concisely, and warmly. Always use backend tools to check actual doctor availability, clinic hours, and services before offering slots. Never diagnose medical conditions, prescribe medication, or invent slot times. Always ask for explicit patient confirmation before calling createAppointment.',
  '{
    "toneOfVoice": "Warm, professional, concise, reassuring",
    "enable24hReminder": true,
    "enable1hReminder": true,
    "emergencyResponseMessage": "If you are experiencing a medical emergency, severe bleeding, swelling affecting breathing, or facial trauma, please contact local emergency services immediately or call our emergency hotline."
  }'::jsonb
) ON CONFLICT (clinic_id) DO NOTHING;



INSERT INTO public.users (id, clinic_id, full_name, email, role, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Ibrahim (Super Admin)', 'superadmin@gashaclinic.com', 'super_admin', TRUE),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Dr. Marcus Vance (Clinic Admin)', 'admin@gashaclinic.com', 'clinic_admin', TRUE),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Nadia Al-Mansoor (Receptionist)', 'reception@gashaclinic.com', 'receptionist', TRUE),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'Dr. Elena Rostova (Doctor)', 'elena@gashaclinic.com', 'doctor', TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.doctors (id, clinic_id, name, title, specialization, description, credentials, image_url, appointment_duration_minutes, is_active, is_verified, google_calendar_connected)
VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Dr. Marcus Vance', 'Clinical Director & Implantologist', 'Aesthetic & Implant Dentistry', 'Specializes in full-mouth smile reconstructions, 3D guided implants, and porcelain veneers.', '["DDS", "Implantology Fellow", "Cosmetic Specialist"]'::jsonb, 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600&auto=format&fit=crop&q=80', 45, TRUE, FALSE, TRUE),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'Dr. Elena Rostova', 'Lead Orthodontist', 'Orthodontics & Clear Aligners', 'Dedicated to non-extraction orthodontic alignment, clear aligners, and aesthetic teeth whitening.', '["BDS, MSc", "Orthodontics", "Clear Aligner Specialist"]'::jsonb, 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&auto=format&fit=crop&q=80', 45, TRUE, FALSE, TRUE),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001', 'Dr. Zainab Malik', 'Endodontic Microsurgeon', 'Microscopic Endodontics & Pain Relief', 'Specializes in single-visit microscopic root canal therapy and emergency tooth preservation.', '["BDS, MFD", "Endodontics", "Microsurgery"]'::jsonb, 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=600&auto=format&fit=crop&q=80', 60, TRUE, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000001', 'Dr. Julian Hayes', 'Pediatric & Family Dentist', 'Pediatric & Preventive Dentistry', 'Creates calm, welcoming dental visits for children, teens, and families.', '["DMD", "Pediatric Dentistry", "Preventive Care"]'::jsonb, 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&auto=format&fit=crop&q=80', 30, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.services (id, clinic_id, name, badge, category, description, duration_minutes, visits_label, comfort_label, price, price_label, image_url, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 'Laser Teeth Whitening', 'Same-Day Glow', 'Aesthetic Care', 'Medical-grade in-office laser whitening in 45 minutes while protecting enamel.', 45, '1 Visit', '100% Gentle', 199.00, 'From $199', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=900&auto=format&fit=crop&q=80', TRUE),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', 'Porcelain Veneers & Lumineers', 'Smile Design', 'Cosmetic Dentistry', 'Bespoke ultra-thin porcelain shells fixing chips, gaps, and discoloration.', 60, '2 Visits', 'Painless', 850.00, 'Custom Consultation', 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=900&auto=format&fit=crop&q=80', TRUE),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000001', 'Precision Dental Implants', 'Restorative', 'Implantology', 'Biocompatible titanium posts with custom-milled zirconia crowns.', 60, '2 - 3 Visits', 'Computerized Anesthesia', 1200.00, '0% Financing Available', 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=900&auto=format&fit=crop&q=80', TRUE),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000001', 'Clear Aligners (Invisalign)', 'Orthodontics', 'Orthodontics', 'Straighten crowded teeth and close gaps using clear removable aligners.', 45, 'Every 6 - 8 Weeks', 'Very High', 99.00, 'Monthly Plans from $99/mo', 'https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?w=900&auto=format&fit=crop&q=80', TRUE),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000001', 'Microscopic Root Canal Therapy', 'Endodontics', 'Endodontics & Pain Relief', 'High-magnification surgical microscope root canal therapy eliminating toothache.', 60, '1 - 2 Visits', '100% Pain-Free', 350.00, 'Insurance Covered', 'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=900&auto=format&fit=crop&q=80', TRUE),
  ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000001', 'Comprehensive 3D Dental Checkup & Consultation', 'First Visit', 'General & Diagnostic', 'Complete 45-minute oral examination, 3D digital scan, and written treatment plan.', 45, '1 Visit', 'Gentle Diagnostic', 50.00, '$50 Consultation', 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=900&auto=format&fit=crop&q=80', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.integrations (clinic_id, provider, connection_status, account_label)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'whatsapp', 'mock_mode', 'Meta WhatsApp Cloud API (/api/whatsapp/webhook)'),
  ('00000000-0000-0000-0000-000000000001', 'openai', 'mock_mode', 'OpenAI Tool-Calling Receptionist (/api/ai/chat)'),
  ('00000000-0000-0000-0000-000000000001', 'google_calendar', 'mock_mode', 'Google Calendar OAuth 2.0 (/api/calendar/connect)')
ON CONFLICT (clinic_id, provider) DO NOTHING;

NOTIFY pgrst, 'reload schema';
