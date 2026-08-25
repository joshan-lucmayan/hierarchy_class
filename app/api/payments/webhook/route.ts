/**
 * POST /api/payments/webhook
 * 
 * PayMongo webhook handler for checkout_session.payment.paid events.
 * 
 * Security:
 * - Reads raw body before any parsing
 * - Verifies HMAC-SHA256 signature
 * - Uses timing-safe comparison
 * - Rejects invalid signatures
 * 
 * Idempotency:
 * - Event-ID pre-check skips known events (fast path)
 * - The payment transaction row + complete_payment RPC are the FINAL
 *   idempotency authority (FOR UPDATE lock, pending-only processing)
 * - The processed_webhook_events record is written only AFTER safe
 *   completion, so a crash or error anywhere earlier lets PayMongo's retry
 *   re-run the flow instead of silently skipping a paid transaction
 *
 * Flow:
 * 1. Read raw body
 * 2. Verify signature
 * 3. Parse event
 * 4. Fast-path deduplicate on event ID
 * 5. Extract transaction reference
 * 6. Verify provider data matches internal transaction
 * 7. Store provider payment info and call complete_payment RPC
 * 8. Record the event after completion succeeds
 * 9. Return 200 OK
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { verifyWebhookSignature } from '@/lib/paymongo';
import type { PayMongoWebhookEvent } from '@/lib/paymongo';

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Read raw body (must be before any parsing)
    const rawBody = await request.text();
    
    // 2. Read the provider signature header
    const signatureHeader = request.headers.get('paymongo-signature');
    
    if (!signatureHeader) {
      console.error('Webhook missing Paymongo-Signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }
    
    // 3. Verify HMAC-SHA256 signature
    const isValidSignature = verifyWebhookSignature(rawBody, signatureHeader);
    
    if (!isValidSignature) {
      console.error('Webhook signature verification failed');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // 4. Parse the verified payload
    let parsedBody: any;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      console.error('Webhook: Failed to parse JSON');
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }
    
    // 5. Extract PayMongo event ID
    const eventId = parsedBody.data?.id;
    if (!eventId) {
      console.error('Webhook: Missing event ID');
      return NextResponse.json(
        { error: 'Missing event ID' },
        { status: 400 }
      );
    }
    
    // 6. Extract event type
    const eventType = parsedBody.data?.attributes?.type;
    if (eventType !== 'checkout_session.payment.paid') {
      // Acknowledge non-payment events without processing
      console.log(`Webhook: Ignoring event type: ${eventType}`);
      return NextResponse.json({ status: 'ignored' });
    }
    
    // 7. Initialize Supabase service client
    const supabase = createServiceClient();
    if (!supabase) {
      console.error('Webhook: Service client not configured');
      return NextResponse.json(
        { error: 'Service not configured' },
        { status: 500 }
      );
    }
    
    // 8. Fast-path dedup: skip work if this event was already fully processed.
    // This is an optimization only - the transaction state machine below
    // remains the authoritative duplicate guard.
    const { data: existingEvent } = await (supabase
      .from('processed_webhook_events') as any)
      .select('id')
      .eq('provider', 'paymongo')
      .eq('event_id', eventId)
      .maybeSingle();
    
    if (existingEvent) {
      // Event already processed - acknowledge safely
      console.log(`Webhook: Event ${eventId} already processed`);
      return NextResponse.json({ status: 'already_processed' });
    }
    
    // 9. Extract Checkout Session data
    const session = parsedBody.data?.data;
    if (!session || session.type !== 'checkout_session') {
      console.error('Webhook: Invalid session data');
      return NextResponse.json(
        { error: 'Invalid session data' },
        { status: 400 }
      );
    }
    
    const checkoutSessionId = session.id;
    const referenceNumber = session.attributes?.reference_number;
    
    if (!referenceNumber) {
      console.error('Webhook: Missing reference number');
      return NextResponse.json(
        { error: 'Missing reference number' },
        { status: 400 }
      );
    }
    
    // 10. Find internal transaction
    const { data: tx, error: txError } = await (supabase
      .from('payment_transactions') as any)
      .select('*')
      .eq('reference_number', referenceNumber)
      .maybeSingle();
    
    if (txError || !tx) {
      console.error(`Webhook: Transaction not found for reference: ${referenceNumber}`);
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 200 }  // Return 200 to acknowledge, but don't process
      );
    }
    
    // 11. Verify transaction is eligible for completion
    if (tx.status !== 'pending') {
      // Transaction already processed - acknowledge
      console.log(`Webhook: Transaction ${tx.id} already in status: ${tx.status}`);
      return NextResponse.json({ status: 'already_processed' });
    }
    
    // 12. Verify provider session ID matches
    if (tx.provider_session_id && tx.provider_session_id !== checkoutSessionId) {
      console.error(`Webhook: Session ID mismatch - expected: ${tx.provider_session_id}, got: ${checkoutSessionId}`);
      return NextResponse.json(
        { error: 'Session ID mismatch' },
        { status: 200 }
      );
    }
    
    // 13. Verify payment data
    const payments = session.attributes?.payments;
    if (!payments || payments.length === 0) {
      console.error('Webhook: No payments in session');
      return NextResponse.json(
        { error: 'No payments' },
        { status: 200 }
      );
    }
    
    const payment = payments[0];
    const paymentAmount = payment.attributes?.amount;
    const paymentCurrency = payment.attributes?.currency;
    const paymentStatus = payment.attributes?.status;
    const paymentId = payment.id;
    
    // 14. Verify payment status is successful
    if (paymentStatus !== 'paid') {
      console.error(`Webhook: Payment status is ${paymentStatus}, not paid`);
      
      // Mark transaction as failed
      await (supabase
        .from('payment_transactions') as any)
        .update({
          status: 'failed',
          failure_reason: `Payment status: ${paymentStatus}`,
          provider_payment_id: paymentId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tx.id);
      
      return NextResponse.json({ status: 'payment_not_paid' });
    }
    
    // 15. Verify amount matches expected transaction amount
    const expectedAmountCentavos = Math.round(Number(tx.amount_php) * 100);
    if (paymentAmount !== expectedAmountCentavos) {
      console.error(`Webhook: Amount mismatch - expected: ${expectedAmountCentavos}, got: ${paymentAmount}`);
      return NextResponse.json(
        { error: 'Amount mismatch' },
        { status: 200 }
      );
    }
    
    // 16. Verify currency matches
    if (paymentCurrency !== tx.currency) {
      console.error(`Webhook: Currency mismatch - expected: ${tx.currency}, got: ${paymentCurrency}`);
      return NextResponse.json(
        { error: 'Currency mismatch' },
        { status: 200 }
      );
    }
    
    // 17. Update transaction with provider payment ID
    await (supabase
      .from('payment_transactions') as any)
      .update({
        provider_payment_id: paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tx.id);

    // 18. Call complete_payment RPC (the ONLY path that credits Florin).
    //
    // The transaction row itself is the final idempotency authority:
    // complete_payment() locks it FOR UPDATE and only ever processes a
    // 'pending' transaction. The processed_webhook_events record is written
    // only AFTER completion succeeds, so if this process crashes or errors
    // at any point before that, PayMongo's retry re-runs the whole flow and
    // completion is never skipped. A concurrent duplicate delivery is safe:
    // the row lock serializes them and the loser sees a non-pending status.
    const { data: result, error: rpcError } = await (supabase as any).rpc('complete_payment', {
      p_transaction_id: tx.id,
    });

    if (rpcError) {
      console.error('Webhook: complete_payment RPC error:', rpcError);
      // Not recorded yet - PayMongo will retry and the transaction is still
      // pending, so a retry can safely complete it.
      return NextResponse.json(
        { error: 'Payment completion failed' },
        { status: 500 }
      );
    }

    const rpcResult = result as { ok: boolean; error?: string; balance?: number; florin_added?: number };

    if (!rpcResult.ok) {
      // 'already_processed' means another delivery/concurrent request won the
      // race - that is success from our perspective. Anything else is unexpected.
      if (rpcResult.error === 'already_processed') {
        console.log(`Webhook: Transaction ${tx.id} was completed concurrently`);
      } else {
        console.error('Webhook: complete_payment returned error:', rpcResult.error);
      }
    }

    // 19. Record the event AFTER completion has safely succeeded. Failure here
    // does NOT undo the payment - the pre-check at step 8 plus the RPC's own
    // idempotency make re-delivery harmless.
    const { error: insertEventError } = await (supabase
      .from('processed_webhook_events') as any)
      .insert({
        provider: 'paymongo',
        event_id: eventId,
        transaction_id: tx.id,
      });

    if (insertEventError && insertEventError.code !== '23505') {
      // Unique violations are benign (a concurrent duplicate recorded it);
      // anything else is logged but must not fail an already-completed payment.
      console.error('Webhook: Failed to record processed event:', insertEventError);
    }

    // 20. Success
    console.log(`Webhook: Payment processed - Transaction: ${tx.id}, Florin added: ${rpcResult.florin_added ?? 0}, New balance: ${rpcResult.balance ?? 'n/a'}`);

    return NextResponse.json({
      status: rpcResult.ok ? 'completed' : rpcResult.error,
      transaction_id: tx.id,
      florin_added: rpcResult.florin_added,
    });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
