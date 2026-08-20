import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/session'
import { scanAndSyncContent } from '@/lib/chapters'

export const dynamic = 'force-dynamic'

// POST /api/admin/scan
// Requires session. Scans content/ directory and syncs with the DB.
export async function POST() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const result = await scanAndSyncContent()
    return NextResponse.json(result)
  } catch (err) {
    console.error('POST /api/admin/scan failed', err)
    return NextResponse.json(
      { error: 'Failed to scan content directory' },
      { status: 500 },
    )
  }
}

// GET — same behavior, for convenience.
export async function GET() {
  return POST()
}
