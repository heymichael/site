import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, RotateCcw } from 'lucide-react'
import { useAuthUser } from '../auth/AuthUserContext'

interface FieldSchema {
  name: string
  type: string
  required: boolean
}

interface Version {
  id: string
  updatedAt: string
  data: Record<string, unknown>
  workflowStatus?: string
}

interface VersionHistoryProps {
  itemId: string
  contentTypeSlug: string
  contentTypeName?: string
  onBack: () => void
  onRestore: () => void
}

export function VersionHistory({ itemId, contentTypeSlug, contentTypeName, onBack, onRestore }: VersionHistoryProps) {
  const authUser = useAuthUser()
  const [versions, setVersions] = useState<Version[]>([])
  const [schema, setSchema] = useState<FieldSchema[]>([])
  const [itemTitle, setItemTitle] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const token = await authUser.getIdToken()

        const [versionsResp, itemResp] = await Promise.all([
          fetch(`/agent/api/cms/items/${itemId}/versions`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/cms/api/content-items/${itemId}?depth=1`),
        ])

        if (cancelled) return

        if (itemResp.ok) {
          const item = await itemResp.json()
          const data = (item.data as Record<string, unknown>) ?? {}
          setItemTitle((data.title as string) ?? itemId.toString().slice(0, 8))
          const ct = item.contentType
          if (typeof ct === 'object' && ct?.schema) {
            const fields = ct.schema.fields ?? ct.schema ?? []
            setSchema(fields)
          }
        }

        if (versionsResp.ok) {
          const data = await versionsResp.json()
          const docs: Version[] = (data.docs ?? []).map((d: Record<string, unknown>) => ({
            id: d.id as string,
            updatedAt: d.updatedAt as string,
            data: (d.data as Record<string, unknown>) ?? {},
            workflowStatus: (d.workflowStatus as string) ?? '',
          }))
          setVersions(docs)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [itemId, authUser.getIdToken])

  const handleRestore = useCallback(async (versionId: string) => {
    setRestoring(true)
    try {
      const token = await authUser.getIdToken()
      const resp = await fetch(`/agent/api/cms/items/${itemId}/versions/${versionId}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (resp.ok) onRestore()
    } finally {
      setRestoring(false)
    }
  }, [itemId, authUser.getIdToken, onRestore])

  const handleBackFromVersion = useCallback(() => {
    setSelectedVersion(null)
  }, [])

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading versions...</div>
  }

  if (selectedVersion) {
    const versionDate = new Date(selectedVersion.updatedAt).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    return (
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleBackFromVersion} className="rounded p-1 hover:bg-accent transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={onBack} className="text-sm font-medium hover:underline">
            {contentTypeName ?? contentTypeSlug}
          </button>
          <span className="text-xs text-muted-foreground">/</span>
          <button type="button" onClick={onBack} className="text-xs text-muted-foreground hover:underline">
            {itemTitle}
          </button>
          <span className="text-xs text-muted-foreground">/</span>
          <button type="button" onClick={handleBackFromVersion} className="text-xs text-muted-foreground hover:underline">
            Version history
          </button>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs text-muted-foreground font-medium">{versionDate}</span>

          <div className="ml-auto">
            <button
              type="button"
              onClick={() => handleRestore(selectedVersion.id)}
              disabled={restoring}
              className="flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-accent transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-1">
          {schema.length > 0 ? schema.map((field) => (
            <div key={field.name} className="grid grid-cols-[8rem_1fr] items-start gap-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2 text-right">
                {field.name}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {field.type === 'richtext' ? (
                <div
                  className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm min-h-[6rem] prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_p]:my-1 [&_a]:text-primary [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: String(selectedVersion.data[field.name] ?? '') }}
                />
              ) : field.type === 'textarea' ? (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm whitespace-pre-wrap min-h-[6rem]">
                  {String(selectedVersion.data[field.name] ?? '')}
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm">
                  {String(selectedVersion.data[field.name] ?? '')}
                </div>
              )}
            </div>
          )) : Object.entries(selectedVersion.data).map(([key, value]) => (
            <div key={key} className="grid grid-cols-[8rem_1fr] items-start gap-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2 text-right">
                {key}
              </label>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm">
                {String(value ?? '')}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded p-1 hover:bg-accent transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={onBack} className="text-sm font-medium hover:underline">
          {contentTypeName ?? contentTypeSlug}
        </button>
        <span className="text-xs text-muted-foreground">/</span>
        <button type="button" onClick={onBack} className="text-xs text-muted-foreground hover:underline">
          {itemTitle}
        </button>
        <span className="text-xs text-muted-foreground">/ Version history</span>
      </div>

      <div className="flex flex-col gap-1 px-1">
        {(() => {
          const liveVersionId = versions.find((v) => v.workflowStatus === 'live')?.id
          return versions.map((v, idx) => (
            <button
              key={v.id}
              type="button"
              onClick={() => idx === 0 ? onBack() : setSelectedVersion(v)}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-left hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {new Date(v.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {idx === 0 && (
                  <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[10px] font-medium">Current</span>
                )}
                {v.id === liveVersionId && (
                  <span className="rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-[10px] font-medium">Live</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(v.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </button>
          ))
        })()}
        {versions.length === 0 && (
          <div className="py-4 text-sm text-muted-foreground italic">No versions found.</div>
        )}
      </div>
    </div>
  )
}
