import { useState, useEffect } from "react";
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
          title: "Free limit reached",
          description: "Sign in to get 5 more free generations!",
        });
        return false;
      }
      if (check.reason === "user_limit") {
        setShowPricingModal(true);
        toast({
          title: "Free limit reached",
          description: "Subscribe to continue generating documents.",
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
        title: "Generation started",
        description: remaining === 0
          ? "This is your last free generation!"
          : `${remaining} free generation${remaining === 1 ? '' : 's'} remaining`,
      });
    }

    return true;
  };

  const handleSelectPlan = async (plan: keyof typeof PRICING_TIERS, priceId?: string, provider?: string) => {
    if (!isAuthenticated || !user) {
      setShowPricingModal(false);
      setShowLoginPrompt(true);
      toast({
        title: "Sign in required",
        description: "Please sign in to subscribe to a plan.",
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
            title: "Opening Buy Me a Coffee",
            description: "Complete your purchase on Buy Me a Coffee. Make sure to use the same email address you signed up with!",
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
          title: "Payment unavailable",
          description: "Unable to find the selected plan. Please refresh and try again, or contact support.",
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
        title: "Checkout failed",
        description: error.message || "Failed to start checkout. Please try again.",
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
            title: "Welcome!",
            description: "You now have 5 free generations.",
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
