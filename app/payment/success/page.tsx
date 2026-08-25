/**
 * /payment/success
 * 
 * User-facing payment success page.
 * 
 * This page is READ-ONLY and does NOT credit Florin.
 * It only displays the current payment status.
 * 
 * Security:
 * - Only displays status for the authenticated user's own transaction
 * - Does not call complete_payment()
 * - Does not update any balances
 * - The webhook is the only successful credit path
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useMyProfile } from '@/lib/useMyProfile';
import Link from 'next/link';

// ============================================================================
// TYPES
// ============================================================================

interface PaymentStatus {
  id: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired';
  florin_amount: number;
  amount_php: number;
  package_id: string;
  reference_number: string;
  completed_at: string | null;
  failure_reason: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const referenceNumber = searchParams.get('ref');
  
  const { profile, loading: profileLoading } = useMyProfile();
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Fetch payment status
  useEffect(() => {
    if (!referenceNumber || !profile) return;
    
    let cancelled = false;
    const supabase = createClient();
    
    async function fetchPaymentStatus() {
      try {
        const { data, error: fetchError } = await (supabase
          .from('payment_transactions') as any)
          .select('*')
          .eq('reference_number', referenceNumber)
          .eq('student_id', profile!.id)  // Ensure user owns this transaction
          .single();
        
        if (cancelled) return;
        
        if (fetchError || !data) {
          setError('Transaction not found');
          setLoading(false);
          return;
        }
        
        setPayment({
          id: data.id,
          status: data.status,
          florin_amount: data.florin_amount,
          amount_php: Number(data.amount_php),
          package_id: data.package_id,
          reference_number: data.reference_number,
          completed_at: data.completed_at,
          failure_reason: data.failure_reason,
        });
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Failed to load payment status');
          setLoading(false);
        }
      }
    }
    
    fetchPaymentStatus();
    
    return () => {
      cancelled = true;
    };
  }, [referenceNumber, profile, retryCount]);
  
  // Auto-refresh if status is still pending (webhook might not have arrived yet)
  useEffect(() => {
    if (payment?.status === 'pending' && retryCount < 10) {
      const timer = setTimeout(() => {
        setRetryCount((c) => c + 1);
      }, 3000);  // Check every 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [payment?.status, retryCount]);
  
  // Loading state
  if (profileLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-4"></div>
          <p className="text-muted">Loading payment status...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !payment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="max-w-md w-full mx-4 p-8 rounded-[10px] border border-base bg-surface text-center">
          <h1 className="text-xl font-bold text-navy mb-4">Payment Error</h1>
          <p className="text-muted mb-6">{error || 'Transaction not found'}</p>
          <Link
            href="/student/shop"
            className="inline-block px-6 py-2.5 rounded-full bg-navy text-white font-semibold hover:bg-gold transition-colors"
          >
            Return to Shop
          </Link>
        </div>
      </div>
    );
  }
  
  // Status-specific display
  const statusConfig = {
    pending: {
      title: 'Verifying Payment',
      message: 'Your payment is being verified. This may take a few moments.',
      icon: (
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gold mx-auto mb-4"></div>
      ),
      bgColor: 'bg-[var(--surface)]',
      textColor: 'text-navy',
    },
    completed: {
      title: 'Payment Successful!',
      message: `You received ${payment.florin_amount.toLocaleString()} Florin.`,
      icon: (
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ),
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-700',
    },
    failed: {
      title: 'Payment Failed',
      message: payment.failure_reason || 'Your payment could not be processed.',
      icon: (
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      ),
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-700',
    },
    cancelled: {
      title: 'Payment Cancelled',
      message: 'Your payment was cancelled.',
      icon: (
        <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      ),
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-700',
    },
    expired: {
      title: 'Payment Expired',
      message: 'Your payment session has expired. Please try again.',
      icon: (
        <div className="w-16 h-16 rounded-full bg-gray-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      ),
      bgColor: 'bg-gray-500/10',
      textColor: 'text-gray-700',
    },
  };
  
  const config = statusConfig[payment.status];
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="max-w-md w-full mx-4 p-8 rounded-[10px] border border-base bg-surface text-center">
        {/* Status Icon */}
        {config.icon}
        
        {/* Status Title */}
        <h1 className={`text-xl font-bold ${config.textColor} mb-2`}>
          {config.title}
        </h1>
        
        {/* Status Message */}
        <p className="text-muted mb-6">{config.message}</p>
        
        {/* Payment Details */}
        <div className="rounded-[10px] border border-base bg-[var(--surface)] p-4 mb-6 text-left">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted">Package</span>
            <span className="text-sm font-semibold text-navy">{payment.florin_amount.toLocaleString()} Florin</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted">Amount</span>
            <span className="text-sm font-semibold text-navy">₱{payment.amount_php.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Reference</span>
            <span className="text-sm font-mono text-muted">{payment.reference_number}</span>
          </div>
        </div>
        
        {/* Auto-refresh notice for pending */}
        {payment.status === 'pending' && (
          <p className="text-xs text-muted mb-4">
            Auto-refreshing... (attempt {retryCount + 1}/10)
          </p>
        )}
        
        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Link
            href="/student/shop"
            className="inline-block px-6 py-2.5 rounded-full bg-navy text-white font-semibold hover:bg-gold transition-colors"
          >
            {payment.status === 'completed' ? 'View Shop' : 'Return to Shop'}
          </Link>
          
          {payment.status !== 'completed' && (
            <Link
              href="/student/shop"
              className="inline-block px-6 py-2.5 rounded-full border border-base text-navy font-semibold hover:bg-surface transition-colors"
            >
              Try Again
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
