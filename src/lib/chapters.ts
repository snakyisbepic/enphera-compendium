import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { db } from '@/lib/db'

/**
 * Directory where markdown chapter files live.
 *
 * Defaults to `<cwd>/content` (i.e. the `content/` folder at the project root).
 * Override with the `CONTENT_DIR` env var if you want chapters to live on a
 * persistent volume — e.g. on Railway/Render/Fly set `CONTENT_DIR=/data/content`
 * so uploaded chapters survive redeploys.
 */
export const CONTENT_DIR = path.resolve(
  process.env.CONTENT_DIR || path.join(process.cwd(), 'content'),
)

export interface ChapterFile {
  filename: string
  title: string
  status?: string
  content: string
}

export interface ChapterMeta {
  id: string
  filename: string
  title: string
  status?: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

/** Safe filename: only allow simple, sane .md filenames inside content/. */
export function assertSafeFilename(filename: string) {
  if (!filename) throw new Error('Filename is required')
  if (!filename.toLowerCase().endsWith('.md'))
    throw new Error('Filename must end with .md')
  // No path separators, no dots beyond the extension, no traversal.
  const base = filename.toLowerCase()
  if (
    base.includes('/') ||
    base.includes('\\') ||
    base.includes('..') ||
    base.includes('\0')
  ) {
    throw new Error('Invalid filename')
  }
  // Limit charset to alphanumerics, dashes, underscores, dots.
  if (!/^[a-z0-9._-]+\.md$/i.test(filename)) {
    throw new Error('Filename must only contain letters, numbers, dashes, underscores, and dots')
  }
  // Final sanity: the resolved path must remain inside CONTENT_DIR.
  const resolved = path.resolve(CONTENT_DIR, filename)
  const rel = path.relative(CONTENT_DIR, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Filename escapes content directory')
  }
  return resolved
}

export function filePathFor(filename: string) {
  return assertSafeFilename(filename)
}

/** Parse frontmatter + body from raw markdown content. */
export function parseMarkdown(raw: string) {
  const { data, content } = matter(raw)
  const title =
    (typeof data.title === 'string' && data.title.trim()) || undefined
  const status =
    typeof data.status === 'string' ? data.status.toLowerCase() : undefined
  return { title, status, content }
}

/** Derive a human title from a filename like "01-cosmology.md" -> "Cosmology". */
export function titleFromFilename(filename: string) {
  const base = filename.replace(/\.md$/i, '')
  // Drop leading numbers / dashes.
  const cleaned = base.replace(/^\d+[-_\s]*/, '').replace(/[-_]/g, ' ')
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Read a chapter file from disk. */
export async function readChapterFile(filename: string) {
  const resolved = filePathFor(filename)
  const raw = await fs.readFile(resolved, 'utf8')
  const parsed = parseMarkdown(raw)
  return {
    filename,
    title: parsed.title || titleFromFilename(filename),
    status: parsed.status,
    content: parsed.content,
  }
}

/** Write a chapter file to disk (overwrite or create). */
export async function writeChapterFile(
  filename: string,
  raw: string,
): Promise<ChapterFile> {
  const resolved = filePathFor(filename)
  await fs.mkdir(CONTENT_DIR, { recursive: true })
  await fs.writeFile(resolved, raw, 'utf8')
  const parsed = parseMarkdown(raw)
  return {
    filename,
    title: parsed.title || titleFromFilename(filename),
    status: parsed.status,
    content: parsed.content,
  }
}

/** Delete a chapter file from disk. */
export async function deleteChapterFile(filename: string) {
  const resolved = filePathFor(filename)
  await fs.unlink(resolved).catch(() => {
    /* file may already be gone — that's fine */
  })
}

/** List all .md files currently in content/. */
export async function listContentFiles(): Promise<string[]> {
  await fs.mkdir(CONTENT_DIR, { recursive: true })
  const entries = await fs.readdir(CONTENT_DIR)
  return entries.filter((e) => e.toLowerCase().endsWith('.md')).sort()
}

/** Check if a file exists in content/. */
export async function fileExists(filename: string) {
  const resolved = filePathFor(filename)
  try {
    await fs.access(resolved)
    return true
  } catch {
    return false
  }
}

/**
 * Scan content/ directory and sync with the DB.
 * - Adds any new files to the database.
 * - Flags any DB records whose files are missing.
 * - Leaves existing matches untouched.
 */
export async function scanAndSyncContent() {
  const filesOnDisk = await listContentFiles()
  const dbChapters = await db.chapter.findMany()

  const dbFilenames = new Set(dbChapters.map((c) => c.filename))
  const diskSet = new Set(filesOnDisk)

  const added: ChapterMeta[] = []
  for (const filename of filesOnDisk) {
    if (!dbFilenames.has(filename)) {
      const file = await readChapterFile(filename)
      const maxSort = await db.chapter.aggregate({
        _max: { sortOrder: true },
      })
      const nextSort = (maxSort._max.sortOrder ?? -1) + 1
      const created = await db.chapter.create({
        data: {
          filename,
          title: file.title,
          status: file.status,
          sortOrder: nextSort,
        },
      })
      added.push(created as unknown as ChapterMeta)
    }
  }

  const missing: ChapterMeta[] = []
  for (const ch of dbChapters) {
    if (!diskSet.has(ch.filename)) {
      missing.push(ch as unknown as ChapterMeta)
    }
  }

  const existing = dbChapters.filter((c) => diskSet.has(c.filename)) as unknown as ChapterMeta[]

  return { added, missing, existing }
}

/**
 * Auto-seed the database from content/ on first run if it is empty.
 * Safe to call repeatedly — it is a no-op when chapters already exist.
 */
export async function ensureSeeded() {
  const count = await db.chapter.count()
  if (count > 0) return
  await scanAndSyncContent()
}

/** Get the next available sortOrder value. */
export async function nextSortOrder() {
  const max = await db.chapter.aggregate({ _max: { sortOrder: true } })
  return (max._max.sortOrder ?? -1) + 1
}
