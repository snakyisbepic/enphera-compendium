import { db } from '@/lib/db'
import { ensureSeeded, readChapterFile } from '@/lib/chapters'
import { ChapterRenderer } from '@/components/chapter-renderer'
import { TableOfContents } from '@/components/table-of-contents'

export const dynamic = 'force-dynamic'

async function getChaptersWithContent() {
  await ensureSeeded()
  const chapters = await db.chapter.findMany({
    orderBy: { sortOrder: 'asc' },
  })
  // Read each chapter's markdown from disk in parallel.
  // The markdown files are the source of truth — the DB only stores metadata.
  const withContent = await Promise.all(
    chapters.map(async (c) => {
      try {
        const file = await readChapterFile(c.filename)
        return {
          ...c,
          content: file.content,
          status: c.status ?? file.status ?? null,
        }
      } catch (err) {
        console.error('Failed to read chapter', c.filename, err)
        return {
          ...c,
          content:
            '*(This chapter file could not be read from disk. It may have been moved or deleted. Use the admin panel to remove this entry or restore the file.)*',
          status: c.status ?? null,
        }
      }
    }),
  )
  return withContent
}

// Anchor ID generator that mirrors remark-slug behavior so client-side TOC
// links match. We use a simpler custom ID for chapter-level anchors so we
// have full control over uniqueness: chapter-{sortOrder+1}-slug.
function chapterAnchor(id: string) {
  return id
}

export default async function PublicPage() {
  const chapters = await getChaptersWithContent()

  return (
    <div className="min-h-screen enphera-body">
      <TableOfContents chapters={chapters.map((c) => ({
        id: chapterAnchor(c.id),
        title: c.title,
        status: c.status,
      }))} />

      <main className="lg:pl-72">
        <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
          {/* Hero header */}
          <header className="mb-12 lg:mb-16 text-center">
            <h1 className="enphera-brand text-5xl lg:text-7xl text-[color:var(--enphera-amber)]">
              ENPHERA
            </h1>
            <p className="mt-3 text-sm lg:text-base text-[color:var(--enphera-muted)] font-sans tracking-widest uppercase">
              A Worldbuilding Compendium
            </p>
            <div className="mt-6 mx-auto h-px w-24 bg-[color:var(--enphera-amber)]/60" />
          </header>

          {chapters.length === 0 ? (
            <div className="text-center text-[color:var(--enphera-muted)] py-20">
              <p className="font-serif text-lg">
                The compendium is empty. Add chapters via the admin panel.
              </p>
            </div>
          ) : (
            <article>
              {chapters.map((c) => (
                <section
                  key={c.id}
                  id={chapterAnchor(c.id)}
                  className="mb-16 lg:mb-24 scroll-mt-24"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="font-mono text-xs text-[color:var(--enphera-muted)]">
                      {String(c.sortOrder + 1).padStart(2, '0')} ·
                    </span>
                    {c.status === 'draft' && (
                      <span className="inline-block rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest text-[color:var(--enphera-amber)]">
                        Draft
                      </span>
                    )}
                  </div>
                  <ChapterRenderer markdown={c.content} />
                </section>
              ))}
            </article>
          )}

          <footer className="mt-16 pt-8 border-t border-[color:var(--enphera-border)] text-center text-xs text-[color:var(--enphera-muted)] font-sans">
            <p>
              The Enphera Compendium is a living document. Chapters may change
              as the worldbuilding project evolves.
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
