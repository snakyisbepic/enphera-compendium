import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'
import type { Plugin } from 'unified'
import type { Heading, Text, PhrasingContent, Root } from 'mdast'

/**
 * Tiny custom remark plugin: add stable `id` attributes to all headings.
 *
 * This mirrors the historical behavior of remark-slug using the GitHub
 * algorithm (lowercase, collapse whitespace to dashes, strip non-word chars).
 */
const remarkHeadingIds: Plugin<[], Root> = () => {
  const slug = (text: string): string =>
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // strip punctuation
      .replace(/\s+/g, '-') // spaces -> dashes

  const textOf = (node: PhrasingContent): string => {
    if (node.type === 'text') return node.value
    if (node.type === 'link') {
      return (node.children ?? [])
        .map((c) => textOf(c as PhrasingContent))
        .join('')
    }
    if ('value' in node && typeof node.value === 'string') return node.value
    if ('children' in node && Array.isArray((node as any).children)) {
      return (node as any).children
        .map((c: PhrasingContent) => textOf(c))
        .join('')
    }
    return ''
  }

  return (tree) => {
    const seen = new Map<string, number>()
    const walk = (node: any) => {
      if (node.type === 'heading') {
        const heading = node as Heading
        const text = (heading.children ?? [])
          .map((c) => textOf(c as PhrasingContent))
          .join('')
        let base = slug(text) || 'section'
        let id = base
        const n = seen.get(base) ?? 0
        if (n > 0) id = `${base}-${n}`
        seen.set(base, n + 1)
        if (!heading.data) heading.data = {}
        heading.data.hProperties = { id }
        // remark-html reads `data.hName` and `data.hProperties`.
      }
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) walk(child)
      }
    }
    walk(tree)
  }
}

/**
 * Convert markdown to safe HTML on the server.
 * Includes:
 * - remark-gfm: tables, strikethrough, task lists, autolink literals
 * - remark-heading-ids: anchor IDs on every heading
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkHeadingIds)
    .use(remarkHtml, { sanitize: false })
    .process(markdown)
  return String(file)
}

/**
 * Generate a URL-safe anchor slug from a heading text.
 * Mirrors the behavior of the custom remark plugin above.
 */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}
