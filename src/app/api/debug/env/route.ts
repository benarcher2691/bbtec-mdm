import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '(not set)',
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL || '(not set)',
    VERCEL_URL: process.env.VERCEL_URL || '(not set)',
    VERCEL_ENV: process.env.VERCEL_ENV || '(not set)',
    NODE_ENV: process.env.NODE_ENV || '(not set)',
    CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT || '(not set)',
  })
}
