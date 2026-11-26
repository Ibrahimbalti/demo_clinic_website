import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Moon,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  ChevronRight,
  Menu,
  X,
  Bot,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { useClinicStore } from '../hooks/useClinicStore';
import {
  COUNTRY_DIAL_CODES,
  formatE164WithCountryCode,
  isValidE164Mobile,
  publicAppointmentSchema,
  type PublicAppointmentFormValues,
} from '../lib/schemas';
import {
  handleInboundWhatsAppWebhookMessage,
  resetAISessionDraft,
} from '../lib/aiReceptionistEngine';
import { formatDisplayTime } from '../lib/availabilityEngine';
import {
  AboutUsPage,
  TreatmentsPage,
  DoctorsPage,
  ContactAndHoursPage,
  FaqKnowledgeBasePage,
  type PublicPageRoute,
} from './PublicSubpages';

function getBasePrefix(): string {
  if (typeof window === 'undefined') return '';
  if (window.location.pathname.toLowerCase().startsWith('/demo_clinic_website')) {
    return '/demo_clinic_website';
  }
  return '';
}

function resolveRouteFromLocation(): PublicPageRoute {
  if (typeof window === 'undefined') return 'home';
  const prefix = getBasePrefix().toLowerCase();
  let path = window.location.pathname.toLowerCase();
  if (prefix && path.startsWith(prefix)) {
    path = path.slice(prefix.length);
  }
  path = path.replace(/\/+$/, '') || '/';
  const hash = window.location.hash.toLowerCase();

  if (path === '/about' || hash === '#about' || hash === '#about-section') return 'about';
  if (path === '/treatments' || path === '/services' || hash === '#treatments' || hash === '#services-section')
    return 'treatments';
  if (path === '/doctors' || hash === '#doctors' || hash === '#doctors-section') return 'doctors';
  if (path === '/contact' || path === '/hours' || hash === '#contact' || hash === '#hours-section')
    return 'contact';
  if (path === '/faq' || hash === '#faq' || hash === '#faq-section') return 'faq';
  if (path === '/book' || hash === '#book' || hash === '#booking-section') return 'book';
  return 'home';
}

const ROUTE_TO_PATH: Record<PublicPageRoute, string> = {
  home: '/',
  about: '/about',
  treatments: '/treatments',
  doctors: '/doctors',
  contact: '/contact',
  faq: '/faq',
  book: '/book',
};

interface PublicWebsiteProps {
  onOpenAdmin: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const HERO_SLIDES = [
  {
    eyebrow: '✦ BESPOKE SMILE DESIGN · PAIN-FREE DENTISTRY',
    titleMain: 'Your Dream Smile,',
    titleAccent: 'Crafted with Artistry.',
    description:
      'Experience pain-free aesthetic dentistry, 3D digital smile design, and instant AI-powered WhatsApp appointment scheduling in a tranquil, state-of-the-art clinic.',
    image:
      'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1920&auto=format&fit=crop&q=85',
    pills: [
      'Painless Computerized Anesthesia',
      '3D Digital Smile Simulation',
      'Hospital-Grade Sterilization',
      '24/7 AI WhatsApp Booking',
    ],
    tabLabel: 'Smile Artistry',
  },
  {
    eyebrow: '✨ IN-OFFICE LASER WHITENING · 45-MINUTE VISIT',
    titleMain: 'Luminous Brilliance,',
    titleAccent: 'In a Single Gentle Visit.',
    description:
      'Medical-grade laser whitening that safely lifts years of discoloration in 45 minutes while actively shielding your enamel and preventing sensitivity.',
    image:
      'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1920&auto=format&fit=crop&q=85',
    pills: [
      '45-Minute In-Clinic Treatment',
      'Enamel-Safe Formulation',
      'Protective Gum Barrier',
      'Take-Home Maintenance Kit',
    ],
    tabLabel: 'Laser Whitening',
  },
  {
    eyebrow: '🔬 GUIDED IMPLANTOLOGY & CLEAR ALIGNERS',
    titleMain: 'Flawless Alignment,',
    titleAccent: 'Permanent Strength.',
    description:
      'Straighten discreetly with virtually invisible custom aligners, or restore missing teeth with 3D-guided biocompatible titanium implants and zirconia crowns.',
    image:
      'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=1920&auto=format&fit=crop&q=85',
    pills: [
      'Guided 3D Surgical Precision',
      'Virtually Invisible Aligners',
      'Transparent Written Plans',
      'Custom Zirconia Crowns',
    ],
    tabLabel: 'Implants & Aligners',
  },
  {
    eyebrow: '🌿 COMPASSIONATE CARE · ALL AGES WELCOME',
    titleMain: 'Gentle Dentistry,',
    titleAccent: 'For Your Entire Family.',
    description:
      'Where dental anxiety dissolves into soothing comfort. Warm greetings, gentle preventive treatments, and calm family dental visits.',
    image:
      'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=1920&auto=format&fit=crop&q=85',
    pills: [
      'Anxiety-Free Soothing Environment',
      'Gentle Pediatric & Family Care',
      'Same-Day Priority Slots',
      'Preventive Fissure Sealants',
    ],
    tabLabel: 'Family Dentistry',
  },
];

export const PublicWebsite: React.FC<PublicWebsiteProps> = ({
  onOpenAdmin,
  theme,
  onToggleTheme,
}) => {
  const { state, store } = useClinicStore();
  const { clinic, doctors, services, holidays, aiConfig } = state;

  const activeDoctors = useMemo(() => doctors.filter((d) => d.isActive), [doctors]);
  const activeServices = useMemo(() => services.filter((s) => s.isActive), [services]);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [beforeAfterPct, setBeforeAfterPct] = useState(50);
  const [publicPage, setPublicPage] = useState<PublicPageRoute>(() =>
    resolveRouteFromLocation()
  );

  useEffect(() => {
    const handleLocationSync = () => {
      setPublicPage(resolveRouteFromLocation());
    };
    window.addEventListener('popstate', handleLocationSync);
    window.addEventListener('hashchange', handleLocationSync);
    return () => {
      window.removeEventListener('popstate', handleLocationSync);
      window.removeEventListener('hashchange', handleLocationSync);
    };
  }, []);

  const navigateToPage = (page: PublicPageRoute) => {
    setPublicPage(page);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      const prefix = getBasePrefix();
      const subPath = ROUTE_TO_PATH[page] || '/';
      const targetUrl = prefix ? `${prefix}${subPath === '/' ? '/' : subPath}` : subPath;
      if (window.location.pathname !== targetUrl || window.location.hash) {
        window.history.pushState({ page }, '', targetUrl);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navigateToBookingPage = () => navigateToPage('book');
  const [bookingConfirmation, setBookingConfirmation] = useState<{
    appointmentId: string;
    patientName: string;
    patientPhoneE164: string;
    hasWhatsApp: boolean;
    paymentMethod: string;
    paymentStatus: string;
    paymentDisplayLabel: string;
    appointmentStatus: string;
    doctorName: string;
    serviceName: string;
    date: string;
    time: string;
  } | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // Resubmit Rejected Receipt State
  const [resubmitApptId, setResubmitApptId] = useState('');
  const [resubmitTid, setResubmitTid] = useState('');
  const [resubmitFileUrl, setResubmitFileUrl] = useState('');
  const [resubmitFileName, setResubmitFileName] = useState('');
  const [resubmitSuccessMsg, setResubmitSuccessMsg] = useState<string | null>(null);

  // Interactive WhatsApp AI Concierge Drawer State
  const [waDrawerOpen, setWaDrawerOpen] = useState(false);
  const [waSimulatorPhone, setWaSimulatorPhone] = useState('+15559012345');
  const [waInput, setWaInput] = useState('');
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // Default tomorrow date for booking
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PublicAppointmentFormValues>({
    resolver: zodResolver(publicAppointmentSchema),
    defaultValues: {
      fullName: '',
      countryCode: '+92',
      phone: '',
      hasWhatsApp: true,
      email: '',
      serviceId: activeServices[0]?.id || 'svc_checkup',
      doctorId: '',
      appointmentDate: tomorrowStr,
      startTime: '',
      paymentMethod: 'CASH_AT_CLINIC',
      transactionReference: '',
      receiptFileUrl: '',
      receiptFileName: '',
      visitReason: '',
      consentGranted: true,
    },
  });

  const watchedDate = watch('appointmentDate');
  const watchedServiceId = watch('serviceId');
  const watchedDoctorId = watch('doctorId');
  const watchedStartTime = watch('startTime');
  const watchedCountryCode = watch('countryCode') || '+92';
  const watchedPhone = watch('phone') || '';
  const watchedHasWhatsApp = watch('hasWhatsApp');
  const watchedPaymentMethod = watch('paymentMethod') || 'CASH_AT_CLINIC';
  const watchedReceiptFileName = watch('receiptFileName');

  const paymentSettings = clinic.paymentSettings ?? {
    cashAtClinicEnabled: true,
    manualEasypaisaEnabled: true,
    easypaisaAccountNumber: '0370-5621256',
    easypaisaAccountTitle: 'Gasha Demo Clinic',
    easypaisaInstructions:
      'Send the appointment fee via Easypaisa to account 0370-5621256 (Gasha Demo Clinic), upload your payment receipt screenshot, and enter the Transaction ID (TID).',
    debitCreditCardEnabled: true,
    appleGooglePayEnabled: true,
    paypalEnabled: true,
    internationalCardEnabled: true,
    internationalGatewayProvider: 'safepay_pk',
    hasEligibleInternationalMerchantAccount: false,
    currencyCode: 'USD',
  };

  const rejectedAppointments = useMemo(() => {
    return state.appointments.filter((a) => a.paymentStatus === 'REJECTED');
  }, [state.appointments]);

  const previewE164Phone = useMemo(() => {
    if (!watchedPhone.trim()) return '';
    return formatE164WithCountryCode(watchedCountryCode, watchedPhone);
  }, [watchedCountryCode, watchedPhone]);

  const availableSlots = useMemo(() => {
    if (!watchedDate) return [];
    return store.getAvailableSlots({
      date: watchedDate,
      doctorId: watchedDoctorId || undefined,
      serviceId: watchedServiceId || undefined,
    });
  }, [state.appointments, watchedDate, watchedDoctorId, watchedServiceId, store]);

  // Deduplicate display times when "Any available doctor" is selected
  const uniqueDisplaySlots = useMemo(() => {
    const map = new Map<string, (typeof availableSlots)[0]>();
    for (const s of availableSlots) {
      const key = watchedDoctorId ? `${s.doctorId}_${s.startTime}` : s.startTime;
      if (!map.has(key)) map.set(key, s);
    }
    return Array.from(map.values());
  }, [availableSlots, watchedDoctorId]);

  useEffect(() => {
    if (
      uniqueDisplaySlots.length > 0 &&
      !uniqueDisplaySlots.some((s) => s.startTime === watchedStartTime)
    ) {
      setValue('startTime', uniqueDisplaySlots[0].startTime);
    }
  }, [uniqueDisplaySlots, watchedStartTime, setValue]);

  // Auto-advance hero slider
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6500);
    return () => clearInterval(timer);
  }, []);

