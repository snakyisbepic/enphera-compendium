'use client'

import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface TocChapter {
  id: string
  title: string
  status?: string | null
}

interface TableOfContentsProps {
  chapters: TocChapter[]
  /** Title rendered at the top of the sidebar. */
  brandTitle?: string
}

/**
 * Sticky sidebar with the compendium brand at the top, the chapter list,
 * and a subtle admin link.
 *
 * On mobile, the sidebar collapses into a slide-over drawer triggered by
 * a hamburger button in the sticky header.
 */
export function TableOfContents({
  chapters,
  brandTitle = 'ENPHERA',
}: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('')
  const [mobileOpen, setMobileOpen] = useState(false)

  // Track which chapter is currently in view via IntersectionObserver.
  useEffect(() => {
    if (chapters.length === 0) return
    const ids = chapters.map((c) => c.id)
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el))

    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry closest to the top that is intersecting.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          setActiveId(visible[0].target.id)
        }
      },
      {
        // Trigger when the top of a chapter crosses ~30% of the viewport.
        rootMargin: '-80px 0px -55% 0px',
        threshold: 0,
      },
    )

    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [chapters])

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(id)
      // Update URL hash without jump
      history.replaceState(null, '', `#${id}`)
      setMobileOpen(false)
    }
  }

  const sidebarInner = (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-4 border-b border-[color:var(--enphera-border)]">
        <Link
          href="/"
          className="block text-2xl enphera-brand text-[color:var(--enphera-amber)] hover:text-[color:var(--enphera-amber-soft)] transition-colors"
          onClick={() => setMobileOpen(false)}
        >
          {brandTitle}
        </Link>
        <p className="mt-1 text-xs text-[color:var(--enphera-muted)] font-sans tracking-wide">
          Compendium
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto enphera-scroll px-2 py-3">
        <ul className="space-y-0.5">
          {chapters.map((ch, idx) => {
            const isActive = ch.id === activeId
            return (
              <li key={ch.id}>
                <a
                  href={`#${ch.id}`}
                  onClick={(e) => handleNavClick(e, ch.id)}
                  className={cn(
                    'group block rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-[color:var(--enphera-amber)]/10 text-[color:var(--enphera-amber)] border-l-2 border-[color:var(--enphera-amber)]'
                      : 'text-[color:var(--enphera-text)]/80 hover:bg-white/5 hover:text-[color:var(--enphera-text)] border-l-2 border-transparent',
                  )}
                >
                  <span className="font-mono text-xs text-[color:var(--enphera-muted)] mr-2">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-serif">{ch.title}</span>
                  {ch.status === 'draft' && (
                    <span className="ml-2 inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-sans uppercase tracking-wider text-[color:var(--enphera-amber)]">
                      Draft
                    </span>
                  )}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="border-t border-[color:var(--enphera-border)] px-5 py-3">
        <Link
          href="/admin"
          className="text-xs text-[color:var(--enphera-muted)] hover:text-[color:var(--enphera-amber)] transition-colors font-sans"
          onClick={() => setMobileOpen(false)}
        >
          ⚙ Manage
        </Link>
      </div>
    </div>
  )

  return (
    <>
      {/* Sticky mobile header */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[color:var(--enphera-bg)]/95 backdrop-blur border-b border-[color:var(--enphera-border)]">
        <Link href="/" className="enphera-brand text-xl text-[color:var(--enphera-amber)]">
          {brandTitle}
        </Link>
        <button
          type="button"
          aria-label="Toggle table of contents"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-2 text-[color:var(--enphera-text)] hover:bg-white/5"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-72 lg:z-20 bg-[color:var(--enphera-bg-elevated)] border-r border-[color:var(--enphera-border)]">
        {sidebarInner}
      </aside>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80vw] bg-[color:var(--enphera-bg-elevated)] shadow-xl enphera-fade-in">
            <button
              type="button"
              aria-label="Close table of contents"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-md p-2 text-[color:var(--enphera-muted)] hover:text-[color:var(--enphera-text)] hover:bg-white/5"
            >
              <X size={18} />
            </button>
            {sidebarInner}
          </div>
        </div>
      )}
    </>
  )
}
