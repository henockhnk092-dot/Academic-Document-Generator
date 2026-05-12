import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function CheckoutCancel() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="h-16 w-16 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">{t("pages.checkoutCancel.title")}</CardTitle>
          <CardDescription className="text-base mt-2">
            {t("pages.checkoutCancel.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p>{t("pages.checkoutCancel.supportText")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => setLocation("/settings")}
              className="w-full"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {t("pages.checkoutCancel.viewPlans")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("pages.checkoutCancel.backHome")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
