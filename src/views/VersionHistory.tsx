import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, RotateCcw } from 'lucide-react'
import { agentFetch } from '@haderach/shared-ui'
import { useAuthUser } from '../auth/AuthUserContext'

interface Version {
  id: string
  updatedAt: string
  data: Record<string, unknown>
}

interface VersionHistoryProps {
  itemId: string
  contentTypeSlug: string
  onBack: () => void
  onRestore: () => void
}

export function VersionHistory({ itemId, contentTypeSlug, onBack, onRestore }: VersionHistoryProps) {
  const authUser = useAuthUser()
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await agentFetch(
          `/cms/api/content-items/${itemId}/versions?sort=-updatedAt&limit=50`,
          authUser.getIdToken,
        )
        if (!resp.ok || cancelled) return
        const data = await resp.json()
        const docs: Version[] = (data.docs ?? []).map((d: Record<string, unknown>) => ({
          id: d.id as string,
          updatedAt: d.updatedAt as string,
          data: ((d.version as Record<string, unknown>)?.data as Record<string, unknown>) ?? {},
        }))
        setVersions(docs)
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
      const resp = await agentFetch(`/cms/api/content-items/${itemId}/versions/${versionId}`, authUser.getIdToken, {
        method: 'POST',
      })
      if (resp.ok) onRestore()
    } finally {
      setRestoring(false)
    }
  }, [itemId, authUser.getIdToken, onRestore])

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading versions…</div>
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded p-1 hover:bg-accent transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{contentTypeSlug}</span>
        <span className="text-xs text-muted-foreground">/ Version history</span>
      </div>

      <div className="flex gap-3 min-h-0">
        <div className="flex flex-col gap-1 w-64 shrink-0 overflow-y-auto">
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedVersion(v)}
              className={`flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors ${
                selectedVersion?.id === v.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <span className="text-xs font-medium">
                {new Date(v.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(v.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </button>
          ))}
          {versions.length === 0 && (
            <div className="py-4 text-sm text-muted-foreground italic">No versions found.</div>
          )}
        </div>

        {selectedVersion && (
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {new Date(selectedVersion.updatedAt).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => handleRestore(selectedVersion.id)}
                disabled={restoring}
                className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore this version
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {Object.entries(selectedVersion.data).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{key}</span>
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                    {String(value ?? '')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
