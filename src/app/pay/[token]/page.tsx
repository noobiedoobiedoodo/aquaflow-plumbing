import { prisma } from '@/lib/db';
import { createPaymentIntentFromToken } from '@/app/actions/finance';
import { notFound } from 'next/navigation';
import PaymentClientWrapper from './PaymentClientWrapper';

export default async function PaymentPage({ params }: { params: { token: string } }) {
  const { token } = await params;

  // 1. Fetch public invoice details
  const invoice = await prisma.invoice.findUnique({
    where: { paymentToken: token },
    include: {
      organization: true,
      lines: true,
      taxes: true
    }
  });

  if (!invoice) return notFound();

  const balanceDue = invoice.total - invoice.amountPaid;
  const isPaid = balanceDue <= 0 || invoice.status === 'PAID' || invoice.status === 'VOID';

  // 2. If it's not paid, generate a payment intent
  let clientSecret: string | null = null;
  if (!isPaid) {
    try {
      const intent = await createPaymentIntentFromToken(token);
      clientSecret = intent.clientSecret;
    } catch (e: any) {
      console.error("Failed to create payment intent", e);
      // We will handle this gracefully on the client
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row">
      {/* Left Column: Invoice Details */}
      <div className="flex-1 p-8 md:p-12 lg:p-24 border-r border-neutral-200 bg-white">
        <div className="max-w-xl mx-auto">
          <div className="mb-12">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">{invoice.organization.name}</h1>
            <p className="text-neutral-500 mt-2 text-sm">Invoice #{invoice.invoiceNumber}</p>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">Summary</h2>
              <div className="space-y-4">
                {invoice.lines.map((line) => (
                  <div key={line.id} className="flex justify-between items-start text-sm">
                    <div>
                      <p className="font-medium text-neutral-900">{line.description}</p>
                      <p className="text-neutral-500">{line.quantity} × ${(line.unitCost).toFixed(2)}</p>
                    </div>
                    <span className="text-neutral-900 font-medium">${(line.quantity * line.unitCost).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-100 pt-6 space-y-3 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span>${invoice.subtotal.toFixed(2)}</span>
              </div>
              {invoice.taxes.map((tax) => (
                <div key={tax.id} className="flex justify-between text-neutral-600">
                  <span>{tax.name} ({(tax.rate * 100).toFixed(1)}%)</span>
                  <span>${tax.amount.toFixed(2)}</span>
                </div>
              ))}
              {invoice.amountPaid > 0 && (
                <div className="flex justify-between text-green-600 font-medium pt-2">
                  <span>Amount Paid</span>
                  <span>-${invoice.amountPaid.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg text-neutral-900 pt-4 border-t border-neutral-200">
                <span>Balance Due</span>
                <span>${Math.max(0, balanceDue).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Payment Form */}
      <div className="flex-1 p-8 md:p-12 lg:p-24 bg-neutral-50">
        <div className="max-w-md mx-auto h-full flex flex-col justify-center">
          {isPaid ? (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-100 text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-neutral-900 mb-2">Invoice Paid</h2>
              <p className="text-neutral-500">Thank you! This invoice has been fully paid.</p>
            </div>
          ) : clientSecret ? (
            <PaymentClientWrapper clientSecret={clientSecret} returnUrl={`/pay/${token}/success`} />
          ) : (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
              There was a problem initializing the payment system. Please try again later.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
