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
