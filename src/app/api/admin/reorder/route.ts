import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/session'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/reorder
// Body: { chapters: [{ id, sortOrder }] }
export async function PATCH(req: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json().catch(() => null)
    const list = body?.chapters
    if (!Array.isArray(list)) {
      return NextResponse.json(
        { error: 'Body must contain `chapters: [{ id, sortOrder }]`' },
        { status: 400 },
      )
    }

    // Use a transaction to update all sort orders atomically.
    await db.$transaction(
      list.map((item: { id?: string; sortOrder?: number }) =>
        db.chapter.update({
          where: { id: String(item.id) },
          data: { sortOrder: Number(item.sortOrder) },
        }),
      ),
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PATCH /api/admin/reorder failed', err)
    return NextResponse.json(
      { error: 'Failed to reorder chapters' },
      { status: 500 },
    )
  }
}
