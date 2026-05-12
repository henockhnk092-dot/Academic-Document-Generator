import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { useUsage } from "@/hooks/use-usage";
import { apiRequest } from "@/lib/queryClient";
import { PRICING_TIERS } from "@shared/schema";
import {
  Crown,
  Check,
  X,
  Zap,
  Clock,
  Calendar,
  Loader2,
  Sparkles,
  Shield,
  Code,
  ArrowRight,
  ExternalLink,
  Coffee,
} from "lucide-react";
import { useTranslation } from "react-i18next";

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

const FEATURE_KEYS = ["feature1", "feature2", "feature3", "feature4", "feature5", "feature6", "feature7", "feature8"] as const;

export default function Pricing() {
  const { t } = useTranslation();

  const [, setLocation] = useLocation();
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderInfo | null>(null);

  const { toast } = useToast();
  const { user, isAuthenticated, userRole, hasUnlimitedAccess } = useAuth();
  const { getUsageStatus, isLoading: usageLoading } = useUsage();

  const usageStatus = getUsageStatus();

  useEffect(() => {
    fetchPaymentProvider();
  }, []);

  useEffect(() => {
    // Only fetch Stripe products if Stripe is the preferred provider
    if (paymentProvider?.preferred === 'stripe') {
      fetchProducts();
    } else if (paymentProvider) {
      setIsLoadingProducts(false);
    }
  }, [paymentProvider]);

  const fetchPaymentProvider = async () => {
    try {
      const response = await fetch("/api/payment/provider");
      const data = await response.json();
      setPaymentProvider(data);
    } catch (error) {
      console.error("Failed to fetch payment provider:", error);
      // Default to showing pricing even if provider check fails
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
      console.error("Failed to fetch products:", error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const getProductForTier = (tier: keyof typeof PRICING_TIERS): StripeProduct | undefined => {
    return products.find(p => p.product_metadata?.tier === tier);
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

  const handleSelectPlan = async (plan: keyof typeof PRICING_TIERS) => {
    if (!isAuthenticated || !user) {
      toast({
        title: t("pages.pricing.signInRequired"),
        description: t("pages.pricing.signInRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    setSelectedPlan(plan);
    setIsCheckoutLoading(true);

    try {
      // Handle Buy Me a Coffee checkout
      if (paymentProvider?.preferred === 'bmc') {
        const response = await fetch(`/api/bmc/checkout-url?tier=${plan}`);
        const data = await response.json();
        if (data.url) {
          // Open BMC in new tab (BMC doesn't support custom redirects)
          window.open(data.url, '_blank');
          toast({
            title: t("pages.pricing.openingBMC"),
            description: t("pages.pricing.openingBMCDesc"),
          });
        } else {
          throw new Error("No checkout URL returned");
        }
        setIsCheckoutLoading(false);
        setSelectedPlan(null);
        return;
      }

      // Handle Yoco checkout
      if (paymentProvider?.preferred === 'yoco') {
        const data = await apiRequest<{ url: string }>("POST", "/api/yoco/checkout", {
          tier: plan,
          userId: user.uid,
          userEmail: user.email,
        });

        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No checkout URL returned");
        }
        return;
      }

      // Handle Stripe checkout (default)
      const product = getProductForTier(plan);
      if (!product?.price_id) {
        toast({
          title: t("pages.pricing.productsLoading"),
          description: t("pages.pricing.productsLoadingDesc"),
          variant: "destructive",
        });
        return;
      }

      const data = await apiRequest<{ url: string }>("POST", "/api/stripe/checkout", {
        priceId: product.price_id,
        userId: user.uid,
        userEmail: user.email,
      });

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: t("pages.pricing.checkoutFailed"),
        description: error.message || t("pages.pricing.checkoutFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setIsCheckoutLoading(false);
      setSelectedPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!user?.uid) return;

    setIsCheckoutLoading(true);
    try {
      const data = await apiRequest<{ url: string }>("POST", "/api/stripe/portal", {
        userId: user.uid,
      });

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error: any) {
      console.error("Portal error:", error);
      toast({
        title: t("pages.pricing.portalError"),
        description: error.message || t("pages.pricing.portalErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const getCurrentPlanBadge = () => {
    if (userRole === "admin") {
      return (
        <Badge className="gap-1.5 border-red-500/50 bg-red-500/10 text-red-500" variant="outline">
          <Shield className="h-3.5 w-3.5" />
          {t("pages.settings.roleAdmin")}
        </Badge>
      );
    }
    if (userRole === "developer") {
      return (
        <Badge className="gap-1.5 border-blue-500/50 bg-blue-500/10 text-blue-500" variant="outline">
          <Code className="h-3.5 w-3.5" />
          {t("pages.settings.roleDeveloper")}
        </Badge>
      );
    }
    if (usageStatus.hasActiveSubscription && usageStatus.subscriptionTier) {
      return (
        <Badge className="gap-1.5" variant="outline">
          <Crown className="h-3.5 w-3.5 text-primary" />
          <span className="capitalize">{usageStatus.subscriptionTier}</span>
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1.5">
        {t("pages.pricing.freePlan")}
      </Badge>
    );
  };

  const getTierName = (tier: typeof TIER_ORDER[number]): string => {
    switch (tier) {
      case 'day_pass': return t("pages.pricing.dayPass");
      case 'weekly': return t("pages.pricing.weekly");
      case 'monthly': return t("pages.pricing.monthly");
      case 'yearly': return t("pages.pricing.yearly");
    }
  };

  const getTierDescription = (tier: typeof TIER_ORDER[number]): string => {
    switch (tier) {
      case 'day_pass': return t("pages.pricing.dayPassDesc");
      case 'weekly': return t("pages.pricing.weeklyDesc");
      case 'monthly': return t("pages.pricing.monthlyDesc");
      case 'yearly': return t("pages.pricing.yearlyDesc");
    }
  };

  return (
    <div className="container max-w-6xl py-8 px-4 mx-auto" data-testid="page-pricing">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight flex items-center justify-center gap-3">
            <Crown className="h-10 w-10 text-primary" />
            {t("pages.pricing.title")}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("pages.pricing.subtitle")}
          </p>
          {paymentProvider?.preferred === 'bmc' && (
            <div className="flex items-center justify-center gap-2 text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 py-2 px-4 rounded-lg max-w-md mx-auto">
              <Coffee className="h-4 w-4" />
              <span>{t("pages.pricing.securePayments")}</span>
            </div>
          )}
        </div>

        {/* Current Plan Status */}
        {isAuthenticated && (
          <Card className="bg-muted/30">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("pages.pricing.currentPlan")}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getCurrentPlanBadge()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                {hasUnlimitedAccess ? (
                  <p className="text-sm font-medium text-green-600">{t("pages.pricing.unlimitedAccess")}</p>
                ) : usageStatus.hasActiveSubscription ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-600">{t("pages.pricing.activeSubscription")}</p>
                    {usageStatus.subscriptionExpiry && (
                      <p className="text-xs text-muted-foreground">
                        {t("pages.pricing.renews")} {new Date(usageStatus.subscriptionExpiry).toLocaleDateString()}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManageSubscription}
                      disabled={isCheckoutLoading}
                    >
                      {t("pages.pricing.manageSubscription")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {usageStatus.remaining} / {usageStatus.maxAttempts} {t("pages.settings.generationsLeft")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Cards */}
        {isLoadingProducts ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {TIER_ORDER.map((tier) => {
              const tierInfo = PRICING_TIERS[tier];
              const product = getProductForTier(tier);
              const Icon = TIER_ICONS[tier];
              const isPopular = tier === 'monthly';
              const isBestValue = tier === 'yearly';
              const isSelected = selectedPlan === tier;
              const isProcessing = isSelected && isCheckoutLoading;

              return (
                <Card
                  key={tier}
                  className={`relative flex flex-col ${isPopular ? 'border-primary border-2 shadow-lg' : ''} ${isBestValue ? 'bg-gradient-to-br from-primary/5 to-primary/10' : ''}`}
                  data-testid={`card-pricing-${tier.replace('_', '-')}`}
                >
                  {isPopular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 whitespace-nowrap">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {t("pages.pricing.mostPopular")}
                    </Badge>
                  )}
                  {isBestValue && (
                    <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 whitespace-nowrap">
                      {t("pages.pricing.bestValue")}
                    </Badge>
                  )}
                  <CardHeader className="pb-4 pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-2 rounded-lg ${isPopular || isBestValue ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Icon className={`h-5 w-5 ${isPopular || isBestValue ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <CardTitle className="text-xl">{getTierName(tier)}</CardTitle>
                    </div>
                    <CardDescription>{getTierDescription(tier)}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="mb-4">
                      <span className="text-4xl font-bold">
                        {formatPrice(product, tierInfo.price)}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        {tier === 'day_pass' ? t("pages.pricing.oneTime") : getRecurringText(product, t("pages.pricing.perInterval", { interval: tier.replace('_', ' ') }))}
                      </span>
                    </div>
                    {tier === 'yearly' && (
                      <p className="text-sm text-green-600 mb-4">
                        {t("pages.pricing.save25")}
                      </p>
                    )}
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{t("pages.pricing.unlimitedGenerations")}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{t("pages.pricing.allDocumentTypes")}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{t("pages.pricing.aiImageGeneration")}</span>
                      </li>
                    </ul>
                  </CardContent>
                  <CardFooter className="pt-4">
                    <Button
                      className="w-full"
                      size="lg"
                      variant={isPopular || isBestValue ? "default" : "outline"}
                      onClick={() => handleSelectPlan(tier)}
                      disabled={isProcessing || isCheckoutLoading || (hasUnlimitedAccess && userRole !== "user")}
                      data-testid={`button-select-${tier.replace('_', '-')}`}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("pages.pricing.processing")}
                        </>
                      ) : hasUnlimitedAccess ? (
                        t("pages.pricing.currentPlan")
                      ) : paymentProvider?.preferred === 'bmc' ? (
                        <>
                          <Coffee className="mr-2 h-4 w-4" />
                          {t("pages.pricing.subscribe")}
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </>
                      ) : (
                        <>
                          {t("pages.pricing.getStarted")}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Features Section */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("pages.pricing.allPlansInclude")}
            </CardTitle>
            <CardDescription>
              {t("pages.pricing.allPlansDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURE_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{t(`pages.pricing.${key}`)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Comparison Table */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-center">{t("pages.pricing.planComparison")}</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold w-1/2">{t("pages.pricing.tableFeature")}</th>
                  <th className="text-center px-4 py-3 font-semibold">{t("pages.pricing.tableFree")}</th>
                  <th className="text-center px-4 py-3 font-semibold">{t("pages.pricing.tableDayPass")}</th>
                  <th className="text-center px-4 py-3 font-semibold text-primary">{t("pages.pricing.tableMonthly")}</th>
                  <th className="text-center px-4 py-3 font-semibold">{t("pages.pricing.tableYearly")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  { label: t("pages.pricing.tableGenerations"), free: t("pages.pricing.tableFreeGenerations"), paid: t("pages.pricing.tableUnlimited") },
                  { label: t("pages.pricing.tableReports"), free: true, paid: true },
                  { label: t("pages.pricing.tableThesis"), free: false, paid: true },
                  { label: t("pages.pricing.tableConference"), free: false, paid: true },
                  { label: t("pages.pricing.tablePowerpoint"), free: true, paid: true },
                  { label: t("pages.pricing.tableAIImages"), free: false, paid: true },
                  { label: t("pages.pricing.tableAIHumanizer"), free: false, paid: true },
                  { label: t("pages.pricing.tableCitations"), free: true, paid: true },
                  { label: t("pages.pricing.tableExport"), free: true, paid: true },
                  { label: t("pages.pricing.tableCloudStorage"), free: false, paid: true },
                  { label: t("pages.pricing.tableRefManager"), free: true, paid: true },
                  { label: t("pages.pricing.tableLanguages"), free: true, paid: true },
                  { label: t("pages.pricing.tableTTS"), free: false, paid: true },
                  { label: t("pages.pricing.tablePrioritySupport"), free: false, paid: true },
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="px-4 py-2.5 font-medium">{row.label}</td>
                    {/* Free */}
                    <td className="px-4 py-2.5 text-center">
                      {typeof row.free === "string" ? (
                        <span className="text-muted-foreground">{row.free}</span>
                      ) : row.free ? (
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      )}
                    </td>
                    {/* Day Pass */}
                    <td className="px-4 py-2.5 text-center">
                      {typeof row.paid === "string" ? (
                        <span className="text-muted-foreground">{row.paid}</span>
                      ) : row.paid ? (
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      )}
                    </td>
                    {/* Monthly */}
                    <td className="px-4 py-2.5 text-center bg-primary/5">
                      {typeof row.paid === "string" ? (
                        <span className="text-muted-foreground">{row.paid}</span>
                      ) : row.paid ? (
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      )}
                    </td>
                    {/* Yearly */}
                    <td className="px-4 py-2.5 text-center">
                      {typeof row.paid === "string" ? (
                        <span className="text-muted-foreground">{row.paid}</span>
                      ) : row.paid ? (
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-center">{t("pages.pricing.faqTitle")}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("pages.pricing.faq1Q")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t("pages.pricing.faq1A")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("pages.pricing.faq2Q")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {paymentProvider?.preferred === 'bmc'
                    ? t("pages.pricing.faq2A")
                    : t("pages.pricing.faq2ACard")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("pages.pricing.faq3Q")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t("pages.pricing.faq3A")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("pages.pricing.faq4Q")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t("pages.pricing.faq4A")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
