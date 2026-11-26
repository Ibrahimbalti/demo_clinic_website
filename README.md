# Gasha Demo Clinic — AI-Powered WhatsApp Appointment Management System

Production-grade full-stack healthcare website, SaaS admin dashboard, and custom TypeScript AI WhatsApp appointment management system built for **Netlify** and **Supabase** without n8n or external workflow automation platforms.

## Key Capabilities

1. **Luxury Public Clinic Website** ([src/components/PublicWebsite.tsx](file:///d:/2026%20Project/dental%20clinic/src/components/PublicWebsite.tsx)):
   - Preserves the Deep Teal (`#0e4f57`) and Gold (`#c9a66b`) luxury aesthetic with dark/light mode persistence.
   - Real-time available slot picker driven by actual doctor working hours, break times, clinic holidays, and existing appointments.
   - Interactive in-browser **AI WhatsApp Receptionist Drawer** + official `wa.me` direct conversation links.
   - Configurable placeholder verification notice so unverified details are never presented as fabricated clinical claims.

2. **11-Module SaaS Admin Dashboard** ([src/components/AdminDashboard.tsx](file:///d:/2026%20Project/dental%20clinic/src/components/AdminDashboard.tsx)):
   - **Overview**: 11 real-time database KPIs, status distribution charts, doctor performance table, and security audit trail.
   - **Appointment Management**: Search, filter by date/doctor/status, manual atomic creation, confirm, complete, cancel, and reschedule.
   - **Calendar & Google Calendar Sync**: Day, Week, and Month views with open slot computation and privacy-safe Google Calendar sync.
   - **Patient Management**: Patient CRM, consent status, visit reasons, internal notes, and appointment count.
   - **Doctor & Schedule Management**: Add/edit/deactivate specialists, working hours, breaks, slot durations, and Google Calendar links.
   - **Services & Treatments**: Add/edit/deactivate services, durations, and transparent pricing labels.
   - **WhatsApp Inbox** ([src/components/admin/WhatsAppInboxView.tsx](file:///d:/2026%20Project/dental%20clinic/src/components/admin/WhatsAppInboxView.tsx)): Real-time conversation threads, manual receptionist replies, and one-click **Take Over (Pause AI)** / **Return to AI (Resume AI)**.
   - **AI Receptionist Configuration & Sandbox** ([src/components/admin/AISettingsAndTestView.tsx](file:///d:/2026%20Project/dental%20clinic/src/components/admin/AISettingsAndTestView.tsx)): Manage prompt instructions, FAQs, medical safety guardrails, and test all 12 Zod-validated backend tools interactively.
   - **Automated Reminders**: Database-backed 24h & 1h reminder queue with unique idempotency keys and retry controls.
   - **Reports & CSV Export**: Automated daily clinic owner reports and one-click CSV export.
   - **Settings & RBAC**: Clinic profile editor, verified content flag, holiday manager, integration status, and 4-tier RBAC (`Super Admin`, `Clinic Admin`, `Receptionist`, `Doctor`).

3. **TypeScript Serverless Backend & Scheduled Functions** (`netlify/functions/`):
   - `/api/auth/*`, `/api/appointments/*`, `/api/patients/*`, `/api/doctors/*`, `/api/services/*`, `/api/whatsapp/*`, `/api/ai/*`, `/api/calendar/*`, `/api/reminders/*`, `/api/reports/*`, `/api/settings/*`
   - `scheduled-reminders.ts` (`*/5 * * * *`) & `scheduled-daily-report.ts` (`0 6 * * *`).

4. **Supabase PostgreSQL Schema & RLS** (`supabase/migrations/`):
   - [001_initial_schema.sql](file:///d:/2026%20Project/dental%20clinic/supabase/migrations/001_initial_schema.sql) & [002_seed_clinic_data.sql](file:///d:/2026%20Project/dental%20clinic/supabase/migrations/002_seed_clinic_data.sql).

## Local Development & Testing

```bash
# Install dependencies
npm install

# Run automated test suite (Vitest)
npm test

# Start development server
npm run dev

# Build production bundle
npm run build
```

See [docs/DEPLOYMENT_AND_SETUP_GUIDE.md](file:///d:/2026%20Project/dental%20clinic/docs/DEPLOYMENT_AND_SETUP_GUIDE.md) for complete Supabase, Meta WhatsApp Cloud API, Google OAuth 2.0, and Netlify deployment instructions.
