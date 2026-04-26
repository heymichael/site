import { useState, useEffect, useMemo } from 'react'
import { Search, Plus, Settings } from 'lucide-react'

interface ContentType {
  id: string
  slug: string
  label: string
  status: 'draft' | 'committed'
}

const SCHEMA_STATUS_COLORS: Record<'draft' | 'committed', string> = {
  draft: 'border-amber-200',
  committed: 'border-border',
}

const SCHEMA_STATUS_BADGE: Record<'draft' | 'committed', string> = {
  draft: 'bg-amber-100 text-amber-700',
  committed: 'bg-green-100 text-green-800',
}

interface CollectionsListProps {
  onSelect: (id: string, slug: string, name: string) => void
  onNewContentType?: () => void
  onEditContentType?: (id: string) => void
}

export function CollectionsList({ onSelect, onNewContentType, onEditContentType }: CollectionsListProps) {
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await fetch('/cms/api/content-types?depth=0&limit=100')
        if (!resp.ok) return
        const data = await resp.json()
        if (cancelled) return
        const allTypes: ContentType[] = (data.docs ?? [])
          .map((d: Record<string, unknown>) => ({
            id: d.id as string,
            slug: d.slug as string,
            label: (d.name as string) ?? (d.slug as string),
            status: d.status as 'draft' | 'committed',
          }))

        // Dedupe by slug: committed wins, else most recent (highest ID)
        const bySlug = new Map<string, ContentType>()
        for (const ct of allTypes) {
          const existing = bySlug.get(ct.slug)
          if (!existing) {
            bySlug.set(ct.slug, ct)
          } else if (ct.status === 'committed' && existing.status !== 'committed') {
            bySlug.set(ct.slug, ct)
          } else if (ct.status === existing.status && Number(ct.id) > Number(existing.id)) {
            bySlug.set(ct.slug, ct)
          }
        }
        setContentTypes([...bySlug.values()])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!search) return contentTypes
    const q = search.toLowerCase()
    return contentTypes.filter((ct) => ct.label.toLowerCase().includes(q) || ct.slug.toLowerCase().includes(q))
  }, [contentTypes, search])

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading collections...</div>
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collections..."
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <button
          type="button"
          onClick={onNewContentType}
          className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title="New content type"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {filtered.map((ct) => (
          <div
            key={ct.id}
            role="button"
            tabIndex={0}
            onClick={() => ct.status === 'committed' ? onSelect(ct.id, ct.slug, ct.label) : onEditContentType?.(ct.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') { if (ct.status === 'committed') onSelect(ct.id, ct.slug, ct.label); else onEditContentType?.(ct.id) } }}
            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left hover:bg-accent transition-colors group cursor-pointer ${SCHEMA_STATUS_COLORS[ct.status]}`}
          >
            <span className="text-sm font-medium">{ct.label}</span>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SCHEMA_STATUS_BADGE[ct.status]}`}>
                {ct.status === 'committed' ? 'Committed' : 'Draft'}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEditContentType?.(ct.id) }}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                title="Schema settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {contentTypes.length === 0 ? 'No collections yet. Create one with the + button.' : 'No collections match your filters.'}
          </div>
        )}
      </div>
    </div>
  )
}
