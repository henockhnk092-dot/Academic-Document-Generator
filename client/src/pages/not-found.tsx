import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { FileQuestion, Home, FileText, Presentation, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <FileQuestion className="h-20 w-20 text-muted-foreground/40" />
        </div>

        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-primary">404</h1>
          <p className="text-xl font-medium">{t("pages.notFound.heading")}</p>
          <p className="text-muted-foreground text-sm">
            {t("pages.notFound.desc")}
          </p>
        </div>

        <Link href="/">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            {t("pages.notFound.backHome")}
          </Button>
        </Link>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-3">{t("pages.notFound.jumpTo")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/generate/report">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> {t("generators.technicalReport")}
              </Button>
            </Link>
            <Link href="/generate/powerpoint">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Presentation className="h-3.5 w-3.5" /> {t("generators.powerpoint")}
              </Button>
            </Link>
            <Link href="/generate/thesis">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <GraduationCap className="h-3.5 w-3.5" /> {t("generators.thesis")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
