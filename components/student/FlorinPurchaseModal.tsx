/**
 * FlorinPurchaseModal
 * 
 * Modal for purchasing Florin via GCash through PayMongo.
 * 
 * Features:
 * - Loads packages from database
 * - Initiates PayMongo checkout
 * - Handles redirect to PayMongo hosted checkout
 * - Shows loading and error states
 * - Validates package selection
 * 
 * Security:
 * - Package prices loaded from database, not hardcoded
 * - Server validates package before checkout creation
 * - Client never directly credits Florin
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useFlorin } from "@/lib/florinStore";
import { FlorinPackageCard } from "./FlorinPackageCard";
import { useOnline } from "@/lib/useOnline";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { backendUrl } from "@/lib/siteUrl";
import { isNativeApp } from "@/lib/native";
import { registerBackHandler } from "@/lib/nativeBackHandler";
import { Browser } from "@capacitor/browser";

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

interface CheckoutResponse {
  checkout_url: string;
  reference_number: string;
  status: 'new' | 'reused';
  transaction_id: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FlorinPurchaseModal({ onClose }: { onClose: () => void }) {
  const { balance } = useFlorin();
  const isOnline = useOnline();
  
  const [packages, setPackages] = useState<FlorinPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<FlorinPackage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load packages from database
  useEffect(() => {
    let cancelled = false;
    
    async function loadPackages() {
      try {
        const response = await fetch(backendUrl('/api/payments/packages'));
        
        if (!response.ok) {
          throw new Error('Failed to load packages');
        }
        
        const data = await response.json();
        
        if (!cancelled) {
          setPackages(data.packages || []);
          setLoadingPackages(false);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load packages');
          setLoadingPackages(false);
        }
      }
    }
    
    loadPackages();
    
    return () => {
      cancelled = true;
    };
  }, []);
  
  // Handle package selection and checkout initiation
  const handleSelectPackage = useCallback(async (pkg: FlorinPackage) => {
    if (isProcessing) return;
    if (!isOnline) {
      setError("You’re offline — connect to purchase Florin. Nothing was charged.");
      return;
    }
    
    setSelectedPackage(pkg);
    setIsProcessing(true);
    setError(null);
    
    try {
      const response = await fetch(backendUrl('/api/payments/create-checkout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          package_id: pkg.id,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout');
      }
      
      const data: CheckoutResponse = await response.json();
      
      // Redirect to PayMongo checkout. In the standalone Android app the
      // hosted checkout (an off-origin URL) must leave the app shell - open
      // it in the system browser and return via the app switcher. On the web
      // the same-origin navigation behaves exactly as before.
      if (data.checkout_url) {
        if (isNativeApp()) {
          void Browser.open({ url: data.checkout_url });
        } else {
          window.location.href = data.checkout_url;
        }
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate payment');
      setIsProcessing(false);
    }
  }, [isProcessing, isOnline]);
  
  // Handle modal close
  const handleClose = useCallback(() => {
    if (!isProcessing) {
      onClose();
    }
  }, [isProcessing, onClose]);

  // Android hardware back closes the modal before any navigation happens.
  useEffect(() => {
    return registerBackHandler(() => {
      handleClose();
      return true;
    });
  }, [handleClose]);
  
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm rounded-[10px] border border-base bg-surface p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Buy Florin</p>
        <h2 className="mt-2 text-xl font-bold text-navy">Top up your coins</h2>
        <p className="mt-2 text-sm text-muted">
          Your current balance is <span className="font-semibold text-navy">{balance.toLocaleString()} Florin</span>.
        </p>
        
        {/* Offline notice */}
        {!isOnline && <OfflineBanner message="You’re offline — Florin purchase needs a connection. Nothing was charged." />}
        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-[10px] bg-red-500/10 border border-red-500/20 p-3 text-center">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        
        {/* Package grid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {loadingPackages ? (
            // Loading skeleton
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-[10px] border border-base bg-surface px-3 py-3 text-center animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-16 mx-auto mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-12 mx-auto mb-1"></div>
                  <div className="h-4 bg-gray-200 rounded w-10 mx-auto"></div>
                </div>
              ))}
            </>
          ) : packages.length > 0 ? (
            // Package cards
            packages.map((pkg) => (
              <FlorinPackageCard
                key={pkg.id}
                pkg={pkg}
                onSelect={handleSelectPackage}
                isLoading={isProcessing}
                isSelected={selectedPackage?.id === pkg.id}
                disabled={isProcessing}
              />
            ))
          ) : (
            // No packages available
            <div className="col-span-2 text-center py-4">
              <p className="text-sm text-muted">No packages available</p>
            </div>
          )}
        </div>
        
        {/* Info notice */}
        <div className="mt-5 rounded-[10px] border border-base bg-[var(--surface-strong)] p-4 text-center">
          <p className="text-sm font-semibold text-navy">Secure Payment</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Payments are processed securely via GCash through PayMongo.
            Your Florin will be credited after successful payment verification.
          </p>
        </div>
        
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          disabled={isProcessing}
          className="mt-5 w-full rounded-full bg-navy py-3 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {isProcessing ? 'Processing...' : 'Close'}
        </button>
      </div>
    </div>
  );
}
