import { useState, useEffect, type ReactNode } from 'react'
import { ChevronLeft, Lock, Trash2, Send, FilePlus2, X } from 'lucide-react'
import { useAuthUser } from '../auth/AuthUserContext'
import { useConfirm } from '../components/ConfirmDialog'

function ToolbarBtn({ label, onClick, active, alwaysMuted, children }: {
  label: string
  onClick?: () => void
  active?: boolean
  alwaysMuted?: boolean
  children: ReactNode
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={label}
        onClick={active ? onClick : undefined}
        className={`rounded-md border border-input p-1.5 transition-colors ${
          alwaysMuted
            ? 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            : active
              ? 'text-primary hover:bg-accent hover:text-accent-foreground'
              : 'text-muted-foreground/40 cursor-default'
        }`}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 whitespace-nowrap rounded bg-primary px-2 py-1 text-[11px] text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </div>
  )
}

interface FieldSchema {
  name: string
  label?: string
  type: string
  required: boolean
  guidelines?: string
  options?: string[]
}

interface SharedBlockDef {
  role: string
  label: string
  field_type: string
}

interface ContentTypeManagerProps {
  contentTypeId?: string
  onBack: () => void
  onCommit: () => void
  onDelete?: () => void
  refreshKey?: number
}

export function ContentTypeManager({ contentTypeId, onBack, onCommit, onDelete, refreshKey }: ContentTypeManagerProps) {
  const authUser = useAuthUser()
  const confirm = useConfirm()
  const [label, setLabel] = useState('')
  const [slug, setSlug] = useState('')
  const [status, setStatus] = useState<'draft' | 'committed'>('draft')
  const [committedFields, setCommittedFields] = useState<FieldSchema[]>([])
  const [proposedFields, setProposedFields] = useState<FieldSchema[]>([])
  const [sharedBlocks, setSharedBlocks] = useState<SharedBlockDef[]>([])
  const [loading, setLoading] = useState(!!contentTypeId)
  const isNew = !contentTypeId
  const isExtendMode = status === 'committed'

  useEffect(() => {
    if (!contentTypeId) return
    let cancelled = false
    async function load() {
      try {
        const resp = await fetch(`/cms/api/content-types/${contentTypeId}`)
        if (!resp.ok || cancelled) return
        const ct = await resp.json()
        setLabel(ct.name ?? ct.label ?? ct.slug ?? '')
        setSlug(ct.slug ?? '')
        setStatus(ct.status ?? 'draft')
        const rawSchema = ct.schema
        const schema: FieldSchema[] = (typeof rawSchema === 'object' && rawSchema?.fields ? rawSchema.fields : rawSchema) ?? []
        const blocks: SharedBlockDef[] = (typeof rawSchema === 'object' && rawSchema?.shared_blocks) ? rawSchema.shared_blocks : []
        setSharedBlocks(blocks)
        if (ct.status === 'committed') {
          setCommittedFields(schema)
          setProposedFields((ct.proposed_fields as FieldSchema[]) ?? [])
        } else {
          setCommittedFields([])
          setProposedFields(schema)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [contentTypeId, authUser.getIdToken, refreshKey])

  const handleCommit = async () => {
    if (!contentTypeId) return
    const confirmed = await confirm({
      title: 'Commit Schema',
      description: `Commit "${label}" schema? This will make the schema available for content creation.`,
      confirmLabel: 'Commit',
    })
    if (!confirmed) return
    const token = await authUser.getIdToken()
    const resp = await fetch(`/agent/api/cms/content-types/${contentTypeId}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        status: 'committed',
        ...(isExtendMode && {
          schema: [...committedFields, ...proposedFields],
          proposed_fields: [],
        }),
      }),
    })
    if (resp.ok) onCommit()
  }

  const handleDelete = async () => {
    if (!contentTypeId || status !== 'draft') return
    const confirmed = await confirm({
      title: 'Delete Collection',
      description: `Delete "${label}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!confirmed) return
    const token = await authUser.getIdToken()
    const resp = await fetch(`/agent/api/cms/content-types/${contentTypeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (resp.ok) onDelete?.()
  }

  const handleExtend = () => {
    // Extension mode is entered by navigating to a committed content type
    // The agent will handle adding proposed fields
  }

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading content type…</div>
  }

  const canCommit = contentTypeId && proposedFields.length > 0
  const canDelete = contentTypeId && status === 'draft'
  const canExtend = contentTypeId && status === 'committed'

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded p-1 hover:bg-accent transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">
          {isNew ? 'New Collection' : label}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            status === 'committed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
          }`}>
            {status === 'committed' ? 'Live' : 'Draft'}
          </span>
          <ToolbarBtn label="Commit" onClick={canCommit ? handleCommit : undefined} active={!!canCommit}>
            <Send className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn label="Extend schema" onClick={canExtend ? handleExtend : undefined} active={!!canExtend}>
            <FilePlus2 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn label="Delete" onClick={canDelete ? handleDelete : undefined} active={!!canDelete}>
            <Trash2 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn label="Close" onClick={onBack} active alwaysMuted>
            <X className="h-4 w-4" />
          </ToolbarBtn>
        </div>
      </div>

      {isNew && (
        <div className="rounded-md border border-dashed border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          Describe the new content type to the agent in the chat pane. The agent will create the schema and you can iterate before committing.
        </div>
      )}

      {!isNew && (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
            <span className="text-sm">{label}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Slug</span>
            <span className="text-sm text-muted-foreground">{slug}</span>
          </div>
        </div>
      )}

      {sharedBlocks.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Shared blocks</span>
          {sharedBlocks.map((block) => (
            <div key={block.role} className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
              <Lock className="h-3 w-3 text-blue-600 shrink-0" />
              <span className="text-sm font-medium">{block.label}</span>
              <span className="text-xs text-muted-foreground">{block.field_type}</span>
            </div>
          ))}
        </div>
      )}

      {committedFields.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Committed fields</span>
          {committedFields.map((field) => (
            <div key={field.name} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 opacity-75">
              <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">{field.label || field.name}</span>
              <span className="text-xs text-muted-foreground">{field.type}</span>
            </div>
          ))}
        </div>
      )}

      {proposedFields.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {isExtendMode ? 'Proposed additions' : 'Schema fields'}
          </span>
          {proposedFields.map((field) => (
            <div key={field.name} className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
              <span className="text-sm font-medium">{field.label || field.name}</span>
              <span className="text-xs text-muted-foreground">{field.type}</span>
            </div>
          ))}
        </div>
      )}

      {!isNew && committedFields.length === 0 && proposedFields.length === 0 && (
        <div className="py-4 text-sm text-muted-foreground italic">
          No fields defined yet. Describe the schema to the agent in the chat pane.
        </div>
      )}
    </div>
  )
}
