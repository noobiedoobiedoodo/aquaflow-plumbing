'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileCheck,
  Download,
  Printer,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { recordElectronicConsentAction, signInvoiceAction } from '@/app/actions/invoice-signing-actions';

interface InvoiceSigningClientProps {
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
    organization: {
      name: string;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      city?: string | null;
      province?: string | null;
      postalCode?: string | null;
    };
    customer: {
      firstName: string;
      lastName: string;
      email?: string | null;
      phone?: string | null;
    };
  };
  version: {
    versionNumber: number;
    canonicalDocumentHash: string;
    signedPdfHash: string | null;
    status: string;
    snapshotData: any;
  };
  signature: {
    id: string;
    signerName: string;
    signerEmail: string;
    signatureMethod: string;
    signatureTimestamp: string;
    canonicalDocumentHash: string;
    signedPdfHash: string;
  } | null;
}

export default function InvoiceSigningClient({
  invoice,
  version,
  signature,
}: InvoiceSigningClientProps) {
  const router = useRouter();

  const isSigned = invoice.status === 'SIGNED' || version.status === 'SIGNED' || !!signature;

  // Unsigned Form States
  const [consentChecked, setConsentChecked] = useState(false);
  const [signerName, setSignerName] = useState(`${invoice.customer.firstName} ${invoice.customer.lastName}`.trim());
  const [signerEmail, setSignerEmail] = useState(invoice.customer.email || '');
  const [signatureMethod, setSignatureMethod] = useState<'TYPED' | 'DRAWN_CANVAS'>('TYPED');
  const [typedSignature, setTypedSignature] = useState(signerName);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Canvas ref for drawn signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasHasDrawn, setCanvasHasDrawn] = useState(false);

  // Drawing canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setCanvasHasDrawn(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setCanvasHasDrawn(false);
  };

  const handleSignAndAccept = async () => {
    if (!consentChecked) {
      setErrorMessage('You must check the electronic consent checkbox before signing.');
      return;
    }
    if (!signerName.trim()) {
      setErrorMessage('Please enter your full legal name.');
      return;
    }
    if (!signerEmail.trim() || !signerEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    let signatureData: string | null = null;
    if (signatureMethod === 'DRAWN_CANVAS') {
      if (!canvasHasDrawn || !canvasRef.current) {
        setErrorMessage('Please draw your signature on the pad provided.');
        return;
      }
      signatureData = canvasRef.current.toDataURL('image/png');
    } else {
      signatureData = `TYPED:${typedSignature || signerName}`;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // Step 1: Record affirmative statutory consent
      const consentRes = await recordElectronicConsentAction(
        invoice.id,
        version.versionNumber,
        true,
        invoice.paymentToken
      );

      // Step 2: Sign invoice version atomically with hash verification
      const signRes = await signInvoiceAction(
        invoice.id,
        version.versionNumber,
        consentRes.consentRecordId,
        signerName,
        signerEmail,
        signatureMethod,
        signatureData,
        invoice.paymentToken
      );

      if (signRes.success) {
        setSuccessMessage('Invoice successfully signed and verified. Generating permanent record...');
        setTimeout(() => {
          router.refresh();
        }, 800);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while signing the invoice.');
    } finally {
      setLoading(false);
    }
  };

  const snapshot = version.snapshotData;
  const balanceDue = invoice.total - invoice.amountPaid;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 print:p-0 print:m-0 print:max-w-none">
      {/* Top Banner: Status & Actions */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              Invoice #{invoice.invoiceNumber}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
              Version {version.versionNumber}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                isSigned
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {isSigned ? 'SIGNED' : 'AWAITING SIGNATURE'}
            </span>
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            Issued by {invoice.organization.name} on{' '}
            {new Date(snapshot.issueDate || invoice.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isSigned && (
            <>
              <a
                href={`/api/invoices/${invoice.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition"
              >
                <Download className="w-4 h-4 text-neutral-500" />
                Download PDF
              </a>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition"
              >
                <Printer className="w-4 h-4 text-neutral-500" />
                Print
              </button>
            </>
          )}

          {balanceDue > 0 && (
            <a
              href={`/pay/${invoice.paymentToken}`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition"
            >
              <CreditCard className="w-4 h-4" />
              Pay Balance (${balanceDue.toFixed(2)})
            </a>
          )}
        </div>
      </div>

      {/* Main Document Body (Clean Business Invoice Paper) */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-8 md:p-12 print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 pb-8 border-b border-neutral-100">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">{invoice.organization.name}</h2>
            <div className="text-sm text-neutral-500 mt-1 space-y-0.5">
              {invoice.organization.address && <p>{invoice.organization.address}</p>}
              <p>
                {[invoice.organization.city, invoice.organization.province, invoice.organization.postalCode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {invoice.organization.phone && <p>Tel: {invoice.organization.phone}</p>}
              {invoice.organization.email && <p>{invoice.organization.email}</p>}
            </div>
          </div>

          <div className="text-right">
            <h3 className="text-2xl font-bold text-neutral-900 tracking-tight">INVOICE</h3>
            <p className="text-sm font-mono text-neutral-500 mt-0.5">#{invoice.invoiceNumber}</p>
            <div className="text-xs text-neutral-500 mt-3 space-y-1">
              <div>
                <span className="font-medium text-neutral-700">Date: </span>
                {new Date(snapshot.issueDate || invoice.createdAt).toLocaleDateString()}
              </div>
              <div>
                <span className="font-medium text-neutral-700">Due: </span>
                {snapshot.dueDate ? new Date(snapshot.dueDate).toLocaleDateString() : 'Upon Receipt'}
              </div>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="py-6 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Billed To</p>
          <p className="text-base font-semibold text-neutral-900 mt-1">
            {snapshot.customerName || `${invoice.customer.firstName} ${invoice.customer.lastName}`}
          </p>
          {snapshot.customerEmail && <p className="text-sm text-neutral-500">{snapshot.customerEmail}</p>}
        </div>

        {/* Itemized Table */}
        <div className="py-6">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                <th className="pb-3">Description</th>
                <th className="pb-3 text-right">Qty</th>
                <th className="pb-3 text-right">Unit Price</th>
                <th className="pb-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {snapshot.lines &&
                snapshot.lines.map((item: any, idx: number) => (
                  <tr key={idx} className="py-3">
                    <td className="py-3 text-neutral-900 font-medium">{item.description}</td>
                    <td className="py-3 text-right text-neutral-600">{item.quantity.toFixed(2)}</td>
                    <td className="py-3 text-right text-neutral-600">${item.unitCost.toFixed(2)}</td>
                    <td className="py-3 text-right text-neutral-900 font-semibold">${item.total.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Financial Totals */}
        <div className="flex justify-end pt-4 border-t border-neutral-100">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span>${snapshot.subtotal.toFixed(2)}</span>
            </div>
            {snapshot.taxes &&
              snapshot.taxes.map((t: any, idx: number) => (
                <div key={idx} className="flex justify-between text-neutral-600">
                  <span>
                    {t.name} ({(t.rate * 100).toFixed(1)}%)
                  </span>
                  <span>${t.amount.toFixed(2)}</span>
                </div>
              ))}
            {invoice.amountPaid > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium pt-1">
                <span>Amount Paid</span>
                <span>-${invoice.amountPaid.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg text-neutral-900 pt-3 border-t border-neutral-200">
              <span>Balance Due</span>
              <span>${Math.max(0, balanceDue).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Signed Artifact Display: Shown when invoice is SIGNED */}
        {isSigned && (
          <div className="mt-10 p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                FlowLoopOS Verified Electronic Signature
              </div>
              <span className="text-xs font-mono text-neutral-500">
                {signature?.id || 'Recorded & Sealed'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-neutral-600 pt-2 border-t border-slate-200">
              <div>
                <span className="font-semibold text-neutral-700">Signed By: </span>
                {signature?.signerName || `${invoice.customer.firstName} ${invoice.customer.lastName}`} (
                {signature?.signerEmail || invoice.customer.email})
              </div>
              <div>
                <span className="font-semibold text-neutral-700">Date & Time: </span>
                {signature
                  ? new Date(signature.signatureTimestamp).toLocaleString()
                  : invoice.signedAt
                  ? new Date(invoice.signedAt).toLocaleString()
                  : 'Completed'}
              </div>
              <div>
                <span className="font-semibold text-neutral-700">Electronic Consent: </span>
                Affirmatively Accepted
              </div>
              <div>
                <span className="font-semibold text-neutral-700">Document Hash: </span>
                <span className="font-mono text-neutral-500 truncate block">
                  {version.canonicalDocumentHash}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 italic pt-2">
              This invoice has been electronically signed and cryptographically sealed. Any material alteration creates a new revision without modifying this signed record.
            </p>
          </div>
        )}

        {/* Signing Interaction Section: Displayed ONLY if NOT yet signed */}
        {!isSigned && (
          <div className="mt-10 p-6 md:p-8 rounded-xl bg-blue-50/50 border border-blue-100 space-y-6 print:hidden">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Review & Electronically Sign</h3>
              <p className="text-sm text-neutral-600 mt-1">
                Please review the invoice above and complete the required electronic consent and signature below.
              </p>
            </div>

            {/* 1. Explicit Affirmative Consent Checkbox (Unchecked by default) */}
            <div className="bg-white p-5 rounded-lg border border-neutral-200 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-neutral-800 leading-relaxed">
                  I consent to transact electronically and to sign this invoice electronically. I understand that my electronic signature has the same intended effect as signing a paper copy, subject to applicable law.
                </span>
              </label>
              <p className="text-xs text-neutral-400 pl-7">
                FlowLoopOS records your consent timestamp, document hash, and signer attribution as part of an immutable audit record.
              </p>
            </div>

            {/* 2. Signer Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => {
                    setSignerName(e.target.value);
                    if (signatureMethod === 'TYPED') setTypedSignature(e.target.value);
                  }}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-3.5 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Signer Email
                </label>
                <input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="e.g. jane@example.com"
                  className="w-full px-3.5 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            {/* 3. Signature Method Selection */}
            <div>
              <div className="flex items-center gap-4 mb-3">
                <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                  Signature Format:
                </span>
                <button
                  type="button"
                  onClick={() => setSignatureMethod('TYPED')}
                  className={`text-xs font-medium px-3 py-1 rounded-md border ${
                    signatureMethod === 'TYPED'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-neutral-700 border-neutral-300'
                  }`}
                >
                  Type Signature
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMethod('DRAWN_CANVAS')}
                  className={`text-xs font-medium px-3 py-1 rounded-md border ${
                    signatureMethod === 'DRAWN_CANVAS'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-neutral-700 border-neutral-300'
                  }`}
                >
                  Draw Signature
                </button>
              </div>

              {signatureMethod === 'TYPED' ? (
                <div className="bg-white p-6 rounded-lg border border-neutral-200 text-center">
                  <span className="font-serif italic text-2xl text-neutral-900 tracking-wide">
                    {typedSignature || signerName || 'Your Signature'}
                  </span>
                  <p className="text-[11px] text-neutral-400 mt-2">
                    Typed electronic signature authorized by {signerEmail || 'signer'}
                  </p>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-lg border border-neutral-200">
                  <div className="border border-dashed border-neutral-300 rounded bg-neutral-50 relative">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-28 cursor-crosshair touch-none"
                    />
                    {!canvasHasDrawn && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-neutral-400">
                        Sign with your mouse or fingertip on this line
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-xs text-neutral-500 hover:text-neutral-800 font-medium"
                    >
                      Clear Pad
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Error or Success Notice */}
            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-neutral-500">
                Clicking "Sign & Accept" locks this invoice version and records the cryptographic audit trail.
              </p>
              <button
                type="button"
                onClick={handleSignAndAccept}
                disabled={!consentChecked || loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition"
              >
                {loading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Sealing Document...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    Sign & Accept Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Conservative Legal Posture Footer */}
        <div className="mt-12 pt-6 border-t border-neutral-100 text-[11px] text-neutral-400 leading-relaxed">
          FlowLoopOS provides electronic signing, document integrity controls, and an auditable electronic record designed to support electronic transactions and evidentiary requirements. FlowLoopOS does not provide legal advice or guarantee enforceability in a particular dispute or jurisdiction.
        </div>
      </div>
    </div>
  );
}
