'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  FileArchive,
  RefreshCw,
  Clock,
  History,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowLeft,
  Calendar,
  User,
  Hash,
} from 'lucide-react';
import Link from 'next/link';
import { createInvoiceRevisionAction, updateInvoiceStatus } from '@/app/actions/finance';
import { verifyInvoiceIntegrityAction } from '@/app/actions/invoice-signing-actions';

interface AdminInvoiceDetailProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    organizationId: string;
    status: string;
    currentVersion: number;
    isImmutable: boolean;
    signedAt: string | null;
    paymentToken: string;
    subtotal: number;
    taxTotal: number;
    total: number;
    amountPaid: number;
    dueDate: string | null;
    issuedAt: string | null;
    createdAt: string;
    customer: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string | null;
      phone?: string | null;
    };
    lines: Array<{
      id: string;
      description: string;
      quantity: number;
      unitCost: number;
    }>;
    taxes: Array<{
      id: string;
      name: string;
      jurisdiction: string;
      rate: number;
      amount: number;
    }>;
  };
  versions: Array<{
    id: string;
    versionNumber: number;
    canonicalDocumentHash: string;
    signedPdfHash: string | null;
    status: string;
    createdAt: string;
  }>;
  latestSignature: {
    id: string;
    signerName: string;
    signerEmail: string;
    signatureMethod: string;
    signatureTimestamp: string;
    canonicalDocumentHash: string;
    signedPdfHash: string;
    ipAddress: string;
    userAgent: string;
    timezone: string;
    sessionId?: string | null;
    requestId?: string | null;
    consentRecord: {
      consentTextVersion: string;
      consentedAt: string;
      ipAddress: string;
    };
  } | null;
  auditEvents: Array<{
    id: string;
    eventType: string;
    actorType: string;
    eventDetails: string;
    canonicalDocumentHash?: string | null;
    signedPdfHash?: string | null;
    ipAddress?: string | null;
    createdAt: string;
  }>;
}

