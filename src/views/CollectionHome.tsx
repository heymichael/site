import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, FileText, List, Settings } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  needs_approval: 'bg-amber-100 text-amber-800',
  changes_requested: 'bg-red-100 text-red-800',
  approved: 'bg-purple-100 text-purple-800',
  scheduled: 'bg-blue-100 text-blue-800',
  live: 'bg-green-100 text-green-800',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  needs_approval: 'Needs Approval',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  scheduled: 'Scheduled',
  live: 'Live',
}

interface SharedBlockDef {
  role: string
  label: string
  field_type: string
}

interface SharedBlockItem {
  id: string
  role: string
  label: string
  workflowStatus: string
}

interface CollectionHomeProps {
  collectionId: string
  collectionSlug: string
  collectionName: string
  onBack: () => void
  onSelectListings: () => void
  onSelectItem: (itemId: string) => void
  onSelectForApproval?: (itemId: string) => void
  onEditContentType?: (id: string) => void
}

export function CollectionHome({
  collectionId,
  collectionName,
  onBack,
  onSelectListings,
  onSelectItem,
  onSelectForApproval,
  onEditContentType,
}: CollectionHomeProps) {
  const [sharedBlocks, setSharedBlocks] = useState<SharedBlockItem[]>([])
  const [itemCount, setItemCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const ctResp = await fetch(`/cms/api/content-types/${collectionId}`)
        if (!ctResp.ok || cancelled) return
        const ct = await ctResp.json()
        const blockDefs: SharedBlockDef[] = ct.schema?.shared_blocks ?? []

        const itemsResp = await fetch(
          `/cms/api/content-items?where[contentType][equals]=${collectionId}&limit=500&sort=-updatedAt`,
        )
        if (!itemsResp.ok || cancelled) return
        const itemsData = await itemsResp.json()
        const allDocs = itemsData.docs ?? []

        const blocks: SharedBlockItem[] = []
        let listingCount = 0

        for (const doc of allDocs) {
          const role = (doc.data as Record<string, unknown>)?.role as string | undefined
          if (role) {
            const def = blockDefs.find((b) => b.role === role)
            if (def) {
              blocks.push({
                id: doc.id as string,
                role,
                label: def.label,
                workflowStatus: (doc.workflow_status as string) ?? 'draft',
              })
            }
          } else {
            listingCount++
          }
        }

        if (!cancelled) {
          setSharedBlocks(blocks)
          setItemCount(listingCount)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [collectionId])

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded p-1 hover:bg-accent transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{collectionName}</span>
        {onEditContentType && (
          <button
            type="button"
            onClick={() => onEditContentType(collectionId)}
            className="ml-auto rounded-md border border-input p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Manage content type"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {sharedBlocks.map((block) => (
          <button
            key={block.role}
            type="button"
            onClick={() => block.workflowStatus === 'needs_approval' && onSelectForApproval ? onSelectForApproval(block.id) : onSelectItem(block.id)}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left hover:bg-accent transition-colors group"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">{block.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[block.workflowStatus] ?? 'bg-gray-100 text-gray-700'}`}>
              {STATUS_LABELS[block.workflowStatus] ?? block.workflowStatus}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}

        <button
          type="button"
          onClick={onSelectListings}
          className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left hover:bg-accent transition-colors group"
        >
          <List className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">Listings</span>
          {itemCount !== null && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {itemCount}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    </div>
  )
}
