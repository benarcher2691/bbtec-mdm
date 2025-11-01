# Archived Express Implementation

**Archived Date:** November 1, 2025
**Reason:** Migration to Next.js 15 + React + Convex stack

## What's Here

This directory contains the original Express.js implementation of the bbtec-mdm system.

### `/express-version/` Contents

- **src/** - Express server code
  - `server.js` - Main server entry point
  - `routes/` - API route handlers
  - `controllers/` - Business logic controllers
  - `services/` - Android Management API integration
  - `middleware/` - Authentication middleware (Clerk)

- **public/** - Static frontend files
  - `index.html` - Main dashboard page
  - `app.js` - Frontend JavaScript
  - `styles.css` - Styling

- **config/** - Configuration files
  - `service-account-key.json` - Google Cloud credentials

- **Documentation:**
  - `README.md` - Original project documentation
  - `CLERK_SETUP.md` - Clerk authentication setup guide
  - `SYSTEM_SUMMARY.md` - System architecture overview
  - `SMOKE_TEST_RESULTS.md` - Testing documentation

## Key Features Implemented

✅ **Authentication**
- Clerk integration with hosted Account Portal
- JWT token-based API protection
- UserButton component for account management

✅ **Device Management**
- Device list view
- Device detail modal with comprehensive information
- Real-time device data from Android Management API

✅ **Enrollment**
- QR code generation for device provisioning
- Enrollment token management
- Android Management API integration

✅ **UI/UX**
- Responsive design
- Modal dialogs
- Status indicators
- User-friendly interface

## Technology Stack (Archived)

- **Backend:** Express.js + Node.js
- **Frontend:** Vanilla JavaScript + HTML + CSS
- **Authentication:** Clerk
- **API:** Google Android Management API
- **Deployment:** Standalone Node.js server

## Why We Migrated

1. **Better Performance:** Next.js Server Components and Server Actions
2. **Type Safety:** Full TypeScript implementation
3. **Real-time Features:** Convex database with live subscriptions
4. **Modern DX:** Better tooling, faster development
5. **Scalability:** Vercel deployment with edge functions
6. **Component Library:** shadcn/ui for professional UI

## Useful Code to Reference

When porting to the new Next.js implementation, these files are particularly useful:

### Android Management API Integration
- `src/services/androidManagement.js` - Core API logic
- `src/controllers/mdmController.js` - Request handlers

### Authentication
- `src/middleware/auth.js` - Clerk JWT verification
- `src/routes/mdm.js` - Protected route setup

### Frontend Components
- `public/app.js` - Device list, modal, API calls
- `public/index.html` - Layout structure, Clerk integration
- `public/styles.css` - Component styling

### Device Features
- Device list rendering logic (lines 141-157 in app.js)
- Device detail modal (lines 203-300 in app.js)
- Real-time device data fetching
- Status indicators and formatting

## Environment Variables Used

```env
PORT=3000
NODE_ENV=development
GOOGLE_APPLICATION_CREDENTIALS=./config/service-account-key.json
ENTERPRISE_NAME=enterprises/LC03fy18qv
GOOGLE_CLOUD_PROJECT_ID=bbtec-mdm
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

## Git History

All git commits for this implementation are preserved in the main repository history.
Look for commits before the "Archive Express implementation" commit.

## Running the Archived Version

If you need to run this version:

```bash
cd .archive/express-version
npm install
npm run dev
# Server runs on http://localhost:3000
```

**Note:** You'll need to restore the `.env` file with proper credentials.

## Migration Notes

The new Next.js implementation preserves all functionality while adding:
- Type safety with TypeScript
- Real-time updates with Convex
- Better component architecture
- Improved developer experience
- Modern deployment pipeline

Refer to `/planning/migration-plan.md` for detailed migration strategy.
