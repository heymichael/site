import { useEditor, EditorContent } from '@tiptap/react'
import type { JSONContent } from '@tiptap/react'
import { useEffect, useCallback, useRef } from 'react'
import {
  Bold, Italic, List, ListOrdered, Heading2, Link as LinkIcon,
  Quote, Undo, Redo,
} from 'lucide-react'
import { tiptapExtensions, renderContentToHtml } from './tiptapConfig'

interface RichTextEditorProps {
  value: JSONContent | string
  onChange: (json: JSONContent) => void
  editable?: boolean
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={title}
        className={`rounded p-1 transition-colors ${
          disabled
            ? 'text-muted-foreground/30 cursor-default'
            : active
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {title}
      </span>
    </div>
  )
}

export function RichTextEditor({ value, onChange, editable = true }: RichTextEditorProps) {
  const ready = useRef(false)

  const editor = useEditor({
    extensions: tiptapExtensions,
    content: value,
    editable,
    onCreate: () => {
      requestAnimationFrame(() => { ready.current = true })
    },
    onUpdate: ({ editor: e }) => {
      if (ready.current && e.isEditable) onChange(e.getJSON())
    },
    editorProps: {
      attributes: {
        class: [
          'prose prose-sm max-w-none',
          'focus:outline-none',
          'min-h-[8rem] px-3 py-2',
          '[&_ul]:list-disc [&_ul]:ml-4',
          '[&_ol]:list-decimal [&_ol]:ml-4',
          '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1',
          '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1',
          '[&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
          '[&_p]:my-1',
          '[&_a]:text-primary [&_a]:underline',
        ].join(' '),
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const currentJson = JSON.stringify(editor.getJSON())
    const newJson = typeof value === 'string' ? null : JSON.stringify(value)
    if (typeof value === 'string') {
      if (editor.getHTML() !== value) {
        editor.commands.setContent(value, { emitUpdate: false })
      }
    } else if (newJson && currentJson !== newJson) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editable, editor])

  const setLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }, [editor])

  if (!editor) return null

  if (!editable) {
    const html = renderContentToHtml(value)
    return (
      <div
        className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm min-h-[8rem] prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_p]:my-1 [&_a]:text-primary [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <div className="rounded-md border border-input bg-background overflow-hidden">
      <div className="flex items-center gap-0.5 border-b border-input px-2 py-1 bg-muted/30">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Blockquote"
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={setLink}
          active={editor.isActive('link')}
          title="Link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
