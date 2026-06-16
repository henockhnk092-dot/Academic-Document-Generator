import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUsage } from "@/hooks/use-usage";
import { LoginPromptDialog } from "@/components/login-prompt-dialog";
import { PricingModal } from "@/components/pricing-modal";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { PRICING_TIERS } from "@shared/schema";

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

  const handleSelectPlan = async (plan: keyof typeof PRICING_TIERS) => {
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
      const response = await fetch(`/api/bmc/checkout-url?tier=${encodeURIComponent(plan)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || t("components.usageGate.paymentUnavailableDesc"));
      }
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        setShowPricingModal(false);
        toast({
          title: t("pages.pricing.openingBMC"),
          description: t("pages.pricing.openingBMCDesc"),
        });
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: t("pages.pricing.checkoutFailed"),
        description: error instanceof Error ? error.message : t("pages.pricing.checkoutFailedDesc"),
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