  const officialWhatsAppUrl = useMemo(() => {
    const cleanNum = clinic.whatsappNumber.replace(/[^\d]/g, '') || '15552347645';
    const text = encodeURIComponent(
      `Hello ${clinic.name}, I would like to book an appointment.`
    );
    return `https://wa.me/${cleanNum}?text=${text}`;
  }, [clinic.whatsappNumber, clinic.name]);

  const onSubmitBooking = (values: PublicAppointmentFormValues) => {
    setBookingError(null);
    setBookingConfirmation(null);

    const formattedE164 = formatE164WithCountryCode(values.countryCode, values.phone);
    if (!isValidE164Mobile(formattedE164)) {
      setBookingError(
        'A valid international mobile number in E.164 format is mandatory to book an appointment.'
      );
      return;
    }

    const result = store.createAppointmentAtomic({
      patientName: values.fullName,
      patientPhone: formattedE164,
      patientHasWhatsApp: values.hasWhatsApp,
      patientEmail: values.email || undefined,
      doctorId: values.doctorId || undefined,
      serviceId: values.serviceId,
      appointmentDate: values.appointmentDate,
      startTime: values.startTime,
      paymentMethod: values.paymentMethod,
      transactionReference: values.transactionReference || undefined,
      receiptFileUrl: values.receiptFileUrl || undefined,
      receiptFileName: values.receiptFileName || undefined,
      source: 'website',
      visitReason: values.visitReason || 'Online website booking',
      actorName: 'Website Patient Booking',
    });

    if (!result.success || !result.appointment) {
      setBookingError(result.error || 'Could not book the selected slot.');
      return;
    }

    setBookingConfirmation({
      appointmentId: result.appointment.id,
      patientName: result.appointment.patientName,
      patientPhoneE164: result.appointment.patientPhone,
      hasWhatsApp: values.hasWhatsApp,
      paymentMethod: result.appointment.paymentMethod,
      paymentStatus: result.appointment.paymentStatus,
      paymentDisplayLabel: result.appointment.paymentDisplayLabel,
      appointmentStatus: result.appointment.status,
      doctorName: result.appointment.doctorName,
      serviceName: result.appointment.serviceName,
      date: result.appointment.appointmentDate,
      time: formatDisplayTime(result.appointment.startTime),
    });
    // Sync the in-browser WhatsApp drawer to the patient's booked phone number so they can immediately view their WhatsApp confirmation message
    setWaSimulatorPhone(result.appointment.patientPhone);
    setShowSuccessPopup(true);

    reset({
      fullName: '',
      countryCode: values.countryCode,
      phone: '',
      hasWhatsApp: values.hasWhatsApp,
      email: '',
      serviceId: values.serviceId,
      doctorId: values.doctorId,
      appointmentDate: values.appointmentDate,
      startTime: '',
      paymentMethod: values.paymentMethod,
      transactionReference: '',
      receiptFileUrl: '',
      receiptFileName: '',
      visitReason: '',
      consentGranted: true,
    });
  };

  const handleSelectTreatmentAndScroll = (serviceId: string, doctorId?: string) => {
    setValue('serviceId', serviceId);
    if (doctorId) setValue('doctorId', doctorId);
    navigateToBookingPage();
  };

  // Live WhatsApp Simulator Conversation Messages
  const simulatorConversation = useMemo(() => {
    return state.conversations.find((c) => c.phone === waSimulatorPhone);
  }, [state.conversations, waSimulatorPhone]);

  const simulatorMessages = useMemo(() => {
    if (!simulatorConversation) return [];
    return state.messages.filter((m) => m.conversationId === simulatorConversation.id);
  }, [state.messages, simulatorConversation]);

