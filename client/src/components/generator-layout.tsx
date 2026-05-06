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
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-home">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              {icon}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {children}
      </div>
    </div>
  );
}
