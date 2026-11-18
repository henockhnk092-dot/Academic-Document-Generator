import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface GeneratorLayoutProps {
  title: string;
  description: string;
  icon: ReactNode;
  gradient: string;
  children: ReactNode;
}

export function GeneratorLayout({
  title,
  description,
  icon,
  gradient,
  children,
}: GeneratorLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6 max-w-7xl">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" data-testid="button-back-home">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className={`w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-lg [&_svg]:w-5 [&_svg]:h-5 sm:[&_svg]:w-6 sm:[&_svg]:h-6 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <h1 className="text-lg sm:text-2xl font-bold leading-tight break-words">{title}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-snug break-words">{description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        {children}
      </div>
    </div>
  );
}
