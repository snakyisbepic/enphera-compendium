import { NextResponse } from 'next/server'
import { getSession, ADMIN_PIN } from '@/lib/session'

export const dynamic = 'force-dynamic'

// POST /api/admin/auth
// Body: { pin: string }
// Verifies PIN, creates encrypted session cookie.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const pin = body?.pin
    if (typeof pin !== 'string') {
      return NextResponse.json(
        { success: false, error: 'PIN is required' },
        { status: 400 },
      )
    }
    if (pin !== ADMIN_PIN) {
      return NextResponse.json(
        { success: false, error: 'Invalid PIN' },
        { status: 401 },
      )
    }
    const session = await getSession()
    session.admin = true
    session.loginAt = Date.now()
    await session.save()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/admin/auth failed', err)
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 },
    )
  }
}

// DELETE /api/admin/auth — sign out (clears session)
export async function DELETE() {
  try {
    const session = await getSession()
    session.destroy()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/admin/auth failed', err)
    return NextResponse.json(
      { success: false, error: 'Sign out failed' },
      { status: 500 },
    )
  }
}
