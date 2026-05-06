import Stripe from 'stripe';

/**
 * Stripe configuration using environment variables
 *
 * Required env vars:
 * - STRIPE_SECRET_KEY       (sk_test_... / sk_live_...)
 * - STRIPE_PUBLISHABLE_KEY  (pk_test_... / pk_live_...)
 * - STRIPE_WEBHOOK_SECRET   (whsec_... for webhook verification)
 */

let stripeInstance: Stripe | null = null;

function getEnvStripeKeys() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to your .env file in the project root.",
    );
  }

  if (!publishableKey) {
    throw new Error(
      "STRIPE_PUBLISHABLE_KEY is not set. Add it to your .env file in the project root.",
    );
  }

  return { secretKey, publishableKey };
}

export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const { secretKey } = getEnvStripeKeys();
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-03-31.basil',
    });
  }
  return stripeInstance;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  return getStripeClient();
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = getEnvStripeKeys();
  return publishableKey;
}

export async function getStripeSecretKey(): Promise<string> {
  const { secretKey } = getEnvStripeKeys();
  return secretKey;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Add it to your .env file for webhook verification.",
    );
  }
  return secret;
}
