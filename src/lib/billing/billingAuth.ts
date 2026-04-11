// Tools AI — Billing auth + gate.
//
// This is the dual-path auth layer for the /api/v1/chat endpoint. It
// tries to resolve the bearer token to either:
//
//   A. A JWT issued by our new signup/login flow → new billing path
//      (trial / chad / payg, Stripe meter events, hard caps)
//
//   B. A legacy `tai-xxx` key from tai_keys → old billing path
//      (flat $25/mo silent cap, existing trackUsage logic)
//
// The existing tai_keys users are paying customers and MUST keep working
// unchanged. The new path only activates for JWT tokens.

import jwt from 'jsonwebtoken';
import { env } from './env';
import { findUserById, findActiveTrial, checkVelocity } from './billingDb';
import type { UserRow } from './billingDb';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

export type AuthResult =
  | { kind: 'legacy'; token: string } // tai-xxx token → fall through to existing logic
  | { kind: 'anonymous'; deviceId: string } // anon_xxx token → existing anonymous path
  | { kind: 'new_user'; user: UserRow } // authenticated new-billing user
  | { kind: 'unauth' }; // no token or invalid

export type Gate =
  | 'allow'
  | 'trial_expired'
  | 'hard_limit'
  | 'velocity'
  | 'suspended'
  | 'unauth';

export async function resolveBearer(authHeader: string | undefined): Promise<AuthResult> {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { kind: 'unauth' };

  // Legacy tai-xxx tokens: hand off to existing chat.ts validateKey logic.
  if (token.startsWith('tai-')) {
    return { kind: 'legacy', token };
  }

  // Anonymous device tokens (chat app anonymous mode): existing path.
  if (token.startsWith('anon_')) {
    const deviceId = token.slice(5);
    return deviceId.length >= 16 ? { kind: 'anonymous', deviceId } : { kind: 'unauth' };
  }

  // Everything else is treated as a JWT from our signup/login flow.
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    if (!decoded?.id) return { kind: 'unauth' };
    const user = await findUserById(decoded.id);
    if (!user) return { kind: 'unauth' };
    return { kind: 'new_user', user };
  } catch {
    return { kind: 'unauth' };
  }
}

/**
 * Check gating rules for a new-billing user. Returns 'allow' if the call
 * should proceed, or a reason code otherwise.
 */
export async function gateNewUser(user: UserRow): Promise<Gate> {
  // 1. Suspended (invoice.payment_failed set this)
  if (user.tier === 'suspended') return 'suspended';

  // 2. Trial expired without subscription
  if (user.tier === 'expired') return 'trial_expired';

  // 3. Trial running but expired by date
  if (user.tier === 'trial') {
    const trial = await findActiveTrial(user.id);
    if (!trial || new Date(trial.expires_at).getTime() <= Date.now()) {
      return 'trial_expired';
    }
  }

  // 4. Velocity limit (60 calls/hour default)
  const ok = await checkVelocity(user.id, env.VELOCITY_LIMIT_CALLS_PER_HOUR());
  if (!ok) return 'velocity';

  // 5. Hard cap (monthly billed-cents ceiling)
  if (user.period_billed_cents >= user.hard_limit_cents) {
    return 'hard_limit';
  }

  return 'allow';
}

/** Map a gate to the HTTP response the endpoint should return. */
export function gateToResponse(gate: Gate): { status: number; body: { error: string; code: string } } {
  switch (gate) {
    case 'unauth':
      return { status: 401, body: { error: 'Sign in required', code: 'UNAUTH' } };
    case 'suspended':
      return {
        status: 402,
        body: {
          error: 'Your account is suspended due to a failed payment. Update your card to continue.',
          code: 'SUSPENDED',
        },
      };
    case 'trial_expired':
      return {
        status: 402,
        body: {
          error: 'Your free trial has ended. Choose a plan to keep using Tools AI.',
          code: 'TRIAL_EXPIRED',
        },
      };
    case 'velocity':
      return {
        status: 429,
        body: { error: 'Too many requests. Please slow down.', code: 'VELOCITY_LIMIT' },
      };
    case 'hard_limit':
      return {
        status: 402,
        body: {
          error: 'Monthly spending cap reached. Raise your cap or upgrade your plan.',
          code: 'HARD_LIMIT_HIT',
        },
      };
    default:
      return { status: 500, body: { error: 'Unknown gate state', code: 'INTERNAL' } };
  }
}

/** Sign a JWT for a freshly created or logged-in user. */
export function signJwt(payload: { id: string; email: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}
