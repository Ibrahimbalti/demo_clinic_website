# Gasha Demo Clinic — Complete Deployment, Integration & Production Launch Guide

This guide covers all setup and operational instructions for deploying the **Gasha Demo Clinic AI-Powered WhatsApp Appointment Management System** to **Netlify** and **Supabase** with **OpenAI**, **Meta WhatsApp Cloud API**, and **Google Calendar OAuth 2.0**.

---

## 1. Architecture Overview

* **Frontend**: React 18 + strict TypeScript + Vite + Tailwind CSS + React Hook Form + Zod + TanStack Query + Lucide Icons (`src/`).
* **Backend Serverless API**: TypeScript Netlify Functions (`netlify/functions/`) mapped to `/api/*` via [netlify.toml](file:///d:/2026%20Project/dental%20clinic/netlify.toml).
* **Scheduled Automation (Zero n8n / Zero Third-Party Workflows)**:
  * [scheduled-reminders.ts](file:///d:/2026%20Project/dental%20clinic/netlify/functions/scheduled-reminders.ts) (`*/5 * * * *` — every 5 minutes): Atomically claims due 24-hour and 1-hour reminder jobs from the `reminders` table, checks that the appointment is not cancelled, and sends approved Meta WhatsApp reminder templates.
  * [scheduled-daily-report.ts](file:///d:/2026%20Project/dental%20clinic/netlify/functions/scheduled-daily-report.ts) (`0 6 * * *` — daily at 06:00 UTC): Generates the clinic owner daily report (`daily_reports`).
* **Database**: Supabase PostgreSQL 15+ with Row Level Security (RLS), `btree_gist` exclusion constraints preventing overlapping doctor bookings, and the atomic `book_appointment_atomic` stored procedure.

---

## 2. Supabase Setup & Database Migration Instructions

1. Create a new Supabase project at `https://supabase.com/dashboard`.
2. Open the **SQL Editor** in your Supabase dashboard.
3. Run [001_initial_schema.sql](file:///d:/2026%20Project/dental%20clinic/supabase/migrations/001_initial_schema.sql) to create all 16 tables, indexes, `btree_gist` exclusion constraints, `book_appointment_atomic` RPC function, and Row Level Security policies.
4. Run [002_seed_clinic_data.sql](file:///d:/2026%20Project/dental%20clinic/supabase/migrations/002_seed_clinic_data.sql) to seed the initial configurable clinic profile (`gasha-demo-clinic`) and AI receptionist configuration.
5. Copy your **Project URL**, **Anon Public Key**, and **Service Role Secret Key** from **Project Settings -> API**:
   * Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public browser keys).
   * Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (private server-only keys for Netlify Functions).

---

## 3. Admin User Creation Instructions

1. In your Supabase Dashboard, go to **Authentication -> Users** and click **Add User -> Create New User**.
2. Enter the administrator's email (e.g., `superadmin@gashaclinic.com`) and a strong password, and check **Auto Confirm User**.
3. Copy the newly created user's `UUID` (`auth.users.id`).
4. In the **SQL Editor**, link the user to `public.users` with the `super_admin` or `clinic_admin` role:
   ```sql
   INSERT INTO public.users (
     auth_user_id,
     clinic_id,
     full_name,
     email,
     role,
     is_active
   ) VALUES (
     '<AUTH_USER_UUID>',
     '00000000-0000-0000-0000-000000000001',
     'Clinic Super Admin',
     'superadmin@gashaclinic.com',
     'super_admin',
     TRUE
   );
   ```
5. To add Receptionists (`role = 'receptionist'`) or Doctors (`role = 'doctor'`), repeat the step above with their respective role.

---

## 4. Meta WhatsApp Cloud API Setup Instructions

1. Go to `https://developers.facebook.com/` and create or open a **Business App** with the **WhatsApp** product enabled.
2. In **WhatsApp -> API Setup** (or **Phone Numbers**):
   * Copy your **Phone Number ID** -> `WHATSAPP_PHONE_NUMBER_ID`
   * Copy your **WhatsApp Business Account ID** -> `WHATSAPP_BUSINESS_ACCOUNT_ID`
   * Generate a permanent **System User Access Token** in Meta Business Settings with `whatsapp_business_messaging` and `whatsapp_business_management` permissions -> `WHATSAPP_ACCESS_TOKEN`
3. In **App Settings -> Basic**, copy your **App Secret** -> `WHATSAPP_APP_SECRET` (used by `/api/whatsapp/webhook` to validate `X-Hub-Signature-256` HMAC-SHA256 headers).
4. Choose a strong random verification token string -> `WHATSAPP_VERIFY_TOKEN`.
5. In **WhatsApp -> Configuration -> Webhook**:
   * **Callback URL**: `https://gashademoclinic.netlify.app/api/whatsapp/webhook`
   * **Verify Token**: Your `WHATSAPP_VERIFY_TOKEN` value
   * Click **Verify and Save**, then subscribe to the **`messages`** webhook field.
6. Create and submit two message templates in **WhatsApp Manager -> Message Templates**:
   * `appointment_confirmation`
   * `appointment_reminder` (Body parameters: `{{1}}` Patient Name, `{{2}}` Clinic Name, `{{3}}` Service, `{{4}}` Doctor, `{{5}}` Date, `{{6}}` Time).

---

## 5. Google Calendar OAuth 2.0 Setup Instructions

1. Open the Google Cloud Console (`https://console.cloud.google.com/`).
2. Create a project and enable the **Google Calendar API**.
3. Configure the **OAuth Consent Screen** and add scopes:
   * `https://www.googleapis.com/auth/calendar.events`
   * `https://www.googleapis.com/auth/calendar.readonly`
4. Under **Credentials -> Create Credentials -> OAuth Client ID (Web Application)**:
   * Add Authorized Redirect URI: `https://gashademoclinic.netlify.app/api/calendar/callback`
   * Copy **Client ID** -> `GOOGLE_CLIENT_ID`
   * Copy **Client Secret** -> `GOOGLE_CLIENT_SECRET`
   * Set `GOOGLE_REDIRECT_URI=https://gashademoclinic.netlify.app/api/calendar/callback`
5. Set a 32-byte random string in `ENCRYPTION_KEY` so OAuth refresh tokens are encrypted with AES-256-GCM before being stored in `public.integrations`.

---

## 6. Netlify Deployment Guide

1. Push the repository to GitHub/GitLab and connect it to Netlify (`https://app.netlify.com`).
2. Netlify automatically reads [netlify.toml](file:///d:/2026%20Project/dental%20clinic/netlify.toml):
   * **Build command**: `npm run build`
   * **Publish directory**: `dist`
   * **Functions directory**: `netlify/functions`
3. In **Netlify Site Configuration -> Environment Variables**, add all variables listed in [.env.example](file:///d:/2026%20Project/dental%20clinic/.env.example).
   * **Security Rule**: Never prefix private credentials (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `GOOGLE_CLIENT_SECRET`, `ENCRYPTION_KEY`) with `VITE_`.
4. Trigger a production deploy and verify:
   * Public website loads at `/`
   * Admin Dashboard loads via **Admin Portal** button (`/?admin=1`)
   * Serverless functions respond under `/api/*`
   * Scheduled functions `scheduled-reminders` and `scheduled-daily-report` appear in the **Netlify Functions** tab.

---

## 7. Production Launch Checklist

- [ ] **Database Migrations**: `001_initial_schema.sql` and `002_seed_clinic_data.sql` executed in Supabase.
- [ ] **Verified Clinic Profile**: In the Admin Dashboard -> **Settings & RBAC**, replace placeholder address, phone number, WhatsApp number, email, opening hours, and doctor biographies with verified clinic information, then check **"Mark clinic contact details, doctors, and hours as Verified for Production Launch"**.
- [ ] **Environment Variables**: All variables from `.env.example` configured in Netlify Environment Variables.
- [ ] **Meta WhatsApp Webhook**: Verified `GET /api/whatsapp/webhook` challenge and subscribed to `messages` events with `WHATSAPP_APP_SECRET` signature verification enabled.
- [ ] **WhatsApp Templates Approved**: `appointment_reminder` and `appointment_confirmation` templates approved in Meta WhatsApp Manager.
- [ ] **OpenAI API Key**: `OPENAI_API_KEY` and `OPENAI_MODEL` configured and tested in **Admin -> AI Receptionist -> Testing Sandbox**.
- [ ] **Google Calendar Connected**: OAuth flow completed via `/api/calendar/connect` with AES-256-GCM encrypted token storage.
- [ ] **RBAC Staff Accounts Created**: Super Admin, Clinic Admin, Receptionist, and Doctor accounts provisioned with least-privilege access.
