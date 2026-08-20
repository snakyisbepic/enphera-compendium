import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/session'
import { writeChapterFile, deleteChapterFile, readChapterFile } from '@/lib/chapters'
import { markdownToHtml } from '@/lib/markdown'

export const dynamic = 'force-dynamic'

// PUT /api/admin/chapters/[id] — Replace a chapter's .md file.
// Requires session. Body: FormData with `file` field.
export async function PUT(
  req: Request,
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

    // If the new filename differs, we delete the old file and write the new one.
    const newFilename = file.name
    let written
    try {
      written = await writeChapterFile(newFilename, raw)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid filename'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (newFilename !== existing.filename) {
      await deleteChapterFile(existing.filename)
    }

    // Update DB record. If filename changed, ensure no collision with another record.
    if (newFilename !== existing.filename) {
      const collision = await db.chapter.findUnique({
        where: { filename: newFilename },
      })
      if (collision && collision.id !== existing.id) {
        return NextResponse.json(
          { error: 'Another chapter already uses that filename.' },
          { status: 409 },
        )
      }
    }

    const updated = await db.chapter.update({
      where: { id },
      data: {
        filename: written.filename,
        title: written.title,
        status: written.status,
      },
    })
    return NextResponse.json({ chapter: updated })
  } catch (err) {
    console.error('PUT /api/admin/chapters/[id] failed', err)
    return NextResponse.json(
      { error: 'Failed to replace chapter' },
      { status: 500 },
    )
  }
}

// DELETE /api/admin/chapters/[id] — Delete chapter file + DB record.
export async function DELETE(
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
    await deleteChapterFile(existing.filename)
    await db.chapter.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/admin/chapters/[id] failed', err)
    return NextResponse.json(
      { error: 'Failed to delete chapter' },
      { status: 500 },
    )
  }
}

// GET /api/admin/chapters/[id]?preview=1 — Preview rendered markdown.
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
    const file = await readChapterFile(existing.filename)
    const html = await markdownToHtml(file.content)
    return NextResponse.json({
      chapter: { ...existing, content: file.content, html },
    })
  } catch (err) {
    console.error('GET /api/admin/chapters/[id] failed', err)
    return NextResponse.json(
      { error: 'Failed to load chapter' },
      { status: 500 },
    )
  }
}
