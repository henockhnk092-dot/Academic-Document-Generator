/**
 * Buy Me a Coffee Integration Client
 *
 * BMC acts as the Merchant of Record, handling all payment processing.
 * This integration uses BMC memberships for subscription tiers.
 *
 * Setup:
 * 1. Create account at buymeacoffee.com
 * 2. Set up membership tiers matching your pricing
 * 3. Get your webhook secret from Settings > Integrations > Webhooks
 * 4. Configure the webhook URL to point to /api/bmc/webhook
 */

import crypto from 'crypto';
import { PRICING_TIERS } from '@shared/schema';

// BMC Webhook event types
export const BMC_EVENTS = {
  MEMBERSHIP_STARTED: 'membership.started',
  MEMBERSHIP_CANCELLED: 'membership.cancelled',
  MEMBERSHIP_EXPIRED: 'membership.expired',
  DONATION_RECEIVED: 'donation.received',
  EXTRA_PURCHASED: 'extra.purchased',
} as const;

// BMC Webhook payload structure
export interface BMCWebhookPayload {
  event: string;
  data: {
    supporter_email: string;
    supporter_name: string;
    amount: number;
    currency: string;
    message?: string;
    membership_level_id?: number;
    membership_level_name?: string;
    duration?: string; // 'monthly' or 'yearly'
    extra_id?: number;
    extra_name?: string;
    transaction_id?: string;
    created_at: string;
  };
}

// Mapping of BMC membership level names to our tiers
// You'll need to create these tiers on BMC with exact names
export const BMC_TIER_MAPPING: Record<string, keyof typeof PRICING_TIERS> = {
  'Day Pass': 'day_pass',
  'Weekly Access': 'weekly',
  'Monthly Access': 'monthly',
  'Yearly Access': 'yearly',
  // Alternative names
  'day_pass': 'day_pass',
  'weekly': 'weekly',
  'monthly': 'monthly',
  'yearly': 'yearly',
};

// BMC Configuration
export interface BMCConfig {
  username: string;           // Your BMC username (for the link)
  webhookSecret: string;      // Webhook secret for signature verification
  accessToken?: string;       // Optional: API access token for advanced features
}

/**
 * Get BMC configuration from environment
 */
export function getBMCConfig(): BMCConfig {
  const username = process.env.BMC_USERNAME;
  const webhookSecret = process.env.BMC_WEBHOOK_SECRET;
  const accessToken = process.env.BMC_ACCESS_TOKEN;

  if (!username) {
    throw new Error('BMC_USERNAME is not configured');
  }

  return {
    username,
    webhookSecret: webhookSecret || '',
    accessToken,
  };
}

/**
 * Check if BMC is configured
 */
export function isBMCConfigured(): boolean {
  return !!process.env.BMC_USERNAME;
}

/**
 * Get the BMC page URL for a specific tier
 * Users will be redirected here to complete payment
 */
export function getBMCCheckoutUrl(tier?: keyof typeof PRICING_TIERS): string {
  const config = getBMCConfig();
  const baseUrl = `https://buymeacoffee.com/${config.username}`;

  // BMC handles tiers through their membership page
  // The user selects their tier on the BMC page
  return tier ? `${baseUrl}/membership` : baseUrl;
}

/**
 * Verify BMC webhook signature
 * BMC uses HMAC-SHA256 for webhook verification
 */
export function verifyBMCWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret || !signature) {
    // If no secret configured, skip verification (development mode)
    return true;
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    const expectedSignature = hmac.update(payload).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Parse tier from BMC membership level name
 */
export function parseBMCTier(membershipLevelName?: string): keyof typeof PRICING_TIERS | null {
  if (!membershipLevelName) return null;

  // Try exact match first
  if (BMC_TIER_MAPPING[membershipLevelName]) {
    return BMC_TIER_MAPPING[membershipLevelName];
  }

  // Try case-insensitive match
  const lowerName = membershipLevelName.toLowerCase();
  for (const [key, value] of Object.entries(BMC_TIER_MAPPING)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  // Try to parse from name containing tier keywords
  if (lowerName.includes('day')) return 'day_pass';
  if (lowerName.includes('week')) return 'weekly';
  if (lowerName.includes('year')) return 'yearly';
  if (lowerName.includes('month')) return 'monthly';

  return null;
}

/**
 * Calculate subscription expiry based on tier
 */
export function calculateBMCExpiry(tier: keyof typeof PRICING_TIERS): Date {
  const tierConfig = PRICING_TIERS[tier];
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + tierConfig.duration);
  return expiry;
}

/**
 * Get BMC products for display (with our pricing)
 */
export function getBMCProducts() {
  const config = getBMCConfig();

  return Object.entries(PRICING_TIERS).map(([key, tier]) => ({
    tier: key as keyof typeof PRICING_TIERS,
    name: tier.name,
    description: tier.description,
    priceUsd: tier.price,
    duration: tier.duration,
    bmcUrl: `https://buymeacoffee.com/${config.username}/membership`,
  }));
}
