import { useState, useEffect } from 'react'
import { ChevronLeft, Lock } from 'lucide-react'
import { agentFetch } from '@haderach/shared-ui'
import { useAuthUser } from '../auth/AuthUserContext'

interface FieldSchema {
  name: string
  type: string
  required: boolean
  ui: 'inline-form' | 'chat'
  guidelines?: string
}

interface ContentTypeManagerProps {
  contentTypeId?: string
  onBack: () => void
  onCommit: () => void
}

export function ContentTypeManager({ contentTypeId, onBack, onCommit }: ContentTypeManagerProps) {
  const authUser = useAuthUser()
  const [label, setLabel] = useState('')
  const [slug, setSlug] = useState('')
  const [status, setStatus] = useState<'draft' | 'committed'>('draft')
  const [committedFields, setCommittedFields] = useState<FieldSchema[]>([])
  const [proposedFields, setProposedFields] = useState<FieldSchema[]>([])
  const [loading, setLoading] = useState(!!contentTypeId)
  const isNew = !contentTypeId
  const isExtendMode = status === 'committed'

  useEffect(() => {
    if (!contentTypeId) return
    let cancelled = false
    async function load() {
      try {
        const resp = await agentFetch(`/cms/api/content-types/${contentTypeId}`, authUser.getIdToken)
        if (!resp.ok || cancelled) return
        const ct = await resp.json()
        setLabel(ct.label ?? ct.slug ?? '')
        setSlug(ct.slug ?? '')
        setStatus(ct.status ?? 'draft')
        const schema = (ct.schema as FieldSchema[]) ?? []
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
  }, [contentTypeId, authUser.getIdToken])

  const handleCommit = async () => {
    if (!contentTypeId) return
    const resp = await agentFetch(`/cms/api/content-types/${contentTypeId}`, authUser.getIdToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading content type…</div>
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded p-1 hover:bg-accent transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">
          {isNew ? 'New Content Type' : isExtendMode ? `Extend: ${label}` : `Draft: ${label}`}
        </span>
        {status === 'committed' && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800">Committed</span>
        )}
        {status === 'draft' && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">Draft</span>
        )}

        <div className="ml-auto">
          {contentTypeId && (
            <button
              type="button"
              onClick={handleCommit}
              className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Commit
            </button>
          )}
        </div>
      </div>

      {isNew && (
        <div className="rounded-md border border-dashed border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          Describe the new content type to the agent in the chat pane. The agent will create the schema and you can iterate before committing.
        </div>
      )}

      {!isNew && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
            <div className="text-sm">{label}</div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Slug</span>
            <div className="text-sm text-muted-foreground">{slug}</div>
          </div>
        </div>
      )}

      {committedFields.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Committed fields</span>
          {committedFields.map((field) => (
            <div key={field.name} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 opacity-75">
              <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">{field.name}</span>
              <span className="text-xs text-muted-foreground">{field.type}</span>
              <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium ${field.ui === 'chat' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                {field.ui}
              </span>
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
            <div key={field.name} className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
              <span className="text-sm font-medium">{field.name}</span>
              <span className="text-xs text-muted-foreground">{field.type}</span>
              {field.required && <span className="text-[10px] text-red-500">required</span>}
              <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium ${field.ui === 'chat' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                {field.ui}
              </span>
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
