import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { USAGE_LIMITS } from "@shared/schema";

const GUEST_USAGE_KEY = "papergen_guest_attempts";
const GUEST_USAGE_VERSION = "v2"; // Version to prevent stale data issues

interface GuestUsage {
  attempts: number;
  timestamp: number;
  version?: string;
}

interface UsageData {
  attemptsUsed: number;
  maxAttempts: number;
  subscriptionStatus: string;
  subscriptionTier: string;
  subscriptionExpiry: string | null;
  hasActiveSubscription: boolean;
}

export function useUsage() {
  const { user, isAuthenticated, isLoading: authLoading, hasUnlimitedAccess, userRole } = useAuth();
  const [guestAttempts, setGuestAttempts] = useState(0);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      const stored = localStorage.getItem(GUEST_USAGE_KEY);
      if (stored) {
        try {
          const usage: GuestUsage = JSON.parse(stored);
          setGuestAttempts(usage.attempts);
        } catch {
          setGuestAttempts(0);
        }
      }
    }
  }, [isAuthenticated]);

  const { data: serverUsage, isLoading: usageLoading } = useQuery<{ usage: UsageData }>({
    queryKey: ["/api/usage", user?.uid],
    enabled: isAuthenticated && !!user?.uid,
  });

  const recordUsageMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", "/api/usage/record", { userId });
    },
  });

  const getGuestAttempts = useCallback((): number => {
    const stored = localStorage.getItem(GUEST_USAGE_KEY);
    if (stored) {
      try {
        const usage: GuestUsage = JSON.parse(stored);
        // Check version - if outdated or missing, reset to current attempts
        if (usage.version !== GUEST_USAGE_VERSION) {
          // Migration: keep existing attempts but update version
          const updatedUsage: GuestUsage = {
            attempts: usage.attempts || 0,
            timestamp: Date.now(),
            version: GUEST_USAGE_VERSION,
          };
          localStorage.setItem(GUEST_USAGE_KEY, JSON.stringify(updatedUsage));
          return updatedUsage.attempts;
        }
        return usage.attempts;
      } catch {
        return 0;
      }
    }
    return 0;
  }, []);

  const incrementGuestAttempts = useCallback((): number => {
    const current = getGuestAttempts();
    const newCount = current + 1;
    const usage: GuestUsage = {
      attempts: newCount,
      timestamp: Date.now(),
      version: GUEST_USAGE_VERSION,
    };
    localStorage.setItem(GUEST_USAGE_KEY, JSON.stringify(usage));
    setGuestAttempts(newCount);
    console.log(`[Usage] Guest attempts incremented to ${newCount}/${USAGE_LIMITS.guest}`);
    return newCount;
  }, [getGuestAttempts]);

  const canGenerate = useCallback((): { allowed: boolean; reason?: string } => {
    if (authLoading) {
      return { allowed: false, reason: "loading" };
    }

    // Admin and Developer have unlimited access - no payment required
    if (isAuthenticated && hasUnlimitedAccess) {
      return { allowed: true };
    }

    if (!isAuthenticated) {
      const attempts = getGuestAttempts();
      console.log(`[Usage] Guest check: ${attempts}/${USAGE_LIMITS.guest} attempts used`);
      if (attempts >= USAGE_LIMITS.guest) {
        console.log(`[Usage] Guest limit reached - blocking generation`);
        return { allowed: false, reason: "guest_limit" };
      }
      return { allowed: true };
    }

    const usage = serverUsage?.usage;
    if (!usage) {
      return { allowed: true };
    }

    if (usage.hasActiveSubscription) {
      return { allowed: true };
    }

    if (usage.attemptsUsed >= usage.maxAttempts) {
      return { allowed: false, reason: "user_limit" };
    }

    return { allowed: true };
  }, [authLoading, isAuthenticated, hasUnlimitedAccess, getGuestAttempts, serverUsage]);

  const recordAttempt = useCallback(async (): Promise<{ success: boolean; showModal?: "login" | "pricing" }> => {
    // Admin and Developer don't need to record usage
    if (isAuthenticated && hasUnlimitedAccess) {
      return { success: true };
    }

    if (!isAuthenticated) {
      const current = getGuestAttempts();
      if (current >= USAGE_LIMITS.guest) {
        setShowLoginPrompt(true);
        return { success: false, showModal: "login" };
      }
      incrementGuestAttempts();
      return { success: true };
    }

    // Get current userId - must be defined since isAuthenticated is true
    const currentUserId = user?.uid;
    if (!currentUserId) {
      console.error("[Usage] User ID not available despite being authenticated");
      return { success: false };
    }

    try {
      await recordUsageMutation.mutateAsync(currentUserId);
      // Manually invalidate the usage query to ensure UI updates with fresh data
      await queryClient.invalidateQueries({ queryKey: ["/api/usage", currentUserId] });
      // Also refetch to ensure we have the latest data
      await queryClient.refetchQueries({ queryKey: ["/api/usage", currentUserId] });
      console.log("[Usage] Usage recorded and cache invalidated for user:", currentUserId);
      return { success: true };
    } catch (error: any) {
      if (error.status === 403 || error.message?.includes("403")) {
        setShowPricingModal(true);
        return { success: false, showModal: "pricing" };
      }
      throw error;
    }
  }, [isAuthenticated, hasUnlimitedAccess, getGuestAttempts, incrementGuestAttempts, recordUsageMutation, user?.uid]);

  const getRemainingAttempts = useCallback((): number => {
    // Admin and Developer have unlimited attempts
    if (isAuthenticated && hasUnlimitedAccess) {
      return Infinity;
    }

    if (!isAuthenticated) {
      return Math.max(0, USAGE_LIMITS.guest - getGuestAttempts());
    }

    const usage = serverUsage?.usage;
    if (!usage) return USAGE_LIMITS.freeUser;

    if (usage.hasActiveSubscription) {
      return Infinity;
    }

    return Math.max(0, usage.maxAttempts - usage.attemptsUsed);
  }, [isAuthenticated, hasUnlimitedAccess, getGuestAttempts, serverUsage]);

  const getUsageStatus = useCallback(() => {
    if (!isAuthenticated) {
      return {
        type: "guest" as const,
        attemptsUsed: guestAttempts,
        maxAttempts: USAGE_LIMITS.guest,
        remaining: Math.max(0, USAGE_LIMITS.guest - guestAttempts),
        hasActiveSubscription: false,
        userRole: "guest" as const,
      };
    }

    // Admin and Developer have unlimited access
    if (hasUnlimitedAccess) {
      return {
        type: userRole as "admin" | "developer",
        attemptsUsed: 0,
        maxAttempts: Infinity,
        remaining: Infinity,
        hasActiveSubscription: true, // Treat as having subscription for UI purposes
        userRole: userRole,
      };
    }

    const usage = serverUsage?.usage;
    if (!usage) {
      return {
        type: "free" as const,
        attemptsUsed: 0,
        maxAttempts: USAGE_LIMITS.freeUser,
        remaining: USAGE_LIMITS.freeUser,
        hasActiveSubscription: false,
        userRole: userRole,
      };
    }

    return {
      type: usage.hasActiveSubscription ? "subscribed" as const : "free" as const,
      attemptsUsed: usage.attemptsUsed,
      maxAttempts: usage.maxAttempts,
      remaining: usage.hasActiveSubscription ? Infinity : Math.max(0, usage.maxAttempts - usage.attemptsUsed),
      hasActiveSubscription: usage.hasActiveSubscription,
      subscriptionTier: usage.subscriptionTier,
      subscriptionExpiry: usage.subscriptionExpiry,
      userRole: userRole,
    };
  }, [isAuthenticated, guestAttempts, hasUnlimitedAccess, userRole, serverUsage]);

  return {
    isLoading: authLoading || (isAuthenticated && usageLoading),
    canGenerate,
    recordAttempt,
    getRemainingAttempts,
    getUsageStatus,
    showLoginPrompt,
    setShowLoginPrompt,
    showPricingModal,
    setShowPricingModal,
    isAuthenticated,
    user,
    hasUnlimitedAccess,
    userRole,
  };
}
