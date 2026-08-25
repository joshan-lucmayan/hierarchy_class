/**
 * PaymentHistory
 * 
 * Displays recent payment transactions for the current student.
 * 
 * Features:
 * - Shows payment history with status badges
 * - Displays Florin amount, PHP amount, and date
 * - Uses existing design patterns and theme system
 * - Responsive design
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useMyProfile } from '@/lib/useMyProfile';
import { PaymentStatusBadge } from './PaymentStatusBadge';

// ============================================================================
// TYPES
// ============================================================================

interface PaymentTransaction {
  id: string;
  package_id: string;
  florin_amount: number;
  amount_php: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired';
  reference_number: string;
  created_at: string;
  completed_at: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PaymentHistory() {
  const { profile } = useMyProfile();
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!profile) return;
    
    let cancelled = false;
    const supabase = createClient();
    
    async function fetchTransactions() {
      try {
        const { data, error: fetchError } = await (supabase
          .from('payment_transactions') as any)
          .select('*')
          .eq('student_id', profile!.id)
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (cancelled) return;
        
        if (fetchError) {
          console.error('Failed to fetch transactions:', fetchError);
          setError('Failed to load transaction history');
          setLoading(false);
          return;
        }
        
        setTransactions(data || []);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Failed to load transaction history');
          setLoading(false);
        }
      }
    }
    
    fetchTransactions();
    
    return () => {
      cancelled = true;
    };
  }, [profile]);
  
  // Loading state
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted">{error}</p>
      </div>
    );
  }
  
  // Empty state
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm text-muted">No transactions yet</p>
        <p className="text-xs text-faint mt-1">Your payment history will appear here</p>
      </div>
    );
  }
  
  // Transaction list
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-navy">Recent Transactions</h3>
      
      <div className="space-y-2">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between p-3 rounded-[10px] border border-base bg-surface"
          >
            {/* Left: Package info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-navy">
                  {tx.florin_amount.toLocaleString()} Florin
                </p>
                <PaymentStatusBadge status={tx.status} />
              </div>
              <p className="text-xs text-muted mt-0.5">
                ₱{tx.amount_php.toFixed(2)} • {tx.reference_number}
              </p>
            </div>
            
            {/* Right: Date */}
            <div className="text-right">
              <p className="text-xs text-muted">
                {new Date(tx.created_at).toLocaleDateString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              {tx.completed_at && (
                <p className="text-[10px] text-faint">
                  Completed {new Date(tx.completed_at).toLocaleTimeString('en-PH', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
