import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/session'
import { readRawChapterFile } from '@/lib/chapters'

export const dynamic = 'force-dynamic'

// GET /api/admin/chapters/[id]/download — Download a chapter's raw .md file
// exactly as it exists on disk (frontmatter included).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const existing = await db.chapter.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }
    const raw = await readRawChapterFile(existing.filename)
    return new NextResponse(raw, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${existing.filename}"`,
        'Content-Length': Buffer.byteLength(raw, 'utf8').toString(),
      },
    })
  } catch (err) {
    console.error('GET /api/admin/chapters/[id]/download failed', err)
    return NextResponse.json(
      { error: 'Failed to download chapter' },
      { status: 500 },
    )
  }
}
