import { useUsage } from "@/hooks/use-usage";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Crown, User, UserCircle, Shield, Code } from "lucide-react";

export function UsageBanner() {
  const { getUsageStatus, isLoading } = useUsage();

  if (isLoading) {
    return null;
  }

  const status = getUsageStatus();

  // Admin role - show special badge
  if (status.type === "admin") {
    return (
      <Badge variant="outline" className="gap-1.5 border-red-500/50 bg-red-500/10" data-testid="badge-admin">
        <Shield className="h-3.5 w-3.5 text-red-500" />
        <span className="text-red-500">Admin</span>
      </Badge>
    );
  }

  // Developer role - show special badge
  if (status.type === "developer") {
    return (
      <Badge variant="outline" className="gap-1.5 border-blue-500/50 bg-blue-500/10" data-testid="badge-developer">
        <Code className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-blue-500">Developer</span>
      </Badge>
    );
  }

  if (status.hasActiveSubscription) {
    return (
      <Badge variant="outline" className="gap-1.5" data-testid="badge-subscription">
        <Crown className="h-3.5 w-3.5 text-primary" />
        <span className="capitalize">{status.subscriptionTier}</span>
      </Badge>
    );
  }

  const remainingText = status.remaining === Infinity
    ? "Unlimited"
    : `${status.remaining} left`;

  const Icon = status.type === "guest" ? UserCircle : User;

  return (
    <Badge
      variant={status.remaining <= 1 ? "destructive" : "secondary"}
      className="gap-1.5"
      data-testid="badge-usage"
    >
      <Icon className="h-3.5 w-3.5" />
      <Sparkles className="h-3 w-3" />
      <span>{remainingText}</span>
    </Badge>
  );
}
