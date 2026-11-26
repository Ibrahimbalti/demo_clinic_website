import React, { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Play,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useClinicStore } from '../../hooks/useClinicStore';
import {
  processPatientMessageWithAI,
  resetAISessionDraft,
  type AIToolExecutionResult,
} from '../../lib/aiReceptionistEngine';

interface SandboxTurn {
  id: string;
  sender: 'patient' | 'ai';
  text: string;
  tools?: AIToolExecutionResult[];
}

export const AISettingsAndTestView: React.FC = () => {
  const { state, store } = useClinicStore();
  const { aiConfig } = state;

  const [enabled, setEnabled] = useState(aiConfig.enabled);
  const [assistantName, setAssistantName] = useState(aiConfig.assistantName);
  const [welcomeMessage, setWelcomeMessage] = useState(aiConfig.welcomeMessage);
  const [language, setLanguage] = useState(aiConfig.language);
  const [toneOfVoice, setToneOfVoice] = useState(aiConfig.toneOfVoice);
  const [systemPrompt, setSystemPrompt] = useState(aiConfig.systemPrompt);
  const [emergencyMessage, setEmergencyMessage] = useState(
    aiConfig.emergencyResponseMessage
  );
  const [savedBanner, setSavedBanner] = useState(false);

  // AI Testing Sandbox state
  const [sandboxPhone] = useState('+15550009999');
  const [sandboxInput, setSandboxInput] = useState('');
  const [sandboxTurns, setSandboxTurns] = useState<SandboxTurn[]>([
    {
      id: 'init',
      sender: 'ai',
      text: aiConfig.welcomeMessage,
    },
  ]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateAIConfiguration({
      enabled,
      assistantName,
      welcomeMessage,
      language,
      toneOfVoice,
      systemPrompt,
      emergencyResponseMessage: emergencyMessage,
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  const handleSendSandbox = (textToProcess: string) => {
    if (!textToProcess.trim()) return;
    const userTurn: SandboxTurn = {
      id: `u_${Date.now()}`,
      sender: 'patient',
      text: textToProcess.trim(),
    };

    const res = processPatientMessageWithAI({
      patientPhone: sandboxPhone,
      messageText: textToProcess.trim(),
    });

    const aiTurn: SandboxTurn = {
      id: `a_${Date.now() + 1}`,
      sender: 'ai',
      text: res.reply || '[AI Paused — Handed over to human receptionist]',
      tools: res.toolsExecuted,
    };

    setSandboxTurns((prev) => [...prev, userTurn, aiTurn]);
    setSandboxInput('');
  };

  const handleResetSandbox = () => {
    resetAISessionDraft(sandboxPhone);
    setSandboxTurns([
      {
        id: `init_${Date.now()}`,
        sender: 'ai',
        text: welcomeMessage,
      },
    ]);
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6 items-start">
      {/* Left 7 Cols: AI Receptionist Configuration Form */}
      <form
        onSubmit={handleSaveConfig}
        className="lg:col-span-7 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-5 shadow-xs"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div>
            <h3 className="font-serif-heading text-xl font-semibold flex items-center gap-2">
              <Bot className="w-5 h-5 text-[var(--teal)]" />
              <span>AI Receptionist Configuration</span>
            </h3>
            <p className="text-xs text-[var(--mut)]">
              Configure OpenAI tool-calling behavior, medical safety guardrails, and verified clinic rules.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-checked:bg-emerald-600 rounded-full relative transition">
              <div
                className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </div>
            <span className="text-xs font-bold">
              {enabled ? 'AI Enabled' : 'AI Disabled'}
            </span>
          </label>
        </div>

        {savedBanner && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>AI Receptionist settings saved and applied immediately.</span>
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">
              Assistant Name
            </label>
            <input
              type="text"
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">
              Primary Language
            </label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">
              Tone of Voice
            </label>
            <input
              type="text"
              value={toneOfVoice}
              onChange={(e) => setToneOfVoice(e.target.value)}
              className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1">
            Welcome Message
          </label>
          <textarea
            rows={2}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1">
            System Instructions &amp; Tool-Calling Guardrails
          </label>
          <textarea
            rows={4}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2 text-sm font-mono text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-red-700 dark:text-red-400 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Emergency Medical Safety Response Message</span>
          </label>
          <textarea
            rows={2}
            value={emergencyMessage}
            onChange={(e) => setEmergencyMessage(e.target.value)}
            className="w-full rounded-xl border border-red-400/50 bg-red-500/5 px-3.5 py-2 text-xs"
          />
        </div>

        {/* 12 Backend-Validated AI Tools Reference */}
        <div className="p-4 rounded-xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-2">
          <div className="text-xs font-bold flex items-center gap-1.5 text-[var(--teal)]">
            <Wrench className="w-4 h-4" />
            <span>12 Registered Backend-Controlled AI Functions (Zod Validated)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              'getClinicInformation()',
              'getClinicOpeningHours()',
              'getClinicServices()',
              'getAvailableDoctors()',
              'getDoctorDetails()',
              'getAvailableSlots()',
              'createAppointment()',
              'getAppointmentDetails()',
              'cancelAppointment()',
              'rescheduleAppointment()',
              'transferToHuman()',
              'getPatientAppointmentHistory()',
            ].map((fn) => (
              <span
                key={fn}
                className="px-2.5 py-1 rounded-lg bg-[var(--surf)] border border-[var(--line)] font-mono text-[11px] font-semibold"
              >
                {fn}
              </span>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="px-6 py-3 rounded-xl bg-[var(--teal)] hover:bg-[var(--teal-light)] text-white font-bold text-sm flex items-center gap-2 transition"
        >
          <Save className="w-4 h-4" />
          <span>Save AI Receptionist Configuration</span>
        </button>
      </form>

      {/* Right 5 Cols: Live AI Conversation & Tool-Calling Testing Sandbox */}
      <div className="lg:col-span-5 bg-[var(--surf)] border border-[var(--line)] rounded-2xl shadow-xs flex flex-col h-[680px] overflow-hidden">
        <div className="p-4 bg-[#072b30] text-white flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#f7dfa7]" />
              <span>AI Receptionist Testing Sandbox</span>
            </h4>
            <p className="text-[11px] text-[#b7dbd7]">
              Test multi-turn booking, tool execution, and medical safety guardrails
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetSandbox}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Session</span>
          </button>
        </div>

        {/* Quick Walkthrough Step Buttons */}
        <div className="p-2.5 bg-[var(--surf-alt)] border-b border-[var(--line)] flex flex-wrap gap-1.5">
          {[
            { label: '1. Book Appt', text: 'Hello, I want to book an appointment.' },
            { label: '2. Name: Ahmed', text: 'My name is Ahmed' },
            { label: '3. Dental checkup', text: 'Dental checkup' },
            { label: '4. Any doctor', text: 'Any available doctor' },
            { label: '5. Tomorrow', text: 'Tomorrow' },
            { label: '6. Pick Slot 1', text: '1' },
            { label: '7. Confirm Yes', text: 'Yes' },
            { label: 'Test Emergency Safety', text: 'I am bleeding heavily and cannot breathe' },
          ].map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={() => handleSendSandbox(btn.text)}
              className="px-2.5 py-1 rounded-lg bg-[var(--surf)] border border-[var(--line-strong)] hover:border-[var(--teal)] text-[11px] font-semibold transition"
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Sandbox Transcript */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg)]">
          {sandboxTurns.map((turn) => (
            <div
              key={turn.id}
              className={`flex flex-col ${
                turn.sender === 'patient' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[90%] rounded-2xl p-3 text-xs space-y-2 ${
                  turn.sender === 'patient'
                    ? 'bg-[var(--teal)] text-white rounded-tr-xs'
                    : 'bg-[var(--surf)] border border-[var(--line)] text-[var(--ink)] rounded-tl-xs shadow-2xs'
                }`}
              >
                <div className="whitespace-pre-line leading-relaxed">{turn.text}</div>

                {turn.tools && turn.tools.length > 0 && (
                  <div className="pt-2 border-t border-[var(--line)] space-y-1.5">
                    {turn.tools.map((t, i) => (
                      <div
                        key={`${t.toolName}_${i}`}
                        className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 font-mono text-[10px] text-emerald-950 dark:text-emerald-200"
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>⚡ {t.toolName}()</span>
                          <span className="text-emerald-600">✓ Zod Validated</span>
                        </div>
                        <div className="truncate opacity-80">
                          Args: {JSON.stringify(t.args)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendSandbox(sandboxInput);
          }}
          className="p-3 bg-[var(--surf)] border-t border-[var(--line)] flex items-center gap-2"
        >
          <input
            type="text"
            value={sandboxInput}
            onChange={(e) => setSandboxInput(e.target.value)}
            placeholder="Type a patient message to test AI..."
            className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2 text-xs focus:outline-none focus:border-[var(--teal)]"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[var(--teal)] text-white font-bold text-xs flex items-center gap-1"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Test</span>
          </button>
        </form>
      </div>
    </div>
  );
};
