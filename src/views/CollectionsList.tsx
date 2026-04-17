import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Plus, Settings } from 'lucide-react'
import { agentFetch } from '@haderach/shared-ui'
import { useAuthUser } from '../auth/AuthUserContext'

const WORKFLOW_STATES = ['draft', 'needs_approval', 'changes_requested', 'pending', 'live'] as const
type WorkflowState = typeof WORKFLOW_STATES[number]

const STATE_COLORS: Record<WorkflowState, string> = {
  draft: 'bg-gray-100 text-gray-700',
  needs_approval: 'bg-amber-100 text-amber-800',
  changes_requested: 'bg-red-100 text-red-800',
  pending: 'bg-blue-100 text-blue-800',
  live: 'bg-green-100 text-green-800',
}

const STATE_LABELS: Record<WorkflowState, string> = {
  draft: 'Draft',
  needs_approval: 'Needs Approval',
  changes_requested: 'Changes Requested',
  pending: 'Pending',
  live: 'Live',
}

interface ContentType {
  id: string
  slug: string
  label: string
  status: 'draft' | 'committed'
  itemStates: WorkflowState[]
}

interface CollectionsListProps {
  onSelect: (id: string, slug: string) => void
  onNewContentType?: () => void
  onEditContentType?: (id: string) => void
}

export function CollectionsList({ onSelect, onNewContentType, onEditContentType }: CollectionsListProps) {
  const authUser = useAuthUser()
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<WorkflowState>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await agentFetch('/cms/api/content-types?depth=0&limit=100', authUser.getIdToken)
        if (!resp.ok) return
        const data = await resp.json()
        if (cancelled) return
        const types: ContentType[] = (data.docs ?? [])
          .filter((d: Record<string, unknown>) => d.status === 'committed')
          .map((d: Record<string, unknown>) => ({
            id: d.id as string,
            slug: d.slug as string,
            label: (d.label as string) ?? (d.slug as string),
            status: d.status as 'draft' | 'committed',
            itemStates: [] as WorkflowState[],
          }))
        setContentTypes(types)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [authUser.getIdToken])

  const toggleFilter = useCallback((state: WorkflowState) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(state)) next.delete(state)
      else next.add(state)
      return next
    })
  }, [])

  const filtered = useMemo(() => {
    let list = contentTypes
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((ct) => ct.label.toLowerCase().includes(q) || ct.slug.toLowerCase().includes(q))
    }
    if (activeFilters.size > 0) {
      list = list.filter((ct) =>
        ct.itemStates.some((s) => activeFilters.has(s))
      )
    }
    return list
  }, [contentTypes, search, activeFilters])

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

      <div className="flex flex-wrap gap-1.5">
        {WORKFLOW_STATES.map((state) => (
          <button
            key={state}
            type="button"
            onClick={() => toggleFilter(state)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              activeFilters.has(state) ? STATE_COLORS[state] : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {STATE_LABELS[state]}
          </button>
        ))}
      </div>

      <div className="text-xs text-muted-foreground">
        Collections: {filtered.length}
      </div>

      <div className="flex flex-col gap-1">
        {filtered.map((ct) => (
          <div
            key={ct.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(ct.id, ct.slug)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelect(ct.id, ct.slug) }}
            className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left hover:bg-accent transition-colors group cursor-pointer"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{ct.label}</span>
              <span className="text-xs text-muted-foreground">{ct.slug}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {ct.itemStates.length > 0 && (
                <div className="flex gap-1">
                  {ct.itemStates.map((state) => (
                    <span key={state} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATE_COLORS[state]}`}>
                      {STATE_LABELS[state]}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEditContentType?.(ct.id) }}
                className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-all"
                title="Manage content type"
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
