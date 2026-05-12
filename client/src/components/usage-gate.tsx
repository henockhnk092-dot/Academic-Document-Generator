import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUsage } from "@/hooks/use-usage";
import { LoginPromptDialog } from "@/components/login-prompt-dialog";
import { PricingModal } from "@/components/pricing-modal";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { PRICING_TIERS } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface PaymentProviderInfo {
  preferred: 'bmc' | 'yoco' | 'stripe' | 'none';
  bmc: boolean;
  yoco: boolean;
  stripe: boolean;
}

interface UsageGateProps {
  children: (props: {
    checkUsage: () => Promise<boolean>;
    isChecking: boolean;
    remainingAttempts: number;
    usageStatus: ReturnType<ReturnType<typeof useUsage>["getUsageStatus"]>;
    openPricing: () => void;
  }) => React.ReactNode;
}

export function UsageGate({ children }: UsageGateProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderInfo | null>(null);
  const {
    isLoading,
    canGenerate,
    recordAttempt,
    getRemainingAttempts,
    getUsageStatus,
    showLoginPrompt,
    setShowLoginPrompt,
    showPricingModal,
    setShowPricingModal,
  } = useUsage();

  useEffect(() => {
    fetchPaymentProvider();
  }, []);

  const fetchPaymentProvider = async () => {
    try {
      const response = await fetch("/api/payment/provider");
      const data = await response.json();
      setPaymentProvider(data);
    } catch (error) {
      console.error("Failed to fetch payment provider:", error);
      setPaymentProvider({ preferred: 'none', bmc: false, yoco: false, stripe: false });
    }
  };

  const checkUsage = async (): Promise<boolean> => {
    const check = canGenerate();

    if (!check.allowed) {
      if (check.reason === "guest_limit") {
        setShowLoginPrompt(true);
        toast({
          title: t("components.usageGate.freeLimitReached"),
          description: t("components.usageGate.signInForMore"),
        });
        return false;
      }
      if (check.reason === "user_limit") {
        setShowPricingModal(true);
        toast({
          title: t("components.usageGate.freeLimitReached"),
          description: t("components.usageGate.subscribeToGenerate"),
        });
        return false;
      }
      return false;
    }

    const result = await recordAttempt();
    if (!result.success) {
      if (result.showModal === "login") {
        setShowLoginPrompt(true);
      } else if (result.showModal === "pricing") {
        setShowPricingModal(true);
      }
      return false;
    }

    // Show remaining generations toast after successful usage recording
    const remaining = getRemainingAttempts();
    if (remaining !== Infinity && remaining >= 0) {
      toast({
        title: t("components.usageGate.generationStarted"),
        description: remaining === 0
          ? t("components.usageGate.lastFreeGen")
          : t("components.usageGate.freeGensRemaining", { count: remaining }),
      });
    }

    return true;
  };

  const handleSelectPlan = async (plan: keyof typeof PRICING_TIERS, priceId?: string, provider?: string) => {
    if (!isAuthenticated || !user) {
      setShowPricingModal(false);
      setShowLoginPrompt(true);
      toast({
        title: t("pages.pricing.signInRequired"),
        description: t("pages.pricing.signInRequiredDesc"),
      });
      return;
    }

    setIsCheckoutLoading(true);
    try {
      // Handle Buy Me a Coffee checkout
      const effectiveProvider = provider || paymentProvider?.preferred;
      if (effectiveProvider === 'bmc') {
        const response = await fetch(`/api/bmc/checkout-url?tier=${plan}`);
        const data = await response.json();
        if (data.url) {
          // Open BMC in new tab (BMC doesn't support custom redirects)
          window.open(data.url, '_blank');
          setShowPricingModal(false);
          toast({
            title: t("pages.pricing.openingBMC"),
            description: t("pages.pricing.openingBMCDesc"),
          });
        } else {
          throw new Error("No checkout URL returned");
        }
        setIsCheckoutLoading(false);
        return;
      }

      // Handle Yoco checkout
      if (effectiveProvider === 'yoco') {
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
      if (!priceId) {
        toast({
          title: t("components.usageGate.paymentUnavailable"),
          description: t("components.usageGate.paymentUnavailableDesc"),
          variant: "destructive",
        });
        console.error("[UsageGate] No priceId found for plan:", plan);
        setIsCheckoutLoading(false);
        return;
      }

      const response = await apiRequest("POST", "/api/stripe/checkout", {
        priceId,
        userId: user.uid,
        userEmail: user.email,
      });

      const data = await (response as any).json();

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
    }
  };

  return (
    <>
      {children({
        checkUsage,
        isChecking: isLoading,
        remainingAttempts: getRemainingAttempts(),
        usageStatus: getUsageStatus(),
        openPricing: () => setShowPricingModal(true),
      })}
      
      <LoginPromptDialog
        open={showLoginPrompt}
        onOpenChange={setShowLoginPrompt}
        onSuccess={() => {
          toast({
            title: t("components.loginPromptDialog.welcome"),
            description: t("components.loginPromptDialog.freeGenerations"),
          });
        }}
      />
      
      <PricingModal
        open={showPricingModal}
        onOpenChange={setShowPricingModal}
        onSelectPlan={handleSelectPlan}
        isLoading={isCheckoutLoading}
      />
    </>
  );
}
