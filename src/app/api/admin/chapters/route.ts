import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/session'
import { writeChapterFile, nextSortOrder } from '@/lib/chapters'

export const dynamic = 'force-dynamic'

// POST /api/admin/chapters — Upload a new chapter .md file.
// Requires session. Body: FormData with `file` field.
export async function POST(req: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Upload a .md file.' },
        { status: 400 },
      )
    }
    if (!file.name.toLowerCase().endsWith('.md')) {
      return NextResponse.json(
        { error: 'File must be a .md markdown file.' },
        { status: 400 },
      )
    }
    const raw = await file.text()
    let written
    try {
      written = await writeChapterFile(file.name, raw)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid filename'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    // Check for duplicate filename in DB
    const existing = await db.chapter.findUnique({
      where: { filename: written.filename },
    })
    if (existing) {
      // Update instead of create
      const updated = await db.chapter.update({
        where: { id: existing.id },
        data: {
          title: written.title,
          status: written.status,
        },
      })
      return NextResponse.json({ chapter: updated })
    }
    const created = await db.chapter.create({
      data: {
        filename: written.filename,
        title: written.title,
        status: written.status,
        sortOrder: await nextSortOrder(),
      },
    })
    return NextResponse.json({ chapter: created })
  } catch (err) {
    console.error('POST /api/admin/chapters failed', err)
    return NextResponse.json(
      { error: 'Failed to upload chapter' },
      { status: 500 },
    )
  }
}
