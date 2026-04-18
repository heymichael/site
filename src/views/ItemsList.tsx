import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, Plus } from 'lucide-react'
import { useAuthUser } from '../auth/AuthUserContext'

const WORKFLOW_STATES = ['draft', 'needs_approval', 'changes_requested', 'approved', 'scheduled', 'live'] as const
type WorkflowState = typeof WORKFLOW_STATES[number]

const STATE_COLORS: Record<WorkflowState, string> = {
  draft: 'bg-gray-100 text-gray-700',
  needs_approval: 'bg-amber-100 text-amber-800',
  changes_requested: 'bg-red-100 text-red-800',
  approved: 'bg-purple-100 text-purple-800',
  scheduled: 'bg-blue-100 text-blue-800',
  live: 'bg-green-100 text-green-800',
}

const STATE_LABELS: Record<WorkflowState, string> = {
  draft: 'Draft',
  needs_approval: 'Needs Approval',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  scheduled: 'Scheduled',
  live: 'Live',
}

interface ContentItem {
  id: string
  title: string
  workflowStatus: WorkflowState
  updatedAt: string
}

interface ItemsListProps {
  collectionId: string
  collectionSlug: string
  collectionName: string
  onSelect: (id: string) => void
  onSelectForApproval?: (id: string) => void
  onNew: () => void
  onBack: () => void
}

export function ItemsList({ collectionId, collectionName, onSelect, onSelectForApproval, onBack }: ItemsListProps) {
  const authUser = useAuthUser()
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Set<WorkflowState>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await fetch(
          `/cms/api/content-items?where[contentType][equals]=${collectionId}&limit=200&sort=-updatedAt`,
        )
        if (!resp.ok) return
        const data = await resp.json()
        if (cancelled) return
        const docs: ContentItem[] = (data.docs ?? [])
          .filter((d: Record<string, unknown>) => !(d.data as Record<string, unknown>)?.role)
          .map((d: Record<string, unknown>) => ({
            id: d.id as string,
            title: ((d.data as Record<string, unknown>)?.title as string) ?? (d.slug as string) ?? `Item ${d.id}`,
            workflowStatus: ((d.workflow_status as string) ?? 'draft') as WorkflowState,
            updatedAt: d.updatedAt as string,
          }))
        setItems(docs)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [collectionId])

  const handleCreate = useCallback(async () => {
    setCreating(true)
    try {
      const token = await authUser.getIdToken()
      const resp = await fetch('/agent/api/cms/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentTypeId: collectionId, data: { title: 'Untitled' } }),
      })
      if (!resp.ok) throw new Error(`Create failed: ${resp.status}`)
      const result = await resp.json()
      const newId = result.item?.id ?? result.id
      if (newId) onSelect(String(newId))
    } catch (e) {
      console.error('Failed to create item:', e)
    } finally {
      setCreating(false)
    }
  }, [authUser, collectionId, onSelect])

  const toggleFilter = useCallback((state: WorkflowState) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(state)) next.delete(state)
      else next.add(state)
      return next
    })
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const filtered = useMemo(() => {
    if (activeFilters.size === 0) return items
    return items.filter((item) => activeFilters.has(item.workflowStatus))
  }, [items, activeFilters])

  const approvedSelected = useMemo(
    () => [...selected].filter((id) => items.find((i) => i.id === id)?.workflowStatus === 'approved'),
    [selected, items],
  )

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading items...</div>
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded p-1 hover:bg-accent transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{collectionName}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {approvedSelected.length > 0 && (
            <button
              type="button"
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Publish {approvedSelected.length} selected
            </button>
          )}
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
            title="New item"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
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

      <div className="text-xs text-muted-foreground">Items: {filtered.length}</div>

      <div className="flex flex-col gap-1">
        {filtered.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 hover:bg-accent transition-colors">
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => toggleSelect(item.id)}
              className="h-3.5 w-3.5 rounded border-input"
            />
            <button
              type="button"
              onClick={() => item.workflowStatus === 'needs_approval' && onSelectForApproval ? onSelectForApproval(item.id) : onSelect(item.id)}
              className="flex flex-1 items-center justify-between text-left"
            >
              <span className="text-sm font-medium">{item.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATE_COLORS[item.workflowStatus]}`}>
                {STATE_LABELS[item.workflowStatus]}
              </span>
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {items.length === 0 ? 'No items yet. Create one with the + button.' : 'No items match your filters.'}
          </div>
        )}
      </div>
    </div>
  )
}
