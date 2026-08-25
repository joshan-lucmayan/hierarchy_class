/**
 * PaymentStatusBadge
 * 
 * Displays payment status with appropriate styling.
 * 
 * Statuses:
 * - pending: Yellow/orange
 * - completed: Green
 * - failed: Red
 * - cancelled: Gray
 * - expired: Gray
 */

'use client';

// ============================================================================
// TYPES
// ============================================================================

type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const statusConfig: Record<PaymentStatus, { label: string; className: string }> = {
    pending: {
      label: 'Pending',
      className: 'bg-yellow-500/20 text-yellow-700',
    },
    completed: {
      label: 'Completed',
      className: 'bg-green-500/20 text-green-700',
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-500/20 text-red-700',
    },
    cancelled: {
      label: 'Cancelled',
      className: 'bg-gray-500/20 text-gray-700',
    },
    expired: {
      label: 'Expired',
      className: 'bg-gray-500/20 text-gray-700',
    },
  };
  
  const config = statusConfig[status];
  
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        ${config.className}
      `}
    >
      {config.label}
    </span>
  );
}
