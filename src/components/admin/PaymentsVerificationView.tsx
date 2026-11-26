import React, { useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  FileCheck,
  RefreshCw,
  Save,
  ShieldAlert,
  Wallet,
  XCircle,
  Eye,
  Send,
} from 'lucide-react';
import { useClinicStore } from '../../hooks/useClinicStore';
import type { InternationalGatewayProvider } from '../../types/clinic';
import { formatDisplayTime } from '../../lib/availabilityEngine';

export const PaymentsVerificationView: React.FC = () => {
  const { state, store, currentUser } = useClinicStore();
  const {
    clinic,
    appointments,
    paymentVerificationRecords = [],
    notificationDeliveries = [],
  } = state;

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
    internationalGatewayProvider: 'safepay_pk' as InternationalGatewayProvider,
    hasEligibleInternationalMerchantAccount: false,
    currencyCode: 'USD',
  };

  // Admin decision reason inputs keyed by appointmentId
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Payment Settings Form State
  const [cashEnabled, setCashEnabled] = useState(paymentSettings.cashAtClinicEnabled);
  const [easypaisaEnabled, setEasypaisaEnabled] = useState(
    paymentSettings.manualEasypaisaEnabled
  );
  const [debitCreditEnabled, setDebitCreditEnabled] = useState(
    paymentSettings.debitCreditCardEnabled !== false
  );
  const [appleGooglePayEnabled, setAppleGooglePayEnabled] = useState(
    paymentSettings.appleGooglePayEnabled !== false
  );
  const [paypalEnabled, setPaypalEnabled] = useState(
    paymentSettings.paypalEnabled !== false
  );
  const [epNumber, setEpNumber] = useState(paymentSettings.easypaisaAccountNumber);
  const [epTitle, setEpTitle] = useState(paymentSettings.easypaisaAccountTitle);
  const [epInstructions, setEpInstructions] = useState(
    paymentSettings.easypaisaInstructions
  );
  const [intlEnabled, setIntlEnabled] = useState(
    paymentSettings.internationalCardEnabled
  );
  const [intlProvider, setIntlProvider] = useState<InternationalGatewayProvider>(
    paymentSettings.internationalGatewayProvider
  );
  const [hasEligibleForeignMerchant, setHasEligibleForeignMerchant] = useState(
    paymentSettings.hasEligibleInternationalMerchantAccount
  );

  const easypaisaAppointments = appointments.filter(
    (a) => a.paymentMethod === 'MANUAL_EASYPAISA' || a.paymentStatus === 'PENDING_VERIFICATION' || a.paymentStatus === 'REJECTED'
  );

  const handleApprove = (appointmentId: string, tid?: string | null) => {
    const reason =
      decisionReasons[appointmentId]?.trim() ||
      `Verified Easypaisa Transaction ID ${tid || 'receipt'} against clinic statement.`;
    const res = store.approveEasypaisaPayment({
      appointmentId,
      reason,
      adminName: currentUser?.fullName || 'Clinic Admin',
    });
    if (res.success) {
      setFeedbackBanner(
        `Approved payment for appointment ${appointmentId}: Marked PAID, confirmed appointment, created Google Calendar event, dispatched 3-way WhatsApp confirmations (Patient, Doctor, Clinic), and scheduled 1-hour reminder.`
      );
      setTimeout(() => setFeedbackBanner(null), 6000);
    }
  };

  const handleReject = (appointmentId: string) => {
    const reason =
      decisionReasons[appointmentId]?.trim() ||
      'Transaction ID or receipt screenshot could not be matched. Please upload a clear receipt.';
    const res = store.rejectEasypaisaPayment({
      appointmentId,
      reason,
      adminName: currentUser?.fullName || 'Clinic Admin',
    });
    if (res.success) {
      setFeedbackBanner(
        `Rejected receipt for appointment ${appointmentId}. Patient notified via WhatsApp and allowed to submit a new receipt.`
      );
      setTimeout(() => setFeedbackBanner(null), 6000);
    }
  };

  const handleSavePaymentSettings = (e: React.FormEvent) => {
    e.preventDefault();
    // Enforce Stripe/PayPal merchant eligibility rule
    let safeProvider = intlProvider;
    if (
      (intlProvider === 'stripe_eligible_merchant' ||
        intlProvider === 'paypal_eligible_merchant') &&
      !hasEligibleForeignMerchant
    ) {
      safeProvider = 'safepay_pk';
      setIntlProvider('safepay_pk');
    }

    store.updateClinicProfile({
      paymentSettings: {
        cashAtClinicEnabled: cashEnabled,
        manualEasypaisaEnabled: easypaisaEnabled,
        easypaisaAccountNumber: epNumber.trim(),
        easypaisaAccountTitle: epTitle.trim(),
        easypaisaInstructions: epInstructions.trim(),
        debitCreditCardEnabled: debitCreditEnabled,
        appleGooglePayEnabled,
        paypalEnabled,
        internationalCardEnabled: intlEnabled,
        internationalGatewayProvider: safeProvider,
        hasEligibleInternationalMerchantAccount: hasEligibleForeignMerchant,
        currencyCode: 'USD',
      },
    });
    setFeedbackBanner('Payment settings saved and updated on checkout immediately.');
    setTimeout(() => setFeedbackBanner(null), 4000);
  };

  return (
    <div className="space-y-6">
      {feedbackBanner && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      {/* 1. MANUAL EASYPAISA RECEIPT VERIFICATION QUEUE */}
      <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-serif-heading text-xl font-bold flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-[var(--teal)]" />
              <span>Manual Easypaisa Receipt Verification Queue</span>
            </h3>
            <p className="text-xs text-[var(--mut)]">
              Never auto-confirm based on an uploaded screenshot alone. Review the Transaction ID (TID) and receipt image before approving.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-bold">
            {
              appointments.filter((a) => a.paymentStatus === 'PENDING_VERIFICATION')
                .length
            }{' '}
            Pending Verification
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[var(--surf-alt)] border-b border-[var(--line)] text-[var(--mut)] uppercase">
                <th className="p-3.5">Patient (E.164)</th>
                <th className="p-3.5">Appointment &amp; Doctor</th>
                <th className="p-3.5">Method &amp; TID</th>
                <th className="p-3.5">Receipt</th>
                <th className="p-3.5">Payment &amp; Appt Status</th>
                <th className="p-3.5">Admin Decision Reason</th>
                <th className="p-3.5 text-right">Verify Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {easypaisaAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--mut)]">
                    No manual payment receipts pending verification.
                  </td>
                </tr>
              ) : (
                easypaisaAppointments.map((appt) => (
                  <tr key={appt.id}>
                    <td className="p-3.5">
                      <div className="font-bold text-sm">{appt.patientName}</div>
                      <div className="font-mono text-[var(--mut)]">
                        {appt.patientPhone}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold">{appt.serviceName}</div>
                      <div className="text-[var(--mut)]">
                        {appt.doctorName} · {appt.appointmentDate} at{' '}
                        {formatDisplayTime(appt.startTime)}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-[var(--teal)]">
                        {appt.paymentMethod}
                      </div>
                      <div className="font-mono text-[11px]">
                        TID: <strong>{appt.transactionReference || 'N/A'}</strong>
                      </div>
                    </td>
                    <td className="p-3.5">
                      {appt.receiptFileUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewReceiptUrl(appt.receiptFileUrl || null)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--teal-subtle)] text-[var(--teal)] font-bold text-[11px]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{appt.receiptFileName || 'View Receipt'}</span>
                        </button>
                      ) : (
                        <span className="text-[var(--mut)]">No file</span>
                      )}
                    </td>
                    <td className="p-3.5 space-y-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          appt.paymentStatus === 'PAID'
                            ? 'bg-emerald-500/15 text-emerald-700'
                            : appt.paymentStatus === 'REJECTED'
                            ? 'bg-red-500/15 text-red-700'
                            : 'bg-amber-500/20 text-amber-800'
                        }`}
                      >
                        Payment: {appt.paymentStatus}
                      </span>
                      <div className="text-[10px] font-semibold text-[var(--mut)]">
                        Appt: {appt.status}
                      </div>
                      {appt.paymentVerifiedByAdminName && (
                        <div className="text-[10px] text-[var(--teal)]">
                          By: {appt.paymentVerifiedByAdminName}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <input
                        type="text"
                        value={
                          decisionReasons[appt.id] ??
                          appt.paymentDecisionReason ??
                          ''
                        }
                        onChange={(e) =>
                          setDecisionReasons({
                            ...decisionReasons,
                            [appt.id]: e.target.value,
                          })
                        }
                        placeholder="Enter verification note/reason..."
                        className="w-48 rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-2.5 py-1.5 text-xs"
                      />
                    </td>
                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      {appt.paymentStatus !== 'PAID' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleApprove(appt.id, appt.transactionReference)
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                        >
                          ✓ Approve &amp; Confirm
                        </button>
                      )}
                      {appt.paymentStatus !== 'REJECTED' && (
                        <button
                          type="button"
                          onClick={() => handleReject(appt.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/25 text-red-700 font-bold text-[11px]"
                        >
                          ✕ Reject Receipt
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Image Preview Modal */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-5 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm">Submitted Payment Receipt</h4>
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="text-xs font-bold text-[var(--mut)]"
              >
                Close &times;
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-[var(--line)] max-h-96 bg-black/5 flex items-center justify-center">
              <img
                src={previewReceiptUrl}
                alt="Payment Receipt"
                className="max-h-96 object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. 3-WAY WHATSAPP NOTIFICATION DELIVERY TRACKER (PATIENT, DOCTOR, CLINIC) */}
      <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="font-serif-heading text-lg font-bold flex items-center gap-2">
            <Send className="w-4 h-4 text-[#25D366]" />
            <span>3-Way WhatsApp Delivery Tracker (Patient · Assigned Doctor · Clinic Admin)</span>
          </h3>
          <p className="text-xs text-[var(--mut)]">
            Tracks confirmation messages separately for each recipient with idempotency keys to prevent duplicates and retry failed messages.
          </p>
        </div>

        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[var(--surf-alt)] border-b border-[var(--line)] text-[var(--mut)] uppercase">
                <th className="p-3">Appointment</th>
                <th className="p-3">Recipient Role</th>
                <th className="p-3">Recipient &amp; E.164 Phone</th>
                <th className="p-3">Event Type</th>
                <th className="p-3">Delivery Status</th>
                <th className="p-3">Idempotency Key</th>
                <th className="p-3 text-right">Retry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {notificationDeliveries.map((nd) => (
                <tr key={nd.id}>
                  <td className="p-3 font-mono font-bold">{nd.appointmentId}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] font-bold uppercase text-[10px]">
                      {nd.recipientRole}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold">{nd.recipientName}</div>
                    <div className="font-mono text-[var(--mut)]">{nd.recipientPhone}</div>
                  </td>
                  <td className="p-3 font-mono text-[11px]">{nd.eventType}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        nd.deliveryStatus === 'delivered' || nd.deliveryStatus === 'sent'
                          ? 'bg-emerald-500/15 text-emerald-700'
                          : 'bg-red-500/15 text-red-700'
                      }`}
                    >
                      {nd.deliveryStatus} (Attempts: {nd.attempts})
                    </span>
                  </td>
                  <td className="p-3 font-mono text-[10px] text-[var(--mut)]">
                    {nd.idempotencyKey}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => store.retryWhatsAppRecipientDelivery(nd.id)}
                      className="px-2.5 py-1 rounded-lg border border-[var(--line-strong)] hover:border-[var(--teal)] text-[11px] font-semibold inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. PAYMENT SETTINGS & INTERNATIONAL GATEWAY CONFIGURATION + AUDIT TRAIL */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSavePaymentSettings}
          className="lg:col-span-7 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4"
        >
          <h3 className="font-serif-heading text-lg font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[var(--teal)]" />
            <span>Payment Methods, Manual Easypaisa &amp; International Gateway Settings</span>
          </h3>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <label className="p-3 rounded-xl border border-[var(--line)] bg-[var(--surf-alt)] flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={debitCreditEnabled}
                onChange={(e) => setDebitCreditEnabled(e.target.checked)}
              />
              <span>1. Debit &amp; Credit Cards (US/UK Priority)</span>
            </label>
            <label className="p-3 rounded-xl border border-[var(--line)] bg-[var(--surf-alt)] flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={appleGooglePayEnabled}
                onChange={(e) => setAppleGooglePayEnabled(e.target.checked)}
              />
              <span>2. Apple Pay &amp; Google Pay</span>
            </label>
            <label className="p-3 rounded-xl border border-[var(--line)] bg-[var(--surf-alt)] flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={paypalEnabled}
                onChange={(e) => setPaypalEnabled(e.target.checked)}
              />
              <span>3. PayPal (US/UK)</span>
            </label>
            <label className="p-3 rounded-xl border border-[var(--line)] bg-[var(--surf-alt)] flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={cashEnabled}
                onChange={(e) => setCashEnabled(e.target.checked)}
              />
              <span>4. Cash at Clinic (Pay at Clinic)</span>
            </label>
            <label className="p-3 rounded-xl border border-[var(--line)] bg-[var(--surf-alt)] flex items-center gap-2 font-bold cursor-pointer sm:col-span-2">
              <input
                type="checkbox"
                checked={easypaisaEnabled}
                onChange={(e) => setEasypaisaEnabled(e.target.checked)}
              />
              <span>5. Manual Easypaisa (Receipt &amp; TID Verification)</span>
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold block mb-1">
                Easypaisa Account Number (Displayed at Checkout)
              </label>
              <input
                type="text"
                value={epNumber}
                onChange={(e) => setEpNumber(e.target.value)}
                className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2 font-mono"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">
                Easypaisa Account Holder Name / Title
              </label>
              <input
                type="text"
                value={epTitle}
                onChange={(e) => setEpTitle(e.target.value)}
                className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="font-bold block mb-1">
              Manual Easypaisa Checkout Instructions
            </label>
            <textarea
              rows={2}
              value={epInstructions}
              onChange={(e) => setEpInstructions(e.target.value)}
              className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-2"
            />
          </div>

          {/* International Payment Gateway Compliance Box */}
          <div className="p-4 rounded-xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-3 text-xs">
            <div className="font-bold flex items-center gap-1.5 text-[var(--teal)]">
              <CreditCard className="w-4 h-4" />
              <span>International Online Card Payment Gateway (Pakistani &amp; Global Compliance)</span>
            </div>
            <p className="text-[11px] text-[var(--mut)] leading-relaxed">
              <strong>Compliance Notice:</strong> Do not assume a domestic Pakistani merchant account can use PayPal or Stripe. For Pakistani businesses accepting domestic and international Visa/Mastercard payments, use an SBP-compliant gateway (<strong>Safepay Pakistan</strong>, <strong>PayFast Pakistan</strong>, or <strong>2Checkout / Verifone</strong>). Stripe or PayPal may only be enabled if the clinic holds an eligible foreign merchant entity.
            </p>

            <label className="flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={hasEligibleForeignMerchant}
                onChange={(e) => setHasEligibleForeignMerchant(e.target.checked)}
              />
              <span>
                Clinic holds an eligible non-Pakistani / international merchant entity &amp; bank account (unlocks Stripe / PayPal options)
              </span>
            </label>

            <div>
              <label className="font-bold block mb-1">
                Active International Card Gateway Provider
              </label>
              <select
                value={intlProvider}
                onChange={(e) =>
                  setIntlProvider(e.target.value as InternationalGatewayProvider)
                }
                className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surf)] px-3.5 py-2 font-semibold"
              >
                <option value="safepay_pk">
                  Safepay Pakistan (Recommended — Supports Pakistani Businesses &amp; Intl Visa/Mastercard)
                </option>
                <option value="payfast_pk">
                  PayFast Pakistan (SBP-Licensed Pakistani PSO/PSP — Intl Visa/Mastercard)
                </option>
                <option value="2checkout_verifone">
                  2Checkout (Verifone) — Merchant of Record for Pakistani Businesses
                </option>
                <option
                  value="stripe_eligible_merchant"
                  disabled={!hasEligibleForeignMerchant}
                >
                  Stripe (Requires Eligible Foreign Merchant Account){' '}
                  {!hasEligibleForeignMerchant ? '— Locked' : ''}
                </option>
                <option
                  value="paypal_eligible_merchant"
                  disabled={!hasEligibleForeignMerchant}
                >
                  PayPal (Requires Eligible Foreign Merchant Account){' '}
                  {!hasEligibleForeignMerchant ? '— Locked' : ''}
                </option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[var(--teal)] text-white font-bold text-xs flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Payment Configuration</span>
          </button>
        </form>

        {/* Payment Verification Decision Audit Log */}
        <div className="lg:col-span-5 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 space-y-4">
          <h3 className="font-serif-heading text-lg font-bold">
            Payment Verification Audit Records
          </h3>
          <p className="text-xs text-[var(--mut)]">
            Immutable record of administrator, timestamp, transaction reference, and reason for every payment decision.
          </p>
          <div className="space-y-2.5 max-h-96 overflow-y-auto text-xs">
            {paymentVerificationRecords.map((rec) => (
              <div
                key={rec.id}
                className="p-3 rounded-xl bg-[var(--surf-alt)] border border-[var(--line)] space-y-1"
              >
                <div className="flex items-center justify-between font-bold">
                  <span
                    className={
                      rec.decision === 'APPROVED'
                        ? 'text-emerald-600'
                        : rec.decision === 'REJECTED'
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }
                  >
                    {rec.decision} · Appt #{rec.appointmentId}
                  </span>
                  <span className="text-[10px] text-[var(--mut)]">
                    {new Date(rec.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-[11px]">
                  <strong>TID:</strong> <span className="font-mono">{rec.transactionReference || 'N/A'}</span> ·{' '}
                  <strong>By:</strong> {rec.adminName}
                </div>
                <div className="text-[11px] text-[var(--mut)]">
                  <strong>Reason:</strong> {rec.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
