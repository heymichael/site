import { useState, useCallback, useEffect, useRef } from 'react'
import { CollectionsList } from './CollectionsList'
import { CollectionHome } from './CollectionHome'
import { ItemsList } from './ItemsList'
import { ItemEditor } from './ItemEditor'
import { ApprovalDiff } from './ApprovalDiff'
import { VersionHistory } from './VersionHistory'
import { SchedulingPanel } from './SchedulingPanel'
import { ContentTypeManager } from './ContentTypeManager'
import { PermissionsMatrix } from './PermissionsMatrix'

export type CmsMode = 'browse' | 'editing' | 'scheduling' | 'approval' | 'admin' | 'admin-permissions'
type Segment = 'collections' | 'schedule' | 'admin'
type SubView = 'none' | 'listings' | 'shared-item' | 'approval' | 'history' | 'content-type'

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
  onModeChange: (mode: CmsMode, ctx: { orgSlug?: string; itemId?: string; contentTypeSlug?: string; contentTypeId?: string }) => void
  refreshKey?: number
  navigateToCollections?: number
}

export function CmsWorkPane({ isCmsAdmin, onModeChange, refreshKey, navigateToCollections }: CmsWorkPaneProps) {
  const [nav, setNav] = useState<NavState>({ segment: 'collections', subView: 'none' })

  const prevNavKeyRef = useRef(navigateToCollections)
  useEffect(() => {
    if (navigateToCollections !== prevNavKeyRef.current) {
      prevNavKeyRef.current = navigateToCollections
      if (navigateToCollections && navigateToCollections > 0) {
        queueMicrotask(() => {
          setNav({ segment: 'collections', subView: 'none' })
          onModeChange('browse', {})
        })
      }
    }
  }, [navigateToCollections, onModeChange])

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
    setNav((prev) => ({ ...prev, itemId, subView: 'listings' }))
    onModeChange('editing', { itemId, contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const handleSelectSharedItem = useCallback((itemId: string) => {
    setNav((prev) => ({ ...prev, itemId, subView: 'shared-item' }))
    onModeChange('editing', { itemId, contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const handleNewItem = useCallback(() => {
    setNav((prev) => ({ ...prev, itemId: undefined, subView: 'listings' }))
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
    onModeChange('admin', { contentTypeSlug: nav.collectionSlug, contentTypeId })
  }, [onModeChange, nav.collectionSlug])

  const handleSelectListings = useCallback(() => {
    setNav((prev) => ({ ...prev, subView: 'listings' }))
  }, [])

  const handleBackToHome = useCallback(() => {
    setNav((prev) => ({ ...prev, subView: 'none', itemId: undefined }))
    onModeChange('browse', { contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const handleBack = useCallback(() => {
    if (nav.subView === 'history' || nav.subView === 'approval') {
      const returnView = nav.itemId ? (nav.subView === 'approval' ? 'listings' : 'listings') : 'none'
      setNav((prev) => ({ ...prev, subView: returnView as SubView }))
      if (nav.subView === 'approval') {
        onModeChange('browse', { contentTypeSlug: nav.collectionSlug })
      }
      return
    }
    if (nav.subView === 'content-type') {
      setNav((prev) => ({ ...prev, subView: 'none', contentTypeId: undefined }))
      return
    }
    if (nav.subView === 'shared-item') {
      setNav((prev) => ({ ...prev, subView: 'none', itemId: undefined }))
      onModeChange('browse', { contentTypeSlug: nav.collectionSlug })
      return
    }
    if (nav.itemId) {
      setNav((prev) => ({ ...prev, itemId: undefined, subView: 'listings' }))
      onModeChange('browse', { contentTypeSlug: nav.collectionSlug })
    } else if (nav.subView === 'listings') {
      setNav((prev) => ({ ...prev, subView: 'none' }))
    } else if (nav.collectionId) {
      setNav({ segment: 'collections', subView: 'none' })
      onModeChange('browse', {})
    }
  }, [nav, onModeChange])

  const handleBackToList = useCallback(() => {
    setNav((prev) => ({ ...prev, itemId: undefined, subView: 'listings' }))
    onModeChange('browse', { contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const handleActionComplete = useCallback(() => {
    setNav((prev) => ({ ...prev, itemId: undefined, subView: 'listings' }))
    onModeChange('browse', { contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug])

  const handleContentTypeDeleted = useCallback(() => {
    setNav({ segment: 'collections', subView: 'none' })
    onModeChange('browse', {})
  }, [onModeChange])

  const handleRestoreComplete = useCallback(() => {
    setNav((prev) => ({ ...prev, subView: 'listings' }))
    if (nav.itemId) {
      onModeChange('editing', { itemId: nav.itemId, contentTypeSlug: nav.collectionSlug })
      return
    }
    onModeChange('browse', { contentTypeSlug: nav.collectionSlug })
  }, [onModeChange, nav.collectionSlug, nav.itemId])

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
        {nav.segment === 'collections' && nav.subView === 'none' && nav.collectionId && (
          <CollectionHome
            collectionId={nav.collectionId}
            collectionSlug={nav.collectionSlug ?? ''}
            collectionName={nav.collectionName ?? nav.collectionSlug ?? ''}
            onBack={handleBack}
            onSelectListings={handleSelectListings}
            onSelectItem={handleSelectSharedItem}
            onSelectForApproval={handleOpenApproval}
            onEditContentType={(id) => handleOpenContentType(id)}
          />
        )}
        {nav.segment === 'collections' && nav.subView === 'shared-item' && nav.itemId && (
          <ItemEditor
            itemId={nav.itemId}
            contentTypeSlug={nav.collectionSlug ?? ''}
            contentTypeName={nav.collectionName}
            onBack={handleBack}
            onOpenHistory={handleOpenHistory}
            refreshKey={refreshKey}
          />
        )}
        {nav.segment === 'collections' && nav.subView === 'listings' && nav.collectionId && !nav.itemId && (
          <ItemsList
            collectionId={nav.collectionId}
            collectionSlug={nav.collectionSlug ?? ''}
            collectionName={nav.collectionName ?? nav.collectionSlug ?? ''}
            onSelect={handleSelectItem}
            onSelectForApproval={handleOpenApproval}
            onNew={handleNewItem}
            onBack={handleBackToHome}
          />
        )}
        {nav.segment === 'collections' && nav.subView === 'listings' && nav.itemId && (
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
            onRestore={handleRestoreComplete}
          />
        )}
        {nav.subView === 'content-type' && (
          <ContentTypeManager
            contentTypeId={nav.contentTypeId}
            onBack={handleBack}
            onCommit={handleActionComplete}
            onDelete={handleContentTypeDeleted}
            refreshKey={refreshKey}
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
