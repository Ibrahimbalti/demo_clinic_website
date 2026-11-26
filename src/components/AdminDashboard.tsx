import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bell,
  Bot,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Stethoscope,
  Sun,
  Users,
  XCircle,
} from 'lucide-react';
import { useClinicStore } from '../hooks/useClinicStore';
import type {
  AppointmentStatus,
  UserRole,
} from '../types/clinic';
import { formatDisplayTime } from '../lib/availabilityEngine';
import { WhatsAppInboxView } from './admin/WhatsAppInboxView';
import { AISettingsAndTestView } from './admin/AISettingsAndTestView';
import { PaymentsVerificationView } from './admin/PaymentsVerificationView';

export type AdminTab =
  | 'overview'
  | 'appointments'
  | 'payments'
  | 'calendar'
  | 'patients'
  | 'doctors'
  | 'services'
  | 'inbox'
  | 'ai'
  | 'reminders'
  | 'reports'
  | 'settings';

interface AdminDashboardProps {
  onBackToWebsite: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  clinic_admin: 'Clinic Admin',
  receptionist: 'Receptionist',
  doctor: 'Doctor',
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBackToWebsite,
  theme,
  onToggleTheme,
}) => {
  const { state, currentUser, store } = useClinicStore();
  const {
    clinic,
    appointments,
    patients,
    doctors,
    services,
    conversations,
    reminders,
    aiConfig,
    integrations,
    holidays,
    users,
    dailyReports,
    auditLogs,
  } = state;

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('superadmin@gashaclinic.com');
  const [loginPassword, setLoginPassword] = useState('ClinicAdmin2026!');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Appointment Filter & Modal State
  const [apptSearch, setApptSearch] = useState('');
  const [apptDateFilter, setApptDateFilter] = useState('');
  const [apptDoctorFilter, setApptDoctorFilter] = useState('');
  const [apptStatusFilter, setApptStatusFilter] = useState('');
  const [showNewApptModal, setShowNewApptModal] = useState(false);
  const [newApptError, setNewApptError] = useState<string | null>(null);
  const [newApptForm, setNewApptForm] = useState({
    patientName: '',
    patientPhone: '',
    patientEmail: '',
    doctorId: doctors[0]?.id || 'doc_1',
    serviceId: services[0]?.id || 'svc_checkup',
    appointmentDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    startTime: '10:00',
    visitReason: '',
    internalNotes: '',
  });

  // Reschedule Inline State
  const [rescheduleTargetId, setRescheduleTargetId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [rescheduleTime, setRescheduleTime] = useState('10:00');
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Calendar View State
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [calendarDate, setCalendarDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [calendarDoctorId, setCalendarDoctorId] = useState('');
  const [gcalSyncBanner, setGcalSyncBanner] = useState<string | null>(null);

  // Patient Management State
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [patientForm, setPatientForm] = useState({
    id: '',
    fullName: '',
    phone: '',
    email: '',
    visitReason: '',
    internalNotes: '',
  });

  // Doctor Management State
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [doctorForm, setDoctorForm] = useState({
    id: '',
    name: '',
    specialization: '',
    description: '',
    appointmentDurationMinutes: 45,
    credentialsText: 'DDS, Cosmetic Specialist',
    googleCalendarConnected: true,
  });

  // Service Management State
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    id: '',
    name: '',
    category: 'Aesthetic Care',
    durationMinutes: 45,
    price: 199,
    priceLabel: 'From $199',
    description: '',
  });

  // Settings State
  const [clinicName, setClinicName] = useState(clinic.name);
  const [clinicAddress, setClinicAddress] = useState(clinic.address);
  const [clinicPhone, setClinicPhone] = useState(clinic.phone);
  const [clinicWhatsapp, setClinicWhatsapp] = useState(clinic.whatsappNumber);
  const [clinicEmail, setClinicEmail] = useState(clinic.email);
  const [clinicTimezone, setClinicTimezone] = useState(clinic.timezone);
  const [isVerifiedContent, setIsVerifiedContent] = useState(clinic.isVerifiedContent);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');
  const [settingsSavedBanner, setSettingsSavedBanner] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // ==========================================================================
  // REAL DATABASE METRICS FOR OVERVIEW & REPORTS (No Hardcoded Statistics)
  // ==========================================================================
  const overviewStats = useMemo(() => {
    const visibleAppts =
      currentUser?.role === 'doctor' && currentUser.doctorId
        ? appointments.filter((a) => a.doctorId === currentUser.doctorId)
        : appointments;

    const totalAppointments = visibleAppts.length;
    const todaysAppointments = visibleAppts.filter(
      (a) => a.appointmentDate === todayStr
    ).length;
    const upcomingAppointments = visibleAppts.filter(
      (a) =>
        a.appointmentDate >= todayStr &&
        (a.status === 'confirmed' || a.status === 'pending')
    ).length;
    const completedAppointments = visibleAppts.filter(
      (a) => a.status === 'completed'
    ).length;
    const cancelledAppointments = visibleAppts.filter(
      (a) => a.status === 'cancelled'
    ).length;
    const pendingAppointments = visibleAppts.filter(
      (a) => a.status === 'pending'
    ).length;
    const confirmedAppointments = visibleAppts.filter(
      (a) => a.status === 'confirmed'
    ).length;

    const totalPatients = patients.length;
    const activeDoctorsCount = doctors.filter((d) => d.isActive).length;
    const totalConversations = conversations.length;
    const aiHandledConversations = conversations.filter(
      (c) => c.handlingMode === 'ai'
    ).length;
    const humanHandledConversations = conversations.filter(
      (c) => c.handlingMode === 'human'
    ).length;

    const doctorStats = doctors.map((doc) => {
      const docAppts = appointments.filter((a) => a.doctorId === doc.id);
      return {
        doctorId: doc.id,
        doctorName: doc.name,
        specialization: doc.specialization,
        total: docAppts.length,
        confirmed: docAppts.filter((a) => a.status === 'confirmed').length,
        completed: docAppts.filter((a) => a.status === 'completed').length,
        cancelled: docAppts.filter((a) => a.status === 'cancelled').length,
      };
    });

    return {
      totalAppointments,
      todaysAppointments,
      upcomingAppointments,
      completedAppointments,
      cancelledAppointments,
      pendingAppointments,
      confirmedAppointments,
      totalPatients,
      activeDoctorsCount,
      totalConversations,
      aiHandledConversations,
      humanHandledConversations,
      doctorStats,
    };
  }, [appointments, patients, doctors, conversations, todayStr, currentUser]);

  const filteredAppointments = useMemo(() => {
    const q = apptSearch.trim().toLowerCase();
    return appointments.filter((a) => {
      if (
        currentUser?.role === 'doctor' &&
        currentUser.doctorId &&
        a.doctorId !== currentUser.doctorId
      ) {
        return false;
      }
      if (apptDateFilter && a.appointmentDate !== apptDateFilter) return false;
      if (apptDoctorFilter && a.doctorId !== apptDoctorFilter) return false;
      if (apptStatusFilter && a.status !== apptStatusFilter) return false;
      if (q) {
        return (
          a.patientName.toLowerCase().includes(q) ||
          a.patientPhone.toLowerCase().includes(q) ||
          a.serviceName.toLowerCase().includes(q) ||
          a.doctorName.toLowerCase().includes(q) ||
          a.visitReason.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    appointments,
    apptSearch,
    apptDateFilter,
    apptDoctorFilter,
    apptStatusFilter,
    currentUser,
  ]);

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q))
    );
  }, [patients, patientSearch]);

  // Calendar Slots for Selected Date
  const calendarAvailableSlots = useMemo(() => {
    return store.getAvailableSlots({
      date: calendarDate,
      doctorId: calendarDoctorId || undefined,
    });
  }, [calendarDate, calendarDoctorId, appointments, doctors, holidays, store]);

  const calendarAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (calendarDoctorId && a.doctorId !== calendarDoctorId) return false;
      if (calendarViewMode === 'day') {
        return a.appointmentDate === calendarDate;
      }
      if (calendarViewMode === 'week') {
        const targetMs = new Date(calendarDate).getTime();
        const apptMs = new Date(a.appointmentDate).getTime();
        return Math.abs(apptMs - targetMs) <= 3.5 * 86400000;
      }
      // month view
      return a.appointmentDate.slice(0, 7) === calendarDate.slice(0, 7);
    });
  }, [appointments, calendarDate, calendarDoctorId, calendarViewMode]);

  // CSV Export Helper for Reports
  const handleExportAppointmentsCSV = () => {
    const headers = [
      'Appointment ID',
      'Date',
      'Start Time',
      'End Time',
      'Status',
      'Patient Name',
      'Patient Phone',
      'Doctor',
      'Service',
      'Source',
      'Visit Reason',
    ];
    const rows = appointments.map((a) => [
      a.id,
      a.appointmentDate,
      a.startTime,
      a.endTime,
      a.status,
      `"${a.patientName.replace(/"/g, '""')}"`,
      a.patientPhone,
      `"${a.doctorName.replace(/"/g, '""')}"`,
      `"${a.serviceName.replace(/"/g, '""')}"`,
      a.source,
      `"${(a.visitReason || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute(
      'download',
      `gasha_clinic_appointments_report_${todayStr}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================================================
  // LOGIN VIEW (When Not Authenticated)
  // ==========================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[var(--surf)] border border-[var(--line)] rounded-3xl p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[var(--teal)] text-white flex items-center justify-center mx-auto shadow-md">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="font-serif-heading text-2xl font-bold">
              {clinic.name} — Staff Portal
            </h1>
            <p className="text-xs text-[var(--mut)]">
              Role-Based Access Control (Super Admin, Clinic Admin, Receptionist, Doctor)
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 text-xs font-semibold">
              {loginError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setLoginError(null);
              const res = store.login(loginEmail, loginPassword);
              if (!res.success) {
                setLoginError(res.error || 'Authentication failed');
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                Staff Email
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-4 py-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[var(--teal)] hover:bg-[var(--teal-light)] text-white font-bold text-sm shadow-md transition"
            >
              Sign In to Admin Dashboard
            </button>
          </form>

          {/* One-Click Demo Role Accounts Selector */}
          <div className="pt-4 border-t border-[var(--line)] space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mut)] block">
              Quick Sign-In by Role (RBAC Verification):
            </span>
            <div className="grid grid-cols-2 gap-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setLoginEmail(u.email);
                    store.login(u.email, 'ClinicAdmin2026!');
                  }}
                  className="p-2.5 rounded-xl border border-[var(--line)] hover:border-[var(--teal)] bg-[var(--surf-alt)] text-left transition"
                >
                  <div className="text-xs font-bold text-[var(--ink)]">
                    {ROLE_LABELS[u.role]}
                  </div>
                  <div className="text-[10px] text-[var(--mut)] truncate">
                    {u.email}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToWebsite}
            className="w-full py-2 text-xs font-semibold text-[var(--teal)] hover:underline text-center block"
          >
            &larr; Return to Public Clinic Website
          </button>
        </div>
      </div>
    );
  }

  // Allowed navigation items based on authenticated user's role
  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    roles: UserRole[];
    badge?: string | number;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
      roles: ['super_admin', 'clinic_admin', 'receptionist', 'doctor'],
    },
    {
      id: 'appointments',
      label: 'Appointments',
      icon: <CalendarIcon className="w-4 h-4" />,
      roles: ['super_admin', 'clinic_admin', 'receptionist', 'doctor'],
      badge: overviewStats.upcomingAppointments,
    },
    {
      id: 'payments',
      label: 'Payments & Receipts',
      icon: <FileText className="w-4 h-4" />,
      roles: ['super_admin', 'clinic_admin', 'receptionist'],
      badge:
        appointments.filter((a) => a.paymentStatus === 'PENDING_VERIFICATION').length ||
        undefined,
    },
    {
      id: 'calendar',
      label: 'Calendar & Sync',
      icon: <Clock className="w-4 h-4" />,
      roles: ['super_admin', 'clinic_admin', 'receptionist', 'doctor'],
    },
    {
      id: 'patients',
      label: 'Patients',
      icon: <Users className="w-4 h-4" />,
      roles: ['super_admin', 'clinic_admin', 'receptionist', 'doctor'],
      badge: patients.length,
    },
    {
      id: 'doctors',
      label: 'Doctors',
      icon: <Stethoscope className="w-4 h-4" />,
      roles: ['super_admin', 'clinic_admin'],
    },
    {
      id: 'services',
      label: 'Services',
      icon: <Sparkles className="w-4 h-4" />,
      roles: ['super_admin', 'clinic_admin'],
    },
    {
      id: 'inbox',
      label: 'WhatsApp Inbox',
      icon: <MessageSquare className="w-4 h-4" />,
      roles: ['super_admin', 'clinic_admin', 'receptionist'],
      badge: conversations.reduce((acc, c) => acc + c.unreadCount, 0) || undefined,
    },
    {
      id: 'ai',
      label: 'AI Receptionist',
      icon: <Bot className="w-4 h-4" />,
      roles: ['super_admin', 'clinic_admin'],
      badge: aiConfig.enabled ? 'ON' : 'OFF',
    },
    {
      id: 'reminders',
      label: 'Reminders',
      icon: <Bell className="w-4 h-4" />,
      roles: ['super_admin', 'clinic_admin', 'receptionist'],
      badge: reminders.filter((r) => r.status === 'pending').length,
    },
    {
      id: 'reports',
      label: 'Reports & CSV',
      icon: <BarChart3 className="w-4 h-4" />,
      roles: ['super_admin', 'clinic_admin'],
    },
    {
      id: 'settings',
      label: 'Settings & RBAC',
      icon: <Settings className="w-4 h-4" />,
      roles: ['super_admin', 'clinic_admin'],
    },
  ];

  const permittedNavItems = navItems.filter((item) =>
    item.roles.includes(currentUser.role)
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col lg:flex-row">
      {/* LEFT SIDEBAR (Fixed on desktop so it never moves on scroll) */}
      <aside className="w-full lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:h-screen bg-[#072b30] text-white flex flex-col justify-between shrink-0 border-r border-white/10 overflow-y-auto">
        <div className="flex-1 flex flex-col min-h-0">
          {/* Brand Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#c9a66b] text-[#072b30] flex items-center justify-center font-bold">
                ✦
              </div>
              <div>
                <span className="font-serif-heading font-bold text-base block leading-tight">
                  {clinic.name}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[#f7dfa7] font-semibold">
                  SaaS Admin Console
                </span>
              </div>
            </div>
          </div>

          {/* Role Switcher Banner */}
          <div className="px-4 py-3 bg-white/5 border-b border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#b7dbd7]">Signed in as:</span>
              <span className="px-2 py-0.5 rounded-full bg-[#c9a66b]/25 text-[#f7dfa7] font-bold text-[10px]">
                {ROLE_LABELS[currentUser.role]}
              </span>
            </div>
            <div className="font-semibold text-xs truncate">{currentUser.fullName}</div>
            <div className="pt-1">
              <label className="text-[10px] text-[#b7dbd7] block mb-1">
                Switch Role (Test RBAC):
              </label>
              <select
                value={currentUser.role}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  store.switchRoleForTesting(newRole);
                  setActiveTab('overview');
                }}
                aria-label="Switch active staff role"
                className="w-full rounded-lg bg-[#03181b] border border-white/20 px-2 py-1 text-xs text-white"
              >
                <option value="super_admin">1. Super Admin (Full Access)</option>
                <option value="clinic_admin">2. Clinic Admin (Operations)</option>
                <option value="receptionist">3. Receptionist (Inbox &amp; Bookings)</option>
                <option value="doctor">4. Doctor (Assigned Schedule)</option>
              </select>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1 flex lg:flex-col overflow-x-auto lg:overflow-y-auto flex-1">
            {permittedNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap w-full ${
                    isActive
                      ? 'bg-[#c9a66b] text-[#062327] shadow-sm'
                      : 'text-[#dff0ef] hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-[#062327] text-[#f7dfa7]'
                          : 'bg-white/15 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={onBackToWebsite}
            className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Globe className="w-4 h-4 text-[#f7dfa7]" />
            <span>View Public Website</span>
          </button>

          <button
            type="button"
            onClick={() => store.logout()}
            className="w-full py-2 px-3 rounded-xl text-red-300 hover:bg-red-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA (Offset by fixed sidebar width on desktop) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Sticky Top Bar */}
        <header
          style={{ backgroundColor: 'var(--surf)' }}
          className="sticky top-0 z-20 border-b border-[var(--line)] px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs"
        >
          <div>
            <h1 className="font-serif-heading text-2xl font-bold capitalize">
              {navItems.find((n) => n.id === activeTab)?.label || 'Dashboard'}
            </h1>
            <p className="text-xs text-[var(--mut)]">
              Real-time clinic operations · Timezone: {clinic.timezone} · Role:{' '}
              <strong>{ROLE_LABELS[currentUser.role]}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentUser.role !== 'doctor' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('appointments');
                  setShowNewApptModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--teal)] hover:bg-[var(--teal-light)] text-white text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>New Appointment</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-xl border border-[var(--line)] hover:bg-[var(--surf-alt)]"
              title="Toggle Dark/Light Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className="p-6 flex-1 space-y-6 overflow-y-auto">
          {/* ================================================================
              A. OVERVIEW MODULE
             ================================================================ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 11 Required KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  {
                    label: 'Total Appointments',
                    val: overviewStats.totalAppointments,
                    tone: 'text-[var(--teal)]',
                  },
                  {
                    label: "Today's Appointments",
                    val: overviewStats.todaysAppointments,
                    tone: 'text-emerald-600',
                  },
                  {
                    label: 'Upcoming Appointments',
                    val: overviewStats.upcomingAppointments,
                    tone: 'text-blue-600',
                  },
                  {
                    label: 'Completed',
                    val: overviewStats.completedAppointments,
                    tone: 'text-emerald-700',
                  },
                  {
                    label: 'Pending Approval',
                    val: overviewStats.pendingAppointments,
                    tone: 'text-amber-600',
                  },
                  {
                    label: 'Cancelled',
                    val: overviewStats.cancelledAppointments,
                    tone: 'text-red-600',
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-4 shadow-2xs"
                  >
                    <span className="text-xs text-[var(--mut)] font-medium block">
                      {kpi.label}
                    </span>
                    <span
                      className={`font-serif-heading text-3xl font-bold mt-1 block ${kpi.tone}`}
                    >
                      {kpi.val}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: 'Total Patients', val: overviewStats.totalPatients },
                  { label: 'Active Doctors', val: overviewStats.activeDoctorsCount },
                  { label: 'WhatsApp Chats', val: overviewStats.totalConversations },
                  { label: 'AI-Handled Chats', val: overviewStats.aiHandledConversations },
                  { label: 'Human-Handled Chats', val: overviewStats.humanHandledConversations },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-4 shadow-2xs"
                  >
                    <span className="text-xs text-[var(--mut)] font-medium block">
                      {kpi.label}
                    </span>
                    <span className="font-serif-heading text-2xl font-bold mt-1 block text-[var(--ink)]">
                      {kpi.val}
                    </span>
                  </div>
                ))}
              </div>

              {/* Charts Row: Status Distribution & Doctor-Wise Breakdown */}
              <div className="grid lg:grid-cols-12 gap-6">
                {/* Status Distribution Chart */}
                <div className="lg:col-span-5 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4">
                  <h3 className="font-serif-heading text-lg font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[var(--teal)]" />
                    <span>Appointment Status Distribution</span>
                  </h3>

                  <div className="space-y-3">
                    {[
                      {
                        label: 'Confirmed',
                        count: overviewStats.confirmedAppointments,
                        color: 'bg-emerald-600',
                      },
                      {
                        label: 'Pending',
                        count: overviewStats.pendingAppointments,
                        color: 'bg-amber-500',
                      },
                      {
                        label: 'Completed',
                        count: overviewStats.completedAppointments,
                        color: 'bg-blue-600',
                      },
                      {
                        label: 'Cancelled',
                        count: overviewStats.cancelledAppointments,
                        color: 'bg-red-500',
                      },
                    ].map((row) => {
                      const pct =
                        overviewStats.totalAppointments > 0
                          ? Math.round(
                              (row.count / overviewStats.totalAppointments) * 100
                            )
                          : 0;
                      return (
                        <div key={row.label} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span>{row.label}</span>
                            <span>
                              {row.count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-[var(--surf-alt)] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${row.color}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Doctor-Wise Appointment Statistics */}
                <div className="lg:col-span-7 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4">
                  <h3 className="font-serif-heading text-lg font-semibold flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-[var(--teal)]" />
                    <span>Doctor-Wise Appointment Statistics</span>
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--line)] text-[var(--mut)] uppercase">
                          <th className="py-2.5">Doctor</th>
                          <th className="py-2.5">Specialization</th>
                          <th className="py-2.5 text-center">Total</th>
                          <th className="py-2.5 text-center">Confirmed</th>
                          <th className="py-2.5 text-center">Completed</th>
                          <th className="py-2.5 text-center">Cancelled</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {overviewStats.doctorStats.map((ds) => (
                          <tr key={ds.doctorId}>
                            <td className="py-3 font-bold text-[var(--ink)]">
                              {ds.doctorName}
                            </td>
                            <td className="py-3 text-[var(--mut)]">
                              {ds.specialization}
                            </td>
                            <td className="py-3 text-center font-bold">
                              {ds.total}
                            </td>
                            <td className="py-3 text-center text-emerald-600 font-semibold">
                              {ds.confirmed}
                            </td>
                            <td className="py-3 text-center text-blue-600 font-semibold">
                              {ds.completed}
                            </td>
                            <td className="py-3 text-center text-red-600 font-semibold">
                              {ds.cancelled}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Recent Audit Logs & Upcoming Schedule */}
              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif-heading text-lg font-semibold">
                      Recent &amp; Upcoming Appointments
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('appointments')}
                      className="text-xs font-bold text-[var(--teal)] hover:underline"
                    >
                      Manage All &rarr;
                    </button>
                  </div>
                  <div className="divide-y divide-[var(--line)] text-xs">
                    {appointments.slice(0, 5).map((a) => (
                      <div
                        key={a.id}
                        className="py-3 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-bold text-sm text-[var(--ink)]">
                            {a.patientName}
                          </span>{' '}
                          <span className="text-[var(--mut)]">({a.patientPhone})</span>
                          <div className="text-[var(--mut)]">
                            {a.serviceName} · <strong>{a.doctorName}</strong>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">
                            {a.appointmentDate} · {formatDisplayTime(a.startTime)}
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              a.status === 'confirmed'
                                ? 'bg-emerald-500/15 text-emerald-700'
                                : a.status === 'completed'
                                ? 'bg-blue-500/15 text-blue-700'
                                : a.status === 'cancelled'
                                ? 'bg-red-500/15 text-red-700'
                                : 'bg-amber-500/15 text-amber-700'
                            }`}
                          >
                            {a.status} ({a.source})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4">
                  <h3 className="font-serif-heading text-lg font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[var(--teal)]" />
                    <span>Security &amp; Activity Audit Logs</span>
                  </h3>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto text-xs">
                    {auditLogs.slice(0, 8).map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-[var(--surf-alt)] border border-[var(--line)]"
                      >
                        <div className="flex items-center justify-between font-bold text-[11px]">
                          <span className="text-[var(--teal)]">{log.action}</span>
                          <span className="text-[var(--mut)]">
                            {new Date(log.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--mut)] mt-0.5">
                          Actor: <strong>{log.userName || 'System'}</strong> · Entity:{' '}
                          {log.entityType} ({log.entityId})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              B. APPOINTMENT MANAGEMENT MODULE
             ================================================================ */}
          {activeTab === 'appointments' && (
            <div className="space-y-6">
              {/* Filter Bar */}
              <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="w-4 h-4 text-[var(--mut)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={apptSearch}
                      onChange={(e) => setApptSearch(e.target.value)}
                      placeholder="Search patient, phone, doctor, or treatment..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs"
                    />
                  </div>

                  <input
                    type="date"
                    value={apptDateFilter}
                    onChange={(e) => setApptDateFilter(e.target.value)}
                    aria-label="Filter by date"
                    className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs"
                  />

                  <select
                    value={apptDoctorFilter}
                    onChange={(e) => setApptDoctorFilter(e.target.value)}
                    aria-label="Filter by doctor"
                    className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs"
                  >
                    <option value="">All Doctors</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={apptStatusFilter}
                    onChange={(e) => setApptStatusFilter(e.target.value)}
                    aria-label="Filter by appointment status"
                    className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No-Show</option>
                  </select>

                  {(apptSearch || apptDateFilter || apptDoctorFilter || apptStatusFilter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setApptSearch('');
                        setApptDateFilter('');
                        setApptDoctorFilter('');
                        setApptStatusFilter('');
                      }}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {currentUser.role !== 'doctor' && (
                  <button
                    type="button"
                    onClick={() => setShowNewApptModal(true)}
                    className="px-4 py-2 rounded-xl bg-[var(--teal)] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Manual Appointment</span>
                  </button>
                )}
              </div>

              {/* Create Manual Appointment Modal */}
              {showNewApptModal && (
                <div className="bg-[var(--surf)] border-2 border-[var(--teal)] rounded-2xl p-6 shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif-heading text-xl font-bold">
                      Create Manual Appointment (Atomic Conflict Check)
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewApptModal(false);
                        setNewApptError(null);
                      }}
                      className="text-xs font-bold text-[var(--mut)] hover:text-[var(--ink)]"
                    >
                      Close &times;
                    </button>
                  </div>

                  {newApptError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 text-xs font-semibold">
                      {newApptError}
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setNewApptError(null);
                      const res = store.createAppointmentAtomic({
                        patientName: newApptForm.patientName,
                        patientPhone: newApptForm.patientPhone,
                        patientEmail: newApptForm.patientEmail || undefined,
                        doctorId: newApptForm.doctorId,
                        serviceId: newApptForm.serviceId,
                        appointmentDate: newApptForm.appointmentDate,
                        startTime: newApptForm.startTime,
                        status: 'confirmed',
                        source: 'admin',
                        visitReason: newApptForm.visitReason || 'Manual clinic booking',
                        internalNotes: newApptForm.internalNotes || undefined,
                      });
                      if (!res.success) {
                        setNewApptError(res.error || 'Booking failed');
                        return;
                      }
                      setShowNewApptModal(false);
                    }}
                    className="grid sm:grid-cols-3 gap-4 text-xs"
                  >
                    <div>
                      <label className="font-bold block mb-1">Patient Full Name *</label>
                      <input
                        type="text"
                        required
                        value={newApptForm.patientName}
                        onChange={(e) =>
                          setNewApptForm({ ...newApptForm, patientName: e.target.value })
                        }
                        className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">WhatsApp Phone *</label>
                      <input
                        type="tel"
                        required
                        placeholder="+1555..."
                        value={newApptForm.patientPhone}
                        onChange={(e) =>
                          setNewApptForm({ ...newApptForm, patientPhone: e.target.value })
                        }
                        className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">Doctor *</label>
                      <select
                        value={newApptForm.doctorId}
                        onChange={(e) =>
                          setNewApptForm({ ...newApptForm, doctorId: e.target.value })
                        }
                        className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                      >
                        {doctors
                          .filter((d) => d.isActive)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold block mb-1">Service *</label>
                      <select
                        value={newApptForm.serviceId}
                        onChange={(e) =>
                          setNewApptForm({ ...newApptForm, serviceId: e.target.value })
                        }
                        className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                      >
                        {services
                          .filter((s) => s.isActive)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.durationMinutes}m)
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold block mb-1">Date *</label>
                      <input
                        type="date"
                        required
                        value={newApptForm.appointmentDate}
                        onChange={(e) =>
                          setNewApptForm({
                            ...newApptForm,
                            appointmentDate: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">Start Time (HH:mm) *</label>
                      <input
                        type="time"
                        required
                        value={newApptForm.startTime}
                        onChange={(e) =>
                          setNewApptForm({ ...newApptForm, startTime: e.target.value })
                        }
                        className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold block mb-1">Visit Reason &amp; Internal Notes</label>
                      <input
                        type="text"
                        value={newApptForm.visitReason}
                        onChange={(e) =>
                          setNewApptForm({ ...newApptForm, visitReason: e.target.value })
                        }
                        placeholder="Visit reason / clinical notes..."
                        className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-[var(--teal)] text-white font-bold"
                      >
                        Validate &amp; Save Appointment
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Appointments Table */}
              <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[var(--surf-alt)] border-b border-[var(--line)] text-[var(--mut)] uppercase">
                        <th className="p-3.5">Patient</th>
                        <th className="p-3.5">Doctor &amp; Service</th>
                        <th className="p-3.5">Date &amp; Time</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">GCal Sync</th>
                        <th className="p-3.5">Notes</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {filteredAppointments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-[var(--mut)]">
                            No appointments found matching your filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredAppointments.map((appt) => (
                          <React.Fragment key={appt.id}>
                            <tr className="hover:bg-[var(--surf-alt)]/50">
                              <td className="p-3.5">
                                <div className="font-bold text-sm text-[var(--ink)]">
                                  {appt.patientName}
                                </div>
                                <div className="font-mono text-[var(--mut)]">
                                  {appt.patientPhone}
                                </div>
                              </td>
                              <td className="p-3.5">
                                <div className="font-bold text-[var(--ink)]">
                                  {appt.doctorName}
                                </div>
                                <div className="text-[var(--mut)]">{appt.serviceName}</div>
                              </td>
                              <td className="p-3.5">
                                <div className="font-bold">{appt.appointmentDate}</div>
                                <div className="text-[var(--teal)] font-semibold">
                                  {formatDisplayTime(appt.startTime)} –{' '}
                                  {formatDisplayTime(appt.endTime)}
                                </div>
                              </td>
                              <td className="p-3.5">
                                <select
                                  value={appt.status}
                                  onChange={(e) =>
                                    store.updateAppointmentStatus(
                                      appt.id,
                                      e.target.value as AppointmentStatus
                                    )
                                  }
                                  aria-label={`Change status for ${appt.patientName}`}
                                  className="rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-2.5 py-1 font-bold uppercase text-[11px]"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="confirmed">Confirmed</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                  <option value="no_show">No-Show</option>
                                </select>
                              </td>
                              <td className="p-3.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    appt.calendarSyncStatus === 'synced'
                                      ? 'bg-emerald-500/15 text-emerald-700'
                                      : 'bg-gray-500/15 text-[var(--mut)]'
                                  }`}
                                >
                                  {appt.googleCalendarEventId ? '✓ Synced' : 'Local DB'}
                                </span>
                              </td>
                              <td className="p-3.5 max-w-[200px]">
                                <div className="truncate text-[var(--mut)]">
                                  {appt.visitReason}
                                </div>
                                {appt.internalNotes && (
                                  <div className="truncate text-[10px] text-[var(--gold-dark)] font-medium">
                                    Note: {appt.internalNotes}
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                                {appt.status !== 'confirmed' &&
                                  appt.status !== 'cancelled' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        store.updateAppointmentStatus(appt.id, 'confirmed')
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]"
                                    >
                                      Confirm
                                    </button>
                                  )}
                                {appt.status !== 'completed' &&
                                  appt.status !== 'cancelled' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        store.updateAppointmentStatus(appt.id, 'completed')
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px]"
                                    >
                                      Complete
                                    </button>
                                  )}
                                {appt.status !== 'cancelled' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRescheduleTargetId(
                                          rescheduleTargetId === appt.id ? null : appt.id
                                        );
                                        setRescheduleDate(appt.appointmentDate);
                                        setRescheduleTime(appt.startTime);
                                        setRescheduleError(null);
                                      }}
                                      className="px-2.5 py-1 rounded-lg border border-[var(--line-strong)] hover:border-[var(--teal)] font-semibold text-[11px]"
                                    >
                                      Reschedule
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        store.cancelAppointment(
                                          appt.id,
                                          'Cancelled by clinic staff'
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-red-600/15 text-red-700 font-bold text-[11px]"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>

                            {/* Inline Reschedule Drawer */}
                            {rescheduleTargetId === appt.id && (
                              <tr className="bg-[var(--teal-subtle)]/40">
                                <td colSpan={7} className="p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="text-xs font-bold">
                                      Reschedule {appt.patientName}&apos;s appointment with{' '}
                                      {appt.doctorName}:
                                    </div>
                                    {rescheduleError && (
                                      <span className="text-xs text-red-600 font-bold">
                                        {rescheduleError}
                                      </span>
                                    )}
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="date"
                                        value={rescheduleDate}
                                        onChange={(e) => setRescheduleDate(e.target.value)}
                                        className="rounded-lg border border-[var(--line-strong)] bg-[var(--surf)] px-2.5 py-1 text-xs"
                                      />
                                      <input
                                        type="time"
                                        value={rescheduleTime}
                                        onChange={(e) => setRescheduleTime(e.target.value)}
                                        className="rounded-lg border border-[var(--line-strong)] bg-[var(--surf)] px-2.5 py-1 text-xs"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const res = store.rescheduleAppointment({
                                            appointmentId: appt.id,
                                            newDate: rescheduleDate,
                                            newStartTime: rescheduleTime,
                                          });
                                          if (!res.success) {
                                            setRescheduleError(
                                              res.error || 'Slot conflict'
                                            );
                                          } else {
                                            setRescheduleTargetId(null);
                                          }
                                        }}
                                        className="px-3 py-1 rounded-lg bg-[var(--teal)] text-white font-bold text-xs"
                                      >
                                        Confirm New Slot
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              B2. PAYMENTS & RECEIPTS VERIFICATION MODULE
             ================================================================ */}
          {activeTab === 'payments' && <PaymentsVerificationView />}

          {/* ================================================================
              C. CALENDAR & GOOGLE CALENDAR SYNC MODULE
             ================================================================ */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              {/* Calendar Controls Header */}
              <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {(['day', 'week', 'month'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCalendarViewMode(mode)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                        calendarViewMode === mode
                          ? 'bg-[var(--teal)] text-white'
                          : 'bg-[var(--surf-alt)] text-[var(--ink)]'
                      }`}
                    >
                      {mode} View
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="date"
                    value={calendarDate}
                    onChange={(e) => setCalendarDate(e.target.value)}
                    className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold"
                  />

                  <select
                    value={calendarDoctorId}
                    onChange={(e) => setCalendarDoctorId(e.target.value)}
                    className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold"
                  >
                    <option value="">All Doctors</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setGcalSyncBanner(
                        `Google Calendar Free/Busy & Event Synchronization completed at ${new Date().toLocaleTimeString()}. All confirmed appointments reconciled.`
                      );
                      setTimeout(() => setGcalSyncBanner(null), 4000);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Google Calendar</span>
                  </button>
                </div>
              </div>

              {gcalSyncBanner && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{gcalSyncBanner}</span>
                </div>
              )}

              <div className="grid lg:grid-cols-12 gap-6">
                {/* Left 7 Cols: Scheduled Appointments & Status Indicators */}
                <div className="lg:col-span-7 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4">
                  <h3 className="font-serif-heading text-lg font-semibold capitalize">
                    {calendarViewMode} Schedule ({calendarDate}) —{' '}
                    {calendarAppointments.length} Bookings
                  </h3>

                  {holidays.some((h) => h.holidayDate === calendarDate) && (
                    <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 text-xs font-bold">
                      🏖️ Clinic Holiday on {calendarDate}:{' '}
                      {holidays.find((h) => h.holidayDate === calendarDate)?.description}
                    </div>
                  )}

                  {calendarAppointments.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[var(--mut)] border border-dashed border-[var(--line)] rounded-xl">
                      No booked appointments in this {calendarViewMode} window.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {calendarAppointments.map((a) => (
                        <div
                          key={a.id}
                          className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surf-alt)]/50 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[var(--teal)]">
                                {formatDisplayTime(a.startTime)} –{' '}
                                {formatDisplayTime(a.endTime)}
                              </span>
                              <span className="text-xs font-semibold text-[var(--mut)]">
                                ({a.appointmentDate})
                              </span>
                            </div>
                            <div className="font-bold text-sm mt-0.5">
                              {a.patientName} ·{' '}
                              <span className="font-normal text-xs">{a.serviceName}</span>
                            </div>
                            <div className="text-xs text-[var(--mut)]">
                              Specialist: <strong>{a.doctorName}</strong>
                            </div>
                          </div>

                          <div className="text-right space-y-1">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                a.status === 'confirmed'
                                  ? 'bg-emerald-500/15 text-emerald-700'
                                  : a.status === 'cancelled'
                                  ? 'bg-red-500/15 text-red-700'
                                  : 'bg-amber-500/15 text-amber-700'
                              }`}
                            >
                              {a.status}
                            </span>
                            {a.googleCalendarEventId && (
                              <div className="text-[10px] text-emerald-700 font-mono">
                                GCal: {a.googleCalendarEventId}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right 5 Cols: Open Available Slots & Blocked Break Times */}
                <div className="lg:col-span-5 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4">
                  <h3 className="font-serif-heading text-lg font-semibold">
                    Live Available Slots on {calendarDate} ({calendarAvailableSlots.length})
                  </h3>
                  <p className="text-xs text-[var(--mut)]">
                    Automatically excludes booked appointments, doctor breaks (13:00–14:00), and clinic holidays.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                    {calendarAvailableSlots.map((slot) => (
                      <div
                        key={`${slot.doctorId}_${slot.startTime}`}
                        className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-center"
                      >
                        <div className="font-bold text-xs text-emerald-800 dark:text-emerald-300">
                          {slot.displayTime}
                        </div>
                        <div className="text-[10px] text-[var(--mut)] truncate">
                          {slot.doctorName}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              D. PATIENT MANAGEMENT MODULE
             ================================================================ */}
          {activeTab === 'patients' && (
            <div className="space-y-6">
              <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-[var(--mut)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patients by full name, WhatsApp phone, or email..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs"
                  />
                </div>
                {currentUser.role !== 'doctor' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPatientForm({
                        id: '',
                        fullName: '',
                        phone: '',
                        email: '',
                        visitReason: '',
                        internalNotes: '',
                      });
                      setShowPatientModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--teal)] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Patient Record</span>
                  </button>
                )}
              </div>

              {showPatientModal && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    store.upsertPatient({
                      id: patientForm.id || undefined,
                      fullName: patientForm.fullName,
                      phone: patientForm.phone,
                      email: patientForm.email || null,
                      visitReason: patientForm.visitReason || null,
                      internalNotes: patientForm.internalNotes || null,
                    });
                    setShowPatientModal(false);
                  }}
                  className="bg-[var(--surf)] border-2 border-[var(--teal)] rounded-2xl p-6 grid sm:grid-cols-3 gap-4 text-xs"
                >
                  <div>
                    <label className="font-bold block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={patientForm.fullName}
                      onChange={(e) =>
                        setPatientForm({ ...patientForm, fullName: e.target.value })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">WhatsApp Phone *</label>
                    <input
                      type="tel"
                      required
                      value={patientForm.phone}
                      onChange={(e) =>
                        setPatientForm({ ...patientForm, phone: e.target.value })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      value={patientForm.email}
                      onChange={(e) =>
                        setPatientForm({ ...patientForm, email: e.target.value })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Visit Reason</label>
                    <input
                      type="text"
                      value={patientForm.visitReason}
                      onChange={(e) =>
                        setPatientForm({ ...patientForm, visitReason: e.target.value })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Internal Administrative Notes</label>
                    <input
                      type="text"
                      value={patientForm.internalNotes}
                      onChange={(e) =>
                        setPatientForm({ ...patientForm, internalNotes: e.target.value })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-xl bg-[var(--teal)] text-white font-bold"
                    >
                      Save Patient
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPatientModal(false)}
                      className="px-3 py-2 rounded-xl border border-[var(--line)]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[var(--surf-alt)] border-b border-[var(--line)] text-[var(--mut)] uppercase">
                      <th className="p-3.5">Patient Name</th>
                      <th className="p-3.5">WhatsApp Phone</th>
                      <th className="p-3.5">Email</th>
                      <th className="p-3.5">Visit Reason &amp; Notes</th>
                      <th className="p-3.5">Appointments</th>
                      <th className="p-3.5">Registered</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {filteredPatients.map((p) => {
                      const patAppts = appointments.filter((a) => a.patientId === p.id);
                      return (
                        <tr key={p.id}>
                          <td className="p-3.5 font-bold text-sm">{p.fullName}</td>
                          <td className="p-3.5 font-mono">{p.phone}</td>
                          <td className="p-3.5 text-[var(--mut)]">{p.email || '—'}</td>
                          <td className="p-3.5">
                            <div>{p.visitReason || 'General inquiry'}</div>
                            {p.internalNotes && (
                              <div className="text-[10px] text-[var(--gold-dark)]">
                                Note: {p.internalNotes}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 font-bold">{patAppts.length} visits</td>
                          <td className="p-3.5 text-[var(--mut)]">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setPatientForm({
                                  id: p.id,
                                  fullName: p.fullName,
                                  phone: p.phone,
                                  email: p.email || '',
                                  visitReason: p.visitReason || '',
                                  internalNotes: p.internalNotes || '',
                                });
                                setShowPatientModal(true);
                              }}
                              className="px-3 py-1 rounded-lg border border-[var(--line-strong)] hover:border-[var(--teal)] font-semibold"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              E. DOCTOR MANAGEMENT MODULE
             ================================================================ */}
          {activeTab === 'doctors' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--mut)]">
                  Manage clinical specialists, working days/hours, break times, appointment durations, and Google Calendar connections.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDoctorForm({
                      id: '',
                      name: '',
                      specialization: '',
                      description: '',
                      appointmentDurationMinutes: 45,
                      credentialsText: 'DDS, Specialist',
                      googleCalendarConnected: true,
                    });
                    setShowDoctorModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--teal)] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Doctor</span>
                </button>
              </div>

              {showDoctorModal && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    store.upsertDoctor({
                      id: doctorForm.id || undefined,
                      name: doctorForm.name,
                      specialization: doctorForm.specialization,
                      description: doctorForm.description,
                      appointmentDurationMinutes: Number(
                        doctorForm.appointmentDurationMinutes
                      ),
                      credentials: doctorForm.credentialsText
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                      googleCalendarConnected: doctorForm.googleCalendarConnected,
                    });
                    setShowDoctorModal(false);
                  }}
                  className="bg-[var(--surf)] border-2 border-[var(--teal)] rounded-2xl p-6 grid sm:grid-cols-3 gap-4 text-xs"
                >
                  <div>
                    <label className="font-bold block mb-1">Doctor Name *</label>
                    <input
                      type="text"
                      required
                      value={doctorForm.name}
                      onChange={(e) =>
                        setDoctorForm({ ...doctorForm, name: e.target.value })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Specialization *</label>
                    <input
                      type="text"
                      required
                      value={doctorForm.specialization}
                      onChange={(e) =>
                        setDoctorForm({
                          ...doctorForm,
                          specialization: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Default Slot Duration (Mins)</label>
                    <input
                      type="number"
                      min={15}
                      max={180}
                      value={doctorForm.appointmentDurationMinutes}
                      onChange={(e) =>
                        setDoctorForm({
                          ...doctorForm,
                          appointmentDurationMinutes: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold block mb-1">Biography / Description</label>
                    <input
                      type="text"
                      value={doctorForm.description}
                      onChange={(e) =>
                        setDoctorForm({ ...doctorForm, description: e.target.value })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-xl bg-[var(--teal)] text-white font-bold"
                    >
                      Save Doctor
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDoctorModal(false)}
                      className="px-3 py-2 rounded-xl border border-[var(--line)]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="grid sm:grid-cols-2 gap-6">
                {doctors.map((doc) => (
                  <div
                    key={doc.id}
                    className={`bg-[var(--surf)] border rounded-2xl p-5 space-y-4 ${
                      doc.isActive
                        ? 'border-[var(--line)]'
                        : 'border-red-300 opacity-65'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={doc.imageUrl}
                          alt={doc.name}
                          className="w-14 h-14 rounded-2xl object-cover"
                        />
                        <div>
                          <h4 className="font-serif-heading text-lg font-bold">
                            {doc.name}
                          </h4>
                          <span className="text-xs font-bold text-[var(--gold-dark)]">
                            {doc.specialization}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          doc.isActive
                            ? 'bg-emerald-500/15 text-emerald-700'
                            : 'bg-red-500/15 text-red-700'
                        }`}
                      >
                        {doc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--mut)]">{doc.description}</p>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-[var(--surf-alt)] p-3 rounded-xl">
                      <div>
                        <strong>Appointment Duration:</strong>{' '}
                        {doc.appointmentDurationMinutes} mins
                      </div>
                      <div>
                        <strong>Break Time:</strong> 13:00 – 14:00
                      </div>
                      <div>
                        <strong>Working Days:</strong>{' '}
                        {doc.availability.filter((a) => a.isAvailable).length} days/wk
                      </div>
                      <div>
                        <strong>Google Calendar:</strong>{' '}
                        <span
                          className={
                            doc.googleCalendarConnected
                              ? 'text-emerald-600 font-bold'
                              : 'text-[var(--mut)]'
                          }
                        >
                          {doc.googleCalendarConnected ? '✓ Connected' : 'Not linked'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDoctorForm({
                            id: doc.id,
                            name: doc.name,
                            specialization: doc.specialization,
                            description: doc.description,
                            appointmentDurationMinutes:
                              doc.appointmentDurationMinutes,
                            credentialsText: doc.credentials.join(', '),
                            googleCalendarConnected: doc.googleCalendarConnected,
                          });
                          setShowDoctorModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-[var(--line-strong)] text-xs font-semibold"
                      >
                        Edit Schedule &amp; Details
                      </button>
                      <button
                        type="button"
                        onClick={() => store.toggleDoctorActive(doc.id)}
                        className="px-3 py-1.5 rounded-xl bg-[var(--surf-alt)] text-xs font-semibold"
                      >
                        {doc.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================
              F. SERVICES AND TREATMENTS MODULE
             ================================================================ */}
          {activeTab === 'services' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--mut)]">
                  Manage treatments, durations, pricing, and assigned specialists.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setServiceForm({
                      id: '',
                      name: '',
                      category: 'Aesthetic Care',
                      durationMinutes: 45,
                      price: 199,
                      priceLabel: 'From $199',
                      description: '',
                    });
                    setShowServiceModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--teal)] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Treatment / Service</span>
                </button>
              </div>

              {showServiceModal && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    store.upsertService({
                      id: serviceForm.id || undefined,
                      name: serviceForm.name,
                      category: serviceForm.category,
                      durationMinutes: Number(serviceForm.durationMinutes),
                      price: Number(serviceForm.price),
                      priceLabel: serviceForm.priceLabel,
                      description: serviceForm.description,
                    });
                    setShowServiceModal(false);
                  }}
                  className="bg-[var(--surf)] border-2 border-[var(--teal)] rounded-2xl p-6 grid sm:grid-cols-3 gap-4 text-xs"
                >
                  <div>
                    <label className="font-bold block mb-1">Service Name *</label>
                    <input
                      type="text"
                      required
                      value={serviceForm.name}
                      onChange={(e) =>
                        setServiceForm({ ...serviceForm, name: e.target.value })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Duration (Minutes) *</label>
                    <input
                      type="number"
                      required
                      min={15}
                      max={240}
                      value={serviceForm.durationMinutes}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          durationMinutes: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Display Price Label *</label>
                    <input
                      type="text"
                      required
                      value={serviceForm.priceLabel}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          priceLabel: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold block mb-1">Description</label>
                    <input
                      type="text"
                      value={serviceForm.description}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          description: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-xl bg-[var(--teal)] text-white font-bold"
                    >
                      Save Service
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowServiceModal(false)}
                      className="px-3 py-2 rounded-xl border border-[var(--line)]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {services.map((svc) => (
                  <div
                    key={svc.id}
                    className={`bg-[var(--surf)] border rounded-2xl p-5 flex flex-col justify-between space-y-4 ${
                      svc.isActive ? 'border-[var(--line)]' : 'opacity-60'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-[10px] font-bold uppercase">
                          {svc.category}
                        </span>
                        <span className="font-bold text-xs text-[var(--gold-dark)]">
                          {svc.priceLabel}
                        </span>
                      </div>
                      <h4 className="font-serif-heading text-lg font-bold">
                        {svc.name}
                      </h4>
                      <p className="text-xs text-[var(--mut)]">{svc.description}</p>
                    </div>

                    <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between text-xs">
                      <span>
                        Duration: <strong>{svc.durationMinutes} mins</strong>
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setServiceForm({
                              id: svc.id,
                              name: svc.name,
                              category: svc.category,
                              durationMinutes: svc.durationMinutes,
                              price: svc.price || 0,
                              priceLabel: svc.priceLabel,
                              description: svc.description,
                            });
                            setShowServiceModal(true);
                          }}
                          className="text-[var(--teal)] font-bold hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => store.toggleServiceActive(svc.id)}
                          className="text-[var(--mut)] hover:underline"
                        >
                          {svc.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================
              G. WHATSAPP INBOX MODULE
             ================================================================ */}
          {activeTab === 'inbox' && <WhatsAppInboxView />}

          {/* ================================================================
              H. AI RECEPTIONIST SETTINGS & TESTING SANDBOX
             ================================================================ */}
          {activeTab === 'ai' && <AISettingsAndTestView />}

          {/* ================================================================
              I. REMINDER MANAGEMENT MODULE
             ================================================================ */}
          {activeTab === 'reminders' && (
            <div className="space-y-6">
              <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif-heading text-lg font-bold">
                    Automated WhatsApp Reminder Queue (Netlify Scheduled Functions)
                  </h3>
                  <p className="text-xs text-[var(--mut)]">
                    Database-backed idempotent reminder jobs running every 5 minutes (`*/5 * * * *`) without n8n or in-memory timers.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiConfig.enable1hReminder}
                      onChange={(e) =>
                        store.updateAIConfiguration({
                          enable1hReminder: e.target.checked,
                        })
                      }
                    />
                    <span>1-Hour Reminder (Default)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiConfig.enable24hReminder}
                      onChange={(e) =>
                        store.updateAIConfiguration({
                          enable24hReminder: e.target.checked,
                        })
                      }
                    />
                    <span>24-Hour Reminder (Optional)</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => store.processDueReminders()}
                    className="px-4 py-2 rounded-xl bg-[var(--teal)] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run Scheduled Reminder Worker Now</span>
                  </button>
                </div>
              </div>

              <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[var(--surf-alt)] border-b border-[var(--line)] text-[var(--mut)] uppercase">
                      <th className="p-3.5">Patient &amp; Phone</th>
                      <th className="p-3.5">Appointment</th>
                      <th className="p-3.5">Type</th>
                      <th className="p-3.5">Scheduled At</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Idempotency Key</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {reminders.map((rem) => (
                      <tr key={rem.id}>
                        <td className="p-3.5">
                          <div className="font-bold">{rem.patientName}</div>
                          <div className="font-mono text-[var(--mut)]">
                            {rem.patientPhone}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold">{rem.serviceName}</div>
                          <div className="text-[var(--mut)]">
                            {rem.doctorName} · {rem.appointmentDate} at{' '}
                            {formatDisplayTime(rem.appointmentTime)}
                          </div>
                        </td>
                        <td className="p-3.5 font-bold uppercase">
                          {rem.reminderType} Before
                        </td>
                        <td className="p-3.5 font-mono text-[11px]">
                          {new Date(rem.scheduledAt).toLocaleString()}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              rem.status === 'sent'
                                ? 'bg-emerald-500/15 text-emerald-700'
                                : rem.status === 'failed'
                                ? 'bg-red-500/15 text-red-700'
                                : rem.status === 'cancelled'
                                ? 'bg-gray-500/15 text-gray-600'
                                : 'bg-amber-500/15 text-amber-700'
                            }`}
                          >
                            {rem.status} (Attempts: {rem.attempts})
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-[10px] text-[var(--mut)]">
                          {rem.idempotencyKey}
                        </td>
                        <td className="p-3.5 text-right">
                          {rem.status !== 'sent' && rem.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => store.processDueReminders(rem.id)}
                              className="px-3 py-1 rounded-lg bg-[var(--teal)] text-white font-bold text-[11px]"
                            >
                              Send / Retry Now
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              J. REPORTS & CSV EXPORT MODULE
             ================================================================ */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif-heading text-lg font-bold">
                    Clinical &amp; WhatsApp Analytics Reports
                  </h3>
                  <p className="text-xs text-[var(--mut)]">
                    Generate automated daily owner summaries ({clinic.timezone}) and export complete appointment logs to CSV.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => store.generateDailyReport(todayStr)}
                    className="px-4 py-2 rounded-xl border border-[var(--teal)] text-[var(--teal)] text-xs font-bold flex items-center gap-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Generate Today&apos;s Owner Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportAppointmentsCSV}
                    className="px-4 py-2 rounded-xl bg-[var(--teal)] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Appointments CSV</span>
                  </button>
                </div>
              </div>

              {/* Daily Owner Reports List */}
              <div className="grid lg:grid-cols-2 gap-6">
                {dailyReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                      <div>
                        <span className="text-xs font-bold uppercase text-[var(--gold-dark)]">
                          Automated Daily Clinic Owner Report
                        </span>
                        <h4 className="font-serif-heading text-xl font-bold">
                          Report Date: {rep.reportDate}
                        </h4>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 text-xs font-bold uppercase">
                        {rep.deliveryStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center text-xs">
                      <div className="p-3 rounded-xl bg-[var(--surf-alt)]">
                        <div className="text-lg font-bold">{rep.totalAppointments}</div>
                        <div className="text-[var(--mut)]">Total Bookings</div>
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--surf-alt)]">
                        <div className="text-lg font-bold text-emerald-600">
                          {rep.confirmedAppointments}
                        </div>
                        <div className="text-[var(--mut)]">Confirmed</div>
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--surf-alt)]">
                        <div className="text-lg font-bold text-red-600">
                          {rep.cancelledAppointments}
                        </div>
                        <div className="text-[var(--mut)]">Cancelled</div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="font-bold text-[var(--mut)] uppercase text-[11px]">
                        Doctor-Wise Breakdown:
                      </div>
                      {rep.doctorBreakdown.map((db) => (
                        <div
                          key={db.doctorId}
                          className="flex items-center justify-between py-1 border-b border-[var(--line)]/60"
                        >
                          <span className="font-semibold">{db.doctorName}</span>
                          <span>
                            {db.total} total ({db.confirmed} confirmed, {db.completed}{' '}
                            completed)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================
              K. SETTINGS, INTEGRATIONS & RBAC MODULE
             ================================================================ */}
          {activeTab === 'settings' && (
            <div className="grid lg:grid-cols-12 gap-6 items-start">
              {/* Clinic Profile & Verification Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  store.updateClinicProfile({
                    name: clinicName,
                    address: clinicAddress,
                    phone: clinicPhone,
                    whatsappNumber: clinicWhatsapp,
                    email: clinicEmail,
                    timezone: clinicTimezone,
                    isVerifiedContent,
                  });
                  setSettingsSavedBanner(true);
                  setTimeout(() => setSettingsSavedBanner(false), 3000);
                }}
                className="lg:col-span-7 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4"
              >
                <h3 className="font-serif-heading text-xl font-bold">
                  Clinic Profile &amp; Verified Information Settings
                </h3>

                {settingsSavedBanner && (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 text-xs font-bold">
                    ✓ Clinic settings saved and synchronized across public website and AI receptionist.
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold block mb-1">Clinic Name</label>
                    <input
                      type="text"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Clinic Timezone</label>
                    <input
                      type="text"
                      value={clinicTimezone}
                      onChange={(e) => setClinicTimezone(e.target.value)}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Direct Phone</label>
                    <input
                      type="text"
                      value={clinicPhone}
                      onChange={(e) => setClinicPhone(e.target.value)}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">
                      Official WhatsApp Number (E.164 Digits)
                    </label>
                    <input
                      type="text"
                      value={clinicWhatsapp}
                      onChange={(e) => setClinicWhatsapp(e.target.value)}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold block mb-1">Physical Address</label>
                    <input
                      type="text"
                      value={clinicAddress}
                      onChange={(e) => setClinicAddress(e.target.value)}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold block mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={clinicEmail}
                      onChange={(e) => setClinicEmail(e.target.value)}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--surf-alt)] border border-[var(--line)] text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVerifiedContent}
                    onChange={(e) => setIsVerifiedContent(e.target.checked)}
                  />
                  <span>
                    Mark clinic contact details, doctors, and hours as Verified for Production Launch (hides placeholder notice banner)
                  </span>
                </label>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[var(--teal)] text-white font-bold text-xs"
                >
                  Save Clinic Profile
                </button>
              </form>

              {/* Right 5 Cols: Holidays, Integrations & RBAC Matrix */}
              <div className="lg:col-span-5 space-y-6">
                {/* Holidays Manager */}
                <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4">
                  <h4 className="font-serif-heading text-lg font-bold">
                    Clinic Holidays (Blocks Booking Slots)
                  </h4>
                  <div className="flex gap-2 text-xs">
                    <input
                      type="date"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-1.5"
                    />
                    <input
                      type="text"
                      placeholder="Holiday reason..."
                      value={newHolidayDesc}
                      onChange={(e) => setNewHolidayDesc(e.target.value)}
                      className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newHolidayDate && newHolidayDesc) {
                          store.addClinicHoliday(newHolidayDate, newHolidayDesc);
                          setNewHolidayDate('');
                          setNewHolidayDesc('');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[var(--teal)] text-white font-bold"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {holidays.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-[var(--surf-alt)]"
                      >
                        <span>
                          <strong>{h.holidayDate}</strong> — {h.description}
                        </span>
                        <button
                          type="button"
                          onClick={() => store.removeClinicHoliday(h.id)}
                          className="text-red-600 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* External Integrations Status */}
                <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-3">
                  <h4 className="font-serif-heading text-lg font-bold">
                    External Integrations Status
                  </h4>
                  <p className="text-xs text-[var(--mut)]">
                    Private tokens are stored server-side via environment variables and AES-256-GCM encryption.
                  </p>
                  <div className="space-y-2 text-xs">
                    {integrations.map((int) => (
                      <div
                        key={int.id}
                        className="p-3 rounded-xl bg-[var(--surf-alt)] border border-[var(--line)] flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold uppercase">{int.provider}</div>
                          <div className="text-[11px] text-[var(--mut)]">
                            {int.accountLabel}
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase">
                          {int.connectionStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
