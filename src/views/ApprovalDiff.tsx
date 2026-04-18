import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, Check, MessageSquare } from 'lucide-react'
import { useAuthUser } from '../auth/AuthUserContext'
import { renderContentToHtml } from '../components/tiptapConfig'

interface FieldSchema {
  name: string
  type: string
  ui: 'inline-form' | 'chat'
}

interface SharedBlockDef {
  role: string
  label: string
  field_type: string
}

interface ApprovalDiffProps {
  itemId: string
  contentTypeSlug: string
  contentTypeName?: string
  onBack: () => void
  onBackToList: () => void
  onActionComplete: () => void
}

export function ApprovalDiff({ itemId, contentTypeSlug, contentTypeName, onBack, onBackToList, onActionComplete }: ApprovalDiffProps) {
  const authUser = useAuthUser()
  const [currentData, setCurrentData] = useState<Record<string, unknown>>({})
  const [publishedData, setPublishedData] = useState<Record<string, unknown> | null>(null)
  const [schema, setSchema] = useState<FieldSchema[]>([])
  const [sharedBlockDefs, setSharedBlockDefs] = useState<SharedBlockDef[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [comment, setComment] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const token = await authUser.getIdToken()

        const resp = await fetch(`/cms/api/content-items/${itemId}?depth=1&draft=true`)
        if (!resp.ok || cancelled) return
        const item = await resp.json()
        setCurrentData((item.data as Record<string, unknown>) ?? {})

        const versionsResp = await fetch(`/agent/api/cms/items/${itemId}/versions`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (versionsResp.ok && !cancelled) {
          const versionsData = await versionsResp.json()
          const allVersions = versionsData.docs ?? []
          const lastPublished = allVersions.find(
            (v: Record<string, unknown>) => v.status === 'published'
          )
          setPublishedData(lastPublished ? ((lastPublished.data as Record<string, unknown>) ?? {}) : null)
        }

        const ctId = typeof item.contentType === 'object' ? item.contentType.id : item.contentType
        if (ctId) {
          const ctResp = await fetch(`/cms/api/content-types/${ctId}`)
          if (ctResp.ok && !cancelled) {
            const ct = await ctResp.json()
            const rawSchema = ct.schema
            setSchema((typeof rawSchema === 'object' && rawSchema?.fields ? rawSchema.fields : rawSchema) ?? [])
            setSharedBlockDefs(rawSchema?.shared_blocks ?? [])
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
      const token = await authUser.getIdToken()
      const resp = await fetch(`/agent/api/cms/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workflow_status: 'approved' }),
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
      const token = await authUser.getIdToken()
      const resp = await fetch(`/agent/api/cms/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
        <button type="button" onClick={onBackToList} className="text-sm font-medium hover:underline">
          {contentTypeName ?? contentTypeSlug}
        </button>
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
        {publishedData ? (
          <div className="grid grid-cols-[8rem_1fr_1fr] gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b pb-1">
            <span />
            <span>Published (before)</span>
            <span>Current draft (after)</span>
          </div>
        ) : (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            New item — no previously published version.
          </div>
        )}
        {currentData.role ? (() => {
          const beforeRaw = publishedData ? publishedData.body : null
          const afterRaw = currentData.body
          const before = beforeRaw !== null ? renderContentToHtml(beforeRaw as string | Record<string, unknown>) : null
          const after = renderContentToHtml(afterRaw as string | Record<string, unknown>)
          const changed = before !== null && before !== after
          const blockDef = sharedBlockDefs.find((b) => b.role === currentData.role)
          return (
            <div className={`grid items-start gap-3 ${before !== null ? 'grid-cols-[8rem_1fr_1fr]' : 'grid-cols-[8rem_1fr]'}`}>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2 text-right">
                {blockDef?.label ?? 'Content'}
              </label>
              {before !== null && (
                <div
                  className={`rounded-md border px-3 py-2 text-sm prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_p]:my-1 [&_a]:text-primary [&_a]:underline ${changed ? 'border-red-200 bg-red-50 text-red-900' : 'border-border bg-muted/30'}`}
                  dangerouslySetInnerHTML={{ __html: before || '<span class="italic text-muted-foreground">empty</span>' }}
                />
              )}
              <div
                className={`rounded-md border px-3 py-2 text-sm prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_p]:my-1 [&_a]:text-primary [&_a]:underline ${changed ? 'border-green-200 bg-green-50 text-green-900' : 'border-green-200 bg-green-50 text-green-900'}`}
                dangerouslySetInnerHTML={{ __html: after || '<span class="italic text-muted-foreground">empty</span>' }}
              />
            </div>
          )
        })() : (
          <>
            {schema.map((field) => {
              const isRichtext = field.type === 'richtext'
              const beforeRaw = publishedData ? publishedData[field.name] : undefined
              const afterRaw = currentData[field.name]
              const before = publishedData
                ? (isRichtext
                    ? renderContentToHtml(beforeRaw as string | Record<string, unknown>)
                    : String(beforeRaw ?? ''))
                : null
              const after = isRichtext
                ? renderContentToHtml(afterRaw as string | Record<string, unknown>)
                : String(afterRaw ?? '')
              const changed = before !== null && before !== after
              const isNew = before === null
              return (
                <div key={field.name} className={`grid items-start gap-3 ${before !== null ? 'grid-cols-[8rem_1fr_1fr]' : 'grid-cols-[8rem_1fr]'}`}>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2 text-right">
                    {field.name}
                  </label>
                  {before !== null && (
                    isRichtext ? (
                      <div
                        className={`rounded-md border px-3 py-2 text-sm prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_p]:my-1 [&_a]:text-primary [&_a]:underline ${changed ? 'border-red-200 bg-red-50 text-red-900' : 'border-border bg-muted/30'}`}
                        dangerouslySetInnerHTML={{ __html: before || '<span class="italic text-muted-foreground">empty</span>' }}
                      />
                    ) : (
                      <div className={`rounded-md border px-3 py-2 text-sm ${changed ? 'border-red-200 bg-red-50 text-red-900' : 'border-border bg-muted/30'}`}>
                        {before || <span className="italic text-muted-foreground">empty</span>}
                      </div>
                    )
                  )}
                  {isRichtext ? (
                    <div
                      className={`rounded-md border px-3 py-2 text-sm prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_p]:my-1 [&_a]:text-primary [&_a]:underline ${changed || isNew ? 'border-green-200 bg-green-50 text-green-900' : 'border-border bg-muted/30'}`}
                      dangerouslySetInnerHTML={{ __html: after || '<span class="italic text-muted-foreground">empty</span>' }}
                    />
                  ) : (
                    <div className={`rounded-md border px-3 py-2 text-sm ${changed || isNew ? 'border-green-200 bg-green-50 text-green-900' : 'border-border bg-muted/30'}`}>
                      {after || <span className="italic text-muted-foreground">empty</span>}
                    </div>
                  )}
                </div>
              )
            })}
            {schema.length === 0 && (
              <div className="py-4 text-sm text-muted-foreground italic">No schema defined.</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
