/**
 * PayMongo Hosted Checkout utility functions.
 * 
 * All PayMongo API interactions are centralized here.
 * This file is server-only and must never be imported from client components.
 * 
 * Environment variables required:
 * - PAYMONGO_SECRET_KEY: Secret API key (sk_test_xxx or sk_live_xxx)
 * - PAYMONGO_WEBHOOK_SECRET: Webhook signing secret for signature verification
 */

import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface PayMongoCheckoutSession {
  id: string;
  type: 'checkout_session';
  attributes: {
    checkout_url: string;
    client_key: string;
    reference_number: string;
    status:
      | 'active'
      | 'pending'
      | 'payment_processing'
      | 'succeeded'
      | 'paid'
      | 'expired'
      | 'cancelled';
    livemode: boolean;
    payment_method_types: string[];
    line_items: Array<{
      name: string;
      amount: number;
      currency: string;
      quantity: number;
    }>;
    payments: Array<{
      id: string;
      type: 'payment';
      attributes: {
        amount: number;
        currency: string;
        status: string;
        payment_intent_id: string;
        source: {
          id: string;
          type: string;
          provider?: {
            id: string;
          };
        };
      };
    }>;
    payment_intent: {
      id: string;
      type: 'payment_intent';
      attributes: {
        amount: number;
        currency: string;
        status: string;
      };
    };
    metadata: Record<string, string>;
    created_at: number;
    updated_at: number;
  };
}

export interface PayMongoWebhookEvent {
  data: {
    id: string;                    // PayMongo event ID (evt_xxx)
    type: 'event';
    attributes: {
      type: string;                // 'checkout_session.payment.paid'
      livemode: boolean;
      created_at: number;
      data: {
        id: string;                // Checkout Session ID (cs_xxx)
        type: 'checkout_session';
        attributes: {
          reference_number: string;
          status: string;
          payments: Array<{
            id: string;
            type: 'payment';
            attributes: {
              amount: number;
              currency: string;
              status: string;
              payment_intent_id: string;
              source: {
                id: string;
                type: string;
                provider?: {
                  id: string;
                };
              };
              billing?: {
                email?: string;
                name?: string;
              };
              paid_at?: number;
              created_at: number;
            };
          }>;
          metadata: Record<string, string>;
        };
      };
    };
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

function getSecretKey(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) {
    throw new Error('PAYMONGO_SECRET_KEY environment variable is not set');
  }
  return key;
}

function getWebhookSecret(): string {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('PAYMONGO_WEBHOOK_SECRET environment variable is not set');
  }
  return secret;
}

function getApiBaseUrl(): string {
  return 'https://api.paymongo.com';
}

// ============================================================================
// CREATE CHECKOUT SESSION
// ============================================================================

export interface CreateCheckoutSessionParams {
  referenceNumber: string;
  amount: number;           // Amount in centavos (e.g., 3900 for ₱39.00)
  currency: string;         // 'PHP'
  description: string;      // Package description
  paymentMethods: string[]; // ['gcash']
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

/**
 * Create a PayMongo Checkout Session.
 * 
 * @param params - Checkout session parameters
 * @returns The checkout session with checkout URL
 * @throws Error if API call fails
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<PayMongoCheckoutSession> {
  const secretKey = getSecretKey();
  const baseUrl = getApiBaseUrl();
  
  const response = await fetch(`${baseUrl}/v2/checkout_sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': params.referenceNumber,  // Use internal reference as idempotency key
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: params.description,
              amount: params.amount,
              currency: params.currency,
              quantity: 1,
            },
          ],
          payment_method_types: params.paymentMethods,
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          reference_number: params.referenceNumber,
          metadata: params.metadata || {},
        },
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayMongo API error: ${response.status} - ${error}`);
  }
  
  const result = await response.json();
  return result.data as PayMongoCheckoutSession;
}

// ============================================================================
// VERIFY WEBHOOK SIGNATURE
// ============================================================================

/**
 * Verify PayMongo webhook signature using HMAC-SHA256.
 * 
 * @param rawBody - Raw request body (must be the exact bytes sent by PayMongo)
 * @param signatureHeader - The Paymongo-Signature header value
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string
): boolean {
  const webhookSecret = getWebhookSecret();
  
  // Compute expected signature: HMAC-SHA256 of raw body with webhook secret
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
  
  // Timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expectedSignature);
  
  // Buffers must be same length for timingSafeEqual
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

// ============================================================================
// GET CHECKOUT SESSION STATUS
// ============================================================================

/**
 * Retrieve a PayMongo Checkout Session to check its status.
 * 
 * @param sessionId - The checkout session ID (cs_xxx)
 * @returns The checkout session details
 * @throws Error if API call fails
 */
export async function getCheckoutSessionStatus(
  sessionId: string
): Promise<PayMongoCheckoutSession> {
  const secretKey = getSecretKey();
  const baseUrl = getApiBaseUrl();
  
  // Sessions are CREATED via POST /v2/checkout_sessions (createCheckoutSession),
  // so the lookup must also hit /v2 - GET /v1/checkout_sessions/{id} cannot
  // resolve v2 cs_xxx IDs (404), which silently broke pending-session reuse.
  const response = await fetch(`${baseUrl}/v2/checkout_sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayMongo API error: ${response.status} - ${error}`);
  }
  
  const result = await response.json();
  return result.data as PayMongoCheckoutSession;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique internal reference number for payment transactions.
 * Format: HC-TXN-{timestamp36}-{random6}
 */
export function generateReferenceNumber(): string {
  const timestamp = Date.now().toString(36);
  // Cryptographically random segment (used in the PayMongo Idempotency-Key,
  // so it must never collide) - 3 bytes = exactly 6 hex characters.
  const random = crypto.randomBytes(3).toString("hex");
  return `HC-TXN-${timestamp}-${random}`.toUpperCase();
}

/**
 * Convert peso amount to centavos (PayMongo uses centavos).
 * Example: 39.00 → 3900
 */
export function pesoToCentavos(peso: number): number {
  return Math.round(peso * 100);
}

/**
 * Convert centavos to peso amount for display.
 * Example: 3900 → 39.00
 */
export function centavosToPeso(centavos: number): number {
  return centavos / 100;
}
