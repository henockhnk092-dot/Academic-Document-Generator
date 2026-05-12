import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, FolderOpen, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

const STORAGE_KEY = "academicgen_onboarded_v1";

export function OnboardingModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const STEPS = [
    {
      icon: Sparkles,
      color: "text-purple-500",
      title: t("components.onboarding.step1Title"),
      description: t("components.onboarding.step1Desc"),
      bullets: [
        t("components.onboarding.step1b1"),
        t("components.onboarding.step1b2"),
        t("components.onboarding.step1b3"),
        t("components.onboarding.step1b4"),
      ],
    },
    {
      icon: FileText,
      color: "text-blue-500",
      title: t("components.onboarding.step2Title"),
      description: t("components.onboarding.step2Desc"),
      bullets: [
        t("components.onboarding.step2b1"),
        t("components.onboarding.step2b2"),
        t("components.onboarding.step2b3"),
        t("components.onboarding.step2b4"),
      ],
    },
    {
      icon: FolderOpen,
      color: "text-green-500",
      title: t("components.onboarding.step3Title"),
      description: t("components.onboarding.step3Desc"),
      bullets: [
        t("components.onboarding.step3b1"),
        t("components.onboarding.step3b2"),
        t("components.onboarding.step3b3"),
        t("components.onboarding.step3b4"),
      ],
    },
  ];

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small delay so the page renders first
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  const S = STEPS[step];
  const Icon = S.icon;

  return (
    <Dialog open={open} onOpenChange={dismiss}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Progress bar */}
        <div className="flex gap-1 p-4 pb-0">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="p-6 pt-4 space-y-4">
          {/* Icon + Title */}
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center ${S.color}`}>
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("components.onboarding.stepOf", { current: step + 1, total: STEPS.length })}</p>
              <DialogTitle className="text-xl font-bold">{S.title}</DialogTitle>
            </div>
          </div>

          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">{S.description}</DialogDescription>

          <ul className="space-y-2">
            {S.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                {b}
              </li>
            ))}
          </ul>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={dismiss} className="text-muted-foreground text-xs">
              {t("components.onboarding.skip")}
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button size="sm" onClick={() => setStep(s => s + 1)} className="gap-1">
                  {t("components.onboarding.next")} <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button size="sm" onClick={dismiss} className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90">
                  {t("components.onboarding.getStarted")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
