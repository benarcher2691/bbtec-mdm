"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";

/**
 * Centralized authentication hook that checks both Clerk and Convex auth states.
 *
 * This prevents race conditions during sign-out where Clerk invalidates the JWT
 * before Convex's isAuthenticated state updates, which would cause queries to fail.
 *
 * Usage:
 * ```tsx
 * const { isReady, isLoading } = useAppAuth();
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (!isReady) return <SignInPrompt />;
 *
 * return <AuthenticatedContent />;
 * ```
 */
export function useAppAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();

  // CRITICAL: Must check isSignedIn === true (not just truthy)
  // During sign-out, isSignedIn can be undefined (not false)
  const isReady = isLoaded && isSignedIn === true && isAuthenticated;

  return {
    isReady,
    isLoaded,
    isSignedIn,
    isAuthenticated,
    isLoading: !isLoaded || convexLoading,
  };
}
