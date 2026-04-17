import { useState, useEffect, useCallback } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { agentFetch } from '@haderach/shared-ui'
import { useAuthUser } from '../auth/AuthUserContext'

const CMS_ROLES = ['editor', 'approver', 'publisher', 'admin'] as const
type CmsRole = typeof CMS_ROLES[number]

interface RoleAssignment {
  id?: string
  email: string
  contentTypeId: string
  contentTypeLabel: string
  roles: Set<CmsRole>
}

interface ContentType {
  id: string
  slug: string
  label: string
}

export function PermissionsMatrix() {
  const authUser = useAuthUser()
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [assignments, setAssignments] = useState<RoleAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [ctResp, rolesResp] = await Promise.all([
          agentFetch('/cms/api/content-types?where[status][equals]=committed&limit=100', authUser.getIdToken),
          agentFetch('/cms/api/cms-roles?limit=500&depth=1', authUser.getIdToken),
        ])

        if (cancelled) return

        const types: ContentType[] = []
        if (ctResp.ok) {
          const ctData = await ctResp.json()
          for (const d of ctData.docs ?? []) {
            types.push({ id: d.id, slug: d.slug, label: d.label ?? d.slug })
          }
        }
        setContentTypes(types)

        const roleAssignments: RoleAssignment[] = []
        if (rolesResp.ok) {
          const rolesData = await rolesResp.json()
          for (const d of rolesData.docs ?? []) {
            const ct = typeof d.contentType === 'object' ? d.contentType : { id: d.contentType }
            roleAssignments.push({
              id: d.id,
              email: d.email,
              contentTypeId: ct.id,
              contentTypeLabel: ct.label ?? ct.slug ?? ct.id,
              roles: new Set((d.roles as string[]) ?? []),
            })
          }
        }
        setAssignments(roleAssignments)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [authUser.getIdToken])

  const emails = [...new Set(assignments.map((a) => a.email))].sort()

  const getAssignment = (email: string, ctId: string) =>
    assignments.find((a) => a.email === email && a.contentTypeId === ctId)

  const toggleRole = useCallback((email: string, ctId: string, ctLabel: string, role: CmsRole) => {
    setDirty(true)
    setAssignments((prev) => {
      const idx = prev.findIndex((a) => a.email === email && a.contentTypeId === ctId)
      if (idx >= 0) {
        const updated = [...prev]
        const roles = new Set(updated[idx].roles)
        if (roles.has(role)) roles.delete(role)
        else roles.add(role)
        updated[idx] = { ...updated[idx], roles }
        return updated
      }
      return [...prev, { email, contentTypeId: ctId, contentTypeLabel: ctLabel, roles: new Set([role]) }]
    })
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      for (const a of assignments) {
        if (a.roles.size === 0 && a.id) {
          await agentFetch(`/cms/api/cms-roles/${a.id}`, authUser.getIdToken, { method: 'DELETE' })
        } else if (a.id) {
          await agentFetch(`/cms/api/cms-roles/${a.id}`, authUser.getIdToken, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roles: [...a.roles] }),
          })
        } else if (a.roles.size > 0) {
          await agentFetch('/cms/api/cms-roles', authUser.getIdToken, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: a.email, contentType: a.contentTypeId, roles: [...a.roles] }),
          })
        }
      }
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }, [assignments, authUser.getIdToken])

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading permissions…</div>
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Permissions Matrix</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Update
        </button>
      </div>

      {contentTypes.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">No committed collections yet.</div>
      )}

      {contentTypes.length > 0 && emails.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">No role assignments yet.</div>
      )}

      {contentTypes.length > 0 && emails.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">User</th>
                {contentTypes.map((ct) => (
                  <th key={ct.id} colSpan={CMS_ROLES.length} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground border-l">
                    {ct.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b">
                <th />
                {contentTypes.map((ct) =>
                  CMS_ROLES.map((role) => (
                    <th key={`${ct.id}-${role}`} className="px-1 py-1 text-center text-[10px] text-muted-foreground font-normal">
                      {role.charAt(0).toUpperCase() + role.slice(1, 3)}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr key={email} className="border-b hover:bg-accent/50 transition-colors">
                  <td className="py-1.5 pr-3 text-xs">{email}</td>
                  {contentTypes.map((ct) =>
                    CMS_ROLES.map((role) => {
                      const assignment = getAssignment(email, ct.id)
                      const checked = assignment?.roles.has(role) ?? false
                      return (
                        <td key={`${ct.id}-${role}`} className="px-1 py-1.5 text-center border-l">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRole(email, ct.id, ct.label, role)}
                            className="h-3 w-3 rounded border-input"
                          />
                        </td>
                      )
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
