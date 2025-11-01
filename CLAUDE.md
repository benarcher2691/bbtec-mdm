# Claude Code Context

This file provides context for Claude Code when working on this project.

## On Start-Up

1. **Review learnings from bbtec-notes project**: Read `planning/bbtec-notes-learnings.md` to understand authentication patterns and solutions for sign-out errors

## Project Overview

Educational Android Mobile Device Management (MDM) system built with Android Management API. Allows creation of enrollment tokens, QR code generation, and device management for Android Enterprise devices.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19 RC, TypeScript 5
- **Backend**: Convex (realtime database, queries, mutations)
- **Authentication**: Clerk
- **Styling**: Tailwind CSS + shadcn/ui (New York style, Radix primitives)
- **Device Management**: Android Management API (Google)
- **Deployment**: Vercel (frontend), Convex (hosted), Clerk (hosted)

## Architecture Principles

1. **Server Actions**: Use sparingly, only for auth/session bridging or Android Management API calls
2. **Data Operations**: All CRUD operations go through Convex queries/mutations
3. **Realtime First**: Leverage Convex's built-in realtime capabilities
4. **Type Safety**: Strict TypeScript throughout - NEVER use `any` type
5. **Component Composition**: Prefer composition over inheritance, use shadcn/ui patterns
6. **Security**: All Convex functions must have server-side auth checks (`ctx.auth.getUserIdentity()`)

## Coding Conventions

### TypeScript
- Use strict mode
- **NEVER use `any` type** - always use proper types, `unknown`, or generics
- Prefer `interface` over `type` for object shapes
- Explicitly type function returns
- Use Convex's generated types for queries/mutations

### React
- Functional components only
- Use hooks (useState, useEffect, custom hooks)
- Prefer named exports
- Keep components small and focused
- Use `"use client"` directive only when necessary
- **Authentication**: Always use `useAppAuth()` hook and Convex auth wrapper components (`<Authenticated>`, `<Unauthenticated>`, `<AuthLoading>`)

### Styling
- Tailwind utility classes preferred
- Use shadcn/ui components as base
- Responsive design: mobile-first, then tablet/desktop

### Naming
- Components: PascalCase (e.g., `DeviceList.tsx`)
- Files: kebab-case for utilities (e.g., `format-date.ts`)
- Convex functions: camelCase (e.g., `getDevices.ts`)
- Constants: UPPER_SNAKE_CASE

### File Organization
- One component per file
- Colocate related components
- Index files for clean exports
- Keep utils/helpers in `/lib`

## Development Workflow

1. **Start dev server**: `npm run dev`
2. **Convex dev**: `npx convex dev` (separate terminal)
3. **Type checking**: `npm run type-check` (if available)
4. **Linting**: `npm run lint`

## Git Workflow

**CRITICAL: NEVER PUSH DIRECTLY TO MAIN/MASTER**

- Always work on feature branches or the `development` branch
- Create pull requests for all changes to main/master
- Use descriptive branch names (e.g., `feature/device-table`, `fix/auth-error`)
- Main branch should only be updated via PR merges

## Platform Management: Web UI First, CLI Later

**Philosophy:** Use web dashboards (Vercel, Convex, Google Cloud Console) for learning and setup. Graduate to CLI commands when you understand the platform and need automation.

### Why This Matters

- **Dashboards provide visual feedback** - See exactly what you're changing before applying
- **Prevent costly mistakes** - Visual confirmation reduces deployment errors
- **Better for learning** - Explore features by clicking around
- **Troubleshooting** - Dashboard shows true state when CLI acts weird

### When to Use What

**Use Web Dashboard:**
- ✅ Setting up for the first time (environment variables, deployments)
- ✅ Learning a new feature or platform
- ✅ Troubleshooting issues (verify actual state)
- ✅ Making critical changes (production deployments, secrets)

**Use CLI Commands:**
- ✅ Daily development workflow (convex dev, npm run dev)
- ✅ Tasks you've done 3+ times via dashboard
- ✅ Automation and CI/CD pipelines
- ✅ Repetitive operations

### Platform-Specific Guidance

**Vercel Dashboard:** Use for environment variables, deployment management, build settings
**Convex Dashboard:** Use for creating deployments, schema inspection, deploy key management
**Google Cloud Console:** Use for Android Management API setup, service accounts, enterprise configuration

### Golden Rule

**"If you wouldn't click 'Apply' on a web form, don't run the terminal command."**

## Security

- Never expose Clerk secret keys client-side
- Never expose Google service account credentials client-side
- Validate all user input
- Rate limit write operations
- Scope all Convex queries by userId
- **All Convex functions must check `auth.getUserIdentity()` for authorization**

## Important Notes

### Convex
- All queries/mutations must check `auth.getUserIdentity()` for authorization
- Use indexes for performance (userId, deviceId, etc.)
- Use Convex authentication wrapper components to prevent sign-out errors

### Android Management API
- All API calls must be server-side (Next.js Server Actions or API routes)
- Never expose service account credentials to client
- Enterprise name format: `enterprises/LC03fy18qv`
- Tokens expire and should be tracked in database

## Environment Variables

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CONVEX_URL=https://...
CONVEX_DEPLOYMENT=dev:...
GOOGLE_APPLICATION_CREDENTIALS=./config/service-account-key.json
ENTERPRISE_NAME=enterprises/LC03fy18qv
GOOGLE_CLOUD_PROJECT_ID=bbtec-mdm
```
