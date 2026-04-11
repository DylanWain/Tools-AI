// Tools AI — Billing env var helpers.
// All config lives in env vars. This module normalises names so downstream
// code doesn't care whether the legacy ANTHROPIC_KEY or new ANTHROPIC_API_KEY
// convention is used in Vercel.

function firstNonEmpty(names: string[]): string | null {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.length > 0) return v;
  }
  return null;
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  // Stripe
  STRIPE_SECRET_KEY: () => firstNonEmpty(['STRIPE_SECRET_KEY']) || '',
  STRIPE_WEBHOOK_SECRET: () => firstNonEmpty(['STRIPE_WEBHOOK_SECRET']) || '',
  STRIPE_PRICE_CHAD_FLAT: () => firstNonEmpty(['STRIPE_PRICE_CHAD_FLAT']) || '',
  STRIPE_PRICE_CHAD_OVERAGE: () => firstNonEmpty(['STRIPE_PRICE_CHAD_OVERAGE']) || '',
  STRIPE_PRICE_PAYG: () => firstNonEmpty(['STRIPE_PRICE_PAYG']) || '',
  STRIPE_METER_EVENT_NAME: () => firstNonEmpty(['STRIPE_METER_EVENT_NAME']) || 'api_cost_raw_cents',

  // Trial + Chad config
  TRIAL_DAYS: () => intEnv('TRIAL_DAYS', 14),
  CHAD_INCLUDED_CENTS: () => intEnv('CHAD_INCLUDED_CENTS', 1500),
  CHAD_OVERAGE_MULTIPLIER: () => intEnv('CHAD_OVERAGE_MULTIPLIER', 2),
  PAYG_MULTIPLIER: () => intEnv('PAYG_MULTIPLIER', 3),

  // Safety rails
  NEW_USER_HARD_CAP_CENTS: () => intEnv('NEW_USER_HARD_CAP_CENTS', 5000),
  ESTABLISHED_USER_HARD_CAP_CENTS: () => intEnv('ESTABLISHED_USER_HARD_CAP_CENTS', 20000),
  VELOCITY_LIMIT_CALLS_PER_HOUR: () => intEnv('VELOCITY_LIMIT_CALLS_PER_HOUR', 60),

  // Redirects
  SUCCESS_URL: () => firstNonEmpty(['SUCCESS_URL', 'NEXT_PUBLIC_SITE_URL']) + '/subscribed',
  CANCEL_URL: () => firstNonEmpty(['CANCEL_URL', 'NEXT_PUBLIC_SITE_URL']) + '/checkout-cancelled',

  // Dev safety rail
  DEV_MODE: () => firstNonEmpty(['DEV_MODE']) === 'true',
};
