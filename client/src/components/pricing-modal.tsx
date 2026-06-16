import { useState } from "react";
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
  onSelectPlan?: (plan: keyof typeof PRICING_TIERS) => void;
  isLoading?: boolean;
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
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSelectPlan = (plan: keyof typeof PRICING_TIERS) => {
    setSelectedPlan(plan);
    onSelectPlan?.(plan);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">{t("pages.pricing.upgradeYourPlan")}</DialogTitle>
          <DialogDescription className="text-center">
            {t("pages.pricing.usedAllGenerations")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 py-2 px-4 rounded-lg">
          <Coffee className="h-4 w-4" />
          <span>{t("pages.pricing.securePayments")}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {TIER_ORDER.map((tier) => {
            const tierInfo = PRICING_TIERS[tier];
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
                  <div className="text-3xl font-bold">${tierInfo.price.toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground">
                    {tier === 'day_pass' ? t("pages.pricing.oneTime") : t("pages.pricing.perInterval", { interval: tier.replace('_', ' ') })}
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
                    ) : (
                      <>
                        <Coffee className="mr-2 h-4 w-4" />
                        {t("pages.pricing.getPlan", { name: tierInfo.name.split(' ')[0] })}
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

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

        <p className="text-center text-xs text-muted-foreground mt-2">
          Payments via Buy Me a Coffee ☕ &nbsp;Cancel anytime &bull; No hidden fees
        </p>
      </DialogContent>
    </Dialog>
  );
}
