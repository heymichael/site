import { useState, useEffect } from 'react'
import { Calendar, Clock } from 'lucide-react'
import { agentFetch } from '@haderach/shared-ui'
import { useAuthUser } from '../auth/AuthUserContext'

interface Schedule {
  id: string
  name: string
  publishAt: string
  contentTypes: Array<{ id: string; slug?: string; label?: string }>
}

export function SchedulingPanel() {
  const authUser = useAuthUser()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await agentFetch('/cms/api/schedules?depth=1&sort=-publishAt&limit=50', authUser.getIdToken)
        if (!resp.ok || cancelled) return
        const data = await resp.json()
        const docs: Schedule[] = (data.docs ?? []).map((d: Record<string, unknown>) => ({
          id: d.id as string,
          name: d.name as string,
          publishAt: d.publishAt as string,
          contentTypes: (d.contentTypes as Array<Record<string, unknown>> ?? []).map((ct) => ({
            id: (typeof ct === 'object' ? ct.id : ct) as string,
            slug: ct.slug as string | undefined,
            label: ct.label as string | undefined,
          })),
        }))
        setSchedules(docs)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [authUser.getIdToken])

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading schedules…</div>
  }

  const now = new Date()
  const upcoming = schedules.filter((s) => new Date(s.publishAt) >= now)
  const past = schedules.filter((s) => new Date(s.publishAt) < now)

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Schedules</span>
      </div>

      {schedules.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No schedules yet. Ask the agent to create one in the chat pane.
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upcoming</span>
          {upcoming.map((s) => (
            <ScheduleCard key={s.id} schedule={s} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Past</span>
          {past.map((s) => (
            <ScheduleCard key={s.id} schedule={s} />
          ))}
        </div>
      )}
    </div>
  )
}

function ScheduleCard({ schedule }: { schedule: Schedule }) {
  const publishDate = new Date(schedule.publishAt)
  const isPast = publishDate < new Date()

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${isPast ? 'border-border bg-muted/30' : 'border-primary/20 bg-primary/5'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{schedule.name}</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {publishDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          {' '}
          {publishDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      {schedule.contentTypes.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {schedule.contentTypes.map((ct) => (
            <span key={ct.id} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {ct.label ?? ct.slug ?? ct.id}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
