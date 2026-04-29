import { useState, useCallback, useRef, useEffect } from 'react'
import {
  AppRail,
  useRailExpanded,
  PaneToolbar,
  PaneLayout,
  ChatPanel,
} from '@haderach/shared-ui'
import type { ChatPanelHandle, PaneId, PaneLayoutHandle, DetailPaneId } from '@haderach/shared-ui'

import { useAuthUser } from './auth/AuthUserContext'
import { CmsWorkPane } from './views/CmsWorkPane'
import { SchedulingPanel } from './views/SchedulingPanel'
import { PermissionsMatrix } from './views/PermissionsMatrix'
import type { CmsMode } from './views/CmsWorkPane'

export function App() {
  const authUser = useAuthUser()

  const [railExpanded, toggleRail] = useRailExpanded()
  const [chatOpen, setChatOpen] = useState(true)
  const [detailPane, setDetailPane] = useState<DetailPaneId | null>('data')

  const [cmsMode, setCmsMode] = useState<CmsMode>('browse')
  const [cmsItemId, setCmsItemId] = useState<string | undefined>()
  const [cmsContentTypeSlug, setCmsContentTypeSlug] = useState<string | undefined>()
  const [cmsContentTypeId, setCmsContentTypeId] = useState<string | undefined>()
  const [refreshKey, setRefreshKey] = useState(0)
  const [navToCollectionsKey, setNavToCollectionsKey] = useState(0)

  const chatRef = useRef<ChatPanelHandle>(null)
  const paneRef = useRef<PaneLayoutHandle>(null)
  const dataPaneContextRef = useRef<{ mode: CmsMode; itemId?: string; contentTypeSlug?: string; contentTypeId?: string }>({
    mode: 'browse',
  })

  const handleModeChange = useCallback((mode: CmsMode, ctx: { orgSlug?: string; itemId?: string; contentTypeSlug?: string; contentTypeId?: string }) => {
    setCmsMode(mode)
    setCmsItemId(ctx.itemId)
    setCmsContentTypeSlug(ctx.contentTypeSlug)
    setCmsContentTypeId(ctx.contentTypeId)
    dataPaneContextRef.current = { mode, itemId: ctx.itemId, contentTypeSlug: ctx.contentTypeSlug, contentTypeId: ctx.contentTypeId }
  }, [])

  const handleToolResult = useCallback((toolNames: string[]) => {
    setRefreshKey((k) => k + 1)
    // Navigate back to collections after creating a content type
    if (toolNames.includes('cms_create_content_type')) {
      setCmsMode('browse')
      setCmsItemId(undefined)
      setCmsContentTypeSlug(undefined)
      setNavToCollectionsKey((k) => k + 1)
      dataPaneContextRef.current = { mode: 'browse' }
    }
  }, [])

  const handlePaneToggle = useCallback((id: PaneId) => {
    paneRef.current?.togglePane(id)
  }, [])

  const handleLayoutChange = useCallback((chat: boolean, detail: DetailPaneId | null) => {
    setChatOpen(chat)
    setDetailPane(detail)
  }, [])

  useEffect(() => {
    if (detailPane === 'data') {
      const ctx = dataPaneContextRef.current
      setCmsMode(ctx.mode)
      setCmsItemId(ctx.itemId)
      setCmsContentTypeSlug(ctx.contentTypeSlug)
      setCmsContentTypeId(ctx.contentTypeId)
    } else if (detailPane === 'schedule') {
      setCmsMode('scheduling')
    } else if (detailPane === 'admin') {
      setCmsMode('admin-permissions')
    }
  }, [detailPane])


  return (
    <div className="app-shell">
      <AppRail
        apps={authUser.accessibleApps}
        activeAppId="site"
        expanded={railExpanded}
        onToggle={toggleRail}
        userEmail={authUser.email}
        userPhotoURL={authUser.photoURL}
        userDisplayName={authUser.displayName}
        onSignOut={authUser.signOut}
        openPanes={{ chat: chatOpen, analytics: false, data: detailPane === 'data', schedule: detailPane === 'schedule', admin: detailPane === 'admin', media: false }}
        getIdToken={authUser.getIdToken}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <PaneToolbar
          activePanes={{
            chat: chatOpen,
            analytics: false,
            data: detailPane === 'data',
            schedule: detailPane === 'schedule',
            admin: detailPane === 'admin',
            media: false,
          }}
          panes={['chat', 'data', 'schedule', 'admin']}
          onPaneToggle={handlePaneToggle}
        />

        <PaneLayout
          ref={paneRef}
          chatOpen={chatOpen}
          detailPane={detailPane}
          onLayoutChange={handleLayoutChange}
          chatContent={
            <ChatPanel
              ref={chatRef}
              mode="panel"
              appContext="cms"
              extraContext={{
                mode: cmsMode,
                ...(cmsItemId && { itemId: cmsItemId }),
                ...(cmsContentTypeSlug && { contentTypeSlug: cmsContentTypeSlug }),
                ...(cmsContentTypeId && { contentTypeId: cmsContentTypeId }),
              }}
              getIdToken={authUser.getIdToken}
              onToolResult={handleToolResult}
              inputPlaceholder="How can I help you manage content?"
            />
          }
          dataContent={
            <div className="flex flex-1 min-h-0 flex-col p-2">
              <CmsWorkPane
                isCmsAdmin={authUser.isCmsAdmin}
                onModeChange={handleModeChange}
                refreshKey={refreshKey}
                navigateToCollections={navToCollectionsKey}
              />
            </div>
          }
          scheduleContent={
            <div className="flex flex-1 min-h-0 flex-col p-2">
              <div className="flex flex-1 min-h-0 flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm">
                <SchedulingPanel />
              </div>
            </div>
          }
          adminContent={
            <div className="flex flex-1 min-h-0 flex-col p-2">
              <div className="flex flex-1 min-h-0 flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm">
                <PermissionsMatrix />
              </div>
            </div>
          }
        />
      </div>
    </div>
  )
}