export default function AdminInvoiceDetailClient({
  invoice,
  versions,
  latestSignature,
  auditEvents,
}: AdminInvoiceDetailProps) {
  const router = useRouter();

  // Active tab: 'overview' | 'revisions' | 'audit' | 'integrity'
  const [activeTab, setActiveTab] = useState<'overview' | 'revisions' | 'audit' | 'integrity'>('overview');

  // Live Integrity Verification State
  const [integrityReport, setIntegrityReport] = useState<any | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [integrityError, setIntegrityError] = useState<string | null>(null);

  // Revision Modal State
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionLines, setRevisionLines] = useState<Array<{ description: string; quantity: number; unitCost: number }>>(
    invoice.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitCost: l.unitCost }))
  );
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  // Run dynamic verification
  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    setIntegrityError(null);
    try {
      const report = await verifyInvoiceIntegrityAction(invoice.id, invoice.currentVersion);
      setIntegrityReport(report);
    } catch (err: any) {
      setIntegrityError(err.message || 'Integrity check failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleAddLineItem = () => {
    setRevisionLines([...revisionLines, { description: '', quantity: 1, unitCost: 0 }]);
  };

  const handleRemoveLineItem = (index: number) => {
    setRevisionLines(revisionLines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: string, val: any) => {
    const updated = [...revisionLines];
    (updated[index] as any)[field] = val;
    setRevisionLines(updated);
  };

  const handleCreateRevision = async () => {
    if (!revisionReason.trim()) {
      setRevisionError('A reason for revision is required for the audit record.');
      return;
    }
    if (revisionLines.length === 0) {
      setRevisionError('At least one line item is required.');
      return;
    }

    setRevisionLoading(true);
    setRevisionError(null);

    try {
      await createInvoiceRevisionAction(invoice.id, revisionReason, revisionLines);
      setIsRevisionModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setRevisionError(err.message || 'Failed to create revision.');
    } finally {
      setRevisionLoading(false);
    }
  };

  const isSigned = invoice.status === 'SIGNED' || invoice.isImmutable;
  const balanceDue = invoice.total - invoice.amountPaid;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Back Navigation */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="w-4 h-4" />
        <Link href="/dashboard/invoices">Back to Invoices</Link>
      </div>

      {/* Header & Quick Action Bar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              Invoice #{invoice.invoiceNumber}
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-mono font-semibold bg-neutral-100 text-neutral-800 border border-neutral-200">
              Version {invoice.currentVersion}
            </span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                isSigned
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {invoice.status.replace('_', ' ')}
            </span>
            {invoice.isImmutable && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-900 text-white flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                IMMUTABLE RECORD
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            Customer: {invoice.customer.firstName} {invoice.customer.lastName} • Issued:{' '}
            {new Date(invoice.issuedAt || invoice.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Download Signed PDF */}
          {isSigned && (
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition"
            >
              <Download className="w-4 h-4 text-neutral-500" />
              Download PDF
            </a>
          )}

          {/* Export Evidence Package */}
          {isSigned && (
            <a
              href={`/api/invoices/${invoice.id}/evidence`}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition"
            >
              <FileArchive className="w-4 h-4 text-neutral-500" />
              Export Evidence (ZIP)
            </a>
          )}

          {/* Create Revised Version (Refinement #3 & #12) */}
          {isSigned ? (
            <button
              onClick={() => setIsRevisionModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 shadow-sm transition"
            >
              <History className="w-4 h-4" />
              Create Revised Version (v{invoice.currentVersion + 1})
            </button>
          ) : (
            <button
              onClick={() => setIsRevisionModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 shadow-sm transition"
            >
              Edit Line Items
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          Invoice Overview
        </button>
        <button
          onClick={() => {
            setActiveTab('integrity');
            if (!integrityReport) handleVerifyIntegrity();
          }}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition ${
            activeTab === 'integrity'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Document Integrity
        </button>
        <button
          onClick={() => setActiveTab('revisions')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'revisions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          Revision History ({versions.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          Audit Timeline ({auditEvents.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Line Items Card */}
          <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="text-base font-semibold text-neutral-900">Line Items & Summary</h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase">
                  <th className="pb-3">Description</th>
                  <th className="pb-3 text-right">Qty</th>
                  <th className="pb-3 text-right">Unit Price</th>
                  <th className="pb-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {invoice.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-3 font-medium text-neutral-900">{l.description}</td>
                    <td className="py-3 text-right text-neutral-600">{l.quantity.toFixed(2)}</td>
                    <td className="py-3 text-right text-neutral-600">${l.unitCost.toFixed(2)}</td>
                    <td className="py-3 text-right font-semibold text-neutral-900">
                      ${(l.quantity * l.unitCost).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-neutral-200 pt-4 flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal:</span>
                  <span>${invoice.subtotal.toFixed(2)}</span>
                </div>
                {invoice.taxes.map((t) => (
                  <div key={t.id} className="flex justify-between text-neutral-600">
                    <span>
                      {t.name} ({(t.rate * 100).toFixed(1)}%):
                    </span>
                    <span>${t.amount.toFixed(2)}</span>
                  </div>
                ))}
                {invoice.amountPaid > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Amount Paid:</span>
                    <span>-${invoice.amountPaid.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base text-neutral-900 pt-2 border-t border-neutral-200">
                  <span>Total Due:</span>
                  <span>${Math.max(0, balanceDue).toFixed(2)} CAD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Signature & Customer Details */}
          <div className="space-y-6">
            {/* Signature Record Card */}
            {latestSignature ? (
              <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Electronic Signature
                </div>
                <div className="space-y-2 text-xs text-neutral-600">
                  <div>
                    <span className="font-semibold text-neutral-700">Signer: </span>
                    {latestSignature.signerName} ({latestSignature.signerEmail})
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-700">Timestamp: </span>
                    {new Date(latestSignature.signatureTimestamp).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-700">Method: </span>
                    {latestSignature.signatureMethod}
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-700">Consent Text: </span>
                    Version {latestSignature.consentRecord.consentTextVersion}
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-700">IP Address: </span>
                    <span className="font-mono text-neutral-500">{latestSignature.ipAddress}</span>
                  </div>
                  <div className="pt-2">
                    <span className="font-semibold text-neutral-700 block mb-1">Canonical Hash:</span>
                    <span className="font-mono text-[10px] text-neutral-500 break-all block bg-neutral-50 p-1.5 rounded border border-neutral-200">
                      {latestSignature.canonicalDocumentHash}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm space-y-2 text-center">
                <Clock className="w-8 h-8 text-neutral-400 mx-auto" />
                <h4 className="text-sm font-semibold text-neutral-900">Unsigned Invoice</h4>
                <p className="text-xs text-neutral-500">
                  This invoice is awaiting electronic consent and signature from the customer.
                </p>
              </div>
            )}

            {/* Customer Details Card */}
            <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm space-y-3 text-sm">
              <h4 className="font-semibold text-neutral-900">Customer Information</h4>
              <div className="text-xs text-neutral-600 space-y-1">
                <p className="font-medium text-neutral-800">
                  {invoice.customer.firstName} {invoice.customer.lastName}
                </p>
                {invoice.customer.email && <p>{invoice.customer.email}</p>}
                {invoice.customer.phone && <p>{invoice.customer.phone}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DOCUMENT INTEGRITY VERIFICATION (Refinement #10) */}
      {activeTab === 'integrity' && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Cryptographic Document Integrity</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Dynamically verifies that canonical snapshots and stored PDF artifacts match their recorded SHA-256 hashes.
              </p>
            </div>
            <button
              onClick={handleVerifyIntegrity}
              disabled={verifying}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
              Re-verify Now
            </button>
          </div>

          {verifying && (
            <div className="p-8 text-center text-sm text-neutral-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              Recalculating SHA-256 cryptographic hashes from storage...
            </div>
          )}

          {integrityError && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{integrityError}</span>
            </div>
          )}

          {integrityReport && !verifying && (
            <div className="space-y-6">
              {/* Overall Status Banner */}
              <div
                className={`p-4 rounded-xl flex items-center justify-between border ${
                  integrityReport.overallStatus === 'VERIFIED'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  {integrityReport.overallStatus === 'VERIFIED' ? (
                    <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="w-6 h-6 text-red-600" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm tracking-wide">
                      DOCUMENT INTEGRITY: {integrityReport.overallStatus}
                    </h4>
                    <p className="text-xs opacity-80">
                      {integrityReport.overallStatus === 'VERIFIED'
                        ? 'All cryptographic signatures and stored artifacts are verified authentic and unaltered.'
                        : 'Tamper warning: One or more hashes do not match the recorded evidence!'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono opacity-70">
                  Verified: {new Date(integrityReport.verifiedAt).toLocaleTimeString()}
                </span>
              </div>

              {/* Two-Tier Hash Inspection Grid (Refinement #4) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Canonical Snapshot Hash */}
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                      1. Canonical Snapshot Hash
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        integrityReport.canonicalIntegrity.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {integrityReport.canonicalIntegrity.status}
                    </span>
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="text-neutral-500">Recorded Hash:</p>
                    <p className="font-mono text-[11px] text-neutral-800 break-all bg-white p-1.5 rounded border border-neutral-200">
                      {integrityReport.canonicalIntegrity.recordedHash}
                    </p>
                    <p className="text-neutral-500 pt-1">Computed Hash:</p>
                    <p className="font-mono text-[11px] text-neutral-800 break-all bg-white p-1.5 rounded border border-neutral-200">
                      {integrityReport.canonicalIntegrity.computedHash}
                    </p>
                  </div>
                </div>

                {/* 2. Stored PDF Hash */}
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                      2. Stored PDF Hash
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        integrityReport.pdfIntegrity?.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : integrityReport.pdfIntegrity
                          ? 'bg-red-100 text-red-700'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {integrityReport.pdfIntegrity ? integrityReport.pdfIntegrity.status : 'NOT GENERATED'}
                    </span>
                  </div>
                  {integrityReport.pdfIntegrity ? (
                    <div className="text-xs space-y-1">
                      <p className="text-neutral-500">Recorded PDF Hash:</p>
                      <p className="font-mono text-[11px] text-neutral-800 break-all bg-white p-1.5 rounded border border-neutral-200">
                        {integrityReport.pdfIntegrity.recordedPdfHash}
                      </p>
                      <p className="text-neutral-500 pt-1">Computed Buffer Hash:</p>
                      <p className="font-mono text-[11px] text-neutral-800 break-all bg-white p-1.5 rounded border border-neutral-200">
                        {integrityReport.pdfIntegrity.computedPdfHash}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400 italic pt-2">
                      PDF snapshot will be sealed upon customer signature.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REVISION HISTORY (Refinement #9 & #12) */}
      {activeTab === 'revisions' && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-neutral-900">All Invoice Versions</h3>
          <p className="text-xs text-neutral-500">
            Every signed version is preserved permanently as an audit artifact and cannot be overwritten.
          </p>

          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg overflow-hidden">
            {versions.map((ver) => (
              <div key={ver.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-900">Version {ver.versionNumber}</span>
                    {ver.versionNumber === invoice.currentVersion && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">
                        CURRENT ACTIVE
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        ver.status === 'SIGNED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : ver.status === 'SUPERSEDED'
                          ? 'bg-neutral-100 text-neutral-600 border-neutral-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {ver.status}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 font-mono truncate max-w-md">
                    Hash: {ver.canonicalDocumentHash}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400">
                    {new Date(ver.createdAt).toLocaleDateString()}
                  </span>
                  {ver.signedPdfHash && (
                    <a
                      href={`/api/invoices/${invoice.id}/pdf?version=${ver.versionNumber}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 text-xs font-medium text-neutral-700 border border-neutral-300 rounded hover:bg-neutral-100"
                    >
                      View PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT TIMELINE (Refinement #10) */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-neutral-900">Chronological Audit Timeline</h3>
          <p className="text-xs text-neutral-500">
            Immutable, append-only chronological log of all lifecycle, consent, and signature events.
          </p>

          <div className="space-y-4 pt-2">
            {auditEvents.map((evt, idx) => (
              <div key={evt.id} className="flex items-start gap-3 text-sm relative">
                <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-50 flex-shrink-0" />
                <div className="flex-1 bg-neutral-50 p-3.5 rounded-lg border border-neutral-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900 text-xs">{evt.eventType}</span>
                    <span className="text-[11px] text-neutral-400">
                      {new Date(evt.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600 mt-1">
                    <span className="font-medium text-neutral-700">Actor:</span> {evt.actorType}
                    {evt.ipAddress && (
                      <span className="ml-3 font-mono text-[11px] text-neutral-400">IP: {evt.ipAddress}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono mt-1 break-all">
                    {evt.eventDetails}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE REVISION MODAL (Refinement #3 & #12) */}
      {isRevisionModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">
                {isSigned
                  ? `Create Revised Invoice Version (v${invoice.currentVersion + 1})`
                  : 'Edit Invoice Lines'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                {isSigned
                  ? 'Version 1 is signed and immutable. Creating a revision preserves Version 1 intact and initializes Version 2 for new review and signature.'
                  : 'Update line items for this draft invoice.'}
              </p>
            </div>

            {/* Reason for revision */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                Reason for Revision (Required for Audit Record)
              </label>
              <input
                type="text"
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="e.g. Scope adjustment requested by customer, added parts..."
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Line Items Editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700 uppercase">Line Items</span>
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {revisionLines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                    placeholder="Description"
                    className="flex-1 px-3 py-1.5 text-sm border border-neutral-300 rounded-lg"
                  />
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(e) => handleLineChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    placeholder="Qty"
                    className="w-20 px-2 py-1.5 text-sm border border-neutral-300 rounded-lg text-right"
                  />
                  <input
                    type="number"
                    value={line.unitCost}
                    onChange={(e) => handleLineChange(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                    placeholder="Price"
                    className="w-24 px-2 py-1.5 text-sm border border-neutral-300 rounded-lg text-right"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveLineItem(idx)}
                    className="text-red-500 hover:text-red-700 text-sm px-1.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {revisionError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {revisionError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setIsRevisionModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateRevision}
                disabled={revisionLoading}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {revisionLoading ? 'Creating Revision...' : 'Confirm & Create Revision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
