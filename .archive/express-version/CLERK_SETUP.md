# Clerk Authentication Setup Guide

This application now uses Clerk for authentication. Follow these steps to set it up:

## 1. Create a Clerk Account

1. Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. Sign up for a free account
3. Create a new application

## 2. Get Your API Keys

1. In the Clerk dashboard, go to **API Keys**
2. Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
3. Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)

## 3. Configure Environment Variables

Add the following to your `.env` file:

```bash
CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
```

Replace `pk_test_your_key_here` and `sk_test_your_key_here` with your actual keys from Clerk.

## 4. Configure Clerk Application Settings

In your Clerk dashboard:

1. Go to **Sessions** settings
2. Make sure **JWT Templates** are configured (default template is fine)
3. No additional path configuration needed - the application uses Clerk's hosted Account Portal for authentication

## 5. Start the Server

```bash
npm run dev
```

## 6. Test Authentication

1. Navigate to `http://localhost:3000`
2. You should be redirected to Clerk's hosted sign-in page
3. Create a new account or sign in with existing credentials
4. After signing in, you'll be redirected back to the main MDM dashboard
5. You should see your name in the header with a user avatar button
6. Click the user avatar to access:
   - Account settings
   - Password management
   - Profile updates
   - Sign out option

## Features

- **Protected API Endpoints**: All `/api/*` routes require authentication
- **Session Management**: Uses Clerk's JWT tokens for secure authentication
- **Hosted Authentication**: Uses Clerk's Account Portal for sign-in/sign-up (no custom auth pages)
- **User Management**: Clerk UserButton component provides:
  - Sign out functionality
  - Password updates
  - Profile management
  - Account settings

## Security Notes

- All API requests include a Bearer token in the Authorization header
- Tokens are verified server-side using Clerk's backend SDK
- Invalid or expired tokens result in 401 Unauthorized responses
- Environment variables containing secrets should never be committed to git

## Troubleshooting

### "Clerk is not configured" error
- Make sure you've added `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to your `.env` file
- Restart the server after updating environment variables

### Authentication errors
- Check that your Clerk keys are correct
- Verify that your Clerk application is active in the dashboard
- Check browser console for detailed error messages

### API returns 401 Unauthorized
- Make sure you're signed in
- Try signing out and signing back in
- Clear browser cache and cookies
