import { buildPayFastPaymentUrl, getPayFastConfig, PAYFAST_FREQUENCY, PayFastPaymentData } from './payfastClient';
import { PRICING_TIERS } from '@shared/schema';

export interface PayFastProduct {
  tier: keyof typeof PRICING_TIERS;
  name: string;
  description: string;
  price: number; // in ZAR
  priceUsd: number; // original USD price
  isRecurring: boolean;
  frequency?: number; // PayFast frequency code
  duration: number; // days
}

// Exchange rate: approximately 1 USD = 18.5 ZAR (adjust as needed)
const USD_TO_ZAR = 18.5;

export class PayFastService {
  /**
   * Get all available products with ZAR pricing
   */
  getProducts(): PayFastProduct[] {
    return [
      {
        tier: 'day_pass',
        name: PRICING_TIERS.day_pass.name,
        description: PRICING_TIERS.day_pass.description,
        priceUsd: PRICING_TIERS.day_pass.price,
        price: Math.round(PRICING_TIERS.day_pass.price * USD_TO_ZAR * 100) / 100,
        isRecurring: false,
        duration: PRICING_TIERS.day_pass.duration,
      },
      {
        tier: 'weekly',
        name: PRICING_TIERS.weekly.name,
        description: PRICING_TIERS.weekly.description,
        priceUsd: PRICING_TIERS.weekly.price,
        price: Math.round(PRICING_TIERS.weekly.price * USD_TO_ZAR * 100) / 100,
        isRecurring: false, // PayFast doesn't support weekly recurring
        duration: PRICING_TIERS.weekly.duration,
      },
      {
        tier: 'monthly',
        name: PRICING_TIERS.monthly.name,
        description: PRICING_TIERS.monthly.description,
        priceUsd: PRICING_TIERS.monthly.price,
        price: Math.round(PRICING_TIERS.monthly.price * USD_TO_ZAR * 100) / 100,
        isRecurring: true,
        frequency: PAYFAST_FREQUENCY.monthly,
        duration: PRICING_TIERS.monthly.duration,
      },
      {
        tier: 'yearly',
        name: PRICING_TIERS.yearly.name,
        description: PRICING_TIERS.yearly.description,
        priceUsd: PRICING_TIERS.yearly.price,
        price: Math.round(PRICING_TIERS.yearly.price * USD_TO_ZAR * 100) / 100,
        isRecurring: true,
        frequency: PAYFAST_FREQUENCY.yearly,
        duration: PRICING_TIERS.yearly.duration,
      },
    ];
  }

  /**
   * Get product by tier
   */
  getProductByTier(tier: keyof typeof PRICING_TIERS): PayFastProduct | undefined {
    return this.getProducts().find(p => p.tier === tier);
  }

  /**
   * Create payment data for PayFast redirect
   */
  createPaymentData(options: {
    tier: keyof typeof PRICING_TIERS;
    userId: string;
    userEmail?: string;
    userName?: string;
    returnUrl: string;
    cancelUrl: string;
    notifyUrl: string;
  }): { url: string; formData: Record<string, string> } {
    const product = this.getProductByTier(options.tier);

    if (!product) {
      throw new Error(`Unknown tier: ${options.tier}`);
    }

    // Generate unique payment ID
    const paymentId = `${options.userId}-${options.tier}-${Date.now()}`;

    const paymentData: PayFastPaymentData = {
      m_payment_id: paymentId,
      amount: product.price.toFixed(2),
      item_name: `AcademicGen ${product.name}`,
      item_description: product.description,
      email_address: options.userEmail,
      name_first: options.userName?.split(' ')[0],
      name_last: options.userName?.split(' ').slice(1).join(' '),
      return_url: options.returnUrl,
      cancel_url: options.cancelUrl,
      notify_url: options.notifyUrl,
      // Custom fields for our use
      custom_str1: options.userId,
      custom_str2: options.tier,
      custom_int1: product.duration,
    };

    // Add recurring billing for subscriptions
    if (product.isRecurring && product.frequency) {
      paymentData.subscription_type = 1;
      paymentData.recurring_amount = product.price.toFixed(2);
      paymentData.frequency = product.frequency as 3 | 4 | 5 | 6;
      paymentData.cycles = 0; // Indefinite
    }

    return buildPayFastPaymentUrl(paymentData);
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
   * Check if PayFast is properly configured
   */
  isConfigured(): boolean {
    try {
      getPayFastConfig();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the PayFast base URL (sandbox or production)
   */
  getBaseUrl(): string {
    const config = getPayFastConfig();
    return config.baseUrl;
  }

  /**
   * Check if using sandbox mode
   */
  isSandbox(): boolean {
    const config = getPayFastConfig();
    return config.sandbox;
  }
}

export const payfastService = new PayFastService();
