import { useRegisterSW } from "virtual:pwa-register/react";
import { useTranslation } from "react-i18next";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaUpdateBanner() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg text-sm animate-in slide-in-from-bottom-4">
      <RefreshCw className="h-4 w-4 text-primary flex-shrink-0" />
      <span className="text-foreground">{t("components.pwaUpdateBanner.message")}</span>
      <Button
        size="sm"
        className="h-7 px-3 text-xs"
        onClick={() => updateServiceWorker(true)}
      >
        {t("components.pwaUpdateBanner.refresh")}
      </Button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t("components.pwaUpdateBanner.dismiss")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
