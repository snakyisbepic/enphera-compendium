'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import {
  ArrowLeft,
  LogOut,
  RefreshCw,
  Loader2,
  Upload,
  FolderSearch,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { PinGate } from '@/components/admin/pin-gate'
import { ChapterCard, type AdminChapter } from '@/components/admin/chapter-card'

interface ScanResult {
  added: AdminChapter[]
  missing: AdminChapter[]
  existing: AdminChapter[]
}

export function AdminDashboard() {
  const { toast } = useToast()
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [chapters, setChapters] = useState<AdminChapter[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [dragEnabled, setDragEnabled] = useState(true)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Check session on mount.
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setAuthed(Boolean(d.authenticated))
      })
      .catch(() => {
        if (!cancelled) setAuthed(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshChapters = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/chapters')
      const data = await res.json()
      setChapters(data.chapters ?? [])
    } catch {
      toast({
        title: 'Failed to load chapters',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (authed === true) {
      refreshChapters()
    }
  }, [authed, refreshChapters])

  const handleSignOut = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' })
    } catch {
      /* ignore */
    }
    setAuthed(false)
    setChapters([])
    toast({ title: 'Signed out' })
  }

  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.md')) {
      toast({
        title: 'Invalid file',
        description: 'Please upload a .md file.',
        variant: 'destructive',
      })
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/chapters', {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: 'Upload failed',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Chapter added',
        description: `${data.chapter?.filename ?? file.name} uploaded.`,
      })
      await refreshChapters()
    } finally {
      setUploading(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  const handleScan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/admin/scan', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: 'Scan failed',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        })
        return
      }
      setScanResult(data)
      setScanOpen(true)
      await refreshChapters()
    } finally {
      setScanning(false)
    }
  }

  const persistOrder = async (newOrder: AdminChapter[]) => {
    // Disable drag while persisting to prevent overlap.
    setDragEnabled(false)
    try {
      const body = {
        chapters: newOrder.map((c, i) => ({ id: c.id, sortOrder: i })),
      }
      const res = await fetch('/api/admin/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        toast({
          title: 'Reorder failed',
          description: 'Could not save the new order.',
          variant: 'destructive',
        })
        // Revert by reloading from server.
        await refreshChapters()
      }
    } finally {
      setDragEnabled(true)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = chapters.findIndex((c) => c.id === active.id)
    const newIndex = chapters.findIndex((c) => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(chapters, oldIndex, newIndex)
    setChapters(reordered)
    await persistOrder(reordered)
  }

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const idx = chapters.findIndex((c) => c.id === id)
    if (idx < 0) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= chapters.length) return
    const reordered = arrayMove(chapters, idx, target)
    setChapters(reordered)
    await persistOrder(reordered)
  }

  if (authed === null) {
    return (
      <div className="min-h-screen enphera-body flex items-center justify-center">
        <Loader2 className="animate-spin text-[color:var(--enphera-amber)]" />
      </div>
    )
  }

  if (authed === false) {
    return <PinGate onSuccess={() => setAuthed(true)} />
  }

  return (
    <div className="min-h-screen enphera-body">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[color:var(--enphera-bg)]/95 backdrop-blur border-b border-[color:var(--enphera-border)]">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="enphera-brand text-xl lg:text-2xl text-[color:var(--enphera-amber)]">
              ENPHERA
            </h1>
            <span className="hidden sm:inline text-xs text-[color:var(--enphera-muted)] font-sans uppercase tracking-widest">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleScan}
              disabled={scanning}
              className="border-[color:var(--enphera-border)] bg-transparent text-[color:var(--enphera-text)] hover:bg-white/5 hover:text-[color:var(--enphera-amber)]"
            >
              {scanning ? (
                <Loader2 size={14} className="animate-spin mr-1.5" />
              ) : (
                <FolderSearch size={14} className="mr-1.5" />
              )}
              Scan content/
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshChapters}
              disabled={loading}
              className="border-[color:var(--enphera-border)] bg-transparent text-[color:var(--enphera-text)] hover:bg-white/5 hover:text-[color:var(--enphera-amber)]"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin mr-1.5' : 'mr-1.5'} />
              Refresh
            </Button>
            <Link href="/">
              <Button
                variant="outline"
                size="sm"
                className="border-[color:var(--enphera-border)] bg-transparent text-[color:var(--enphera-text)] hover:bg-white/5 hover:text-[color:var(--enphera-amber)]"
              >
                <ArrowLeft size={14} className="mr-1.5" /> View
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut size={14} className="mr-1.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 lg:py-8">
        {/* Upload zone */}
        <Card className="p-6 mb-6 bg-[color:var(--enphera-bg-elevated)] border-[color:var(--enphera-border)] border-dashed">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-lg text-[color:var(--enphera-text)]">
                Add a new chapter
              </h2>
              <p className="text-sm text-[color:var(--enphera-muted)] font-sans mt-0.5">
                Upload a <code className="text-[color:var(--enphera-amber)]">.md</code>{' '}
                file. Frontmatter <code>title</code> and <code>status</code> are
                read automatically.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={uploadInputRef}
                type="file"
                accept=".md"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleUpload(f)
                }}
              />
              <Button
                onClick={() => uploadInputRef.current?.click()}
                disabled={uploading}
                className="bg-[color:var(--enphera-amber)] text-[color:var(--enphera-bg)] hover:bg-[color:var(--enphera-amber-soft)] font-sans font-semibold"
              >
                {uploading ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <Upload size={16} className="mr-2" />
                )}
                Choose .md file
              </Button>
            </div>
          </div>
        </Card>

        {/* Chapter list */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl text-[color:var(--enphera-text)]">
            Chapters{' '}
            <span className="text-sm text-[color:var(--enphera-muted)] font-sans ml-1">
              ({chapters.length})
            </span>
          </h2>
          <span className="text-xs text-[color:var(--enphera-muted)] font-sans">
            Drag to reorder · use ↑/↓ for accessibility
          </span>
        </div>

        {loading && chapters.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-[color:var(--enphera-amber)]" />
          </div>
        ) : chapters.length === 0 ? (
          <Card className="p-8 text-center bg-[color:var(--enphera-bg-elevated)] border-[color:var(--enphera-border)]">
            <p className="text-[color:var(--enphera-muted)] font-serif">
              No chapters yet. Upload a .md file above or click{' '}
              <strong>Scan content/</strong> to import existing files.
            </p>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={chapters.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className={`space-y-3 ${dragEnabled ? '' : 'pointer-events-none opacity-70'}`}
              >
                {chapters.map((c, idx) => (
                  <ChapterCard
                    key={c.id}
                    chapter={c}
                    index={idx}
                    total={chapters.length}
                    onMove={handleMove}
                    onChanged={refreshChapters}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

      {/* Scan result dialog */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-lg bg-[color:var(--enphera-bg-elevated)] border-[color:var(--enphera-border)]">
          <DialogHeader>
            <DialogTitle className="enphera-brand text-[color:var(--enphera-amber)]">
              Content directory scan
            </DialogTitle>
            <DialogDescription className="text-[color:var(--enphera-muted)]">
              Synced <code>content/</code> with the database.
            </DialogDescription>
          </DialogHeader>
          {scanResult && (
            <div className="space-y-3 mt-2">
              <div className="flex items-start gap-3 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2
                  size={18}
                  className="text-emerald-400 mt-0.5 shrink-0"
                />
                <div className="text-sm">
                  <div className="font-sans text-emerald-300">
                    {scanResult.added.length} added
                  </div>
                  {scanResult.added.length > 0 && (
                    <ul className="mt-1 text-xs text-[color:var(--enphera-muted)] font-mono space-y-0.5">
                      {scanResult.added.map((c) => (
                        <li key={c.id}>{c.filename}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle
                  size={18}
                  className="text-amber-400 mt-0.5 shrink-0"
                />
                <div className="text-sm">
                  <div className="font-sans text-amber-300">
                    {scanResult.missing.length} missing on disk
                  </div>
                  {scanResult.missing.length > 0 && (
                    <ul className="mt-1 text-xs text-[color:var(--enphera-muted)] font-mono space-y-0.5">
                      {scanResult.missing.map((c) => (
                        <li key={c.id}>{c.filename}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="text-xs text-[color:var(--enphera-muted)] font-sans">
                {scanResult.existing.length} unchanged record(s).
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => setScanOpen(false)}
              className="bg-[color:var(--enphera-amber)] text-[color:var(--enphera-bg)] hover:bg-[color:var(--enphera-amber-soft)]"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
