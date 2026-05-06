import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { queryClient } from "@/lib/queryClient";

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get session_id from URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");

    const verifyCheckout = async () => {
      try {
        // Wait a moment for Stripe webhook to process
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Invalidate usage query to fetch updated subscription status
        if (user?.uid) {
          await queryClient.invalidateQueries({ queryKey: ["/api/usage", user.uid] });
          await queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription", user.uid] });
        }

        setIsVerifying(false);
      } catch (err: any) {
        console.error("Verification error:", err);
        setError(err.message || "Failed to verify payment");
        setIsVerifying(false);
      }
    };

    verifyCheckout();
  }, [user?.uid]);

  if (isVerifying) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <CardTitle>Processing Payment...</CardTitle>
            <CardDescription>
              Please wait while we confirm your subscription
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Payment Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setLocation("/settings")}>
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
          <CardDescription className="text-base mt-2">
            Thank you for subscribing to AcademicGen. Your account has been upgraded and you now have unlimited access to all features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium">What's included:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Unlimited document generations
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                All document types (Reports, Thesis, Conference Papers)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                AI-powered image generation
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Priority support
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => setLocation("/generate/report")}
              className="w-full"
            >
              Start Generating
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/settings")}
              className="w-full"
            >
              Manage Subscription
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
