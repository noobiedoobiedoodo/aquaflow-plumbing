import Link from 'next/link';

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 text-center">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Payment Successful</h1>
        <p className="text-neutral-600 mb-8">
          Thank you for your payment. Your invoice has been marked as paid and a receipt will be emailed to you shortly.
        </p>
        <Link href="/" className="inline-flex justify-center w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-xl transition-colors duration-200">
          Return Home
        </Link>
      </div>
    </div>
  );
}