  // Auto-scroll chat feed whenever messages change or drawer opens
  useEffect(() => {
    if (waDrawerOpen && chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simulatorMessages.length, waDrawerOpen, simulatorConversation?.handlingMode]);

  const sendSimulatorText = (textToSend: string) => {
    if (!textToSend.trim()) return;
    // In the website AI Assistant drawer, if the conversation was previously in 'human' mode,
    // automatically resume AI when the user types a message (unless they are asking for a human)
    if (
      simulatorConversation &&
      simulatorConversation.handlingMode === 'human' &&
      !/\b(talk to a human|human receptionist|real person)\b/i.test(textToSend)
    ) {
      store.setConversationHandlingMode(
        simulatorConversation.id,
        'ai',
        'Website Visitor Auto-Resume AI'
      );
    }
    handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: `wamid.web_sim.${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fromPhone: waSimulatorPhone,
      senderProfileName: 'Website Visitor',
      messageType: 'text',
      textContent: textToSend.trim(),
    });
    setWaInput('');
  };

  const handleSendWhatsAppSimulatorMessage = (e: React.FormEvent) => {
    e.preventDefault();
    sendSimulatorText(waInput);
  };

  const handleResumeAIInSimulator = () => {
    if (simulatorConversation) {
      store.setConversationHandlingMode(
        simulatorConversation.id,
        'ai',
        'Patient Simulator Resume AI'
      );
      // Also automatically reply to the last unanswered patient message if one exists
      const lastMsg = simulatorMessages[simulatorMessages.length - 1];
      const lastText =
        lastMsg && lastMsg.direction === 'inbound'
          ? lastMsg.content
          : 'plz share your time slot';
      handleInboundWhatsAppWebhookMessage({
        whatsappMessageId: `wamid.web_resume.${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fromPhone: waSimulatorPhone,
        senderProfileName: 'Website Visitor',
        messageType: 'text',
        textContent: lastText,
      });
    }
  };

  const handleResetSimulator = () => {
    resetAISessionDraft(waSimulatorPhone);
    if (simulatorConversation) {
      store.setConversationHandlingMode(
        simulatorConversation.id,
        'ai',
        'Simulator Reset'
      );
    }
    const newPhone = `+1555${Math.floor(1000000 + Math.random() * 8999999)}`;
    setWaSimulatorPhone(newPhone);
    setWaInput('');
  };

  const slide = HERO_SLIDES[currentSlide];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] transition-colors">
      {/* 1. STICKY HEADER NAVIGATION (High-Contrast Opaque Luxury Healthcare Header) */}
      <header
        style={{ backgroundColor: 'var(--surf)' }}
        className="sticky top-0 z-40 border-b border-[var(--line)] shadow-sm transition-colors"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          {/* Brand Logo — Never Wraps */}
          <button
            type="button"
            onClick={() => navigateToPage('home')}
            className="flex items-center gap-3 shrink-0 whitespace-nowrap group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0e4f57] to-[#177580] flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-[#f7dfa7]" />
            </div>
            <div className="whitespace-nowrap">
              <span className="font-serif-heading font-bold text-lg text-[var(--ink)] block leading-none">
                {clinic.name}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--gold-dark)] block mt-1">
                Dental &amp; Esthetic Art
              </span>
            </div>
          </button>

          {/* Center Desktop Navigation Pill — Separate URLs for Every Page */}
          <nav
            aria-label="Primary Navigation"
            style={{ backgroundColor: 'var(--surf-alt)' }}
            className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-[var(--line)] text-xs font-bold whitespace-nowrap shrink-0"
          >
            {(
              [
                { route: 'home', label: 'Home' },
                { route: 'about', label: 'About Us' },
                { route: 'treatments', label: 'Treatments' },
                { route: 'doctors', label: 'Doctors' },
                { route: 'contact', label: 'Hours & Contact' },
                { route: 'faq', label: 'FAQ' },
              ] as Array<{ route: PublicPageRoute; label: string }>
            ).map((item) => (
              <button
                key={item.route}
                type="button"
                onClick={() => navigateToPage(item.route)}
                className={`px-3.5 py-1.5 rounded-full transition whitespace-nowrap ${
                  publicPage === item.route
                    ? 'bg-[#0e4f57] text-white shadow-2xs'
                    : 'text-[var(--ink)] hover:text-white hover:bg-[#0e4f57]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right Actions Cluster — Single Line Non-Wrapping */}
          <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            <button
              type="button"
              onClick={navigateToBookingPage}
              className={`hidden md:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full font-bold text-xs shadow-xs transition whitespace-nowrap shrink-0 ${
                publicPage === 'book'
                  ? 'bg-gradient-to-r from-[#c9a66b] to-[#e0be84] text-[#062327]'
                  : 'bg-[#0e4f57] hover:bg-[#177580] text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Book Appointment</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle color theme"
              style={{ backgroundColor: 'var(--surf-alt)' }}
              className="w-9 h-9 rounded-full border border-[var(--line)] text-[var(--ink)] flex items-center justify-center transition shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-[#f7dfa7]" /> : <Moon className="w-4 h-4 text-[#0e4f57]" />}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ backgroundColor: 'var(--surf-alt)' }}
              className="xl:hidden w-9 h-9 rounded-xl border border-[var(--line)] text-[var(--ink)] flex items-center justify-center shrink-0"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[var(--surf)] border-t border-[var(--line)] px-4 py-4 space-y-2 shadow-xl">
            <button
              type="button"
              onClick={() => navigateToPage('home')}
              className="w-full text-left block px-3 py-2 rounded-lg font-semibold hover:bg-[var(--teal-subtle)]"
            >
              Home (/)
            </button>
            <button
              type="button"
              onClick={() => navigateToPage('about')}
              className="w-full text-left block px-3 py-2 rounded-lg font-semibold hover:bg-[var(--teal-subtle)]"
            >
              About the Clinic (/about)
            </button>
            <button
              type="button"
              onClick={() => navigateToPage('treatments')}
              className="w-full text-left block px-3 py-2 rounded-lg font-semibold hover:bg-[var(--teal-subtle)]"
            >
              Treatments &amp; Services (/treatments)
            </button>
            <button
              type="button"
              onClick={() => navigateToPage('doctors')}
              className="w-full text-left block px-3 py-2 rounded-lg font-semibold hover:bg-[var(--teal-subtle)]"
            >
              Our Doctors (/doctors)
            </button>
            <button
              type="button"
              onClick={() => navigateToPage('contact')}
              className="w-full text-left block px-3 py-2 rounded-lg font-semibold hover:bg-[var(--teal-subtle)]"
            >
              Opening Hours &amp; Contact (/contact)
            </button>
            <button
              type="button"
              onClick={() => navigateToPage('faq')}
              className="w-full text-left block px-3 py-2 rounded-lg font-semibold hover:bg-[var(--teal-subtle)]"
            >
              Frequently Asked Questions (/faq)
            </button>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={navigateToBookingPage}
                className="w-full py-2.5 rounded-full bg-[var(--teal)] text-white font-semibold text-sm text-center"
              >
                Book Appointment Online (/book)
              </button>
            </div>
          </div>
        )}
      </header>

      {publicPage === 'home' && (
        <>

      {/* 2. HOMEPAGE HERO CAROUSEL */}
      <section id="top" className="relative overflow-hidden bg-[#03181b] text-white">
        <div className="absolute inset-0 z-0">
          <img
            src={slide.image}
            alt={slide.tabLabel}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/img/bg_make_11_06_2023_417.jpg';
            }}
            className="w-full h-full object-cover opacity-35 scale-105 transition-all duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#021418]/95 via-[#021418]/85 to-[#072b30]/70" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-12 gap-10 items-center">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a66b]/20 border border-[#c9a66b]/40 text-[#f7dfa7] text-xs font-bold tracking-wider uppercase">
              {slide.eyebrow}
            </div>

            <h1 className="font-serif-heading text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight text-white">
              {slide.titleMain}{' '}
              <span className="block italic font-normal text-[#f7dfa7]">
                {slide.titleAccent}
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#dff0ef] max-w-2xl leading-relaxed">
              {slide.description}
            </p>

            {/* Primary CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={navigateToBookingPage}
                className="inline-flex items-center gap-2.5 px-7 py-4 rounded-full bg-gradient-to-r from-[#c9a66b] to-[#e0be84] text-[#062327] font-bold text-sm sm:text-base shadow-lg transition transform hover:-translate-y-0.5"
              >
                <Calendar className="w-5 h-5" />
                <span>Book Appointment Online</span>
              </button>

              <button
                type="button"
                onClick={() => navigateToPage('treatments')}
                className="inline-flex items-center gap-2 px-6 py-4 rounded-full border-2 border-white/60 hover:bg-white/10 text-white font-semibold text-sm sm:text-base transition"
              >
                <span>Explore Treatments</span>
              </button>
            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-2.5 pt-3">
              {slide.pills.map((pill) => (
                <span
                  key={pill}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs sm:text-sm text-white/95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5fe0b3]" />
                  {pill}
                </span>
              ))}
            </div>

            {/* Slide Selector Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4">
              {HERO_SLIDES.map((s, idx) => (
                <button
                  key={s.tabLabel}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`text-left p-3 rounded-xl border transition ${
                    currentSlide === idx
                      ? 'bg-[#c9a66b]/25 border-[#c9a66b] text-white'
                      : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#f7dfa7] block">
                    0{idx + 1} / FEATURED
                  </span>
                  <span className="text-xs sm:text-sm font-semibold truncate block">
                    {s.tabLabel}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Quick Live Availability & WhatsApp Card */}
          <div className="lg:col-span-5">
            <div className="bg-[#07262b]/85 backdrop-blur-xl border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#25D366]/20 border border-[#25D366]/40 text-[#6ef3a4] text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                  AI Receptionist Online 24/7
                </span>
                <span className="text-xs text-[#f7dfa7] font-semibold">
                  Real-Time Database Slots
                </span>
              </div>

              <div>
                <h2 className="font-serif-heading text-2xl font-semibold text-white">
                  Instant Appointment Check
                </h2>
                <p className="text-xs sm:text-sm text-[#b7dbd7] mt-1">
                  Check live doctor availability or launch our AI WhatsApp receptionist to book in seconds.
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-[#dff0ef] mb-1">
                    Select Treatment
                  </label>
                  <select
                    value={watchedServiceId}
                    onChange={(e) => setValue('serviceId', e.target.value)}
                    className="w-full rounded-xl bg-[#021418]/90 border border-white/25 px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a66b]"
                  >
                    {activeServices.map((svc) => (
                      <option key={svc.id} value={svc.id}>
                        {svc.name} ({svc.durationMinutes}m · {svc.priceLabel})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#dff0ef] mb-1">
                      Preferred Date
                    </label>
                    <input
                      type="date"
                      value={watchedDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setValue('appointmentDate', e.target.value)}
                      className="w-full rounded-xl bg-[#021418]/90 border border-white/25 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a66b]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#dff0ef] mb-1">
                      Available Slots Found
                    </label>
                    <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 text-[#6ef3a4] font-bold text-sm flex items-center justify-between">
                      <span>{uniqueDisplaySlots.length} Open Slots</span>
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {uniqueDisplaySlots.length > 0 && (
                  <div className="pt-1">
                    <span className="text-xs text-[#b7dbd7] block mb-1.5">
                      Next available times on {watchedDate}:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueDisplaySlots.slice(0, 5).map((slot) => (
                        <button
                          key={`${slot.doctorId}_${slot.startTime}`}
                          type="button"
                          onClick={() => {
                            setValue('startTime', slot.startTime);
                            navigateToBookingPage();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-[#c9a66b] hover:text-[#03181b] text-xs font-semibold text-white transition"
                        >
                          {slot.displayTime}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={navigateToBookingPage}
                  className="w-full py-3.5 px-4 rounded-full bg-gradient-to-r from-[#c9a66b] to-[#e0be84] text-[#062327] font-bold text-sm text-center shadow-md hover:opacity-95 transition"
                >
                  Complete Booking &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <div className="bg-[#072b30] text-white py-7 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#c9a66b]/20 border border-[#c9a66b]/40 flex items-center justify-center text-[#f7dfa7]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif-heading font-semibold text-base text-white">
                Painless Technology
              </h4>
              <span className="text-xs text-[#b2d1cd]">Computerized Local Anesthesia</span>
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#c9a66b]/20 border border-[#c9a66b]/40 flex items-center justify-center text-[#f7dfa7]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif-heading font-semibold text-base text-white">
                Class B Autoclave
              </h4>
              <span className="text-xs text-[#b2d1cd]">6-Step Hospital Sterilization</span>
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#c9a66b]/20 border border-[#c9a66b]/40 flex items-center justify-center text-[#f7dfa7]">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif-heading font-semibold text-base text-white">
                Instant WhatsApp AI
              </h4>
              <span className="text-xs text-[#b2d1cd]">Real-Time Slot Verification</span>
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#c9a66b]/20 border border-[#c9a66b]/40 flex items-center justify-center text-[#f7dfa7]">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif-heading font-semibold text-base text-white">
                {activeDoctors.length} Active Specialists
              </h4>
              <span className="text-xs text-[#b2d1cd]">Upfront Written Treatment Plans</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. WHY CHOOSE US & BEFORE/AFTER TRANSFORMATION */}
      <section id="about-section" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 space-y-20">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="inline-block px-3.5 py-1 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-xs font-bold uppercase tracking-widest">
            Why Choose {clinic.name}
          </span>
          <h2 className="font-serif-heading text-3xl sm:text-4xl font-semibold">
            Dentistry elevated to an art form
          </h2>
          <p className="text-[var(--mut)] text-base sm:text-lg">
            Our clinic pairs peaceful comfort with modern 3D dental diagnostics and transparent written treatment plans.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: '3D Digital Smile Simulation',
              desc: 'Preview your projected smile contour and shade on a high-definition 3D screen before treatment begins.',
            },
            {
              title: 'Gentle Computerized Care',
              desc: 'Our computerized local anesthesia delivery and ultrasonic instruments minimize discomfort and needle anxiety.',
            },
            {
              title: '6-Step Hospital Sterility',
              desc: 'Every instrument is processed through enzymatic cleaning, ultrasonic baths, and Class B vacuum autoclaves.',
            },
            {
              title: 'Transparent Written Plans',
              desc: 'Receive an itemized, all-inclusive written treatment estimate detailing every step and timeline before work begins.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 shadow-sm hover:border-[var(--teal)] transition"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--teal-subtle)] text-[var(--teal)] flex items-center justify-center font-bold mb-4">
                ✓
              </div>
              <h3 className="font-serif-heading text-xl font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-[var(--mut)] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Interactive Before/After Comparison */}
        <div className="grid lg:grid-cols-2 gap-12 items-center bg-[var(--surf-alt)] rounded-3xl p-6 sm:p-12 border border-[var(--line)]">
          <div className="space-y-4">
            <span className="inline-block px-3.5 py-1 rounded-full bg-[#c9a66b]/20 text-[var(--gold-dark)] text-xs font-bold uppercase tracking-widest">
              Interactive Visual Comparison
            </span>
            <h3 className="font-serif-heading text-2xl sm:text-3xl font-semibold">
              Restoring comfort, function, and natural esthetics
            </h3>
            <p className="text-sm sm:text-base text-[var(--mut)] leading-relaxed">
              Slide the comparison handle to view how our restorative and cosmetic treatments relieve acute dental discomfort and restore natural enamel harmony.
            </p>
            <ul className="space-y-2 text-sm text-[var(--ink-light)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--teal)]" />
                <span>Natural translucency and personalized shade matching</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--teal)]" />
                <span>Minimally invasive preparation preserving healthy tooth structure</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--teal)]" />
                <span>Direct WhatsApp follow-up and automated care reminders</span>
              </li>
            </ul>
          </div>

          <div className="relative rounded-2xl overflow-hidden border-2 border-[var(--line)] shadow-xl aspect-[16/10] select-none bg-black">
            <img
              src="/img/patient_smile_after.jpg"
              alt="After dental treatment"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=1200&h=800&auto=format&fit=crop&q=85';
              }}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${beforeAfterPct}%` }}
            >
              <img
                src="/img/patient_pain_before.jpg"
                alt="Before dental treatment"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://plus.unsplash.com/premium_photo-1661559036870-ef6643e7a472?q=80&w=1200&auto=format&fit=crop';
                }}
                className="w-full h-full object-cover"
              />
            </div>
            <div
              className="absolute inset-y-0 w-1 bg-white shadow-lg pointer-events-none"
              style={{ left: `${beforeAfterPct}%` }}
            >
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[var(--teal)] border-2 border-white text-white flex items-center justify-center text-sm font-bold shadow-md">
                ↔
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={beforeAfterPct}
              onChange={(e) => setBeforeAfterPct(Number(e.target.value))}
              aria-label="Before and after transformation comparison slider"
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
            />
            <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/70 text-white text-xs font-bold">
              Before
            </span>
            <span className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-[var(--teal)]/90 text-white text-xs font-bold">
              After Care
            </span>
          </div>
        </div>
      </section>

      {/* 4. TREATMENTS & SERVICES SECTION (Database-Driven) */}
      <section id="services-section" className="py-20 bg-[var(--surf-alt)] border-y border-[var(--line)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="inline-block px-3.5 py-1 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-xs font-bold uppercase tracking-widest">
              Treatments &amp; Services
            </span>
            <h2 className="font-serif-heading text-3xl sm:text-4xl font-semibold">
              Comprehensive clinical &amp; aesthetic care
            </h2>
            <p className="text-[var(--mut)] text-base">
              All treatments and durations below are synchronized directly with our clinical scheduling database and AI WhatsApp receptionist.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {activeServices.map((svc) => (
              <div
                key={svc.id}
                className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-[var(--teal)] transition flex flex-col"
              >
                <div className="relative h-52 bg-[var(--teal-subtle)] overflow-hidden">
                  <img
                    src={svc.imageUrl}
                    alt={svc.name}
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/img/bg_make_11_06_2023_417.jpg';
                    }}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#031a1e]/85 text-[#f7dfa7] text-[11px] font-bold uppercase tracking-wider">
                    {svc.badge}
                  </span>
                  <span className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-[var(--teal)] text-white text-xs font-bold shadow">
                    {svc.priceLabel}
                  </span>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-serif-heading text-xl font-semibold text-[var(--ink)]">
                      {svc.name}
                    </h3>
                    <p className="text-sm text-[var(--mut)] leading-relaxed">
                      {svc.description}
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between text-xs text-[var(--mut)] border-t border-[var(--line)] pt-3">
                      <span>
                        Duration: <strong className="text-[var(--ink)]">{svc.durationMinutes} Mins</strong>
                      </span>
                      <span>
                        Schedule: <strong className="text-[var(--ink)]">{svc.visitsLabel}</strong>
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectTreatmentAndScroll(svc.id)}
                        className="w-full py-2.5 px-4 rounded-full bg-[var(--teal)] hover:bg-[var(--teal-light)] text-white text-xs font-bold transition flex items-center justify-center gap-1"
                      >
                        <span>Book Treatment</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. DOCTORS & SPECIALISTS SECTION (Database-Driven) */}
      <section id="doctors-section" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="inline-block px-3.5 py-1 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-xs font-bold uppercase tracking-widest">
            Clinical Specialists
          </span>
          <h2 className="font-serif-heading text-3xl sm:text-4xl font-semibold">
            Meet our dental care team
          </h2>
          <p className="text-[var(--mut)] text-base">
            Each specialist&apos;s real-time working hours, breaks, and Google Calendar status are linked directly to our appointment engine.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {activeDoctors.map((doc) => (
            <div
              key={doc.id}
              className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-[var(--teal)] transition flex flex-col"
            >
              <div className="h-64 bg-[var(--teal-subtle)] overflow-hidden relative">
                <img
                  src={doc.imageUrl}
                  alt={doc.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {!doc.isVerified && (
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/70 text-[#f7dfa7] text-[10px] font-semibold">
                    Configurable Profile
                  </span>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-dark)] block mb-1">
                    {doc.specialization}
                  </span>
                  <h3 className="font-serif-heading text-xl font-semibold">{doc.name}</h3>
                  <p className="text-xs text-[var(--mut)] mt-2 leading-relaxed">
                    {doc.description}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {doc.credentials.map((cred) => (
                      <span
                        key={cred}
                        className="px-2.5 py-0.5 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-[11px] font-semibold"
                      >
                        {cred}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleSelectTreatmentAndScroll(
                        doc.serviceIds[0] || activeServices[0]?.id || 'svc_checkup',
                        doc.id
                      )
                    }
                    className="w-full py-2.5 rounded-full border border-[var(--teal)] text-[var(--teal)] hover:bg-[var(--teal)] hover:text-white text-xs font-bold transition"
                  >
                    Book with {doc.name.split(' ').slice(0, 2).join(' ')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. PATIENT TESTIMONIALS & VERIFIED FEEDBACK POLICY (Compliance with Section 5) */}
      <section className="py-16 bg-[#072b30] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <span className="inline-block px-3.5 py-1 rounded-full bg-white/10 text-[#f7dfa7] text-xs font-bold uppercase tracking-widest">
                Patient Experience &amp; Ethics
              </span>
              <h2 className="font-serif-heading text-3xl font-semibold text-white">
                Transparent Care &amp; Verified Patient Feedback
              </h2>
              <p className="text-sm text-[#c5e3df] leading-relaxed">
                In accordance with healthcare compliance standards, {clinic.name} never displays fabricated reviews or unverified medical claims. Patient feedback is collected strictly from verified completed appointments.
              </p>
            </div>
            <div className="lg:col-span-7 grid sm:grid-cols-3 gap-4">
              <div className="bg-white/5 border border-white/15 rounded-2xl p-5">
                <div className="text-[#f7dfa7] font-serif-heading text-2xl font-bold mb-1">
                  100% Written
                </div>
                <div className="text-sm font-semibold text-white mb-1">
                  Upfront Cost Transparency
                </div>
                <p className="text-xs text-[#b7dbd7]">
                  Every patient receives a clear written treatment plan before any procedure begins.
                </p>
              </div>
              <div className="bg-white/5 border border-white/15 rounded-2xl p-5">
                <div className="text-[#6ef3a4] font-serif-heading text-2xl font-bold mb-1">
                  24h &amp; 1h
                </div>
                <div className="text-sm font-semibold text-white mb-1">
                  Automated WhatsApp Reminders
                </div>
                <p className="text-xs text-[#b7dbd7]">
                  Instant booking confirmations, automated reminders, and easy WhatsApp rescheduling.
                </p>
              </div>
              <div className="bg-white/5 border border-white/15 rounded-2xl p-5">
                <div className="text-[#f7dfa7] font-serif-heading text-2xl font-bold mb-1">
                  Human + AI
                </div>
                <div className="text-sm font-semibold text-white mb-1">
                  Seamless Reception Handover
                </div>
                <p className="text-xs text-[#b7dbd7]">
                  Our AI assistant handles instant scheduling and transfers complex inquiries to our staff.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. LANDING PAGE BOOKING CTA CARD + OPENING HOURS & CONTACT */}
      <section id="booking-section" className="py-20 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-12 gap-10 items-stretch">
          {/* Left 7 Cols: Clickable Luxury "Book Your Appointment" Card on Landing Page */}
          <div
            onClick={navigateToBookingPage}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateToBookingPage();
              }
            }}
            className="lg:col-span-7 group cursor-pointer bg-gradient-to-br from-[#072b30] via-[#0a3c43] to-[#0e4f57] text-white border border-[#c9a66b]/40 rounded-3xl p-8 sm:p-10 shadow-xl hover:shadow-2xl hover:border-[#c9a66b] transition-all flex flex-col justify-between relative overflow-hidden"
          >
            <div className="space-y-5 relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#c9a66b]/20 border border-[#c9a66b]/40 text-[#f7dfa7] text-xs font-bold uppercase tracking-widest">
                  <Calendar className="w-3.5 h-3.5" />
                  Dedicated Online Booking Page
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#25D366]/20 border border-[#25D366]/40 text-[#6ef3a4] text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                  {uniqueDisplaySlots.length} Slots Open on {watchedDate}
                </span>
              </div>

              <div className="space-y-2.5">
                <h2 className="font-serif-heading text-3xl sm:text-4xl font-semibold text-white group-hover:text-[#f7dfa7] transition-colors">
                  Book Your Appointment
                </h2>
                <p className="text-sm sm:text-base text-[#cde5e2] leading-relaxed max-w-xl">
                  Click this card to open our dedicated appointment booking page. Choose your treatment, preferred specialist, live available time slot, and payment method in seconds.
                </p>
              </div>

              {/* Feature Highlights Inside the Card */}
              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#6ef3a4] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="block text-white">Real-Time Doctor Slots</strong>
                    <span className="text-[#b7dbd7]">Live database availability &amp; Google Calendar sync</span>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#6ef3a4] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="block text-white">WhatsApp Confirmations</strong>
                    <span className="text-[#b7dbd7]">Instant E.164 mobile alert + 1-hour reminder</span>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#f7dfa7] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="block text-white">US · UK &amp; Global Payments</strong>
                    <span className="text-[#b7dbd7]">Visa, Mastercard, Amex, Pay, GPay &amp; PayPal</span>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#f7dfa7] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="block text-white">Local Clinic Options</strong>
                    <span className="text-[#b7dbd7]">Cash at Clinic (Pay at Clinic) &amp; Manual Easypaisa</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-8 mt-6 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 relative z-10">
              <span className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#c9a66b] to-[#e0be84] text-[#062327] font-bold text-sm shadow-lg group-hover:scale-[1.02] transition-transform">
                <span>Open Appointment Booking Page</span>
                <ChevronRight className="w-4 h-4" />
              </span>
            </div>
          </div>

          {/* Right 5 Cols: Clinic Opening Hours, Location & Contact Information */}
          <div id="hours-section" className="lg:col-span-5 space-y-6">
            <div className="bg-[var(--surf)] border border-[var(--line)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 h-full">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--gold-dark)]">
                  Contact &amp; Hours
                </span>
                <h3 className="font-serif-heading text-2xl font-semibold mt-1">
                  {clinic.name}
                </h3>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[var(--teal-subtle)] text-[var(--teal)] flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-[var(--ink)]">Clinic Location</strong>
                    <span className="text-[var(--mut)]">{clinic.address}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[var(--teal-subtle)] text-[var(--teal)] flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-[var(--ink)]">Telephone &amp; Emergency</strong>
                    <p className="text-[var(--mut)]">
                      Direct: <a href={`tel:${clinic.phone}`} className="text-[var(--teal)] font-semibold">{clinic.phone}</a>
                      <br />
                      Emergency: <a href={`tel:${clinic.emergencyPhone}`} className="text-red-600 font-semibold">{clinic.emergencyPhone}</a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Opening Hours Table */}
              <div className="border-t border-[var(--line)] pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-serif-heading font-semibold text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--teal)]" />
                    <span>Clinic Opening Hours</span>
                  </h4>
                  <span className="text-xs text-[var(--mut)]">TZ: {clinic.timezone}</span>
                </div>
                <div className="space-y-1.5 text-xs sm:text-sm">
                  {clinic.openingHours.map((oh) => (
                    <div
                      key={oh.day}
                      className="flex items-center justify-between py-1 border-b border-[var(--line)]/60 last:border-none"
                    >
                      <span className="font-medium text-[var(--ink)]">{oh.day}</span>
                      {oh.isOpen ? (
                        <span className="text-[var(--teal)] font-semibold">
                          {formatDisplayTime(oh.openTime)} – {formatDisplayTime(oh.closeTime)}
                        </span>
                      ) : (
                        <span className="text-[var(--mut)] italic">
                          Closed {oh.note ? `(${oh.note})` : ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {holidays.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-[var(--surf-alt)] text-xs text-[var(--mut)]">
                    <strong>Scheduled Clinic Holidays:</strong>{' '}
                    {holidays.map((h) => `${h.holidayDate} (${h.description})`).join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FREQUENTLY ASKED QUESTIONS */}
      <section id="faq-section" className="py-16 bg-[var(--surf-alt)] border-t border-[var(--line)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <span className="inline-block px-3.5 py-1 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-xs font-bold uppercase tracking-widest">
              Got Questions?
            </span>
            <h2 className="font-serif-heading text-3xl font-semibold">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {aiConfig.faqs.map((faq) => (
              <details
                key={faq.question}
                className="group bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-5 open:border-[var(--teal)] transition"
              >
                <summary className="font-semibold text-base cursor-pointer list-none flex items-center justify-between gap-4">
                  <span>{faq.question}</span>
                  <span className="text-[var(--teal)] text-xl font-light group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="text-sm text-[var(--mut)] mt-3 leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
        </>
      )}

      {/* DEDICATED SEPARATE "/about" PAGE */}
      {publicPage === 'about' && (
        <AboutUsPage
          clinic={clinic}
          doctors={activeDoctors}
          services={activeServices}
          holidays={holidays}
          aiConfig={aiConfig}
          onNavigate={navigateToPage}
          onBookServiceDoctor={handleSelectTreatmentAndScroll}
        />
      )}

      {/* DEDICATED SEPARATE "/treatments" PAGE */}
      {publicPage === 'treatments' && (
        <TreatmentsPage
          clinic={clinic}
          doctors={activeDoctors}
          services={activeServices}
          holidays={holidays}
          aiConfig={aiConfig}
          onNavigate={navigateToPage}
          onBookServiceDoctor={handleSelectTreatmentAndScroll}
        />
      )}

      {/* DEDICATED SEPARATE "/doctors" PAGE */}
      {publicPage === 'doctors' && (
        <DoctorsPage
          clinic={clinic}
          doctors={activeDoctors}
          services={activeServices}
          holidays={holidays}
          aiConfig={aiConfig}
          onNavigate={navigateToPage}
          onBookServiceDoctor={handleSelectTreatmentAndScroll}
        />
      )}

      {/* DEDICATED SEPARATE "/contact" PAGE */}
      {publicPage === 'contact' && (
        <ContactAndHoursPage
          clinic={clinic}
          doctors={activeDoctors}
          services={activeServices}
          holidays={holidays}
          aiConfig={aiConfig}
          onNavigate={navigateToPage}
          onBookServiceDoctor={handleSelectTreatmentAndScroll}
        />
      )}

      {/* DEDICATED SEPARATE "/faq" PAGE */}
      {publicPage === 'faq' && (
        <FaqKnowledgeBasePage
          clinic={clinic}
          doctors={activeDoctors}
          services={activeServices}
          holidays={holidays}
          aiConfig={aiConfig}
          onNavigate={navigateToPage}
          onBookServiceDoctor={handleSelectTreatmentAndScroll}
        />
      )}

      {/* DEDICATED SEPARATE "/book" ("BOOK YOUR APPOINTMENT") PAGE */}
      {publicPage === 'book' && (
        <section className="py-10 sm:py-14 max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
          {/* Top Navigation Bar back to Landing Page */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigateToPage('home')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surf)] border border-[var(--line-strong)] hover:border-[var(--teal)] text-xs font-bold text-[var(--ink)] shadow-2xs transition"
            >
              <span>&larr; Back to Home Page</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-[var(--mut)]">
              <span className="px-3 py-1 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] font-bold">
                Step-by-Step Instant Booking
              </span>
              <span>·</span>
              <span>{clinic.phone}</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Left 8 Cols: Sleek, Compact Live Validated Appointment Booking Form */}
            <div className="lg:col-span-8 bg-[var(--surf)] border border-[var(--line)] rounded-3xl p-5 sm:p-8 shadow-lg">
              {/* Compact Top Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-[var(--line)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--teal-subtle)] text-[var(--teal)] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--teal)] block">
                      Dedicated Appointment Portal
                    </span>
                    <h1 className="font-serif-heading text-xl sm:text-2xl font-semibold leading-tight">
                      Book Your Appointment
                    </h1>
                  </div>
                </div>
              </div>

              {bookingConfirmation && (
                <div
                  className={`mb-4 p-3.5 rounded-2xl border space-y-1.5 ${
                    bookingConfirmation.appointmentStatus === 'confirmed'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-950 dark:text-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        {bookingConfirmation.appointmentStatus === 'confirmed'
                          ? `Appointment Confirmed! (${bookingConfirmation.appointmentId})`
                          : `Pending Payment Verification (${bookingConfirmation.appointmentId})`}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-black/10 text-[10px] font-mono font-bold">
                      {bookingConfirmation.paymentStatus}
                    </span>
                  </div>
                  <p className="text-xs">
                    <strong>{bookingConfirmation.patientName}</strong> ({bookingConfirmation.patientPhoneE164}) ·{' '}
                    <strong>{bookingConfirmation.serviceName}</strong> with{' '}
                    <strong>{bookingConfirmation.doctorName}</strong> on{' '}
                    <strong>
                      {bookingConfirmation.date} at {bookingConfirmation.time}
                    </strong>
                    .
                  </p>
                </div>
              )}

              {bookingError && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-700 dark:text-red-300 text-xs font-medium">
                  {bookingError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmitBooking)} className="space-y-3.5" noValidate>
                {/* ROW 1: Patient Details (Full Name + Mandatory E.164 Mobile + Optional Email in compact grid) */}
                <div className="grid sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <label htmlFor="fullName" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--mut)] mb-1">
                      Full Name *
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      placeholder="e.g. Ahmed Al-Farsi"
                      {...register('fullName')}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-[var(--teal)]"
                    />
                    {errors.fullName && (
                      <p className="text-[11px] text-red-600 font-semibold mt-0.5">{errors.fullName.message}</p>
                    )}
                  </div>

                  <div className="sm:col-span-5">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="phone" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--mut)]">
                        Mobile Number (E.164) *
                      </label>
                      {previewE164Phone && !errors.phone && (
                        <span className="text-[10px] text-[var(--teal)] font-mono font-bold">
                          ✓ {previewE164Phone}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <select
                        id="countryCode"
                        aria-label="Country Dial Code"
                        {...register('countryCode')}
                        className="w-24 shrink-0 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-2 py-2 text-xs font-semibold focus:outline-none focus:border-[var(--teal)]"
                      >
                        {COUNTRY_DIAL_CODES.map((c) => (
                          <option key={`${c.code}_${c.country}`} value={c.code}>
                            {c.flag} {c.code} {c.country}
                          </option>
                        ))}
                      </select>
                      <input
                        id="phone"
                        type="tel"
                        required
                        placeholder={
                          COUNTRY_DIAL_CODES.find((c) => c.code === watchedCountryCode)?.example ||
                          '3705621256'
                        }
                        {...register('phone')}
                        className="flex-1 min-w-0 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-xs sm:text-sm font-mono focus:outline-none focus:border-[var(--teal)]"
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-[11px] text-red-600 font-semibold mt-0.5" role="alert">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--mut)] mb-1">
                      Email (Optional)
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="you@email.com"
                      {...register('email')}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-[var(--teal)]"
                    />
                    {errors.email && (
                      <p className="text-[11px] text-red-600 mt-0.5">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                {/* ROW 2: Treatment + Specialist + Date (3 Compact Columns) */}
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="serviceId" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--mut)] mb-1">
                      Treatment / Service *
                    </label>
                    <select
                      id="serviceId"
                      {...register('serviceId')}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-[var(--teal)]"
                    >
                      {activeServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.durationMinutes}m)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="doctorId" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--mut)] mb-1">
                      Preferred Doctor
                    </label>
                    <select
                      id="doctorId"
                      {...register('doctorId')}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-[var(--teal)]"
                    >
                      <option value="">Any Available Specialist</option>
                      {activeDoctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="appointmentDate" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--mut)] mb-1">
                      Preferred Date *
                    </label>
                    <input
                      id="appointmentDate"
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      {...register('appointmentDate')}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-[var(--teal)]"
                    />
                    {errors.appointmentDate && (
                      <p className="text-[11px] text-red-600 mt-0.5">{errors.appointmentDate.message}</p>
                    )}
                  </div>
                </div>

                {/* ROW 3: Compact Available Time Slot Pills + 1-Line Notes */}
                <div className="p-3 rounded-2xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink)]">
                      Available Time Slots ({uniqueDisplaySlots.length} open on {watchedDate}) *
                    </label>
                    {watchedStartTime && (
                      <span className="text-[11px] font-bold text-[var(--teal)]">
                        Selected: {watchedStartTime}
                      </span>
                    )}
                  </div>

                  {uniqueDisplaySlots.length === 0 ? (
                    <div className="p-2.5 rounded-xl bg-[var(--surf)] border border-[var(--line)] text-xs text-[var(--mut)]">
                      No open slots for this date/doctor. Please choose another date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-28 overflow-y-auto pr-1">
                      {uniqueDisplaySlots.map((slot) => {
                        const isSelected = watchedStartTime === slot.startTime;
                        return (
                          <button
                            key={`${slot.doctorId}_${slot.startTime}`}
                            type="button"
                            onClick={() => setValue('startTime', slot.startTime, { shouldValidate: true })}
                            className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition flex flex-col items-center leading-tight ${
                              isSelected
                                ? 'bg-[var(--teal)] text-white border-[var(--teal)] shadow-sm'
                                : 'bg-[var(--surf)] border-[var(--line-strong)] hover:border-[var(--teal)] text-[var(--ink)]'
                            }`}
                          >
                            <span>{slot.displayTime}</span>
                            <span className="text-[9px] font-normal opacity-75 truncate max-w-full">
                              {slot.doctorName.replace('Dr. ', '').split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {errors.startTime && (
                    <p className="text-[11px] text-red-600">{errors.startTime.message}</p>
                  )}

                  <input
                    id="visitReason"
                    type="text"
                    placeholder="Optional note or symptoms for the doctor (e.g. tooth sensitivity, smile consultation)..."
                    {...register('visitReason')}
                    className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surf)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--teal)]"
                  />
                </div>

                {/* ROW 4: Compact Segmented Payment Method Selector (All 5 Methods in a clean pill grid + compact active summary) */}
                <div className="p-3.5 rounded-2xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink)]">
                      Payment Method (US · UK · Global &amp; Local) *
                    </label>
                    <span className="text-[11px] font-bold text-[var(--teal)]">
                      {watchedPaymentMethod === 'CASH_AT_CLINIC'
                        ? '✓ Pay at Clinic (Instant Confirmation)'
                        : '✓ Server / Admin Verified Checkout'}
                    </span>
                  </div>

                  {/* Compact 5-Button Payment Tabs */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    {paymentSettings.debitCreditCardEnabled !== false && (
                      <button
                        type="button"
                        onClick={() =>
                          setValue('paymentMethod', 'DEBIT_CREDIT_CARD', { shouldValidate: true })
                        }
                        className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                          watchedPaymentMethod === 'DEBIT_CREDIT_CARD'
                            ? 'bg-[var(--teal)] text-white border-[var(--teal)] shadow-sm'
                            : 'bg-[var(--surf)] border-[var(--line-strong)] hover:border-[var(--teal)] text-[var(--ink)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[11px] leading-tight">1. Cards</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold ${
                              watchedPaymentMethod === 'DEBIT_CREDIT_CARD'
                                ? 'bg-white/20 text-white'
                                : 'bg-emerald-500/15 text-emerald-700'
                            }`}
                          >
                            Priority
                          </span>
                        </div>
                        <span className="text-[9px] opacity-80 mt-1 truncate">
                          Visa · MC · Amex
                        </span>
                      </button>
                    )}

                    {paymentSettings.appleGooglePayEnabled !== false && (
                      <button
                        type="button"
                        onClick={() =>
                          setValue('paymentMethod', 'APPLE_GOOGLE_PAY', { shouldValidate: true })
                        }
                        className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                          watchedPaymentMethod === 'APPLE_GOOGLE_PAY'
                            ? 'bg-[var(--teal)] text-white border-[var(--teal)] shadow-sm'
                            : 'bg-[var(--surf)] border-[var(--line-strong)] hover:border-[var(--teal)] text-[var(--ink)]'
                        }`}
                      >
                        <span className="font-bold text-[11px] leading-tight">2. Pay / GPay</span>
                        <span className="text-[9px] opacity-80 mt-1 truncate">Digital Wallet</span>
                      </button>
                    )}

                    {paymentSettings.paypalEnabled !== false && (
                      <button
                        type="button"
                        onClick={() => setValue('paymentMethod', 'PAYPAL', { shouldValidate: true })}
                        className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                          watchedPaymentMethod === 'PAYPAL'
                            ? 'bg-[var(--teal)] text-white border-[var(--teal)] shadow-sm'
                            : 'bg-[var(--surf)] border-[var(--line-strong)] hover:border-[var(--teal)] text-[var(--ink)]'
                        }`}
                      >
                        <span className="font-bold text-[11px] leading-tight">3. PayPal</span>
                        <span className="text-[9px] opacity-80 mt-1 truncate">US &amp; UK Wallet</span>
                      </button>
                    )}

                    {paymentSettings.cashAtClinicEnabled && (
                      <button
                        type="button"
                        onClick={() =>
                          setValue('paymentMethod', 'CASH_AT_CLINIC', { shouldValidate: true })
                        }
                        className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                          watchedPaymentMethod === 'CASH_AT_CLINIC'
                            ? 'bg-[var(--teal)] text-white border-[var(--teal)] shadow-sm'
                            : 'bg-[var(--surf)] border-[var(--line-strong)] hover:border-[var(--teal)] text-[var(--ink)]'
                        }`}
                      >
                        <span className="font-bold text-[11px] leading-tight">4. Cash</span>
                        <span className="text-[9px] opacity-80 mt-1 truncate">Pay at Clinic</span>
                      </button>
                    )}

                    {paymentSettings.manualEasypaisaEnabled && (
                      <button
                        type="button"
                        onClick={() =>
                          setValue('paymentMethod', 'MANUAL_EASYPAISA', { shouldValidate: true })
                        }
                        className={`col-span-2 sm:col-span-1 p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                          watchedPaymentMethod === 'MANUAL_EASYPAISA'
                            ? 'bg-[var(--teal)] text-white border-[var(--teal)] shadow-sm'
                            : 'bg-[var(--surf)] border-[var(--line-strong)] hover:border-[var(--teal)] text-[var(--ink)]'
                        }`}
                      >
                        <span className="font-bold text-[11px] leading-tight">5. Easypaisa</span>
                        <span className="text-[9px] opacity-80 mt-1 truncate">Manual Receipt</span>
                      </button>
                    )}
                  </div>

                  {/* Compact Contextual Strip for Active Payment Method */}
                  {watchedPaymentMethod === 'CASH_AT_CLINIC' && (
                    <div className="px-3 py-2 rounded-xl bg-[var(--surf)] border border-[var(--line)] text-[11px] flex items-center justify-between gap-2">
                      <span className="text-[var(--mut)]">
                        <strong className="text-emerald-700 dark:text-emerald-400">Instant Confirmation:</strong> Status set to <strong>UNPAID (Pay at Clinic)</strong> + GCal &amp; 1h WhatsApp reminder.
                      </span>
                    </div>
                  )}

                  {watchedPaymentMethod === 'MANUAL_EASYPAISA' && (
                    <div className="p-3 rounded-xl bg-[var(--surf)] border border-[var(--teal)] space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-[var(--ink)]">
                          Easypaisa: {paymentSettings.easypaisaAccountTitle}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-[var(--teal-subtle)] text-[var(--teal)] font-mono font-bold">
                          Acct #: {paymentSettings.easypaisaAccountNumber}
                        </span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <div>
                          <input
                            id="transactionReference"
                            type="text"
                            placeholder="Transaction ID (e.g. TID-983412) *"
                            {...register('transactionReference')}
                            className="w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-2.5 py-1.5 font-mono text-xs"
                          />
                          {errors.transactionReference && (
                            <p className="text-[10px] text-red-600 font-semibold mt-0.5" role="alert">
                              {errors.transactionReference.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <input
                            id="receiptUpload"
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setValue('receiptFileName', file.name, { shouldValidate: true });
                              const reader = new FileReader();
                              reader.onload = () => {
                                setValue(
                                  'receiptFileUrl',
                                  typeof reader.result === 'string'
                                    ? reader.result
                                    : `/receipts/${file.name}`,
                                  { shouldValidate: true }
                                );
                              };
                              reader.readAsDataURL(file);
                            }}
                            className="w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-2 py-1 text-[11px]"
                          />
                          {watchedReceiptFileName && (
                            <p className="text-[10px] text-emerald-700 font-semibold mt-0.5 truncate">
                              ✓ {watchedReceiptFileName}
                            </p>
                          )}
                          {errors.receiptFileUrl && (
                            <p className="text-[10px] text-red-600 font-semibold mt-0.5" role="alert">
                              {errors.receiptFileUrl.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {(watchedPaymentMethod === 'DEBIT_CREDIT_CARD' ||
                    watchedPaymentMethod === 'INTERNATIONAL_CARD') && (
                    <div className="px-3 py-2 rounded-xl bg-[var(--surf)] border border-[var(--teal)] text-[11px] flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[var(--mut)]">
                        <strong className="text-[var(--teal)]">US &amp; UK Priority Cards:</strong> Gateway ({paymentSettings.internationalGatewayProvider.toUpperCase()}) verifies payment server-side before confirming.
                      </span>
                      <div className="flex gap-1">
                        {['VISA', 'MC', 'AMEX', 'DISC'].map((c) => (
                          <span key={c} className="px-1.5 py-0.5 rounded bg-[var(--teal-subtle)] text-[var(--teal)] font-bold text-[9px]">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {watchedPaymentMethod === 'APPLE_GOOGLE_PAY' && (
                    <div className="px-3 py-2 rounded-xl bg-[var(--surf)] border border-[var(--teal)] text-[11px] flex items-center justify-between gap-2">
                      <span className="text-[var(--mut)]">
                        <strong className="text-[var(--teal)]">Apple Pay &amp; Google Pay:</strong> Confirms automatically once server-side wallet token is verified.
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-black text-white font-bold text-[9px] shrink-0">
                        Pay · GPay
                      </span>
                    </div>
                  )}

                  {watchedPaymentMethod === 'PAYPAL' && (
                    <div className="px-3 py-2 rounded-xl bg-[var(--surf)] border border-[#003087] text-[11px] flex items-center justify-between gap-2">
                      <span className="text-[var(--mut)]">
                        <strong className="text-[#003087] dark:text-blue-300">PayPal (US &amp; UK):</strong>{' '}
                        {paymentSettings.hasEligibleInternationalMerchantAccount
                          ? 'Confirms via server-side PayPal webhook capture.'
                          : 'Requires eligible merchant account in Admin Settings (queued for verification).'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#003087] text-white font-bold text-[9px] shrink-0">
                        PayPal
                      </span>
                    </div>
                  )}
                </div>

                {/* Rejected Easypaisa Receipt Resubmission Panel */}
                {rejectedAppointments.length > 0 && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/40 space-y-2 text-xs">
                    <div className="font-bold text-red-800 dark:text-red-300">
                      ⚠️ Action Needed: Resubmit Rejected Easypaisa Receipt
                    </div>
                    {resubmitSuccessMsg && (
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-900 font-bold">
                        {resubmitSuccessMsg}
                      </div>
                    )}
                    <div className="grid sm:grid-cols-3 gap-2">
                      <select
                        value={resubmitApptId || rejectedAppointments[0].id}
                        onChange={(e) => setResubmitApptId(e.target.value)}
                        className="rounded-lg border border-[var(--line-strong)] bg-[var(--surf)] px-2 py-1.5 text-xs"
                      >
                        {rejectedAppointments.map((ra) => (
                          <option key={ra.id} value={ra.id}>
                            {ra.patientName} ({ra.id})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={resubmitTid}
                        onChange={(e) => setResubmitTid(e.target.value)}
                        placeholder="New Easypaisa TID..."
                        className="rounded-lg border border-[var(--line-strong)] bg-[var(--surf)] px-2.5 py-1.5 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const targetId = resubmitApptId || rejectedAppointments[0].id;
                          const res = store.resubmitEasypaisaReceipt({
                            appointmentId: targetId,
                            transactionReference: resubmitTid || `TID-RESUB-${Date.now()}`,
                            receiptFileUrl: resubmitFileUrl || '/img/patient_smile_after.jpg',
                            receiptFileName: resubmitFileName || 'resubmitted_easypaisa.jpg',
                          });
                          if (res.success) {
                            setResubmitSuccessMsg(
                              `Receipt resubmitted for ${targetId}. Status returned to PENDING_VERIFICATION.`
                            );
                            setResubmitTid('');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[var(--teal)] text-white font-bold text-xs"
                      >
                        Resubmit Receipt
                      </button>
                    </div>
                  </div>
                )}

                {/* ROW 5: Compact WhatsApp Toggle + Mandatory Consent Checkbox */}
                <div className="px-3.5 py-2.5 rounded-xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-1.5 text-[11px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-[var(--ink)] cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        {...register('hasWhatsApp')}
                        className="rounded border-[var(--line-strong)]"
                      />
                      <span>Number is active on WhatsApp</span>
                    </label>
                    <span className="text-[10px] text-[var(--mut)]">
                      {watchedHasWhatsApp ? 'WhatsApp confirmation + 1h reminder enabled' : 'SMS / Phone call fallback enabled'}
                    </span>
                  </div>

                  <label className="flex items-start gap-2 text-[var(--ink)] cursor-pointer border-t border-[var(--line)] pt-1.5">
                    <input
                      type="checkbox"
                      {...register('consentGranted')}
                      className="mt-0.5 rounded border-[var(--line-strong)]"
                    />
                    <span className="leading-snug text-[var(--mut)]">
                      <strong className="text-[var(--ink)]">Notification Consent *:</strong> I agree to receive appointment confirmations, payment status updates, 1-hour reminders, and reschedule alerts on my mobile number.
                    </span>
                  </label>
                  {errors.consentGranted && (
                    <p className="text-[11px] text-red-600 font-semibold" role="alert">
                      {errors.consentGranted.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || uniqueDisplaySlots.length === 0}
                  className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#c9a66b] to-[#e0be84] text-[#062327] font-bold text-sm shadow-md hover:opacity-95 disabled:opacity-50 transition"
                >
                  Confirm Appointment Instantly &rarr;
                </button>
              </form>
            </div>

            {/* Right 4 Cols: Compact Clinic Summary & Help Card on Booking Page */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-[var(--surf)] border border-[var(--line)] rounded-3xl p-6 shadow-sm space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold-dark)]">
                    Booking Assistance
                  </span>
                  <h3 className="font-serif-heading text-xl font-semibold mt-0.5">
                    {clinic.name}
                  </h3>
                  <p className="text-xs text-[var(--mut)] mt-1">
                    {clinic.address}
                  </p>
                </div>

                <div className="space-y-2.5 text-xs border-t border-[var(--line)] pt-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--mut)]">Direct Reception:</span>
                    <a href={`tel:${clinic.phone}`} className="font-bold text-[var(--teal)]">{clinic.phone}</a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--mut)]">Emergency Line:</span>
                    <a href={`tel:${clinic.emergencyPhone}`} className="font-bold text-red-600">{clinic.emergencyPhone}</a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--mut)]">Clinic Email:</span>
                    <span className="font-bold text-[var(--ink)]">{clinic.email}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-1.5 text-xs">
                  <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[var(--teal)]" />
                    <span>What Happens Next?</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-[var(--mut)]">
                    <li>• <strong>Cash at Clinic:</strong> Immediate confirmation + GCal event + 1h WhatsApp reminder.</li>
                    <li>• <strong>Manual Easypaisa:</strong> Upload receipt &amp; TID for fast Admin verification.</li>
                    <li>• <strong>Cards / Pay / PayPal:</strong> Confirmed upon server-side payment verification.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 9. FOOTER */}
      <footer className="bg-[#072b30] text-[#eef6f5] py-14 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#c9a66b] text-[#072b30] flex items-center justify-center font-bold">
                ✦
              </div>
              <span className="font-serif-heading font-bold text-lg text-white">
                {clinic.name}
              </span>
            </div>
            <p className="text-xs text-[#a3c4c0] leading-relaxed">
              {clinic.tagline}. Powered by real-time availability validation, automated WhatsApp reminders, and Google Calendar synchronization.
            </p>
          </div>

          <div>
            <h4 className="font-serif-heading font-semibold text-white mb-3">Quick Links</h4>
            <ul className="space-y-2 text-xs text-[#a3c4c0]">
              <li>
                <button type="button" onClick={() => navigateToPage('home')} className="hover:text-white">
                  Home Page (/)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigateToPage('about')} className="hover:text-white">
                  About the Clinic (/about)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigateToPage('treatments')} className="hover:text-white">
                  Treatments &amp; Services (/treatments)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigateToPage('doctors')} className="hover:text-white">
                  Clinical Specialists (/doctors)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigateToPage('contact')} className="hover:text-white">
                  Hours &amp; Contact (/contact)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigateToPage('faq')} className="hover:text-white">
                  Patient FAQ (/faq)
                </button>
              </li>
              <li>
                <button type="button" onClick={navigateToBookingPage} className="hover:text-white font-semibold text-[#f7dfa7]">
                  Book Appointment (/book)
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif-heading font-semibold text-white mb-3">Key Treatments</h4>
            <ul className="space-y-2 text-xs text-[#a3c4c0]">
              {activeServices.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => navigateToPage('treatments')}
                    className="hover:text-white text-left"
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-serif-heading font-semibold text-white mb-3">Contact</h4>
            <p className="text-xs text-[#a3c4c0] space-y-1">
              <span className="block">{clinic.address}</span>
              <span className="block">Tel: {clinic.phone}</span>
              <span className="block">Emergency: {clinic.emergencyPhone}</span>
              <span className="block">Email: {clinic.email}</span>
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#82a5a1]">
          <span>&copy; {new Date().getFullYear()} {clinic.name}. All rights reserved.</span>
          <span>Custom TypeScript Serverless Architecture · Supabase · Meta WhatsApp Cloud API</span>
        </div>
      </footer>

      {/* FLOATING WHATSAPP & AI WHATSAPP ASSISTANT BUTTONS (Present on every page) */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setWaDrawerOpen(true)}
          className="px-4 py-3 rounded-full bg-[#0e4f57] hover:bg-[#177580] text-white font-bold text-xs sm:text-sm shadow-xl border border-white/20 flex items-center gap-2 transition transform hover:-translate-y-0.5 whitespace-nowrap"
        >
          <Bot className="w-4 h-4 text-[#f7dfa7] shrink-0" />
          <span>AI WhatsApp Assistant</span>
        </button>

        <a
          href={officialWhatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Official WhatsApp Chat"
          className="w-13 h-13 p-3.5 rounded-full bg-[#25D366] hover:bg-[#1ebe5a] text-white shadow-xl flex items-center justify-center transition transform hover:scale-105 shrink-0"
        >
          <MessageCircle className="w-6 h-6" />
        </a>
      </div>

      {/* INTERACTIVE WHATSAPP AI RECEPTIONIST DRAWER */}
      {waDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-[var(--surf)] h-full shadow-2xl flex flex-col border-l border-[var(--line)]">
            {/* WhatsApp Header */}
            <div className="bg-[#075E54] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-[#6ef3a4]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">
                    {aiConfig.assistantName}
                  </h3>
                  <span className="text-[11px] text-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
                    {simulatorConversation?.handlingMode === 'human'
                      ? 'Human Receptionist Taken Over'
                      : 'AI Receptionist Active · Syncs with Inbox'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleResetSimulator}
                  title="Start New Patient Conversation"
                  className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWaDrawerOpen(false)}
                  aria-label="Close WhatsApp Assistant"
                  className="p-2 rounded-lg hover:bg-white/10 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-banner linking to Official WhatsApp & Admin Inbox */}
            <div className="bg-[#128C7E]/15 px-4 py-2 text-[11px] flex items-center justify-between border-b border-[var(--line)]">
              <span>Simulated Phone: <strong>{waSimulatorPhone}</strong></span>
              <a
                href={officialWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#075E54] dark:text-[#6ef3a4] font-bold hover:underline flex items-center gap-1"
              >
                <span>Open Native WhatsApp</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#ece5dd] dark:bg-[#0b191c]">
              <div className="bg-white/90 dark:bg-[#122529] text-[var(--ink)] p-3 rounded-2xl rounded-tl-xs shadow-xs text-xs max-w-[88%]">
                {aiConfig.welcomeMessage}
              </div>

              {simulatorMessages.map((m) => {
                const isPatient = m.direction === 'inbound';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`p-3 rounded-2xl shadow-xs text-xs whitespace-pre-line max-w-[88%] ${
                        isPatient
                          ? 'bg-[#dcf8c6] text-slate-900 rounded-tr-xs'
                          : 'bg-white dark:bg-[#122529] text-[var(--ink)] rounded-tl-xs'
                      }`}
                    >
                      {m.content}
                      {m.toolCallsExecuted && m.toolCallsExecuted.length > 0 && (
                        <div className="mt-1.5 pt-1.5 border-t border-black/10 dark:border-white/10 flex flex-wrap gap-1">
                          {m.toolCallsExecuted.map((tool) => (
                            <span
                              key={tool}
                              className="px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 font-mono text-[10px]"
                            >
                              ⚡ {tool}()
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {simulatorConversation?.handlingMode === 'human' && (
                <div className="p-3.5 rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 text-amber-950 dark:text-amber-200 text-xs space-y-2.5 shadow-sm">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>👤 Human Receptionist Takeover Active</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Because you clicked <strong>&ldquo;I want to talk to a human receptionist&rdquo;</strong>, the AI Receptionist automatically paused so a human staff member can reply from the Admin WhatsApp Inbox.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleResumeAIInSimulator}
                      className="px-3 py-1.5 rounded-xl bg-[#075E54] hover:bg-[#128C7E] text-white font-bold text-xs transition shadow-xs"
                    >
                      🤖 Resume AI Receptionist Now
                    </button>
                    <button
                      type="button"
                      onClick={onOpenAdmin}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#122529] border border-amber-600/40 font-semibold text-xs transition"
                    >
                      Reply as Staff in Admin Inbox &rarr;
                    </button>
                  </div>
                </div>
              )}

              <div ref={chatMessagesEndRef} />
            </div>

            {/* Quick Prompt Suggestions (Click to Fill Input OR Double-Click/Send) */}
            <div className="px-3 py-2 bg-[var(--surf-alt)] border-t border-[var(--line)] flex gap-1.5 overflow-x-auto text-[11px]">
              {[
                'Hello, I want to book an appointment',
                'What are your opening hours?',
                'What services do you offer?',
                'Who are the doctors?',
                'I want to talk to a human receptionist',
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setWaInput(prompt);
                    // If AI was paused in human mode and user wants to test an AI prompt, auto-resume AI unless they clicked the human handover chip
                    if (
                      simulatorConversation?.handlingMode === 'human' &&
                      !prompt.toLowerCase().includes('human')
                    ) {
                      store.setConversationHandlingMode(
                        simulatorConversation.id,
                        'ai',
                        'Auto-Resume AI on Quick Prompt'
                      );
                    }
                    sendSimulatorText(prompt);
                  }}
                  className="px-2.5 py-1 rounded-full bg-[var(--surf)] border border-[var(--line)] whitespace-nowrap hover:border-[var(--teal)] transition"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Message Input */}
            <form
              onSubmit={handleSendWhatsAppSimulatorMessage}
              className="p-3 bg-[var(--surf)] border-t border-[var(--line)] flex items-center gap-2"
            >
              <input
                type="text"
                value={waInput}
                onChange={(e) => setWaInput(e.target.value)}
                placeholder="Type a WhatsApp message..."
                className="flex-1 rounded-full border border-[var(--line-strong)] bg-[var(--bg)] px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#075E54]"
              />
              <button
                type="submit"
                aria-label="Send WhatsApp Message"
                className="w-10 h-10 rounded-full bg-[#075E54] hover:bg-[#128C7E] text-white flex items-center justify-center shrink-0 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CELEBRATORY APPOINTMENT SUCCESS POPUP MODAL */}
      {showSuccessPopup && bookingConfirmation && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-popup-title"
        >
          <div className="bg-[var(--surf)] border-2 border-[var(--teal)] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
            {/* Top Decorative Gradient Bar */}
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#0e4f57] via-[#16b88b] to-[#c9a66b]" />

            {/* Close X Button */}
            <button
              type="button"
              onClick={() => setShowSuccessPopup(false)}
              aria-label="Close confirmation popup"
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-[var(--surf-alt)] text-[var(--mut)] hover:text-[var(--ink)] transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon & Title */}
            <div className="text-center space-y-2 pt-2">
              <div
                className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center shadow-lg ${
                  bookingConfirmation.appointmentStatus === 'confirmed'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <span className="inline-block px-3 py-1 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-[11px] font-bold uppercase tracking-widest">
                {bookingConfirmation.appointmentStatus === 'confirmed'
                  ? 'Appointment Confirmed'
                  : 'Receipt Submitted for Verification'}
              </span>

              <h3
                id="booking-popup-title"
                className="font-serif-heading text-2xl sm:text-3xl font-bold text-[var(--ink)]"
              >
                {bookingConfirmation.appointmentStatus === 'confirmed'
                  ? 'Appointment Booked Successfully!'
                  : 'Booking Received — Pending Verification!'}
              </h3>

              <p className="text-xs sm:text-sm text-[var(--mut)]">
                Thank you, <strong className="text-[var(--ink)]">{bookingConfirmation.patientName}</strong>! Your booking reference is{' '}
                <span className="font-mono font-bold text-[var(--teal)]">
                  #{bookingConfirmation.appointmentId}
                </span>
                .
              </p>
            </div>

            {/* Structured Receipt Details Card */}
            <div className="p-4 rounded-2xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-2.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between py-1 border-b border-[var(--line)]">
                <span className="text-[var(--mut)]">Treatment</span>
                <strong className="text-[var(--ink)] text-right">
                  {bookingConfirmation.serviceName}
                </strong>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--line)]">
                <span className="text-[var(--mut)]">Specialist Doctor</span>
                <strong className="text-[var(--ink)]">
                  {bookingConfirmation.doctorName}
                </strong>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--line)]">
                <span className="text-[var(--mut)]">Date &amp; Time</span>
                <strong className="text-[var(--teal)]">
                  {bookingConfirmation.date} at {bookingConfirmation.time}
                </strong>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--line)]">
                <span className="text-[var(--mut)]">Patient Mobile (E.164)</span>
                <strong className="font-mono text-[var(--ink)]">
                  {bookingConfirmation.patientPhoneE164}
                </strong>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[var(--mut)]">Payment Status</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    bookingConfirmation.paymentStatus === 'UNPAID'
                      ? 'bg-emerald-500/15 text-emerald-700'
                      : 'bg-amber-500/20 text-amber-800'
                  }`}
                >
                  {bookingConfirmation.paymentStatus} ({bookingConfirmation.paymentDisplayLabel})
                </span>
              </div>
            </div>

            {/* Automated System Actions Checklist */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-950 dark:text-emerald-200 space-y-1.5">
              {bookingConfirmation.appointmentStatus === 'confirmed' ? (
                <>
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>WhatsApp confirmation sent to Patient, Doctor &amp; Clinic Admin</span>
                  </div>
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Google Calendar event created &amp; 1-hour WhatsApp reminder scheduled</span>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2 font-semibold">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Your payment receipt is queued for Admin verification. Once approved, your Google Calendar event, 3-way WhatsApp confirmations, and 1-hour reminder will be triggered automatically.
                  </span>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowSuccessPopup(false)}
                className="w-full py-3.5 px-4 rounded-full bg-[var(--teal)] hover:bg-[var(--teal-light)] text-white font-bold text-sm inline-flex items-center justify-center shadow-md transition whitespace-nowrap"
              >
                Done &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
