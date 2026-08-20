import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/session'

export const dynamic = 'force-dynamic'

// GET /api/admin/session — Check if the current request has a valid admin session.
export async function GET() {
  const ok = await isAuthenticated()
  return NextResponse.json({ authenticated: ok })
}
