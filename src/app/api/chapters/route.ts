import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/chapters'

export const dynamic = 'force-dynamic'

// GET /api/chapters — PUBLIC
// Returns all chapters sorted by sortOrder, including their rendered status.
export async function GET() {
  try {
    await ensureSeeded()
    const chapters = await db.chapter.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        filename: true,
        title: true,
        status: true,
        sortOrder: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ chapters })
  } catch (err) {
    console.error('GET /api/chapters failed', err)
    return NextResponse.json(
      { error: 'Failed to load chapters' },
      { status: 500 },
    )
  }
}
