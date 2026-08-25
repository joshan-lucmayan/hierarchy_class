/**
 * /payment/cancel
 * 
 * Payment cancel page.
 * 
 * This page is displayed when the student cancels the payment.
 * It does NOT credit Florin or update any status.
 * 
 * The cancel URL is called by PayMongo when the student clicks cancel
 * on the checkout page. The actual cancellation is handled by the webhook
 * when PayMongo sends a payment.failed or similar event.
 */

'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PaymentCancelPage() {
  const searchParams = useSearchParams();
  const referenceNumber = searchParams.get('ref');
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="max-w-md w-full mx-4 p-8 rounded-[10px] border border-base bg-surface text-center">
        {/* Cancel Icon */}
        <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        
        {/* Title */}
        <h1 className="text-xl font-bold text-navy mb-2">Payment Cancelled</h1>
        
        {/* Message */}
        <p className="text-muted mb-6">
          Your payment was cancelled. No Florin was added to your account.
        </p>
        
        {/* Reference */}
        {referenceNumber && (
          <div className="rounded-[10px] border border-base bg-[var(--surface)] p-4 mb-6 text-left">
            <div className="flex justify-between">
              <span className="text-sm text-muted">Reference</span>
              <span className="text-sm font-mono text-muted">{referenceNumber}</span>
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Link
            href="/student/shop"
            className="inline-block px-6 py-2.5 rounded-full bg-navy text-white font-semibold hover:bg-gold transition-colors"
          >
            Return to Shop
          </Link>
          
          <Link
            href="/student/home"
            className="inline-block px-6 py-2.5 rounded-full border border-base text-navy font-semibold hover:bg-surface transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
