import { useState, useCallback } from 'react'
import { CollectionsList } from './CollectionsList'
import { ItemsList } from './ItemsList'
import { ItemEditor } from './ItemEditor'
import { ApprovalDiff } from './ApprovalDiff'
import { VersionHistory } from './VersionHistory'
import { SchedulingPanel } from './SchedulingPanel'
import { ContentTypeManager } from './ContentTypeManager'
import { PermissionsMatrix } from './PermissionsMatrix'

export type CmsMode = 'browse' | 'editing' | 'scheduling' | 'approval' | 'admin' | 'admin-permissions'
type Segment = 'collections' | 'schedule' | 'admin'
type SubView = 'none' | 'approval' | 'history' | 'content-type'

interface NavState {
  segment: Segment
  collectionId?: string
  collectionSlug?: string
  collectionName?: string
  itemId?: string
  contentTypeSlug?: string
  contentTypeId?: string
  subView: SubView
}

interface CmsWorkPaneProps {
  isCmsAdmin: boolean
  onModeChange: (mode: CmsMode, ctx: { orgSlug?: string; itemId?: string; contentTypeSlug?: string }) => void
  refreshKey?: number
}

export function CmsWorkPane({ isCmsAdmin, onModeChange, refreshKey }: CmsWorkPaneProps) {
  const [nav, setNav] = useState<NavState>({ segment: 'collections', subView: 'none' })

  const handleSegmentChange = useCallback((seg: Segment) => {
    setNav({ segment: seg, subView: 'none' })
    const modeMap: Record<Segment, CmsMode> = {
      collections: 'browse',
      schedule: 'scheduling',
      admin: 'admin-permissions',
    }
    onModeChange(modeMap[seg], {})
  }, [onModeChange])

  const handleSelectCollection = useCallback((collectionId: string, slug: string, name: string) => {
    setNav({ segment: 'collections', collectionId, collectionSlug: slug, collectionName: name, subView: 'none' })
    onModeChange('browse', { contentTypeSlug: slug })
  }, [onModeChange])

  const handleSelectItem = useCallback((itemId: string) => {
    setNav((prev) => ({ ...prev, itemId, subView: 'none' }))
    onModeChange('editing', { itemId, contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const handleNewItem = useCallback(() => {
    setNav((prev) => ({ ...prev, itemId: undefined, subView: 'none' }))
    onModeChange('editing', { contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const handleOpenApproval = useCallback((itemId: string) => {
    setNav((prev) => ({ ...prev, itemId, subView: 'approval' }))
    onModeChange('approval', { itemId, contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const handleOpenHistory = useCallback(() => {
    setNav((prev) => ({ ...prev, subView: 'history' }))
  }, [])

  const handleOpenContentType = useCallback((contentTypeId?: string) => {
    setNav((prev) => ({ ...prev, contentTypeId, subView: 'content-type' }))
    onModeChange('admin', { contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const handleBack = useCallback(() => {
    if (nav.subView !== 'none') {
      const wasApproval = nav.subView === 'approval'
      setNav((prev) => ({ ...prev, subView: 'none' }))
      if (wasApproval) {
        onModeChange('browse', { contentTypeSlug: nav.collectionSlug })
      }
      return
    }
    if (nav.itemId) {
      setNav((prev) => ({ ...prev, itemId: undefined }))
      onModeChange('browse', { contentTypeSlug: nav.collectionSlug })
    } else if (nav.collectionId) {
      setNav({ segment: 'collections', subView: 'none' })
      onModeChange('browse', {})
    }
  }, [nav, onModeChange])

  const handleBackToList = useCallback(() => {
    setNav((prev) => ({ ...prev, itemId: undefined, subView: 'none' }))
    onModeChange('browse', { contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const handleActionComplete = useCallback(() => {
    setNav((prev) => ({ ...prev, itemId: undefined, subView: 'none' }))
    onModeChange('browse', { contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const segmentBtnClass = (seg: Segment) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      nav.segment === seg
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    }`

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center gap-1 border-b px-3 py-2">
        <button type="button" onClick={() => handleSegmentChange('collections')} className={segmentBtnClass('collections')}>
          Collections
        </button>
        <button type="button" onClick={() => handleSegmentChange('schedule')} className={segmentBtnClass('schedule')}>
          Schedule
        </button>
        {isCmsAdmin && (
          <button type="button" onClick={() => handleSegmentChange('admin')} className={segmentBtnClass('admin')}>
            Admin
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Collections segment */}
        {nav.segment === 'collections' && nav.subView === 'none' && !nav.collectionId && (
          <CollectionsList
            onSelect={handleSelectCollection}
            onNewContentType={() => handleOpenContentType()}
            onEditContentType={(id) => handleOpenContentType(id)}
          />
        )}
        {nav.segment === 'collections' && nav.subView === 'none' && nav.collectionId && !nav.itemId && (
          <ItemsList
            collectionId={nav.collectionId}
            collectionSlug={nav.collectionSlug ?? ''}
            collectionName={nav.collectionName ?? nav.collectionSlug ?? ''}
            onSelect={handleSelectItem}
            onSelectForApproval={handleOpenApproval}
            onNew={handleNewItem}
            onBack={handleBack}
          />
        )}
        {nav.segment === 'collections' && nav.subView === 'none' && nav.itemId && (
          <ItemEditor
            itemId={nav.itemId}
            contentTypeSlug={nav.collectionSlug ?? ''}
            contentTypeName={nav.collectionName}
            onBack={handleBack}
            onOpenHistory={handleOpenHistory}
            refreshKey={refreshKey}
          />
        )}
        {nav.segment === 'collections' && nav.subView === 'approval' && nav.itemId && (
          <ApprovalDiff
            itemId={nav.itemId}
            contentTypeSlug={nav.collectionSlug ?? ''}
            contentTypeName={nav.collectionName}
            onBack={handleBack}
            onBackToList={handleBackToList}
            onActionComplete={handleActionComplete}
          />
        )}
        {nav.segment === 'collections' && nav.subView === 'history' && nav.itemId && (
          <VersionHistory
            itemId={nav.itemId}
            contentTypeSlug={nav.collectionSlug ?? ''}
            contentTypeName={nav.collectionName}
            onBack={handleBack}
            onRestore={handleActionComplete}
          />
        )}
        {nav.subView === 'content-type' && (
          <ContentTypeManager
            contentTypeId={nav.contentTypeId}
            onBack={handleBack}
            onCommit={handleActionComplete}
          />
        )}

        {/* Schedule segment */}
        {nav.segment === 'schedule' && nav.subView === 'none' && (
          <SchedulingPanel />
        )}

        {/* Admin segment */}
        {nav.segment === 'admin' && nav.subView === 'none' && (
          <PermissionsMatrix />
        )}
      </div>
    </div>
  )
}
