import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { generateHTML } from '@tiptap/html'
import type { JSONContent } from '@tiptap/react'

export const tiptapExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { class: 'text-primary underline' },
  }),
]

export function renderContentToHtml(value: JSONContent | string | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  try {
    return generateHTML(value, tiptapExtensions)
  } catch {
    return ''
  }
}

export function isContentEmpty(value: unknown): boolean {
  if (!value) return true
  if (typeof value === 'string') {
    const s = value.trim()
    return !s || s === '<p></p>' || s === '<p><br></p>'
  }
  if (typeof value === 'object' && value !== null) {
    const doc = value as JSONContent
    if (!doc.content || doc.content.length === 0) return true
    return doc.content.every(
      (node) => node.type === 'paragraph' && (!node.content || node.content.length === 0),
    )
  }
  return true
}
