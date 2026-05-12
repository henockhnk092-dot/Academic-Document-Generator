import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Clock, Calendar, Crown, Loader2, Coffee, ExternalLink } from "lucide-react";
import { PRICING_TIERS } from "@shared/schema";

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlan?: (plan: keyof typeof PRICING_TIERS, priceId?: string, paymentProvider?: string) => void;
  isLoading?: boolean;
}

interface StripeProduct {
  product_id: string;
  product_name: string;
  product_description: string;
  product_metadata: Record<string, string>;
  price_id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
}

interface PaymentProviderInfo {
  preferred: 'bmc' | 'yoco' | 'stripe' | 'none';
  bmc: boolean;
  yoco: boolean;
  stripe: boolean;
}

const TIER_ICONS = {
  day_pass: Clock,
  weekly: Zap,
  monthly: Calendar,
  yearly: Crown,
};

const TIER_ORDER = ['day_pass', 'weekly', 'monthly', 'yearly'] as const;

export function PricingModal({ open, onOpenChange, onSelectPlan, isLoading: externalLoading }: PricingModalProps) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderInfo | null>(null);

  useEffect(() => {
    if (open) {
      fetchPaymentProvider();
    }
  }, [open]);

  useEffect(() => {
    // Only fetch Stripe products if Stripe is the preferred provider
    if (paymentProvider?.preferred === 'stripe' && products.length === 0) {
      fetchProducts();
    } else if (paymentProvider && paymentProvider.preferred !== 'stripe') {
      setIsLoadingProducts(false);
    }
  }, [paymentProvider]);

  const fetchPaymentProvider = async () => {
    try {
      const response = await fetch("/api/payment/provider");
      const data = await response.json();
      setPaymentProvider(data);
    } catch (error) {
      console.error("[PricingModal] Failed to fetch payment provider:", error);
      setPaymentProvider({ preferred: 'none', bmc: false, yoco: false, stripe: false });
    }
  };

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const response = await fetch("/api/stripe/products");
      const data = await response.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error("[PricingModal] Failed to fetch products:", error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const getProductForTier = (tier: keyof typeof PRICING_TIERS): StripeProduct | undefined => {
    // First try exact metadata match
    const byMetadata = products.find(p => p.product_metadata?.tier === tier);
    if (byMetadata) return byMetadata;

    // Fallback: match by product name
    const tierInfo = PRICING_TIERS[tier];
    const tierName = tierInfo.name.toLowerCase();
    const byName = products.find(p =>
      p.product_name?.toLowerCase().includes(tierName) ||
      p.product_name?.toLowerCase().replace(/\s+/g, '_') === tier ||
      p.product_name?.toLowerCase().replace(/\s+/g, '') === tier.replace('_', '')
    );
    if (byName) return byName;

    // Fallback: match by recurring interval for subscriptions
    if (tier === 'weekly') {
      return products.find(p => p.recurring?.interval === 'week');
    }
    if (tier === 'monthly') {
      return products.find(p => p.recurring?.interval === 'month');
    }
    if (tier === 'yearly') {
      return products.find(p => p.recurring?.interval === 'year');
    }
    // Day pass is one-time (no recurring)
    if (tier === 'day_pass') {
      return products.find(p => !p.recurring && p.unit_amount === 100); // $1.00
    }

    return undefined;
  };

  const handleSelectPlan = (plan: keyof typeof PRICING_TIERS) => {
    const product = paymentProvider?.preferred === 'stripe' ? getProductForTier(plan) : undefined;

    setSelectedPlan(plan);
    onSelectPlan?.(plan, product?.price_id, paymentProvider?.preferred);
  };

  const formatPrice = (product: StripeProduct | undefined, fallbackPrice: number): string => {
    if (product) {
      return `$${(product.unit_amount / 100).toFixed(2)}`;
    }
    return `$${fallbackPrice.toFixed(2)}`;
  };

  const getRecurringText = (product: StripeProduct | undefined, fallback: string): string => {
    if (product?.recurring) {
      return t("pages.pricing.perInterval", { interval: product.recurring.interval });
    }
    return fallback;
  };

  const isBMC = paymentProvider?.preferred === 'bmc';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">{t("pages.pricing.upgradeYourPlan")}</DialogTitle>
          <DialogDescription className="text-center">
            {t("pages.pricing.usedAllGenerations")}
          </DialogDescription>
        </DialogHeader>

        {isBMC && (
          <div className="flex items-center justify-center gap-2 text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 py-2 px-4 rounded-lg">
            <Coffee className="h-4 w-4" />
            <span>{t("pages.pricing.securePayments")}</span>
          </div>
        )}

        {isLoadingProducts && paymentProvider?.preferred === 'stripe' ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {TIER_ORDER.map((tier) => {
              const tierInfo = PRICING_TIERS[tier];
              const product = paymentProvider?.preferred === 'stripe' ? getProductForTier(tier) : undefined;
              const Icon = TIER_ICONS[tier];
              const isPopular = tier === 'monthly';
              const isBestValue = tier === 'yearly';
              const isSelected = selectedPlan === tier;
              const isProcessing = isSelected && externalLoading;

              return (
                <Card
                  key={tier}
                  className={`relative ${isPopular ? 'border-primary' : ''} ${isBestValue ? 'bg-gradient-to-br from-primary/5 to-primary/10' : ''}`}
                  data-testid={`card-pricing-${tier.replace('_', '-')}`}
                >
                  {isPopular && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">{t("pages.pricing.mostPopular")}</Badge>
                  )}
                  {isBestValue && (
                    <Badge variant="secondary" className="absolute -top-2 left-1/2 -translate-x-1/2">{t("pages.pricing.bestValue")}</Badge>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${isPopular || isBestValue ? 'text-primary' : 'text-muted-foreground'}`} />
                      <CardTitle className="text-lg">{tierInfo.name}</CardTitle>
                    </div>
                    <CardDescription>{tierInfo.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="text-3xl font-bold">
                      {formatPrice(product, tierInfo.price)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tier === 'day_pass' ? t("pages.pricing.oneTime") : getRecurringText(product, t("pages.pricing.perInterval", { interval: tier.replace('_', ' ') }))}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={isPopular || isBestValue ? "default" : "outline"}
                      onClick={() => handleSelectPlan(tier)}
                      disabled={isProcessing || externalLoading}
                      data-testid={`button-select-${tier.replace('_', '-')}`}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("pages.pricing.processing")}
                        </>
                      ) : isBMC ? (
                        <>
                          <Coffee className="mr-2 h-4 w-4" />
                          {t("pages.pricing.getPlan", { name: tierInfo.name.split(' ')[0] })}
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </>
                      ) : (
                        t("pages.pricing.getPlan", { name: tierInfo.name.split(' ')[0] })
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-6 space-y-2">
          <h4 className="font-medium text-center">{t("pages.pricing.allPlansInclude")}:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>{t("pages.pricing.unlimitedGenerations")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>{t("pages.pricing.allDocumentTypes")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>{t("pages.pricing.cloudStorage")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>{t("pages.pricing.exportAllFormats")}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
