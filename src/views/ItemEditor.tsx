import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { ChevronLeft, Save, X, History, ArrowBigRight, Send, FilePlus2 } from 'lucide-react'
import { useAuthUser } from '../auth/AuthUserContext'
import { useConfirm } from '../components/ConfirmDialog'
import { RichTextEditor } from '../components/RichTextEditor'

function ToolbarBtn({ label, onClick, active, alwaysMuted, children }: {
  label: string
  onClick?: () => void
  active?: boolean
  alwaysMuted?: boolean
  children: ReactNode
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={label}
        onClick={active ? onClick : undefined}
        className={`rounded-md border border-input p-1.5 transition-colors ${
          alwaysMuted
            ? 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            : active
              ? 'text-primary hover:bg-accent hover:text-accent-foreground'
              : 'text-muted-foreground/40 cursor-default'
        }`}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 whitespace-nowrap rounded bg-primary px-2 py-1 text-[11px] text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </div>
  )
}

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

interface FieldSchema {
  name: string
  type: string
  required: boolean
  ui: 'inline-form' | 'chat'
  guidelines?: string
}

interface ItemEditorProps {
  itemId: string
  contentTypeSlug: string
  contentTypeName?: string
  onBack: () => void
  onOpenHistory?: () => void
  refreshKey?: number
}

export function ItemEditor({ itemId, contentTypeSlug, contentTypeName, onBack, onOpenHistory, refreshKey }: ItemEditorProps) {
  const authUser = useAuthUser()
  const confirm = useConfirm()
  const [item, setItem] = useState<Record<string, unknown> | null>(null)
  const [schema, setSchema] = useState<FieldSchema[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await fetch(`/cms/api/content-items/${itemId}?depth=1`)
        if (!resp.ok || cancelled) return
        const data = await resp.json()
        setItem(data)
        setDirty(false)

        const ctId = typeof data.contentType === 'object' ? data.contentType.id : data.contentType
        if (ctId) {
          const ctResp = await fetch(`/cms/api/content-types/${ctId}`)
          if (ctResp.ok && !cancelled) {
            const ct = await ctResp.json()
            setSchema(ct.schema?.fields ?? ct.schema ?? [])
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [itemId, refreshKey])

  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    setItem((prev) => prev ? { ...prev, data: { ...((prev.data as Record<string, unknown>) ?? {}), [fieldName]: value } } : prev)
    setDirty(true)
    setSaved(false)
  }, [])

  const handleSave = useCallback(async () => {
    if (!item || !dirty) return
    setSaving(true)
    try {
      const token = await authUser.getIdToken()
      const resp = await fetch(`/agent/api/cms/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ data: item.data }),
      })
      if (!resp.ok) throw new Error(`Save failed: ${resp.status}`)
      setDirty(false)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }, [item, dirty, itemId, authUser])

  const handleClose = useCallback(async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Unsaved changes',
        description: 'You have unsaved changes that will be lost. Close anyway?',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        variant: 'destructive',
      })
      if (!ok) return
    }
    onBack()
  }, [dirty, confirm, onBack])

  const handleSubmit = useCallback(async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Unsaved changes',
        description: 'You have unsaved changes. Save before submitting?',
        confirmLabel: 'Save & submit',
        cancelLabel: 'Cancel',
      })
      if (!ok) return
      await handleSave()
    }
    try {
      const token = await authUser.getIdToken()
      const resp = await fetch(`/agent/api/cms/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workflow_status: 'needs_approval' }),
      })
      if (!resp.ok) throw new Error(`Submit failed: ${resp.status}`)
      onBack()
    } catch (e) {
      console.error('Submit for approval failed:', e)
    }
  }, [dirty, confirm, handleSave, authUser, itemId, onBack])

  const handlePublish = useCallback(async () => {
    try {
      const token = await authUser.getIdToken()
      const resp = await fetch(`/agent/api/cms/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workflow_status: 'live' }),
      })
      if (!resp.ok) throw new Error(`Publish failed: ${resp.status}`)
      onBack()
    } catch (e) {
      console.error('Publish failed:', e)
    }
  }, [authUser, itemId, onBack])

  const handleNewVersion = useCallback(async () => {
    try {
      const token = await authUser.getIdToken()
      const resp = await fetch(`/agent/api/cms/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workflow_status: 'draft' }),
      })
      if (!resp.ok) throw new Error(`New version failed: ${resp.status}`)
      const updated = await fetch(`/cms/api/content-items/${itemId}?depth=1`)
      if (updated.ok) {
        const data = await updated.json()
        setItem(data)
        setDirty(false)
        setSaved(false)
      }
    } catch (e) {
      console.error('New version failed:', e)
    }
  }, [authUser, itemId])

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading item...</div>
  }

  if (!item) {
    return <div className="p-4 text-sm text-red-600">Item not found.</div>
  }

  const itemData = (item.data as Record<string, unknown>) ?? {}
  const workflowStatus = (item.workflow_status as string) ?? 'draft'
  const editable = workflowStatus === 'draft' || workflowStatus === 'changes_requested'
  const canSubmit = editable
  const canPublish = workflowStatus === 'approved'
  const canNewVersion = workflowStatus === 'live'

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleClose} className="rounded p-1 hover:bg-accent transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={handleClose} className="text-sm font-medium hover:underline">
          {contentTypeName ?? contentTypeSlug}
        </button>
        <span className="text-xs text-muted-foreground">/ {(itemData.title as string) ?? itemId.slice(0, 8)}</span>

        <div className="ml-auto flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[workflowStatus] ?? 'bg-gray-100 text-gray-700'}`}>
            {STATUS_LABELS[workflowStatus] ?? workflowStatus}
          </span>
          <ToolbarBtn label="Save" onClick={dirty && !saving ? handleSave : undefined} active={dirty && !saving}>
            <Save className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn label="Submit for approval" onClick={canSubmit ? handleSubmit : undefined} active={canSubmit}>
            <ArrowBigRight className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn label="Publish" onClick={canPublish ? handlePublish : undefined} active={canPublish}>
            <Send className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn label="New version" onClick={canNewVersion ? handleNewVersion : undefined} active={canNewVersion}>
            <FilePlus2 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn label="Version history" onClick={onOpenHistory} active>
            <History className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn label="Close" onClick={handleClose} active alwaysMuted>
            <X className="h-4 w-4" />
          </ToolbarBtn>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-1">
        {schema.map((field) => (
          <div key={field.name} className="grid grid-cols-[8rem_1fr] items-start gap-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2 text-right">
              {field.name}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.type === 'richtext' ? (
              <RichTextEditor
                value={(itemData[field.name] as string) ?? ''}
                onChange={(html) => handleFieldChange(field.name, html)}
                editable={editable}
              />
            ) : field.type === 'textarea' ? (
              editable ? (
                <textarea
                  value={(itemData[field.name] as string) ?? ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  rows={4}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                />
              ) : (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm whitespace-pre-wrap min-h-[6rem]">
                  {(itemData[field.name] as string) ?? ''}
                </div>
              )
            ) : (
              editable ? (
                <input
                  type="text"
                  value={(itemData[field.name] as string) ?? ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              ) : (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm">
                  {(itemData[field.name] as string) ?? ''}
                </div>
              )
            )}
          </div>
        ))}
        {schema.length === 0 && (
          <div className="py-4 text-sm text-muted-foreground italic">
            No schema defined for this content type.
          </div>
        )}
      </div>
    </div>
  )
}
