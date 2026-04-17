import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, Check, MessageSquare } from 'lucide-react'
import { agentFetch } from '@haderach/shared-ui'
import { useAuthUser } from '../auth/AuthUserContext'

interface FieldSchema {
  name: string
  type: string
  ui: 'inline-form' | 'chat'
}

interface ApprovalDiffProps {
  itemId: string
  contentTypeSlug: string
  onBack: () => void
  onActionComplete: () => void
}

export function ApprovalDiff({ itemId, contentTypeSlug, onBack, onActionComplete }: ApprovalDiffProps) {
  const authUser = useAuthUser()
  const [currentData, setCurrentData] = useState<Record<string, unknown>>({})
  const [publishedData, setPublishedData] = useState<Record<string, unknown>>({})
  const [schema, setSchema] = useState<FieldSchema[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [comment, setComment] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await agentFetch(`/cms/api/content-items/${itemId}?depth=1&draft=true`, authUser.getIdToken)
        if (!resp.ok || cancelled) return
        const item = await resp.json()
        setCurrentData((item.data as Record<string, unknown>) ?? {})

        const versionsResp = await agentFetch(
          `/cms/api/content-items/${itemId}/versions?where[version.status][equals]=published&limit=1&sort=-updatedAt`,
          authUser.getIdToken,
        )
        if (versionsResp.ok && !cancelled) {
          const versionsData = await versionsResp.json()
          const lastPublished = versionsData.docs?.[0]?.version
          setPublishedData((lastPublished?.data as Record<string, unknown>) ?? {})
        }

        const ctId = typeof item.contentType === 'object' ? item.contentType.id : item.contentType
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

  const handleApprove = useCallback(async () => {
    setSubmitting(true)
    try {
      const resp = await agentFetch(`/cms/api/content-items/${itemId}`, authUser.getIdToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_status: 'pending' }),
      })
      if (resp.ok) onActionComplete()
    } finally {
      setSubmitting(false)
    }
  }, [itemId, authUser.getIdToken, onActionComplete])

  const handleRequestChanges = useCallback(async () => {
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      const resp = await agentFetch(`/cms/api/content-items/${itemId}`, authUser.getIdToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_status: 'changes_requested', workflow_comment: comment.trim() }),
      })
      if (resp.ok) onActionComplete()
    } finally {
      setSubmitting(false)
    }
  }, [itemId, comment, authUser.getIdToken, onActionComplete])

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading diff…</div>
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded p-1 hover:bg-accent transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{contentTypeSlug}</span>
        <span className="text-xs text-muted-foreground">/ Approval review</span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCommentInput(true)}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Request Changes
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Approve
          </button>
        </div>
      </div>

      {showCommentInput && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/50 p-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Describe the changes needed…"
            rows={3}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => { setShowCommentInput(false); setComment('') }}
              className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRequestChanges}
              disabled={submitting || !comment.trim()}
              className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 px-1">
        <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b pb-1">
          <span>Published (before)</span>
          <span>Current draft (after)</span>
        </div>
        {schema.map((field) => {
          const before = String(publishedData[field.name] ?? '')
          const after = String(currentData[field.name] ?? '')
          const changed = before !== after
          return (
            <div key={field.name} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{field.name}</span>
              <div className="grid grid-cols-2 gap-2">
                <div className={`rounded-md border px-3 py-2 text-sm ${changed ? 'border-red-200 bg-red-50 text-red-900' : 'border-border bg-muted/30'}`}>
                  {before || <span className="italic text-muted-foreground">empty</span>}
                </div>
                <div className={`rounded-md border px-3 py-2 text-sm ${changed ? 'border-green-200 bg-green-50 text-green-900' : 'border-border bg-muted/30'}`}>
                  {after || <span className="italic text-muted-foreground">empty</span>}
                </div>
              </div>
            </div>
          )
        })}
        {schema.length === 0 && (
          <div className="py-4 text-sm text-muted-foreground italic">No schema defined.</div>
        )}
      </div>
    </div>
  )
}
