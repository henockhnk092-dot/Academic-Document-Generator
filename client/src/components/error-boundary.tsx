import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import i18n from "@/i18n";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReload = () => window.location.reload();
  handleHome = () => { window.location.href = "/"; };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="text-center space-y-6 max-w-md">
            <div className="flex justify-center">
              <AlertTriangle className="h-16 w-16 text-destructive/60" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{i18n.t("components.errorBoundary.title")}</h1>
              <p className="text-muted-foreground text-sm">
                {i18n.t("components.errorBoundary.description")}
              </p>
              {this.state.error && (
                <p className="text-xs text-muted-foreground/60 font-mono bg-muted rounded px-3 py-2 mt-2 break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <div className="flex justify-center gap-3">
              <Button onClick={this.handleReload} className="gap-2">
                <RefreshCw className="h-4 w-4" /> {i18n.t("components.errorBoundary.reloadPage")}
              </Button>
              <Button variant="outline" onClick={this.handleHome} className="gap-2">
                <Home className="h-4 w-4" /> {i18n.t("components.errorBoundary.goHome")}
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
