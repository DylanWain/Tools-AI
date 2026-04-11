// Tools AI — Billing DB operations against Supabase.
//
// All writes funnel through here so the chat handler's accounting code
// stays compact. Uses the shared supabaseAdmin client that already exists
// in src/lib/supabase.ts.

import { supabaseAdmin } from '../supabase';

export interface UserRow {
  id: string;
  email: string;
  tier: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  period_consumed_cents: number;
  period_billed_cents: number;
  hard_limit_cents: number;
  current_period_start: string | null;
  current_period_end: string | null;
}

/** Atomically add raw + billed cents to the user's current period. */
export async function recordUsage(
  userId: string,
  rawCents: number,
  chargedCents: number,
): Promise<{ newConsumedCents: number; newBilledCents: number; hardLimitCents: number }> {
  const { data, error } = await supabaseAdmin.rpc('record_usage', {
    p_user_id: userId,
    p_raw_cents: rawCents,
    p_charged_cents: chargedCents,
  });
  if (error) throw new Error(`record_usage failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    newConsumedCents: row?.new_consumed_cents ?? 0,
    newBilledCents: row?.new_billed_cents ?? 0,
    hardLimitCents: row?.hard_limit_cents ?? 0,
  };
}

/** Check the 60-calls/hour velocity limit and bump the counter if allowed. */
export async function checkVelocity(userId: string, limit: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('check_and_bump_velocity', {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw new Error(`check_and_bump_velocity failed: ${error.message}`);
  return !!data;
}

/** Log a usage event (errors, trial calls, billed calls — all go here). */
export async function logUsageEvent(row: {
  user_id: string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  raw_cost_cents: number;
  charged_cents: number;
  kind: string;
  stripe_meter_event_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('usage_events').insert({
    user_id: row.user_id,
    model: row.model,
    input_tokens: row.input_tokens ?? 0,
    output_tokens: row.output_tokens ?? 0,
    raw_cost_cents: row.raw_cost_cents,
    charged_cents: row.charged_cents,
    kind: row.kind,
    stripe_meter_event_id: row.stripe_meter_event_id ?? null,
    error_code: row.error_code ?? null,
    error_message: row.error_message ?? null,
  });
  if (error) {
    // Non-fatal — logging failures should never break a user's request.
    console.error('usage_events insert failed:', error.message);
  }
}

/** Look up the current user row by id. */
export async function findUserById(userId: string): Promise<UserRow | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select(
      'id, email, tier, stripe_customer_id, stripe_subscription_id, subscription_status, period_consumed_cents, period_billed_cents, hard_limit_cents, current_period_start, current_period_end',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserRow;
}

/** Fetch the active trial (if any) for a user. */
export async function findActiveTrial(
  userId: string,
): Promise<{ expires_at: string; consumed_cents: number } | null> {
  const { data } = await supabaseAdmin
    .from('trials')
    .select('expires_at, consumed_cents')
    .eq('user_id', userId)
    .is('ended_reason', null)
    .maybeSingle();
  return (data as any) || null;
}
