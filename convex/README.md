# Convex Database Setup

## Initialization

To initialize Convex, run:

```bash
npx convex dev
```

This will:
1. Create a new Convex project (or connect to existing)
2. Generate deployment URL
3. Add environment variables to `.env.local`
4. Start the development server

## Environment Variables Needed

After initialization, add these to `.env.local`:

```env
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

## Schema

The database schema is defined in `schema.ts`:

- **deviceNotes**: Custom tags, notes, and names for devices
- **userPreferences**: User-specific settings
- **auditLog**: Action tracking and compliance

## Clerk Integration

Convex will be configured to work with Clerk authentication.
User IDs from Clerk are used to scope data access.
