import crypto from 'crypto';

/**
 * PayFast configuration using environment variables
 *
 * Required env vars:
 * - PAYFAST_MERCHANT_ID      (sandbox: 10000100, or your live merchant ID)
 * - PAYFAST_MERCHANT_KEY     (sandbox: 46f0cd694581a, or your live key)
 * - PAYFAST_PASSPHRASE       (optional, for signature verification)
 * - PAYFAST_SANDBOX          (true/false - use sandbox environment)
 */

export interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
  baseUrl: string;
}

let config: PayFastConfig | null = null;

export function getPayFastConfig(): PayFastConfig {
  if (!config) {
    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;

    if (!merchantId || !merchantKey) {
      throw new Error(
        'PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY must be set in your .env file'
      );
    }

    const sandbox = process.env.PAYFAST_SANDBOX !== 'false';

    config = {
      merchantId,
      merchantKey,
      passphrase: process.env.PAYFAST_PASSPHRASE || '',
      sandbox,
      baseUrl: sandbox
        ? 'https://sandbox.payfast.co.za'
        : 'https://www.payfast.co.za',
    };
  }

  return config;
}

export function isPayFastConfigured(): boolean {
  try {
    getPayFastConfig();
    return true;
  } catch {
    return false;
  }
}

export interface PayFastPaymentData {
  // Merchant details (auto-populated)
  merchant_id?: string;
  merchant_key?: string;

  // Customer details
  name_first?: string;
  name_last?: string;
  email_address?: string;
  cell_number?: string;

  // Transaction details
  m_payment_id: string; // Your custom payment ID
  amount: string; // Amount in ZAR (e.g., "100.00")
  item_name: string;
  item_description?: string;

  // URLs
  return_url?: string;
  cancel_url?: string;
  notify_url?: string; // ITN callback URL

  // Recurring billing (subscriptions)
  subscription_type?: 1 | 2; // 1 = subscription, 2 = ad-hoc
  billing_date?: string; // YYYY-MM-DD
  recurring_amount?: string;
  frequency?: 3 | 4 | 5 | 6; // 3=monthly, 4=quarterly, 5=biannually, 6=annually
  cycles?: number; // 0 = indefinite

  // Custom data
  custom_str1?: string;
  custom_str2?: string;
  custom_str3?: string;
  custom_str4?: string;
  custom_str5?: string;
  custom_int1?: number;
  custom_int2?: number;
  custom_int3?: number;
  custom_int4?: number;
  custom_int5?: number;
}

/**
 * Generate MD5 signature for PayFast payment data
 */
export function generatePayFastSignature(data: Record<string, any>, passphrase?: string): string {
  // Create parameter string (sorted alphabetically, URL encoded)
  const paramString = Object.keys(data)
    .filter(key => data[key] !== undefined && data[key] !== '' && key !== 'signature')
    .sort()
    .map(key => `${key}=${encodeURIComponent(String(data[key]).trim()).replace(/%20/g, '+')}`)
    .join('&');

  // Add passphrase if provided
  const stringToSign = passphrase
    ? `${paramString}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`
    : paramString;

  // Generate MD5 hash
  return crypto.createHash('md5').update(stringToSign).digest('hex');
}

/**
 * Verify ITN signature from PayFast
 */
export function verifyPayFastSignature(data: Record<string, any>, signature: string): boolean {
  const config = getPayFastConfig();
  const calculatedSignature = generatePayFastSignature(data, config.passphrase);
  return calculatedSignature === signature;
}

/**
 * Build PayFast payment URL with all required data
 */
export function buildPayFastPaymentUrl(paymentData: PayFastPaymentData): { url: string; formData: Record<string, string> } {
  const config = getPayFastConfig();

  // Build the complete data object
  const data: Record<string, any> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    ...paymentData,
  };

  // Remove undefined values
  Object.keys(data).forEach(key => {
    if (data[key] === undefined || data[key] === '') {
      delete data[key];
    }
  });

  // Generate signature
  data.signature = generatePayFastSignature(data, config.passphrase);

  // Convert all values to strings for form submission
  const formData: Record<string, string> = {};
  Object.keys(data).forEach(key => {
    formData[key] = String(data[key]);
  });

  return {
    url: `${config.baseUrl}/eng/process`,
    formData,
  };
}

/**
 * Validate ITN request from PayFast
 */
export async function validateITN(data: Record<string, any>): Promise<boolean> {
  const config = getPayFastConfig();

  // Verify the signature
  const signature = data.signature;
  if (!signature) {
    console.error('[PayFast] No signature in ITN data');
    return false;
  }

  // Remove signature for verification
  const dataWithoutSignature = { ...data };
  delete dataWithoutSignature.signature;

  if (!verifyPayFastSignature(dataWithoutSignature, signature)) {
    console.error('[PayFast] Invalid signature');
    return false;
  }

  // Validate with PayFast server (optional but recommended for production)
  try {
    const validationUrl = `${config.baseUrl}/eng/query/validate`;
    const params = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
      params.append(key, String(value));
    });

    const response = await fetch(validationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const result = await response.text();
    if (result !== 'VALID') {
      console.error('[PayFast] ITN validation failed:', result);
      return false;
    }
  } catch (error) {
    console.error('[PayFast] ITN validation request failed:', error);
    // In sandbox, we might skip validation if it fails
    if (!config.sandbox) {
      return false;
    }
  }

  return true;
}

// Subscription frequency mapping
export const PAYFAST_FREQUENCY = {
  monthly: 3,
  quarterly: 4,
  biannually: 5,
  yearly: 6,
} as const;

// Payment status codes from PayFast
export const PAYFAST_STATUS = {
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
  CANCELLED: 'CANCELLED',
} as const;
