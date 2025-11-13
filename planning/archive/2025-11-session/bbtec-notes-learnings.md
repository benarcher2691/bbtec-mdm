# Learnings from bbtec-notes Project

## Overview

Investigation of `/home/ben/sandbox/bbtec-notes` to understand authentication issues and solutions that can prevent similar problems in bbtec-mdm.

**Tech Stack Similarity:**
- Next.js 15 + React 19 + TypeScript
- Clerk authentication
- Convex database
- Tailwind CSS + shadcn/ui

---

## Key Finding 1: Sign-Out Errors and Solution

### Problem Identified

**Error Pattern:**
```
Not authenticated
  at publicProcedure (/Users/ben/sandbox/bbtec-notes/node_modules/convex/dist/cjs-shim/server/impl/registration_impl.js:149:27)
```

**Affected Functions:**
- `folders:getFolders`
- `notes:getNotes`
- `prosemirror:latestVersion`

### Root Cause

Race condition during sign-out:
1. User clicks sign-out
2. Clerk invalidates JWT token immediately
3. Convex's `isAuthenticated` state hasn't updated yet
4. Components still mounted try to make Convex queries
5. Queries fail with "Not authenticated" because JWT is invalid

### Solution Implemented

**Two-part solution documented in commit 8e764aa:**

#### 1. Centralized Auth Hook

Created `src/hooks/use-app-auth.ts`:

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

#### 2. Convex Authentication Wrapper Components

Used built-in Convex components:

```typescript
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

<Authenticated>
  {/* Components that make Convex queries */}
  <NoteEditor />
</Authenticated>

<Unauthenticated>
  <SignInPrompt />
</Unauthenticated>

<AuthLoading>
  <LoadingSpinner />
</AuthLoading>
```

**Why This Works:**
- These components unmount immediately when auth is lost
- Prevents queries from firing with invalid tokens
- Completely eliminates sign-out errors

### Documentation Reference

See `/home/ben/sandbox/bbtec-notes/docs/AUTHENTICATION_AND_SYNC.md` for full details.

---

## Key Finding 2: Middleware Location

### User's Statement

"we had some issues logging out and also needed to move the middleware component to src/"

### Investigation Results

**Initial Investigation:**
- Couldn't find middleware.ts in bbtec-notes/src/ or root
- Only found in node_modules and .next build directories

### **CONFIRMED: Middleware Must Be in src/ for Next.js 15**

When running bbtec-mdm, we encountered this exact error:

```
Clerk: clerkMiddleware() was not run, your middleware file might be misplaced.
Move your middleware file to ./src/middleware.ts. Currently located at ./middleware.ts
```

### Solution

**For Next.js 15 projects using src/ directory structure:**

✅ **Correct location:** `src/middleware.ts`
❌ **Incorrect location:** `middleware.ts` (root)

This is a Next.js 15 requirement when using the `src/` directory structure for your app.

### Fix Applied

```bash
mv middleware.ts src/middleware.ts
```

After moving the file, Clerk middleware runs correctly and authentication works properly.

### Why This Matters

If middleware is in the wrong location:
- Clerk authentication won't protect routes
- Server Actions will fail with "Not authenticated" errors
- Sign-in/sign-out flows may not work correctly

### Recommendation

**Always place middleware.ts in src/ directory when using Next.js 15 with src/ structure.**

---

## Recommendations for bbtec-mdm

### Immediate Actions

1. **Create useAppAuth() Hook**
   - Copy pattern from bbtec-notes
   - Use in all components that make authenticated requests

2. **Use Convex Authentication Components**
   - Wrap dashboard components in `<Authenticated>`
   - Use `<AuthLoading>` for better UX
   - Implement `<Unauthenticated>` fallback

3. **Strict Type Checking**
   - Use `isSignedIn === true` not just `isSignedIn`
   - Prevents issues during transition states

### Example Implementation for bbtec-mdm

```typescript
// src/app/dashboard/page.tsx
import { Authenticated, AuthLoading } from "convex/react";
import { useAppAuth } from "@/hooks/use-app-auth";

export default function DashboardPage() {
  return (
    <>
      <AuthLoading>
        <LoadingSpinner />
      </AuthLoading>

      <Authenticated>
        <DashboardContent />
      </Authenticated>
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

---

## Security Considerations

### From bbtec-notes Documentation

All Convex functions need server-side auth checks:

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
      .query("deviceNotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});
```

**Never rely solely on client-side auth checks!**

---

## Summary

### What We Learned

1. Sign-out errors are preventable with proper auth state management
2. Use centralized `useAppAuth()` hook checking both Clerk AND Convex
3. Convex authentication wrapper components prevent race conditions
4. Server-side auth checks are mandatory in all Convex functions
5. Middleware location remains at root level (standard Next.js 15)

### Next Steps

1. Implement `useAppAuth()` hook before building dashboard
2. Structure components to use Convex auth wrappers
3. Add server-side auth checks to all Convex functions
4. Test sign-out flow thoroughly during development

---

**Investigation Date:** 2025-11-01
**Reference Project:** `/home/ben/sandbox/bbtec-notes`
**Key Commit:** 8e764aa "refactor: Centralize auth logic and fix sign-out errors"
