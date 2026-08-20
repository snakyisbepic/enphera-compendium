'use client'

import { useState, useRef } from 'react'
import {
  GripVertical,
  Trash2,
  Eye,
  Upload,
  Loader2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

export interface AdminChapter {
  id: string
  filename: string
  title: string
  status?: string | null
  sortOrder: number
  updatedAt: string
}

interface ChapterCardProps {
  chapter: AdminChapter
  index: number
  total: number
  onMove: (id: string, direction: 'up' | 'down') => void
  onChanged: () => void
}

function statusBadge(status?: string | null) {
  if (!status) return null
  if (status === 'canon') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20">
        Canon
      </Badge>
    )
  }
  if (status === 'draft') {
    return (
      <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/20">
        Draft
      </Badge>
    )
  }
  if (status === 'open') {
    return (
      <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/20">
        Open
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[color:var(--enphera-muted)]">
      {status}
    </Badge>
  )
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function ChapterCard({
  chapter,
  index,
  total,
  onMove,
  onChanged,
}: ChapterCardProps) {
  const { toast } = useToast()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id })

  const [replaceFile, setReplaceFile] = useState<File | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleReplace = async () => {
    if (!replaceFile) return
    setReplacing(true)
    try {
      const form = new FormData()
      form.append('file', replaceFile)
      const res = await fetch(`/api/admin/chapters/${chapter.id}`, {
        method: 'PUT',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: 'Replace failed',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Chapter replaced',
        description: `${data.chapter?.filename ?? chapter.filename} updated.`,
      })
      setReplaceFile(null)
      if (replaceInputRef.current) replaceInputRef.current.value = ''
      onChanged()
    } finally {
      setReplacing(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/chapters/${chapter.id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: 'Delete failed',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Chapter deleted',
        description: `${chapter.filename} removed.`,
      })
      onChanged()
    } finally {
      setDeleting(false)
    }
  }

  const handlePreviewOpen = async (open: boolean) => {
    setPreviewOpen(open)
    if (open && previewHtml === null) {
      setPreviewLoading(true)
      try {
        const res = await fetch(`/api/admin/chapters/${chapter.id}`)
        const data = await res.json()
        if (res.ok && data.chapter?.html) {
          setPreviewHtml(data.chapter.html)
        } else {
          setPreviewHtml('<p><em>(Failed to load content.)</em></p>')
        }
      } catch {
        setPreviewHtml('<p><em>(Failed to load content.)</em></p>')
      } finally {
        setPreviewLoading(false)
      }
    }
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'p-4 bg-[color:var(--enphera-bg-elevated)] border-[color:var(--enphera-border)]',
        isDragging && 'shadow-2xl ring-1 ring-[color:var(--enphera-amber)]',
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="cursor-grab active:cursor-grabbing mt-1 text-[color:var(--enphera-muted)] hover:text-[color:var(--enphera-amber)] touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[color:var(--enphera-muted)]">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="font-serif text-lg text-[color:var(--enphera-text)] truncate">
              {chapter.title}
            </h3>
            {statusBadge(chapter.status)}
          </div>
          <p className="mt-1 text-xs text-[color:var(--enphera-muted)] font-mono truncate">
            {chapter.filename}
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--enphera-muted)] font-sans">
            Updated {formatDate(chapter.updatedAt)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Replace */}
            <label className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--enphera-border)] bg-[color:var(--enphera-bg)] px-3 py-1.5 text-xs font-sans text-[color:var(--enphera-text)] hover:border-[color:var(--enphera-amber)] hover:text-[color:var(--enphera-amber)] transition-colors cursor-pointer">
              {replacing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              Replace
              <input
                ref={replaceInputRef}
                type="file"
                accept=".md"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setReplaceFile(f)
                  }
                }}
              />
            </label>
            {replaceFile && (
              <Button
                size="sm"
                variant="default"
                disabled={replacing}
                onClick={handleReplace}
                className="h-7 text-xs bg-[color:var(--enphera-amber)] text-[color:var(--enphera-bg)] hover:bg-[color:var(--enphera-amber-soft)]"
              >
                Confirm: {replaceFile.name}
              </Button>
            )}

            {/* Preview */}
            <Dialog open={previewOpen} onOpenChange={handlePreviewOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-[color:var(--enphera-border)] bg-transparent text-[color:var(--enphera-text)] hover:bg-white/5"
                >
                  <Eye size={14} /> Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-[color:var(--enphera-bg-elevated)] border-[color:var(--enphera-border)]">
                <DialogHeader>
                  <DialogTitle className="enphera-brand text-[color:var(--enphera-amber)]">
                    Preview — {chapter.title}
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-2">
                  {previewLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="animate-spin text-[color:var(--enphera-amber)]" />
                    </div>
                  ) : previewHtml !== null ? (
                    <div
                      className="enphera-prose"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>

            {/* Up / Down buttons (alternative to drag) */}
            <div className="inline-flex rounded-md border border-[color:var(--enphera-border)] overflow-hidden">
              <button
                type="button"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => onMove(chapter.id, 'up')}
                className="p-1.5 text-[color:var(--enphera-muted)] hover:bg-white/5 hover:text-[color:var(--enphera-amber)] disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={index === total - 1}
                onClick={() => onMove(chapter.id, 'down')}
                className="p-1.5 text-[color:var(--enphera-muted)] hover:bg-white/5 hover:text-[color:var(--enphera-amber)] border-l border-[color:var(--enphera-border)] disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {/* Delete with confirm */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 size={14} /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[color:var(--enphera-bg-elevated)] border-[color:var(--enphera-border)]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-[color:var(--enphera-text)]">
                    Delete this chapter?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-[color:var(--enphera-muted)]">
                    This will permanently delete the file{' '}
                    <code className="text-[color:var(--enphera-amber)]">
                      {chapter.filename}
                    </code>{' '}
                    from <code>content/</code> and remove its database record.
                    This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-[color:var(--enphera-border)] bg-transparent text-[color:var(--enphera-text)] hover:bg-white/5">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    {deleting ? (
                      <Loader2 size={14} className="animate-spin mr-2" />
                    ) : null}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </Card>
  )
}
