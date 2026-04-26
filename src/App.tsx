import { useState, useCallback, useRef } from 'react'
import {
  AppRail,
  useRailExpanded,
  PaneToolbar,
  PaneLayout,
  ChatPanel,
} from '@haderach/shared-ui'
import type { ChatPanelHandle, PaneId, PaneLayoutHandle } from '@haderach/shared-ui'

import { useAuthUser } from './auth/AuthUserContext'
import { CmsWorkPane } from './views/CmsWorkPane'
import type { CmsMode } from './views/CmsWorkPane'

export function App() {
  const authUser = useAuthUser()

  const [railExpanded, toggleRail] = useRailExpanded()
  const [chatOpen, setChatOpen] = useState(true)
  const [detailPane, setDetailPane] = useState<'analytics' | 'data' | null>('data')

  const [cmsMode, setCmsMode] = useState<CmsMode>('browse')
  const [cmsItemId, setCmsItemId] = useState<string | undefined>()
  const [cmsContentTypeSlug, setCmsContentTypeSlug] = useState<string | undefined>()
  const [cmsContentTypeId, setCmsContentTypeId] = useState<string | undefined>()
  const [refreshKey, setRefreshKey] = useState(0)
  const [navToCollectionsKey, setNavToCollectionsKey] = useState(0)

  const chatRef = useRef<ChatPanelHandle>(null)
  const paneRef = useRef<PaneLayoutHandle>(null)

  const handleModeChange = useCallback((mode: CmsMode, ctx: { orgSlug?: string; itemId?: string; contentTypeSlug?: string; contentTypeId?: string }) => {
    setCmsMode(mode)
    setCmsItemId(ctx.itemId)
    setCmsContentTypeSlug(ctx.contentTypeSlug)
    setCmsContentTypeId(ctx.contentTypeId)
  }, [])

  const handleToolResult = useCallback((toolNames: string[]) => {
    setRefreshKey((k) => k + 1)
    // Navigate back to collections after creating a content type
    if (toolNames.includes('cms_create_content_type')) {
      setCmsMode('browse')
      setCmsItemId(undefined)
      setCmsContentTypeSlug(undefined)
      setNavToCollectionsKey((k) => k + 1)
    }
  }, [])

  const handlePaneToggle = useCallback((id: PaneId) => {
    paneRef.current?.togglePane(id)
  }, [])

  const handleLayoutChange = useCallback((chat: boolean, detail: 'analytics' | 'data' | null) => {
    setChatOpen(chat)
    setDetailPane(detail)
  }, [])

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
        openPanes={{ chat: chatOpen, analytics: false, data: detailPane === 'data' }}
        getIdToken={authUser.getIdToken}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <PaneToolbar
          activePanes={{
            chat: chatOpen,
            analytics: false,
            data: detailPane === 'data',
          }}
          panes={['chat', 'data']}
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
        />
      </div>
    </div>
  )
}
