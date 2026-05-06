import { createYocoCheckout, getYocoConfig, isYocoConfigured, YocoCheckoutResponse } from './yocoClient';
import { PRICING_TIERS } from '@shared/schema';

export interface YocoProduct {
  tier: keyof typeof PRICING_TIERS;
  name: string;
  description: string;
  priceZar: number; // in ZAR cents (e.g., 1850 = R18.50)
  priceUsd: number;
  duration: number; // days
}

// Exchange rate: approximately 1 USD = 18.5 ZAR
const USD_TO_ZAR = 18.5;

export class YocoService {
  /**
   * Get all available products with ZAR pricing (in cents for Yoco)
   */
  getProducts(): YocoProduct[] {
    return [
      {
        tier: 'day_pass',
        name: PRICING_TIERS.day_pass.name,
        description: PRICING_TIERS.day_pass.description,
        priceUsd: PRICING_TIERS.day_pass.price,
        priceZar: Math.round(PRICING_TIERS.day_pass.price * USD_TO_ZAR * 100), // cents
        duration: PRICING_TIERS.day_pass.duration,
      },
      {
        tier: 'weekly',
        name: PRICING_TIERS.weekly.name,
        description: PRICING_TIERS.weekly.description,
        priceUsd: PRICING_TIERS.weekly.price,
        priceZar: Math.round(PRICING_TIERS.weekly.price * USD_TO_ZAR * 100), // cents
        duration: PRICING_TIERS.weekly.duration,
      },
      {
        tier: 'monthly',
        name: PRICING_TIERS.monthly.name,
        description: PRICING_TIERS.monthly.description,
        priceUsd: PRICING_TIERS.monthly.price,
        priceZar: Math.round(PRICING_TIERS.monthly.price * USD_TO_ZAR * 100), // cents
        duration: PRICING_TIERS.monthly.duration,
      },
      {
        tier: 'yearly',
        name: PRICING_TIERS.yearly.name,
        description: PRICING_TIERS.yearly.description,
        priceUsd: PRICING_TIERS.yearly.price,
        priceZar: Math.round(PRICING_TIERS.yearly.price * USD_TO_ZAR * 100), // cents
        duration: PRICING_TIERS.yearly.duration,
      },
    ];
  }

  /**
   * Get product by tier
   */
  getProductByTier(tier: keyof typeof PRICING_TIERS): YocoProduct | undefined {
    return this.getProducts().find(p => p.tier === tier);
  }

  /**
   * Create a Yoco checkout session
   */
  async createCheckout(options: {
    tier: keyof typeof PRICING_TIERS;
    userId: string;
    userEmail?: string;
    successUrl: string;
    cancelUrl: string;
    failureUrl?: string;
  }): Promise<YocoCheckoutResponse> {
    const product = this.getProductByTier(options.tier);

    if (!product) {
      throw new Error(`Unknown tier: ${options.tier}`);
    }

    // Yoco requires minimum R2.00 (200 cents)
    if (product.priceZar < 200) {
      throw new Error('Minimum payment amount is R2.00');
    }

    const externalId = `${options.userId}-${options.tier}-${Date.now()}`;

    const checkout = await createYocoCheckout({
      amount: product.priceZar,
      currency: 'ZAR',
      successUrl: options.successUrl,
      cancelUrl: options.cancelUrl,
      failureUrl: options.failureUrl || options.cancelUrl,
      externalId,
      metadata: {
        userId: options.userId,
        tier: options.tier,
        duration: String(product.duration),
        email: options.userEmail || '',
      },
    });

    return checkout;
  }

  /**
   * Calculate subscription expiry date based on tier
   */
  calculateExpiryDate(tier: keyof typeof PRICING_TIERS): Date {
    const product = this.getProductByTier(tier);
    const days = product?.duration || 30;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
  }

  /**
   * Check if Yoco is configured
   */
  isConfigured(): boolean {
    return isYocoConfigured();
  }

  /**
   * Check if using test mode
   */
  isTestMode(): boolean {
    try {
      const config = getYocoConfig();
      return config.isTestMode;
    } catch {
      return true;
    }
  }

  /**
   * Format price for display
   */
  formatPriceZar(priceInCents: number): string {
    return `R${(priceInCents / 100).toFixed(2)}`;
  }
}

export const yocoService = new YocoService();
