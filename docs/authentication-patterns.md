# Authentication Patterns - Clerk + Convex

Best practices for authentication in Next.js 15 + Clerk + Convex applications.

**Tech Stack:**
- Next.js 15 (App Router)
- Clerk authentication
- Convex database
- TypeScript

---

## Problem: Sign-Out Race Condition

### Symptom

```
Not authenticated
  at publicProcedure (convex/server/impl/registration_impl.js:149:27)
```

### Root Cause

Race condition during sign-out:
1. User clicks sign-out
2. Clerk invalidates JWT token immediately
3. Convex's `isAuthenticated` state hasn't updated yet
4. Components still mounted try to make Convex queries
5. Queries fail with "Not authenticated" because JWT is invalid

---

## Solution 1: Centralized Auth Hook

Create `src/hooks/use-app-auth.ts`:

```typescript
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";

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
```

**Key Pattern:**
- Check BOTH Clerk state (`isSignedIn`) AND Convex state (`isAuthenticated`)
- Use strict equality `isSignedIn === true` (not just truthy check)
- Only render when `isReady` is true

---

## Solution 2: Convex Authentication Wrapper Components

Use built-in Convex components to prevent queries from firing with invalid tokens:

```typescript
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

export default function DashboardPage() {
  return (
    <>
      <AuthLoading>
        <LoadingSpinner />
      </AuthLoading>

      <Authenticated>
        <DashboardContent />
      </Authenticated>

      <Unauthenticated>
        <SignInPrompt />
      </Unauthenticated>
    </>
  );
}

function DashboardContent() {
  const { isReady } = useAppAuth();

  // Only make API calls when both Clerk and Convex are ready
  if (!isReady) {
    return <LoadingSpinner />;
  }

  return <DeviceList />;
}
```

**Why This Works:**
- These components unmount immediately when auth is lost
- Prevents queries from firing with invalid tokens
- Completely eliminates sign-out errors

---

## Middleware Location (Next.js 15)

### Important: Use src/ Directory

**For Next.js 15 projects using src/ directory structure:**

✅ **Correct location:** `src/middleware.ts`
❌ **Incorrect location:** `middleware.ts` (root)

This is a Next.js 15 requirement when using the `src/` directory structure.

### Why This Matters

If middleware is in the wrong location:
- Clerk authentication won't protect routes
- Server Actions will fail with "Not authenticated" errors
- Sign-in/sign-out flows may not work correctly

### Error Message You'll See

```
Clerk: clerkMiddleware() was not run, your middleware file might be misplaced.
Move your middleware file to ./src/middleware.ts. Currently located at ./middleware.ts
```

### Fix

```bash
mv middleware.ts src/middleware.ts
```

---

## Security: Server-Side Auth Checks

**CRITICAL:** All Convex functions must check auth server-side. Never rely solely on client-side checks.

```typescript
// convex/devices.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getDevices = query({
  args: {},
  handler: async (ctx) => {
    // CRITICAL: Check auth server-side
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    // Only return user's own devices
    return await ctx.db
      .query("devices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});
```

**Pattern for all Convex functions:**
1. Call `ctx.auth.getUserIdentity()` at the start
2. Throw error if not authenticated
3. Extract `userId` from identity
4. Filter all queries by `userId` to prevent data leakage

---

## Best Practices Summary

### Client-Side
1. ✅ Use `useAppAuth()` hook for auth state
2. ✅ Wrap components in `<Authenticated>` wrapper
3. ✅ Use strict equality: `isSignedIn === true`
4. ✅ Check both Clerk AND Convex auth states
5. ✅ Place middleware in `src/middleware.ts`

### Server-Side
1. ✅ All Convex functions must check `ctx.auth.getUserIdentity()`
2. ✅ Throw error if not authenticated
3. ✅ Filter all queries by userId
4. ✅ Never trust client-side auth alone

### Testing
1. ✅ Test sign-out flow thoroughly
2. ✅ Verify no "Not authenticated" errors
3. ✅ Ensure components unmount on sign-out
4. ✅ Check middleware protects routes

---

## Implementation Checklist

- [ ] Create `src/hooks/use-app-auth.ts` with pattern above
- [ ] Wrap dashboard components in `<Authenticated>`
- [ ] Add `<AuthLoading>` for better UX
- [ ] Implement `<Unauthenticated>` fallback
- [ ] Move middleware to `src/middleware.ts` if needed
- [ ] Add server-side auth checks to ALL Convex functions
- [ ] Test sign-out flow (no errors should appear)
- [ ] Verify middleware protects routes

---

**Last Updated:** 2025-11-11
**Reference Project:** bbtec-notes (commit 8e764aa)
**Status:** Production-tested pattern
