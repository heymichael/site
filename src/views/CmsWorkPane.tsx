import { useState, useCallback } from 'react'
import { CollectionsList } from './CollectionsList'
import { ItemsList } from './ItemsList'
import { ItemEditor } from './ItemEditor'

export type CmsMode = 'browse' | 'editing' | 'scheduling' | 'approval' | 'admin' | 'admin-permissions'
type Segment = 'collections' | 'schedule' | 'admin'

interface NavState {
  segment: Segment
  collectionId?: string
  collectionSlug?: string
  itemId?: string
  contentTypeSlug?: string
}

interface CmsWorkPaneProps {
  isCmsAdmin: boolean
  onModeChange: (mode: CmsMode, ctx: { orgSlug?: string; itemId?: string; contentTypeSlug?: string }) => void
}

export function CmsWorkPane({ isCmsAdmin, onModeChange }: CmsWorkPaneProps) {
  const [nav, setNav] = useState<NavState>({ segment: 'collections' })

  const handleSegmentChange = useCallback((seg: Segment) => {
    setNav({ segment: seg })
    const modeMap: Record<Segment, CmsMode> = {
      collections: 'browse',
      schedule: 'scheduling',
      admin: 'admin-permissions',
    }
    onModeChange(modeMap[seg], {})
  }, [onModeChange])

  const handleSelectCollection = useCallback((collectionId: string, slug: string) => {
    setNav({ segment: 'collections', collectionId, collectionSlug: slug })
    onModeChange('browse', { contentTypeSlug: slug })
  }, [onModeChange])

  const handleSelectItem = useCallback((itemId: string) => {
    setNav((prev) => ({ ...prev, itemId }))
    onModeChange('editing', { itemId, contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const handleNewItem = useCallback(() => {
    setNav((prev) => ({ ...prev, itemId: undefined }))
    onModeChange('editing', { contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const handleBack = useCallback(() => {
    if (nav.itemId) {
      setNav((prev) => ({ ...prev, itemId: undefined }))
      onModeChange('browse', { contentTypeSlug: nav.collectionSlug })
    } else if (nav.collectionId) {
      setNav({ segment: 'collections' })
      onModeChange('browse', {})
    }
  }, [nav, onModeChange])

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b px-3 py-2">
        <button
          type="button"
          onClick={() => handleSegmentChange('collections')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${nav.segment === 'collections' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
        >
          Collections
        </button>
        <button
          type="button"
          onClick={() => handleSegmentChange('schedule')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${nav.segment === 'schedule' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
        >
          Schedule
        </button>
        {isCmsAdmin && (
          <button
            type="button"
            onClick={() => handleSegmentChange('admin')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${nav.segment === 'admin' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
          >
            Admin
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {nav.segment === 'collections' && !nav.collectionId && (
          <CollectionsList onSelect={handleSelectCollection} />
        )}
        {nav.segment === 'collections' && nav.collectionId && !nav.itemId && (
          <ItemsList
            collectionId={nav.collectionId}
            collectionSlug={nav.collectionSlug ?? ''}
            onSelect={handleSelectItem}
            onNew={handleNewItem}
            onBack={handleBack}
          />
        )}
        {nav.segment === 'collections' && nav.itemId && (
          <ItemEditor
            itemId={nav.itemId}
            contentTypeSlug={nav.collectionSlug ?? ''}
            onBack={handleBack}
          />
        )}
        {nav.segment === 'schedule' && (
          <div className="p-4 text-sm text-muted-foreground italic">
            Scheduling panel — manage schedules via the chat pane.
          </div>
        )}
        {nav.segment === 'admin' && (
          <div className="p-4 text-sm text-muted-foreground italic">
            Permissions matrix — coming soon.
          </div>
        )}
      </div>
    </div>
  )
}
