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

**Files Searched:**
- `/home/ben/sandbox/bbtec-notes/src/` - No middleware.ts found
- `/home/ben/sandbox/bbtec-notes/middleware.ts` - Not found in root either
- Only found in:
  - `node_modules/@clerk/nextjs/dist/esm/server/middleware.js`
  - `.next/` build directory

### Current Status

**Unclear:** The middleware location issue mentioned by user couldn't be verified in the current codebase.

**Possibilities:**
1. Change was attempted but not committed
2. Refers to a different component (not Clerk middleware)
3. Issue was resolved differently in final implementation

**Current bbtec-mdm Setup:**
- Middleware is at `/home/ben/sandbox/bbtec-mdm/middleware.ts` (root level)
- This is standard Next.js 15 location
- No issues encountered so far

### Recommendation

Keep middleware at root level unless issues arise. Monitor for any auth-related errors during testing.

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
