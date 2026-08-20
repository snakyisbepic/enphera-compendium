import { markdownToHtml } from '@/lib/markdown'

/**
 * Server-side markdown renderer.
 * Renders markdown to sanitized HTML and returns it inside a styled container.
 *
 * This is a server component — the resulting HTML appears in the raw SSR output
 * so AI web scrapers can read the full chapter text directly from the page source.
 */
export async function ChapterRenderer({
  markdown,
  className,
}: {
  markdown: string
  className?: string
}) {
  const html = await markdownToHtml(markdown)
  return (
    <div
      className={`enphera-prose ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
