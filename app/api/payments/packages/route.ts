/**
 * GET /api/payments/packages
 * 
 * Returns available Florin packages for purchase.
 * 
 * Security:
 * - Requires authenticated user
 * - Returns only active packages
 * - No sensitive data exposed
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getServerProfile } from '@/lib/supabase/auth';

// Auth-aware per-request route: never statically rendered.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Require an authenticated user before exposing the catalog
    const profile = await getServerProfile(request.cookies);
    if (!profile.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Initialize Supabase service client
    const supabase = createServiceClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Service not configured' },
        { status: 500 }
      );
    }
    
    // Fetch active packages
    const { data: packages, error } = await (supabase
      .from('florin_packages') as any)
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch packages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch packages' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      packages: packages || [],
    });
    
  } catch (error) {
    console.error('Packages fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
