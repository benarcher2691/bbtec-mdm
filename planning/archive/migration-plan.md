# Fresh Start: Next.js MDM Dashboard with Modern Stack

**Date:** November 1, 2025
**Status:** Planning
**Approach:** Archive existing Express app, build fresh with modern stack

## Technology Stack

### Frontend
- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** components

### Backend & Services
- **Next.js Server Actions** (replaces Express REST API)
- **Convex** (Database-as-a-Service)
- **Google Android Management API**
- **Clerk** (Authentication)

### Deployment
- **Vercel** (hosting, preview deployments, edge functions)

## What We're Preserving
- ✅ Android Management API integration logic (port to TypeScript)
- ✅ Clerk credentials and configuration
- ✅ UI/UX concepts and design patterns
- ✅ Device detail modal functionality
- ✅ QR code generation logic

## What We're Gaining
- ✅ Server Components for better performance
- ✅ Type safety throughout the application
- ✅ Modern tooling (Turbopack, etc.)
- ✅ Real-time device updates via Convex subscriptions
- ✅ Better DX with shadcn/ui components
- ✅ Automatic deployments with Vercel
- ✅ Cleaner, more maintainable codebase

---

## Implementation Plan

### Phase 1: Archive & Initialize (Foundation)

#### 1.1 Archive Existing Code
- Move all current files to `.archive/express-version/`
- Create `.archive/README.md` documenting preserved implementation
- Commit: "Archive Express implementation before Next.js migration"

#### 1.2 Initialize Next.js 15 Project
```bash
npx create-next-app@latest bbtec-mdm-nextjs
```
Options:
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ App Router
- ✅ src/ directory
- ✅ ESLint

Move generated files to project root, configure properly.

#### 1.3 Install Core Dependencies
```bash
npm install @clerk/nextjs
npm install convex
npm install googleapis
npm install qrcode
npm install @types/qrcode
```

#### 1.4 Setup shadcn/ui
```bash
npx shadcn@latest init
npx shadcn@latest add button
npx shadcn@latest add dropdown-menu
npx shadcn@latest add navigation-menu
npx shadcn@latest add table
npx shadcn@latest add badge
npx shadcn@latest add dialog
npx shadcn@latest add avatar
npx shadcn@latest add sheet # for mobile sidebar
```

---

### Phase 2: Setup Services & Authentication

#### 2.1 Configure Clerk Authentication
- Copy Clerk keys from `.env` to new project
- Add Clerk middleware: `middleware.ts`
- Configure public/protected routes
- Setup Clerk provider in root layout

**Environment variables needed:**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

#### 2.2 Initialize Convex
```bash
npx convex dev
```

Create Convex schema in `convex/schema.ts`:
```typescript
// Device notes, tags, custom data
// User preferences
// Audit logs
// Policy templates
```

Configure Clerk integration with Convex for user authentication.

#### 2.3 Port Android Management API Integration

Create TypeScript service layer:
```
lib/
├── android-management/
│   ├── client.ts          # API client setup
│   ├── devices.ts         # Device operations
│   ├── policies.ts        # Policy operations
│   ├── enrollment.ts      # Enrollment token/QR
│   └── types.ts          # TypeScript types
```

Copy logic from:
- `.archive/express-version/src/services/androidManagement.js`
- Convert to TypeScript with proper types
- Add error handling and validation

**Environment variables needed:**
```env
GOOGLE_APPLICATION_CREDENTIALS=./config/service-account-key.json
ENTERPRISE_NAME=enterprises/LC03fy18qv
GOOGLE_CLOUD_PROJECT_ID=bbtec-mdm
```

---

### Phase 3: Build UI Foundation

#### 3.1 Create Layout Structure

**File: `app/layout.tsx`**
- Root layout with Clerk provider
- Convex provider
- Global styles

**File: `app/(dashboard)/layout.tsx`**
- Top navbar component
- Collapsible sidebar component
- Main content area
- Protected route wrapper

#### 3.2 Build Top Navbar Component

**File: `components/navbar.tsx`**
- Hamburger menu button (toggles sidebar)
- 'bbtec-mdm' logo/branding
- Clerk UserButton (account management)
- Sticky positioning with shadow
- Responsive design

#### 3.3 Build Collapsible Sidebar Component

**File: `components/sidebar.tsx`**
- Navigation menu using shadcn/ui NavigationMenu
- Collapsible sections:
  - **Enrollment** (expandable)
    - QR Code Generator
    - Enrollment Tokens
  - **Management** (expandable)
    - Devices
    - Policies
- Slide in/out animation
- Active state highlighting
- Mobile responsive (Sheet component)
- Remember collapsed state in localStorage

#### 3.4 Style Layout

Use Tailwind for:
- Clean white/gray professional look (no gradients)
- Consistent spacing and typography
- Proper shadows and borders
- Responsive breakpoints

---

### Phase 4: Implement Core Features

#### 4.1 Build Enrollment Page

**File: `app/(dashboard)/enrollment/page.tsx`**

Features:
- QR code generation form
- Policy selection dropdown
- Display generated QR code
- Show enrollment token
- Instructions for device enrollment

**Server Action:**
```typescript
// app/actions/enrollment.ts
export async function createEnrollmentToken(policyId: string) {
  // Port from old code
  // Return token and QR code data
}
```

#### 4.2 Build Devices List Page

**File: `app/(dashboard)/management/devices/page.tsx`**

