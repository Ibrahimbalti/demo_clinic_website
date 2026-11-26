import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  UserCheck,
  ChevronRight,
  Award,
  HeartHandshake,
  Microscope,
  Stethoscope,
  Mail,
  HelpCircle,
} from 'lucide-react';
import type {
  ClinicProfile,
  Doctor,
  ClinicService,
  ClinicHoliday,
  AIConfiguration,
} from '../types/clinic';
import { formatDisplayTime } from '../lib/availabilityEngine';

export type PublicPageRoute =
  | 'home'
  | 'about'
  | 'treatments'
  | 'doctors'
  | 'contact'
  | 'faq'
  | 'book';

interface SharedSubpageProps {
  clinic: ClinicProfile;
  doctors: Doctor[];
  services: ClinicService[];
  holidays: ClinicHoliday[];
  aiConfig: AIConfiguration;
  onNavigate: (page: PublicPageRoute) => void;
  onBookServiceDoctor: (serviceId: string, doctorId?: string) => void;
}

/* ============================================================================
 * 1. DEDICATED "/about" PAGE — ABOUT US, HERITAGE, 3D LAB & STERILIZATION
 * ============================================================================ */
export const AboutUsPage: React.FC<SharedSubpageProps> = ({
  clinic,
  doctors,
  onNavigate,
}) => {
  const [sterilizationStep, setSterilizationStep] = useState(0);

  const sterilizationProtocol = [
    {
      step: '01',
      title: 'Enzymatic Pre-Soak & Decontamination',
      duration: '15 Minutes',
      desc: 'Immediately after clinical use, all instruments are submerged in medical-grade tri-enzymatic solution inside our dedicated dirty-zone utility room to dissolve organic bio-burden.',
      img: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=1000&auto=format&fit=crop&q=85',
    },
    {
      step: '02',
      title: 'Ultrasonic Cavitation Bath',
      duration: '20 Minutes',
      desc: 'High-frequency sound waves create millions of microscopic imploding bubbles that scrub serrated tips, hinges, and internal lumens unreachable by manual brushing.',
      img: 'https://images.unsplash.com/photo-1581595220892-b0739db3ba8c?w=1000&auto=format&fit=crop&q=85',
    },
    {
      step: '03',
      title: 'Thermal Washer-Disinfector & Pure RO Rinse',
      duration: '25 Minutes',
      desc: 'Automated thermal disinfection at 93°C using reverse-osmosis demineralized water eliminates mineral spots and corrosion.',
      img: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=1000&auto=format&fit=crop&q=85',
    },
    {
      step: '04',
      title: 'Individual Pouched Dual-Indicator Sealing',
      duration: '10 Minutes',
      desc: 'Dried instruments are inspected under illuminated magnification and heat-sealed in ISO-certified sterilization pouches with internal and external chemical indicators.',
      img: 'https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1000&auto=format&fit=crop&q=85',
    },
    {
      step: '05',
      title: 'Class-B Fractionated Vacuum Autoclave',
      duration: '45 Minutes @ 134°C',
      desc: 'Hospital-grade European Class-B autoclaves pull three pre-vacuum pulses before injecting pressurized steam at 134°C, eradicating 100% of bacteria, viruses, fungi, and spores.',
      img: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=1000&auto=format&fit=crop&q=85',
    },
    {
      step: '06',
      title: 'Digital Barcode Traceability & Chairside Unsealing',
      duration: 'Every Patient Visit',
      desc: 'Each pouch receives a digital cycle barcode linked to the patient chart and is only unsealed in front of you at the dental chair.',
      img: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1000&auto=format&fit=crop&q=85',
    },
  ];

  const facilitySuites = [
    {
      title: '3D CBCT & Digital Smile Design Studio',
      subtitle: 'Ultra-Low-Dose Tomography & Facial Scanning',
      desc: 'Equipped with sub-millimeter 3D Cone Beam Computed Tomography (CBCT) and dual intraoral optical scanners, enabling virtual implant placement and 3D smile mockups without messy impression trays.',
      image:
        'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&auto=format&fit=crop&q=85',
      metrics: ['90% Lower Radiation Dose', '60-Second Full Arch Scan', '1:1 3D Smile Preview'],
    },
    {
      title: 'Microscopic Endodontic & Surgical Suite',
      subtitle: '25x Carl Zeiss Optical Magnification',
      desc: 'Our surgical suites utilize coaxial LED dental operating microscopes and computerized painless local anesthesia (The Wand STA) for minimally invasive root canal and micro-surgical precision.',
      image:
        'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&auto=format&fit=crop&q=85',
      metrics: ['25x Optical Zoom', 'Computer-Regulated Anesthesia', 'HEPA Air Filtration'],
    },
    {
      title: 'In-House CAD/CAM Ceramic Artisans Lab',
      subtitle: 'Swiss E.max Porcelain & Monolithic Zirconia',
      desc: 'Our master ceramists hand-layer and custom-stain every porcelain veneer and zirconia crown right on site, allowing custom shade matching alongside your restorative specialist.',
      image:
        'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=1200&auto=format&fit=crop&q=85',
      metrics: ['5-Axis Wet/Dry Milling', 'Natural Enamel Translucency', 'Same-Day Provisional Crowns'],
    },
    {
      title: 'Acoustic Private Recovery & Family Lounge',
      subtitle: 'Zero-Anxiety Hospitality Architecture',
      desc: 'Designed like a serene boutique wellness sanctuary with sound-insulated treatment suites, ceiling entertainment screens, noise-canceling headphones, and warm aromatherapy towels.',
      image:
        'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&auto=format&fit=crop&q=85',
      metrics: ['Private Recovery Suites', 'Noise-Canceling Audio', 'Dedicated Family Concierge'],
    },
  ];

  return (
    <div className="space-y-20 pb-20">
      {/* HERO BANNER */}
      <section className="relative overflow-hidden bg-[#03181b] text-white py-20 lg:py-28">
        <img
          src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1920&auto=format&fit=crop&q=85"
          alt="Gasha Demo Clinic Interior"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#021418]/95 via-[#021418]/85 to-[#072b30]/75" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a66b]/20 border border-[#c9a66b]/40 text-[#f7dfa7] text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              About {clinic.name} · Clinical Excellence &amp; Artistry
            </span>
            <h1 className="font-serif-heading text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight">
              Where Swiss Dental Precision Meets{' '}
              <span className="italic font-normal text-[#f7dfa7]">
                Compassionate Human Care.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-[#d7ece9] leading-relaxed max-w-2xl">
              Founded with a singular vision to eliminate dental anxiety and elevate restorative dentistry into fine art, {clinic.name} integrates 3D digital diagnostics, hospital-grade Class-B sterilization, and transparent written treatment plans.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('book')}
                className="px-7 py-3.5 rounded-full bg-gradient-to-r from-[#c9a66b] to-[#e0be84] text-[#062327] font-bold text-sm shadow-lg hover:opacity-95 transition"
              >
                Schedule a Consultation &rarr;
              </button>
              <button
                type="button"
                onClick={() => onNavigate('doctors')}
                className="px-6 py-3.5 rounded-full border border-white/40 hover:bg-white/10 text-white font-semibold text-sm transition"
              >
                Meet Our {doctors.length} Specialists
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            <div className="p-6 rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
              <div className="font-serif-heading text-3xl sm:text-4xl font-bold text-[#f7dfa7]">
                15+ Yrs
              </div>
              <div className="text-sm font-semibold text-white">Clinical Heritage</div>
              <p className="text-xs text-[#b7dbd7]">
                Multidisciplinary prosthodontic, implant, and cosmetic excellence.
              </p>
            </div>
            <div className="p-6 rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
              <div className="font-serif-heading text-3xl sm:text-4xl font-bold text-[#6ef3a4]">
                100%
              </div>
              <div className="text-sm font-semibold text-white">Class-B Autoclave</div>
              <p className="text-xs text-[#b7dbd7]">
                6-stage European hospital sterilization with barcode tracking.
              </p>
            </div>
            <div className="p-6 rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
              <div className="font-serif-heading text-3xl sm:text-4xl font-bold text-[#f7dfa7]">
                0.08 mm
              </div>
              <div className="text-sm font-semibold text-white">3D Optical Accuracy</div>
              <p className="text-xs text-[#b7dbd7]">
                Digital intraoral scanning &amp; guided implant surgery.
              </p>
            </div>
            <div className="p-6 rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
              <div className="font-serif-heading text-3xl sm:text-4xl font-bold text-[#6ef3a4]">
                Written
              </div>
              <div className="text-sm font-semibold text-white">Transparent Plans</div>
              <p className="text-xs text-[#b7dbd7]">
                Upfront itemized fees and timelines before any procedure starts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ARCHITECTURAL & CLINICAL SUITES SHOWCASE (REAL PHOTOGRAPHY) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="inline-block px-3.5 py-1 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-xs font-bold uppercase tracking-widest">
            Inside Our Clinic Architecture
          </span>
          <h2 className="font-serif-heading text-3xl sm:text-4xl font-semibold">
            State-of-the-art clinical suites &amp; digital laboratories
          </h2>
          <p className="text-[var(--mut)] text-base">
            Explore our purpose-built diagnostic studios, microscopic operatories, and in-house ceramic lab designed for painless, predictable clinical outcomes.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {facilitySuites.map((suite) => (
            <div
              key={suite.title}
              className="bg-[var(--surf)] border border-[var(--line)] rounded-3xl overflow-hidden shadow-md hover:border-[var(--teal)] transition flex flex-col"
            >
              <div className="relative h-64 overflow-hidden">
                <img
                  src={suite.image}
                  alt={suite.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <span className="absolute bottom-4 left-4 px-3 py-1 rounded-full bg-[#0e4f57]/90 text-white text-xs font-bold">
                  {suite.subtitle}
                </span>
              </div>
              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <h3 className="font-serif-heading text-2xl font-semibold text-[var(--ink)]">
                    {suite.title}
                  </h3>
                  <p className="text-sm text-[var(--mut)] leading-relaxed">
                    {suite.desc}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--line)]">
                  {suite.metrics.map((m) => (
                    <span
                      key={m}
                      className="px-3 py-1 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-xs font-bold"
                    >
                      ✓ {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* INTERACTIVE 6-STAGE HOSPITAL STERILIZATION PROTOCOL */}
      <section className="bg-[var(--surf-alt)] border-y border-[var(--line)] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="max-w-3xl space-y-3">
            <span className="inline-block px-3.5 py-1 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-xs font-bold uppercase tracking-widest">
              Infection Control &amp; Patient Safety
            </span>
            <h2 className="font-serif-heading text-3xl sm:text-4xl font-semibold">
              Our 6-Stage European Class-B Sterilization Workflow
            </h2>
            <p className="text-[var(--mut)] text-base">
              Click through each stage of our closed-loop sterilization room protocol to see how every instrument is sanitized, pouched, autoclaved, and barcode-verified.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-2.5">
              {sterilizationProtocol.map((st, idx) => (
                <button
                  key={st.step}
                  type="button"
                  onClick={() => setSterilizationStep(idx)}
                  className={`w-full p-4 rounded-2xl border text-left transition flex items-center justify-between gap-3 ${
                    sterilizationStep === idx
                      ? 'bg-[var(--teal)] text-white border-[var(--teal)] shadow-md'
                      : 'bg-[var(--surf)] border-[var(--line)] hover:border-[var(--teal)] text-[var(--ink)]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`w-9 h-9 rounded-xl font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                        sterilizationStep === idx
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--teal-subtle)] text-[var(--teal)]'
                      }`}
                    >
                      {st.step}
                    </span>
                    <div>
                      <div className="font-bold text-sm">{st.title}</div>
                      <div
                        className={`text-xs ${
                          sterilizationStep === idx ? 'text-white/80' : 'text-[var(--mut)]'
                        }`}
                      >
                        Cycle Duration: {st.duration}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              ))}
            </div>

            <div className="lg:col-span-7 bg-[var(--surf)] border border-[var(--line)] rounded-3xl overflow-hidden shadow-lg">
              <div className="relative h-80 overflow-hidden">
                <img
                  src={sterilizationProtocol[sterilizationStep].img}
                  alt={sterilizationProtocol[sterilizationStep].title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4 px-4 py-1.5 rounded-full bg-[#03181b]/90 text-[#f7dfa7] text-xs font-bold">
                  Stage {sterilizationProtocol[sterilizationStep].step} of 06 ·{' '}
                  {sterilizationProtocol[sterilizationStep].duration}
                </div>
              </div>
              <div className="p-8 space-y-4">
                <h3 className="font-serif-heading text-2xl font-semibold">
                  {sterilizationProtocol[sterilizationStep].title}
                </h3>
                <p className="text-sm sm:text-base text-[var(--mut)] leading-relaxed">
                  {sterilizationProtocol[sterilizationStep].desc}
                </p>
                <div className="pt-2 flex flex-wrap gap-3 text-xs font-bold text-[var(--teal)]">
                  <span>✓ ISO 13485 Compliant</span>
                  <span>·</span>
                  <span>✓ Daily Spore &amp; Helix Bowie-Dick Testing</span>
                  <span>·</span>
                  <span>✓ Chairside Pouch Unsealing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLINICAL ETHICS & PATIENT CHARTER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-gradient-to-br from-[#072b30] to-[#0e4f57] text-white rounded-3xl p-8 sm:p-12 grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <span className="inline-block px-3.5 py-1 rounded-full bg-white/10 text-[#f7dfa7] text-xs font-bold uppercase tracking-widest">
              Our Patient Charter
            </span>
            <h2 className="font-serif-heading text-3xl sm:text-4xl font-semibold">
              Experience dentistry with zero surprises and total peace of mind
            </h2>
            <p className="text-sm sm:text-base text-[#cde5e2] leading-relaxed">
              Every patient receives a comprehensive 3D diagnostic consultation, a written treatment plan with clear payment options, and automated 1-hour appointment reminders.
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
            <button
              type="button"
              onClick={() => onNavigate('book')}
              className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#c9a66b] to-[#e0be84] text-[#062327] font-bold text-sm text-center shadow-lg hover:opacity-95 transition"
            >
              Book Your Visit Now &rarr;
            </button>
            <button
              type="button"
              onClick={() => onNavigate('treatments')}
              className="w-full py-3.5 px-6 rounded-full border border-white/30 hover:bg-white/10 text-white font-semibold text-sm text-center transition"
            >
              Explore All Treatments
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ============================================================================
 * 2. DEDICATED "/treatments" PAGE — COMPREHENSIVE CLINICAL CATALOG & PROTOCOLS
 * ============================================================================ */
export const TreatmentsPage: React.FC<SharedSubpageProps> = ({
  services,
  onNavigate,
  onBookServiceDoctor,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Clinical Treatments' },
    { id: 'diagnostic', label: '3D Diagnostics & Prevention' },
    { id: 'cosmetic', label: 'Cosmetic & Smile Design' },
    { id: 'surgical', label: 'Implants & Micro-Surgery' },
    { id: 'orthodontic', label: 'Clear Aligners & Ortho' },
  ];

  // Clinical step-by-step protocols keyed by service ID
  const serviceClinicalDetails: Record<
    string,
    {
      category: string;
      anesthesia: string;
      warranty: string;
      technology: string;
      clinicalSteps: string[];
      idealFor: string[];
    }
  > = {
    svc_checkup: {
      category: 'diagnostic',
      anesthesia: 'None Required (Non-Invasive)',
      warranty: 'Includes Full Written 3D Diagnostic Report',
      technology: '3D Intraoral Optical Scanner + Low-Dose Digital X-Ray',
      clinicalSteps: [
        'High-definition intraoral camera tour & periodontal gum health charting',
        'Ultra-low-dose digital radiographs & caries fluorescence screening',
        '3D digital occlusal bite analysis & TMJ joint evaluation',
        'Itemized written treatment roadmap with transparent fee options',
      ],
      idealFor: ['New Patient Baseline Exam', 'Annual Preventive Checkup', 'Second-Opinion Consultation'],
    },
    svc_whitening: {
      category: 'cosmetic',
      anesthesia: 'Desensitizing Enamel Serum (Needle-Free)',
      warranty: '6–18 Months Brightness + Custom Touch-Up Trays',
      technology: 'Cold-LED Photo-Activated Hydrogen Peroxide Gel',
      clinicalSteps: [
        'Spectrophotometer digital shade recording & ultrasonic plaque polish',
        ' Light-cured liquid rubber dam application to protect gingival tissues',
        'Three 15-minute Cold-LED laser photo-activation cycles',
        'Post-treatment nano-hydroxyapatite fluoride remineralization glaze',
      ],
      idealFor: ['Coffee, Tea & Wine Staining', 'Pre-Wedding / Event Smile Refresh', ' intrinsic Enamel Brightening'],
    },
    svc_veneers: {
      category: 'cosmetic',
      anesthesia: 'Computerized STA Painless Local Anesthesia',
      warranty: '10-Year Structural Ceramic Warranty',
      technology: '3D Digital Smile Design (DSD) + Swiss IPS e.max Porcelain',
      clinicalSteps: [
        '3D facial & intraoral scan with virtual smile proportion design',
        'Trial Smile test-drive in your mouth before touching natural enamel',
        'Ultra-conservative 0.3mm micro-preparation under 25x magnification',
        'Adhesive resin-cementation of hand-layered Swiss e.max veneers',
      ],
      idealFor: ['Chipped or Worn Front Teeth', 'Permanent Discoloration', 'Diastema Gap Closure & Smile Makeovers'],
    },
    svc_implant: {
      category: 'surgical',
      anesthesia: 'Computerized Local Anesthesia',
      warranty: 'Lifetime Titanium Fixture Warranty',
      technology: '3D CBCT Bone Mapping + Computer-Milled Surgical Guide',
      clinicalSteps: [
        '3D CBCT bone volume analysis & virtual nerve-safe implant planning',
        'Keyhole 3D-guided titanium implant placement with zero scalpel sutures',
        'Osseointegration healing phase (8–12 weeks) with aesthetic provisional',
        'Custom screw-retained monolithic zirconia crown delivery',
      ],
      idealFor: ['Single Missing Tooth', 'Multiple Missing Teeth Bridges', 'Full-Arch All-on-4 / All-on-6 Restoration'],
    },
    svc_root_canal: {
      category: 'surgical',
      anesthesia: 'Computerized Profound Local Nerve Block',
      warranty: '5-Year Endodontic Seal Follow-Up',
      technology: 'Carl Zeiss 25x Operating Microscope + Rotary NiTi Files',
      clinicalSteps: [
        'Profound computerized anesthesia & rubber dam isolation',
        '25x microscopic canal localization & electronic apex measurement',
        'Ultrasonic sodium hypochlorite & EDTA laser-activated irrigation',
        '3D warm vertical bioceramic obturation & core buildup',
      ],
      idealFor: ['Acute Throbbing Toothache', 'Deep Decay Reaching Dental Pulp', ' thermal Sensitivity & Apical Abscess'],
    },
    svc_aligners: {
      category: 'orthodontic',
      anesthesia: 'None Required (Removable Clear Trays)',
      warranty: 'Includes Refinement Trays & Vivera Retainers',
      technology: '3D ClinCheck Tooth-Movement Simulation + SmartTrack Polymer',
      clinicalSteps: [
        '60-second radiation-free 3D optical arch scan & bite registration',
        'Interactive 3D video simulation showing week-by-week tooth movement',
        'Delivery of custom medical-grade clear aligner series (worn 20–22h/day)',
        'Monthly progress checks & final custom retention protocol',
      ],
      idealFor: ['Crowded or Overlapping Teeth', 'Spacing & Gaps', 'Overbite, Underbite & Relapse Correction'],
    },
  };

  const filteredServices = services.filter((s) => {
    if (selectedCategory === 'all') return true;
    const meta = serviceClinicalDetails[s.id];
    return meta ? meta.category === selectedCategory : true;
  });

  return (
    <div className="space-y-16 pb-20">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#03181b] text-white py-20">
        <img
          src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1920&auto=format&fit=crop&q=85"
          alt="Clinical Dental Treatments"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#021418]/95 via-[#021418]/85 to-[#072b30]/75" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a66b]/20 border border-[#c9a66b]/40 text-[#f7dfa7] text-xs font-bold uppercase tracking-widest">
            <Stethoscope className="w-3.5 h-3.5" />
            Comprehensive Clinical Directory · Real-Time Database Pricing
          </span>
          <h1 className="font-serif-heading text-4xl sm:text-5xl lg:text-6xl font-semibold max-w-4xl leading-tight">
            Advanced Dental Treatments &amp;{' '}
            <span className="italic font-normal text-[#f7dfa7]">
              Clinical Protocols
            </span>
          </h1>
          <p className="text-base sm:text-lg text-[#d7ece9] max-w-2xl leading-relaxed">
            Every procedure below includes our 4-step clinical protocol, technology specifications, anesthesia comfort rating, and direct online slot booking.
          </p>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2 pt-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-[#c9a66b] to-[#e0be84] text-[#062327] shadow-md'
                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* DETAILED TREATMENT CARDS WITH 4-STEP CLINICAL PROTOCOLS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
        {filteredServices.map((svc, idx) => {
          const details = serviceClinicalDetails[svc.id] || {
            category: 'diagnostic',
            anesthesia: 'Computerized Gentle Comfort',
            warranty: 'Written Clinical Care Guarantee',
            technology: '3D Digital Diagnostics & Guided Care',
            clinicalSteps: [
              'Comprehensive digital examination & 3D diagnostic scan',
              'Written itemized treatment plan & shade/anatomy selection',
              'Minimally invasive clinical procedure under magnification',
              'Post-care review & automated follow-up reminders',
            ],
            idealFor: ['Aesthetic & Functional Restoration', 'Long-Term Oral Health'],
          };

          return (
            <div
              key={svc.id}
              className="bg-[var(--surf)] border border-[var(--line)] rounded-3xl overflow-hidden shadow-md hover:border-[var(--teal)] transition grid lg:grid-cols-12"
            >
              {/* Image Column */}
              <div className="lg:col-span-5 relative min-h-[280px] bg-[var(--teal-subtle)]">
                <img
                  src={svc.imageUrl}
                  alt={svc.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <span className="absolute top-4 left-4 px-3.5 py-1 rounded-full bg-[#031a1e]/90 text-[#f7dfa7] text-xs font-bold uppercase tracking-wider">
                  0{idx + 1} · {svc.badge}
                </span>
                <div className="absolute bottom-4 inset-x-4 flex items-end justify-between text-white">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#f7dfa7] block font-bold">
                      All-Inclusive Fee Guide
                    </span>
                    <span className="font-serif-heading text-2xl sm:text-3xl font-bold">
                      {svc.priceLabel}
                    </span>
                  </div>
                  <div className="text-right text-xs">
                    <span className="block font-bold">{svc.durationMinutes} Minutes</span>
                    <span className="text-white/80">{svc.visitsLabel}</span>
                  </div>
                </div>
              </div>

              {/* Clinical Protocol & Specs Column */}
              <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-serif-heading text-2xl sm:text-3xl font-semibold text-[var(--ink)]">
                      {svc.name}
                    </h2>
                    <span className="px-3 py-1 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-xs font-bold">
                      {details.technology}
                    </span>
                  </div>

                  <p className="text-sm sm:text-base text-[var(--mut)] leading-relaxed">
                    {svc.description}
                  </p>

                  {/* 4-Step Clinical Protocol */}
                  <div className="p-4 rounded-2xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] flex items-center gap-2">
                      <Microscope className="w-4 h-4 text-[var(--teal)]" />
                      <span>Step-by-Step Clinical Protocol</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {details.clinicalSteps.map((stepText, sIdx) => (
                        <div
                          key={stepText}
                          className="p-2.5 rounded-xl bg-[var(--surf)] border border-[var(--line)] text-xs flex items-start gap-2"
                        >
                          <span className="w-5 h-5 rounded-full bg-[var(--teal)] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                            {sIdx + 1}
                          </span>
                          <span className="text-[var(--ink-light)] leading-snug">
                            {stepText}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Specs Row */}
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[var(--surf-alt)] border border-[var(--line)]">
                      <span className="text-[var(--mut)] block">Comfort &amp; Anesthesia:</span>
                      <strong className="text-[var(--ink)]">{details.anesthesia}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surf-alt)] border border-[var(--line)]">
                      <span className="text-[var(--mut)] block">Clinical Guarantee &amp; Deliverables:</span>
                      <strong className="text-[var(--ink)]">{details.warranty}</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-1.5">
                    {details.idealFor.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-lg bg-[var(--teal-subtle)] text-[var(--teal)] text-[11px] font-semibold"
                      >
                        ✓ {tag}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => onBookServiceDoctor(svc.id)}
                    className="px-6 py-3 rounded-full bg-[var(--teal)] hover:bg-[var(--teal-light)] text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 shadow-md transition"
                  >
                    <span>Book This Treatment</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* TRANSPARENT FEE & PAYMENT GUARANTEE BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-[var(--surf-alt)] border border-[var(--line)] rounded-3xl p-8 sm:p-10 grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--teal)]">
              Upfront Written Cost Guarantee
            </span>
            <h3 className="font-serif-heading text-2xl sm:text-3xl font-semibold">
              Flexible US · UK · Global &amp; Local Payment Options
            </h3>
            <p className="text-sm text-[var(--mut)] leading-relaxed">
              We accept Cash at Clinic (Pay at Clinic with immediate confirmation), Manual Easypaisa transfers, US &amp; UK Debit/Credit Cards (Visa, Mastercard, Amex, Discover), Apple Pay, Google Pay, and PayPal.
            </p>
          </div>
          <div className="lg:col-span-4 flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate('book')}
              className="w-full sm:w-auto px-7 py-4 rounded-full bg-gradient-to-r from-[#c9a66b] to-[#e0be84] text-[#062327] font-bold text-sm shadow-lg hover:opacity-95 transition"
            >
              Proceed to Appointment Booking &rarr;
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ============================================================================
 * 3. DEDICATED "/doctors" PAGE — CLINICAL SPECIALISTS, ACADEMIC CV & SCHEDULES
 * ============================================================================ */
export const DoctorsPage: React.FC<SharedSubpageProps> = ({
  doctors,
  services,
  onBookServiceDoctor,
}) => {
  const doctorExtendedBios: Record<
    string,
    {
      education: string;
      fellowships: string[];
      languages: string[];
      publications: string;
      clinicalFocus: string[];
    }
  > = {
    doc_1: {
      education: 'DDS, MS in Prosthodontics — University of Zurich & Harvard School of Dental Medicine Executive Program',
      fellowships: [
        'Fellow, International Team for Implantology (ITI Switzerland)',
        'Member, American Academy of Cosmetic Dentistry (AACD)',
      ],
      languages: ['English', 'Urdu', 'German'],
      publications: '18 Peer-Reviewed Publications on Monolithic Zirconia & 3D Digital Smile Design',
      clinicalFocus: [
        'Minimal-Prep Swiss Porcelain Veneers',
        'Full-Mouth Digital Occlusal Rehabilitation',
        '3D-Guided Aesthetic Implant Prosthetics',
      ],
    },
    doc_2: {
      education: 'BDS, MSc in Endodontics & Micro-Restorative Dentistry — King’s College London (KCL)',
      fellowships: [
        'Specialist Member, European Society of Endodontology (ESE)',
        'Certified Carl Zeiss Microscopic Endodontic Instructor',
      ],
      languages: ['English', 'Russian', 'Arabic'],
      publications: '12 Clinical Papers on 25x Microscopic Root Canal Disinfection & Vital Pulp Therapy',
      clinicalFocus: [
        'Single-Visit 25x Microscopic Root Canal Therapy',
        'Micro-Surgical Root Retreatment & Apicoectomy',
        'Biomimetic Enamel Onlays & Painless Laser Whitening',
      ],
    },
    doc_3: {
      education: 'BDS, DClinDent in Orthodontics & Dentofacial Orthopedics — University of Edinburgh',
      fellowships: [
        'Diamond Invisalign & 3D Clear Aligner Provider',
        'Member, World Federation of Orthodontists (WFO)',
      ],
      languages: ['English', 'Urdu', 'Punjabi'],
      publications: '14 Studies on Digital Clear Aligner Biomechanics & Pediatric Airway Orthodontics',
      clinicalFocus: [
        '3D Digital Clear Aligner Therapy for Adults & Teens',
        'Early Interceptive Pediatric Facial Growth Guidance',
        'Invisible Lingual & Ceramic Retention Systems',
      ],
    },
    doc_4: {
      education: 'DDS, Fellowship in Oral & Maxillofacial Implantology — New York University (NYU) College of Dentistry',
      fellowships: [
        'Diplomate, International Congress of Oral Implantologists (ICOI)',
        'Certified Piezosurgery & Guided Bone Regeneration Specialist',
      ],
      languages: ['English', 'Arabic', 'French'],
      publications: '22 Publications on Computer-Guided Keyhole Implantology & Immediate Loading',
      clinicalFocus: [
        'Flapless 3D Computer-Guided Titanium Implants',
        'Immediate-Load All-on-4 / All-on-6 Full Arch Restorations',
        'Atraumatic Piezoelectric Bone & Sinus Augmentation',
      ],
    },
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-16 pb-20">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#03181b] text-white py-20">
        <img
          src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=1920&auto=format&fit=crop&q=85"
          alt="Clinical Specialists Team"
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#021418]/95 via-[#021418]/85 to-[#072b30]/75" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 space-y-4">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a66b]/20 border border-[#c9a66b]/40 text-[#f7dfa7] text-xs font-bold uppercase tracking-widest">
            <UserCheck className="w-3.5 h-3.5" />
            Multidisciplinary Clinical Faculty · Google Calendar Synced
          </span>
          <h1 className="font-serif-heading text-4xl sm:text-5xl lg:text-6xl font-semibold max-w-4xl leading-tight">
            Meet Our Board-Trained{' '}
            <span className="italic font-normal text-[#f7dfa7]">
              Dental Specialists
            </span>
          </h1>
          <p className="text-base sm:text-lg text-[#d7ece9] max-w-2xl leading-relaxed">
            Review each specialist’s academic credentials, fellowships, clinical focus areas, and live weekly consultation hours.
          </p>
        </div>
      </section>

      {/* DETAILED DOCTOR PROFILES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        {doctors.map((doc) => {
          const bio = doctorExtendedBios[doc.id] || {
            education: 'Doctor of Dental Surgery (DDS) & Postgraduate Clinical Residency',
            fellowships: doc.credentials,
            languages: ['English', 'Urdu'],
            publications: 'Active Clinical Researcher in Digital & Restorative Dentistry',
            clinicalFocus: ['Comprehensive Restorative Care', '3D Digital Diagnostics'],
          };

          const docServices = services.filter((s) => doc.serviceIds.includes(s.id));
          const activeDays = doc.availability.filter((w) => w.isAvailable);

          return (
            <div
              key={doc.id}
              className="bg-[var(--surf)] border border-[var(--line)] rounded-3xl overflow-hidden shadow-md hover:border-[var(--teal)] transition grid lg:grid-cols-12"
            >
              {/* Left 4 Cols: High-Res Portrait & Quick Badges */}
              <div className="lg:col-span-4 relative min-h-[360px] bg-[var(--teal-subtle)] flex flex-col justify-end p-6">
                <img
                  src={doc.imageUrl}
                  alt={doc.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#03181b] via-[#03181b]/30 to-transparent" />
                <div className="relative z-10 text-white space-y-2">
                  <span className="inline-block px-3 py-1 rounded-full bg-[#c9a66b] text-[#062327] text-[11px] font-bold uppercase tracking-wider">
                    {doc.specialization}
                  </span>
                  <h2 className="font-serif-heading text-2xl sm:text-3xl font-bold">
                    {doc.name}
                  </h2>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {doc.credentials.map((cred) => (
                      <span
                        key={cred}
                        className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-xs text-white text-[11px] font-semibold"
                      >
                        {cred}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right 8 Cols: Academic CV, Weekly Schedule & Assigned Treatments */}
              <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-5">
                  <p className="text-sm sm:text-base text-[var(--mut)] leading-relaxed">
                    {doc.description}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-1.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--teal)] flex items-center gap-1.5">
                        <Award className="w-4 h-4" />
                        <span>Academic Education &amp; Research</span>
                      </div>
                      <p className="text-xs font-semibold text-[var(--ink)] leading-snug">
                        {bio.education}
                      </p>
                      <p className="text-[11px] text-[var(--mut)]">
                        {bio.publications}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-1.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--teal)] flex items-center gap-1.5">
                        <Stethoscope className="w-4 h-4" />
                        <span>Primary Clinical Focus</span>
                      </div>
                      <ul className="space-y-1 text-xs text-[var(--ink-light)]">
                        {bio.clinicalFocus.map((cf) => (
                          <li key={cf} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--teal)] shrink-0" />
                            <span>{cf}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Weekly Consultation Schedule & Authorised Services */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[var(--teal)]" />
                          <span>Weekly Consultation Hours</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                          {doc.googleCalendarConnected ? 'GCal Synced' : 'Database Active'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        {activeDays.map((w) => (
                          <div
                            key={w.dayOfWeek}
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--surf)] border border-[var(--line)] flex items-center justify-between"
                          >
                            <span className="font-bold text-[var(--ink)]">
                              {dayNames[w.dayOfWeek].slice(0, 3)}
                            </span>
                            <span className="text-[var(--teal)] font-semibold">
                              {w.startTime}–{w.endTime}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] block">
                        Authorized Treatments ({docServices.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {docServices.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => onBookServiceDoctor(s.id, doc.id)}
                            className="px-2.5 py-1 rounded-lg bg-[var(--surf)] border border-[var(--line-strong)] hover:border-[var(--teal)] text-xs font-semibold text-[var(--ink)] transition"
                          >
                            {s.name} ({s.durationMinutes}m)
                          </button>
                        ))}
                      </div>
                      <div className="text-[11px] text-[var(--mut)] pt-1">
                        Languages Spoken: <strong className="text-[var(--ink)]">{bio.languages.join(' · ')}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs text-[var(--mut)]">
                    Standard Slot Duration: <strong className="text-[var(--ink)]">{doc.appointmentDurationMinutes} mins</strong> · Google Calendar: <strong className="text-[var(--ink)]">{doc.googleCalendarConnected ? 'Connected' : 'Active'}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onBookServiceDoctor(
                        doc.serviceIds[0] || services[0]?.id || 'svc_checkup',
                        doc.id
                      )
                    }
                    className="px-6 py-3 rounded-full bg-[var(--teal)] hover:bg-[var(--teal-light)] text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 shadow-md transition"
                  >
                    <span>Book Appointment with {doc.name}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};

/* ============================================================================
 * 4. DEDICATED "/contact" PAGE — HOURS, LOCATION, EMERGENCY TRIAGE & INQUIRY
 * ============================================================================ */
export const ContactAndHoursPage: React.FC<SharedSubpageProps> = ({
  clinic,
  holidays,
  onNavigate,
}) => {
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquiryTopic, setInquiryTopic] = useState('General Consultation & Treatment Plan');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquirySubmitted, setInquirySubmitted] = useState(false);

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryName.trim() || !inquiryPhone.trim()) return;
    setInquirySubmitted(true);
  };

  return (
    <div className="space-y-16 pb-20">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#03181b] text-white py-20">
        <img
          src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1920&auto=format&fit=crop&q=85"
          alt="Clinic Reception and Concierge"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#021418]/95 via-[#021418]/85 to-[#072b30]/75" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 space-y-4">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a66b]/20 border border-[#c9a66b]/40 text-[#f7dfa7] text-xs font-bold uppercase tracking-widest">
            <MapPin className="w-3.5 h-3.5" />
            Hours, Location &amp; Patient Concierge
          </span>
          <h1 className="font-serif-heading text-4xl sm:text-5xl lg:text-6xl font-semibold max-w-4xl leading-tight">
            Visit {clinic.name} &amp;{' '}
            <span className="italic font-normal text-[#f7dfa7]">
              Direct Clinical Concierge
            </span>
          </h1>
          <p className="text-base sm:text-lg text-[#d7ece9] max-w-2xl leading-relaxed">
            View our live clinical opening hours, emergency dental triage line, parking and accessibility directions, or send an inquiry to our patient coordinator.
          </p>
        </div>
      </section>

      {/* 3 CONTACT PILLAR CARDS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 grid md:grid-cols-3 gap-6">
        <div className="bg-[var(--surf)] border border-[var(--line)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--teal-subtle)] text-[var(--teal)] flex items-center justify-center">
            <Phone className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-dark)] block">
            Reception &amp; Scheduling Desk
          </span>
          <h2 className="font-serif-heading text-2xl font-bold text-[var(--ink)]">
            <a href={`tel:${clinic.phone}`} className="hover:text-[var(--teal)]">
              {clinic.phone}
            </a>
          </h2>
          <p className="text-xs sm:text-sm text-[var(--mut)] leading-relaxed">
            Call our front-desk reception during clinic hours for treatment inquiries, insurance documentation, or family group bookings.
          </p>
        </div>

        <div className="bg-[var(--surf)] border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-600 flex items-center justify-center">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-red-600 block">
            Urgent Dental Pain &amp; Trauma Triage
          </span>
          <h2 className="font-serif-heading text-2xl font-bold text-red-600">
            <a href={`tel:${clinic.emergencyPhone}`}>{clinic.emergencyPhone}</a>
          </h2>
          <p className="text-xs sm:text-sm text-[var(--mut)] leading-relaxed">
            Dedicated same-day emergency triage for acute toothache, dental trauma, knocked-out teeth, or post-surgical swelling.
          </p>
        </div>

        <div className="bg-[var(--surf)] border border-[var(--line)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--teal-subtle)] text-[var(--teal)] flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-dark)] block">
            Clinical Records &amp; X-Ray Transfer
          </span>
          <h2 className="font-serif-heading text-xl sm:text-2xl font-bold text-[var(--ink)] truncate">
            <a href={`mailto:${clinic.email}`} className="hover:text-[var(--teal)]">
              {clinic.email}
            </a>
          </h2>
          <p className="text-xs sm:text-sm text-[var(--mut)] leading-relaxed">
            Email prior panoramic X-rays, CBCT scans, or insurance pre-authorization forms directly to our clinical records desk.
          </p>
        </div>
      </section>

      {/* OPENING HOURS TABLE + PATIENT INQUIRY FORM */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-10 items-start">
        {/* Left 6 Cols: Opening Hours, Holidays & Location */}
        <div className="lg:col-span-6 bg-[var(--surf)] border border-[var(--line)] rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--teal)]">
                Live Database Schedule
              </span>
              <h2 className="font-serif-heading text-2xl sm:text-3xl font-semibold mt-0.5">
                Weekly Opening Hours
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-xs font-bold">
              Timezone: {clinic.timezone}
            </span>
          </div>

          <div className="space-y-2.5 text-sm">
            {clinic.openingHours.map((oh) => (
              <div
                key={oh.day}
                className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surf-alt)] border border-[var(--line)]"
              >
                <span className="font-bold text-[var(--ink)]">{oh.day}</span>
                {oh.isOpen ? (
                  <span className="text-[var(--teal)] font-bold">
                    {formatDisplayTime(oh.openTime)} – {formatDisplayTime(oh.closeTime)}
                  </span>
                ) : (
                  <span className="text-red-600 font-semibold">
                    Closed {oh.note ? `(${oh.note})` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>

          {holidays.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
              <strong className="text-amber-900 dark:text-amber-300 block">
                Upcoming Scheduled Clinic Holidays:
              </strong>
              {holidays.map((h) => (
                <div key={h.id} className="text-[var(--mut)]">
                  • <strong>{h.holidayDate}:</strong> {h.description}
                </div>
              ))}
            </div>
          )}

          <div className="p-5 rounded-2xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-2 text-xs sm:text-sm">
            <div className="font-bold text-[var(--ink)] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[var(--teal)]" />
              <span>Clinic Address &amp; Accessibility</span>
            </div>
            <p className="text-[var(--mut)]">{clinic.address}</p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-semibold text-[var(--teal)]">
              <span>✓ Ground-Floor Step-Free Access</span>
              <span>·</span>
              <span>✓ Dedicated Patient Parking</span>
              <span>·</span>
              <span>✓ Private Recovery Exit</span>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Direct Patient Inquiry & Records Transfer Form */}
        <div className="lg:col-span-6 bg-[var(--surf)] border border-[var(--line)] rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--gold-dark)]">
              Patient Concierge Desk
            </span>
            <h2 className="font-serif-heading text-2xl sm:text-3xl font-semibold mt-0.5">
              Send a Clinical or Billing Inquiry
            </h2>
            <p className="text-xs sm:text-sm text-[var(--mut)] mt-1">
              Have a question about treatment plans, corporate dental insurance, or international travel dentistry? Message our coordinator below or book your slot directly.
            </p>
          </div>

          {inquirySubmitted ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-950 dark:text-emerald-200 space-y-3">
              <div className="flex items-center gap-2 font-bold text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Inquiry Received by Patient Concierge!</span>
              </div>
              <p className="text-xs sm:text-sm">
                Thank you, <strong>{inquiryName}</strong>. Our clinical coordinator will contact you at <strong>{inquiryPhone}</strong> regarding <strong>{inquiryTopic}</strong>.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('book')}
                  className="px-5 py-2.5 rounded-full bg-[var(--teal)] text-white font-bold text-xs"
                >
                  Book Appointment Slot Now &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInquirySubmitted(false);
                    setInquiryMessage('');
                  }}
                  className="px-4 py-2.5 rounded-full border border-[var(--line-strong)] text-xs font-semibold"
                >
                  Send Another Inquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInquirySubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--mut)] mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={inquiryName}
                    onChange={(e) => setInquiryName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--mut)] mb-1">
                    Mobile Number (E.164) *
                  </label>
                  <input
                    type="tel"
                    required
                    value={inquiryPhone}
                    onChange={(e) => setInquiryPhone(e.target.value)}
                    placeholder="e.g. +923001234567"
                    className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--mut)] mb-1">
                  Inquiry Topic
                </label>
                <select
                  value={inquiryTopic}
                  onChange={(e) => setInquiryTopic(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2.5 text-sm"
                >
                  <option>General Consultation &amp; Treatment Plan</option>
                  <option>3D Dental Implants &amp; Porcelain Veneers</option>
                  <option>Clear Aligners &amp; Orthodontic Assessment</option>
                  <option>Payment Methods, Receipts &amp; Insurance</option>
                  <option>Prior X-Ray / Dental Records Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--mut)] mb-1">
                  Your Question or Clinical Notes *
                </label>
                <textarea
                  rows={4}
                  required
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  placeholder="How can our clinical team assist you?"
                  className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="submit"
                  className="px-7 py-3.5 rounded-full bg-[var(--teal)] hover:bg-[var(--teal-light)] text-white font-bold text-sm shadow-md transition"
                >
                  Submit Patient Inquiry
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('book')}
                  className="text-xs font-bold text-[var(--teal)] hover:underline"
                >
                  Want an instant slot instead? Go to Booking Page &rarr;
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};

/* ============================================================================
 * 5. DEDICATED "/faq" PAGE — CLINICAL, PAYMENT, STERILIZATION & BOOKING FAQS
 * ============================================================================ */
export const FaqKnowledgeBasePage: React.FC<SharedSubpageProps> = ({
  clinic,
  aiConfig,
  onNavigate,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const comprehensiveFaqs = [
    ...aiConfig.faqs.map((f) => ({
      category: 'Booking & General Care',
      question: f.question,
      answer: f.answer,
    })),
    {
      category: 'Payments & Verification',
      question: 'Which local and international payment methods do you support?',
      answer:
        'We support 5 clear payment options: (1) US & UK Debit and Credit Cards (Visa, Mastercard, American Express, Discover), (2) Apple Pay & Google Pay digital wallets, (3) PayPal (for eligible international merchant accounts), (4) Cash at Clinic (Pay at Clinic with immediate confirmation and UNPAID status), and (5) Manual Easypaisa transfer with receipt upload and Transaction ID (TID) verification.',
    },
    {
      category: 'Payments & Verification',
      question: 'How does Manual Easypaisa receipt verification work?',
      answer:
        'When you select Manual Easypaisa during checkout, you transfer the fee to our official clinic Easypaisa account, enter your Transaction Reference (TID), and upload your payment screenshot. Your booking is placed in PENDING_PAYMENT_VERIFICATION until our administrator reviews and approves the receipt in the dashboard—after which your appointment is marked PAID & CONFIRMED, your Google Calendar event is created, and your 1-hour WhatsApp reminder is scheduled.',
    },
    {
      category: 'Clinical Comfort & Sterilization',
      question: 'How do you ensure treatments are painless for anxious patients?',
      answer:
        'We use computerized local anesthesia delivery (The Wand STA), which regulates flow pressure below the human pain threshold, combined with topical numbing gels, heated irrigation, and minimally invasive ultrasonic and laser instruments.',
    },
    {
      category: 'Clinical Comfort & Sterilization',
      question: 'What sterilization standards do you follow between patients?',
      answer:
        'Every reusable instrument undergoes our 6-stage European Class-B hospital sterilization cycle: enzymatic decontamination, ultrasonic cavitation cleaning, thermal washer-disinfection at 93°C, dual-indicator pouch sealing, fractionated vacuum autoclaving at 134°C, and chairside barcode verification.',
    },
    {
      category: 'Cosmetic & Implant Procedures',
      question: 'Can I preview my new smile before porcelain veneers are fabricated?',
      answer:
        'Yes. Using 3D Digital Smile Design (DSD) and our intraoral optical scanner, we create a 3D virtual simulation and a physical Trial Smile mockup in your mouth so you can approve tooth length, contour, and shade before any enamel preparation.',
    },
    {
      category: 'Cosmetic & Implant Procedures',
      question: 'How long do 3D-guided titanium dental implants take to heal?',
      answer:
        'Guided keyhole implant placement typically takes 30–45 minutes per implant with minimal post-operative discomfort. Biological osseointegration with the jawbone takes 8–12 weeks, during which a temporary aesthetic tooth can be worn before your final monolithic zirconia crown is secured.',
    },
    {
      category: 'Booking & General Care',
      question: 'Why is an international E.164 mobile number mandatory when booking?',
      answer:
        'Your mobile number (stored in international E.164 format such as +92... or +1...) is required to deliver instant appointment confirmations, payment verification updates, automated 1-hour pre-appointment reminders, and rescheduling notifications. If your number is not on WhatsApp, we retain it for SMS or phone call contact.',
    },
  ];

  const categories = [
    'all',
    'Booking & General Care',
    'Payments & Verification',
    'Clinical Comfort & Sterilization',
    'Cosmetic & Implant Procedures',
  ];

  const filteredFaqs = comprehensiveFaqs.filter((item) => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-16 pb-20">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#03181b] text-white py-20">
        <img
          src="https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1920&auto=format&fit=crop&q=85"
          alt="Patient FAQ Knowledge Base"
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#021418]/95 via-[#021418]/85 to-[#072b30]/75" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-5">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a66b]/20 border border-[#c9a66b]/40 text-[#f7dfa7] text-xs font-bold uppercase tracking-widest">
            <HelpCircle className="w-3.5 h-3.5" />
            Patient Knowledge Base &amp; Clinical Policies
          </span>
          <h1 className="font-serif-heading text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight">
            Frequently Asked{' '}
            <span className="italic font-normal text-[#f7dfa7]">
              Clinical &amp; Booking Questions
            </span>
          </h1>
          <p className="text-base sm:text-lg text-[#d7ece9] max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about our painless procedures, 6-stage sterilization, local and international payment verification, and automated reminders.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto pt-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions (e.g. Easypaisa, veneers, sterilization, reminders)..."
              className="w-full rounded-full bg-white/10 backdrop-blur-md border border-white/25 px-6 py-3.5 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-[#c9a66b]"
            />
          </div>
        </div>
      </section>

      {/* CATEGORY TABS & ACCORDION LIST */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition ${
                activeCategory === cat
                  ? 'bg-[var(--teal)] text-white shadow-sm'
                  : 'bg-[var(--surf)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--teal)]'
              }`}
            >
              {cat === 'all' ? 'All Topics' : cat}
            </button>
          ))}
        </div>

        <div className="space-y-3.5">
          {filteredFaqs.map((faq) => (
            <details
              key={faq.question}
              open
              className="group bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 open:border-[var(--teal)] shadow-xs transition"
            >
              <summary className="font-semibold text-base sm:text-lg cursor-pointer list-none flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-[10px] font-bold uppercase tracking-wider">
                    {faq.category}
                  </span>
                  <div className="text-[var(--ink)]">{faq.question}</div>
                </div>
                <span className="text-[var(--teal)] text-2xl font-light group-open:rotate-45 transition-transform shrink-0">
                  +
                </span>
              </summary>
              <p className="text-sm text-[var(--mut)] mt-3 leading-relaxed border-t border-[var(--line)] pt-3">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="bg-gradient-to-r from-[#072b30] to-[#0e4f57] text-white rounded-3xl p-8 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="font-serif-heading text-2xl font-semibold">
              Ready to schedule your visit at {clinic.name}?
            </h3>
            <p className="text-xs sm:text-sm text-[#cde5e2]">
              Pick your real-time slot online or contact our reception team directly.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('book')}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-[#c9a66b] to-[#e0be84] text-[#062327] font-bold text-xs sm:text-sm shadow-md"
            >
              Book Appointment Now &rarr;
            </button>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="px-5 py-3 rounded-full border border-white/30 hover:bg-white/10 text-white font-semibold text-xs sm:text-sm"
            >
              Hours &amp; Contact Page
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
