import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const BANNER_KEY = "academicgen_banner_v2";

export function WhatsNewBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const FEATURES = [
    t("components.whatsNewBanner.feature1"),
    t("components.whatsNewBanner.feature2"),
    t("components.whatsNewBanner.feature3"),
    t("components.whatsNewBanner.feature4"),
    t("components.whatsNewBanner.feature5"),
  ];

  useEffect(() => {
    if (!localStorage.getItem(BANNER_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(BANNER_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 border-b border-primary/20 px-4 py-2.5">
      <div className="flex items-center gap-3 max-w-5xl mx-auto">
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-primary mr-2">{t("components.whatsNewBanner.label")}</span>
          <span className="text-sm text-foreground/80 hidden sm:inline">
            {FEATURES.join(" · ")}
          </span>
          <span className="text-sm text-foreground/80 sm:hidden">{FEATURES[0]}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={dismiss} aria-label={t("common.dismiss")}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
