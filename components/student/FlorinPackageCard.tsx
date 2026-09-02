/**
 * FlorinPackageCard
 * 
 * Displays a single Florin package option for purchase.
 * 
 * Features:
 * - Shows Florin amount and PHP price
 * - Loading state when checkout is in progress
 * - Disabled state when another package is selected
 * - Responsive design
 */

'use client';

// ============================================================================
// TYPES
// ============================================================================

interface FlorinPackage {
  id: string;
  name: string;
  florin_amount: number;
  price_php: number;
  currency: string;
  sort_order: number;
}

interface FlorinPackageCardProps {
  pkg: FlorinPackage;
  onSelect: (pkg: FlorinPackage) => void;
  isLoading: boolean;
  isSelected: boolean;
  disabled: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FlorinPackageCard({
  pkg,
  onSelect,
  isLoading,
  isSelected,
  disabled,
}: FlorinPackageCardProps) {
  const handleClick = () => {
    if (!isLoading && !disabled) {
      onSelect(pkg);
    }
  };
  
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading || disabled}
      className={`
        relative w-full rounded-[10px] border p-4 text-center transition-all
        ${isSelected 
          ? 'border-accent bg-accent/10' 
          : 'border-base bg-surface hover:border-accent/50'
        }
        ${isLoading || disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Florin Amount */}
      <p className="text-2xl font-bold text-navy">
        {pkg.florin_amount.toLocaleString()}
      </p>
      
      {/* Label */}
      <p className="text-xs text-muted">Florin</p>
      
      {/* Price */}
      <p className="mt-2 text-sm font-semibold text-accent">
        ₱{pkg.price_php.toFixed(2)}
      </p>
      
      {/* Loading indicator */}
      {isLoading && isSelected && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/80 rounded-[10px]">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
        </div>
      )}
      
      {/* Selected indicator */}
      {isSelected && !isLoading && (
        <div className="absolute top-2 right-2">
          <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
    </button>
  );
}