Features:
- Device table with columns:
  - Status indicator (colored dot: 🔴 inactive, 🟢 active)
  - Software version (Android X)
  - User/Owner
  - Last reported (timestamp)
  - Tags (custom labels)
- Pagination (10 items per page)
- Click row to open device detail modal
- Real-time updates via Convex subscriptions

**Components:**
```typescript
// components/device-table.tsx
// components/device-detail-modal.tsx (port from old code)
// components/status-badge.tsx
// components/pagination.tsx
```

**Server Actions:**
```typescript
// app/actions/devices.ts
export async function listDevices()
export async function getDevice(deviceId: string)
```

**Convex Queries/Mutations:**
```typescript
// convex/devices.ts
// Store custom device tags, notes, metadata
// Sync with Android Management API data
```

#### 4.3 Create Reusable Components

**Device Components:**
- `components/device-table.tsx` - Main table with shadcn/ui Table
- `components/device-row.tsx` - Individual table row
- `components/device-detail-modal.tsx` - Full device info modal
- `components/status-indicator.tsx` - Colored status dots
- `components/device-badge.tsx` - Tag badges

**Layout Components:**
- `components/navbar.tsx`
- `components/sidebar.tsx`
- `components/page-header.tsx`

**UI Components:**
- Use shadcn/ui for all base components
- Customize with Tailwind for brand colors

---

### Phase 5: Real-time Features with Convex

#### 5.1 Setup Convex Subscriptions

Enable real-time device status updates:
```typescript
// In device list page
const devices = useQuery(api.devices.list);
// Auto-updates when device status changes
```

#### 5.2 Device Sync Logic

Create background sync:
```typescript
// convex/crons.ts
// Periodically fetch device data from Android Management API
// Update Convex database
// Trigger real-time updates to connected clients
```

---

### Phase 6: Deployment & Testing

#### 6.1 Vercel Deployment Setup
1. Push code to GitHub
2. Connect repository to Vercel
3. Configure environment variables in Vercel dashboard:
   - All Clerk keys
   - Convex deployment URL
   - Google credentials
   - Enterprise name

4. Configure Convex production environment
5. Deploy and test

#### 6.2 Testing Checklist
- [ ] Authentication flow works
- [ ] Device list loads correctly
- [ ] Device detail modal displays all info
- [ ] QR code generation works
- [ ] Real-time updates work
- [ ] Mobile responsive design works
- [ ] Sidebar collapse/expand works
- [ ] All API calls are authenticated
- [ ] Error handling works properly

---

## File Structure (Final)

```
bbtec-mdm/
├── .archive/
│   └── express-version/          # Old Express app
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Dashboard layout with sidebar
│   │   ├── enrollment/
│   │   │   └── page.tsx          # QR code generation
│   │   └── management/
│   │       └── devices/
│   │           └── page.tsx      # Device list
│   ├── actions/
│   │   ├── enrollment.ts         # Server actions
│   │   └── devices.ts
│   ├── api/                      # API routes if needed
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home/redirect
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── navbar.tsx
│   ├── sidebar.tsx
│   ├── device-table.tsx
│   └── device-detail-modal.tsx
├── convex/
│   ├── schema.ts                 # Database schema
│   ├── devices.ts                # Device queries/mutations
│   └── auth.config.ts            # Clerk integration
├── lib/
│   ├── android-management/       # Android API service layer
│   │   ├── client.ts
│   │   ├── devices.ts
│   │   ├── policies.ts
│   │   ├── enrollment.ts
│   │   └── types.ts
│   └── utils.ts                  # Helper functions
├── config/
│   └── service-account-key.json  # Google credentials
├── public/
├── .env.local
├── middleware.ts                 # Clerk middleware
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Migration Checklist

### Phase 1: Archive & Initialize
- [ ] Move existing code to `.archive/express-version/`
- [ ] Create archive README
- [ ] Initialize Next.js project
- [ ] Install dependencies
- [ ] Setup shadcn/ui
- [ ] Commit: "Archive Express and initialize Next.js"

### Phase 2: Services & Auth
- [ ] Configure Clerk
- [ ] Initialize Convex
- [ ] Create Convex schema
- [ ] Port Android Management API service
- [ ] Test authentication flow

### Phase 3: UI Foundation
- [ ] Build navbar component
- [ ] Build sidebar component
- [ ] Create dashboard layout
- [ ] Test responsive design

### Phase 4: Core Features
- [ ] Build enrollment page
- [ ] Build devices list page
- [ ] Port device detail modal
- [ ] Implement pagination
- [ ] Add real-time updates

### Phase 5: Deploy
- [ ] Setup Vercel project
- [ ] Configure environment variables
- [ ] Deploy to production
- [ ] Test live deployment

---

## Notes

### Key Decisions
- **Why Convex?** Real-time subscriptions perfect for live device status updates
- **Why Next.js Server Actions?** Cleaner than REST API, better DX, type-safe
- **Why shadcn/ui?** Modern, accessible, customizable components
- **Why archive?** Keep reference code, maintain git history

### Migration Tips
1. Port one feature at a time
2. Test thoroughly after each phase
3. Keep old code running until new version is deployed
4. Use TypeScript strictly - catch errors early
5. Leverage AI for repetitive porting tasks

### Future Enhancements
- Policy management page
- Advanced device filtering/search
- Bulk device operations
- Reports and analytics dashboard
- Email notifications
- Device grouping/organization
- Custom policy templates
- File distribution to devices
