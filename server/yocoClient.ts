/**
 * Yoco Checkout API Client
 * Documentation: https://developer.yoco.com/docs/checkout-api
 *
 * Required env vars:
 * - YOCO_SECRET_KEY (sk_test_... for test, sk_live_... for live)
 * - YOCO_PUBLIC_KEY (pk_test_... for test, pk_live_... for live)
 */

export interface YocoConfig {
  secretKey: string;
  publicKey: string;
  isTestMode: boolean;
}

export interface YocoCheckoutRequest {
  amount: number; // Amount in cents (e.g., 1000 = R10.00)
  currency: string; // "ZAR"
  successUrl: string;
  cancelUrl: string;
  failureUrl?: string;
  metadata?: Record<string, string>;
  externalId?: string; // Your custom reference ID
}

export interface YocoCheckoutResponse {
  id: string;
  redirectUrl: string;
  status: string;
  metadata?: Record<string, string>;
  externalId?: string;
}

export interface YocoWebhookPayload {
  id: string;
  type: string;
  createdDate: string;
  payload: {
    id: string;
    type: string;
    status: string;
    mode: string;
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
    externalId?: string;
    createdDate: string;
    paymentMethodDetails?: {
      card?: {
        maskedCard: string;
        expiryMonth: number;
        expiryYear: number;
        scheme: string;
      };
    };
  };
}

let config: YocoConfig | null = null;

export function getYocoConfig(): YocoConfig {
  if (!config) {
    const secretKey = process.env.YOCO_SECRET_KEY;
    const publicKey = process.env.YOCO_PUBLIC_KEY;

    if (!secretKey || !publicKey) {
      throw new Error(
        'YOCO_SECRET_KEY and YOCO_PUBLIC_KEY must be set in your .env file'
      );
    }

    config = {
      secretKey,
      publicKey,
      isTestMode: secretKey.startsWith('sk_test_'),
    };
  }

  return config;
}

export function isYocoConfigured(): boolean {
  try {
    getYocoConfig();
    return true;
  } catch {
    return false;
  }
}

export function getYocoPublicKey(): string {
  return getYocoConfig().publicKey;
}

const YOCO_API_BASE = 'https://payments.yoco.com/api';

/**
 * Create a Yoco checkout session
 * Returns a redirect URL where the user can complete payment
 */
export async function createYocoCheckout(
  request: YocoCheckoutRequest
): Promise<YocoCheckoutResponse> {
  const config = getYocoConfig();

  const response = await fetch(`${YOCO_API_BASE}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.secretKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Yoco checkout failed: ${response.status} ${JSON.stringify(errorData)}`
    );
  }

  return response.json();
}

/**
 * Verify a webhook signature from Yoco
 * Yoco uses HMAC-SHA256 for webhook verification
 */
export function verifyYocoWebhook(
  payload: string,
  signature: string,
  webhookSecret: string
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Yoco webhook event types
export const YOCO_EVENTS = {
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  CHECKOUT_EXPIRED: 'checkout.expired',
  REFUND_SUCCEEDED: 'refund.succeeded',
  REFUND_FAILED: 'refund.failed',
} as const;
