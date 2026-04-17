import { useState, useEffect } from 'react'
import { ChevronLeft, Save, X, History, SendHorizontal } from 'lucide-react'
import { agentFetch } from '@haderach/shared-ui'
import { useAuthUser } from '../auth/AuthUserContext'

interface FieldSchema {
  name: string
  type: string
  required: boolean
  ui: 'inline-form' | 'chat'
  guidelines?: string
}

interface ItemEditorProps {
  itemId: string
  contentTypeSlug: string
  onBack: () => void
}

export function ItemEditor({ itemId, contentTypeSlug, onBack }: ItemEditorProps) {
  const authUser = useAuthUser()
  const [item, setItem] = useState<Record<string, unknown> | null>(null)
  const [schema, setSchema] = useState<FieldSchema[]>([])
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await agentFetch(`/cms/api/content-items/${itemId}?depth=1`, authUser.getIdToken)
        if (!resp.ok || cancelled) return
        const data = await resp.json()
        setItem(data)

        const ctId = typeof data.contentType === 'object' ? data.contentType.id : data.contentType
        if (ctId) {
          const ctResp = await agentFetch(`/cms/api/content-types/${ctId}`, authUser.getIdToken)
          if (ctResp.ok && !cancelled) {
            const ct = await ctResp.json()
            setSchema(ct.schema ?? [])
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [itemId, authUser.getIdToken])

  const handleClose = () => {
    if (dirty && !confirm('You have unsaved changes. Close anyway?')) return
    onBack()
  }

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading item...</div>
  }

  if (!item) {
    return <div className="p-4 text-sm text-red-600">Item not found.</div>
  }

  const itemData = (item.data as Record<string, unknown>) ?? {}
  const workflowStatus = (item.workflow_status as string) ?? 'draft'

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleClose} className="rounded p-1 hover:bg-accent transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{contentTypeSlug}</span>
        <span className="text-xs text-muted-foreground">/ {(itemData.title as string) ?? itemId.slice(0, 8)}</span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Version history"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Save"
          >
            <Save className="h-4 w-4" />
          </button>
          {(workflowStatus === 'draft' || workflowStatus === 'changes_requested') && (
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <SendHorizontal className="h-3.5 w-3.5" />
              Submit for approval
            </button>
          )}
          <button type="button" onClick={handleClose} className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-1">
        {schema.map((field) => (
          <div key={field.name} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {field.name}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.ui === 'inline-form' ? (
              <input
                type="text"
                value={(itemData[field.name] as string) ?? ''}
                onChange={(e) => {
                  setItem((prev) => prev ? { ...prev, data: { ...((prev.data as Record<string, unknown>) ?? {}), [field.name]: e.target.value } } : prev)
                  setDirty(true)
                }}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            ) : (
              <div className="rounded-md border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {(itemData[field.name] as string) || <span className="italic">Edit via chat pane</span>}
              </div>
            )}
          </div>
        ))}
        {schema.length === 0 && (
          <div className="py-4 text-sm text-muted-foreground italic">
            No schema defined for this content type.
          </div>
        )}
      </div>
    </div>
  )
}
