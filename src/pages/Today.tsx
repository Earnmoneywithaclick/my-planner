import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type PlanEvent, type Task, type TimetableBlock } from '../db'
import { fmt, nowHHmm } from '../lib/date'
import { toggleAgendaDone, useAgenda, useNow } from '../lib/hooks'
import { Button, Card, IconButton, PageHeader, SectionTitle, TextInput } from '../components/ui'
import { GearIcon, PlusIcon } from '../components/icons'
import { DailyTextCard } from '../components/DailyTextCard'
import { ServiceCard } from '../components/ServiceCard'
import { BibleCard } from '../components/BibleCard'
import { AgendaList } from '../components/AgendaList'
import { TaskRow, TaskSheet } from '../components/TaskSheet'
import { BlockSheet, EventSheet } from '../components/ScheduleSheets'
import { AnimatedList } from '../components/Animated'
import { t } from '../lib/i18n'

export default function Today() {
  const { today } = useNow()
  const agenda = useAgenda(today)
  const [taskEdit, setTaskEdit] = useState<Partial<Task> | null>(null)
  const [eventEdit, setEventEdit] = useState<Partial<PlanEvent> | null>(null)
  const [blockEdit, setBlockEdit] = useState<Partial<TimetableBlock> | null>(null)

  return (
    <>
      <PageHeader
        title={fmt(today, 'M월 d일 EEEE')}
        right={
          <Link to="/settings" aria-label={t('설정', 'Settings')} className="size-11 grid place-items-center rounded-full text-ink-3 active:bg-card-2">
            <GearIcon />
          </Link>
        }
      />
      <div className="gutter board">
        <DailyTextCard key={today} date={today} />

        <BibleCard key={`b-${today}`} today={today} />

        <ServiceCard key={`s-${today}`} date={today} />

        <Card>
          <SectionTitle
            right={
              <IconButton label={t('오늘 일정 추가', 'Add event for today')} className="-my-2 -mr-2 text-accent" onClick={() => setEventEdit({ date: today })}>
                <PlusIcon />
              </IconButton>
            }
          >
            {t('오늘 일정', 'Today’s schedule')}
          </SectionTitle>
          <AgendaList items={agenda} now={nowHHmm()} onOpen={(it) => (it.kind === 'block' ? setBlockEdit(it.block) : setEventEdit(it.event))} onToggle={(it) => toggleAgendaDone(it, today)} />
        </Card>

        <TodayTasks today={today} onOpen={setTaskEdit} />
      </div>

      {taskEdit && <TaskSheet initial={taskEdit} onClose={() => setTaskEdit(null)} />}
      {eventEdit && <EventSheet initial={eventEdit} quickDates={eventEdit.id == null} onClose={() => setEventEdit(null)} />}
      {blockEdit && <BlockSheet initial={blockEdit} onClose={() => setBlockEdit(null)} />}
    </>
  )
}

/** 오늘까지 마감인 일(지난 것 포함) + 오늘 끝낸 일 */
function TodayTasks({ today, onOpen }: { today: string; onOpen: (t: Partial<Task>) => void }) {
  const [draft, setDraft] = useState('')
  const data = useLiveQuery(async () => {
    const [all, goals] = await Promise.all([db.tasks.toArray(), db.goals.toArray()])
    const startOfToday = new Date(today + 'T00:00:00').getTime()
    const due = all.filter((t) => !t.done && t.dueDate && t.dueDate <= today).sort((a, b) => b.priority - a.priority || a.dueDate!.localeCompare(b.dueDate!))
    const doneToday = all.filter((t) => t.done && (t.doneAt ?? 0) >= startOfToday)
    return { tasks: [...due, ...doneToday], goals: new Map(goals.map((g) => [g.id!, g])) }
  }, [today])

  async function quickAdd() {
    const title = draft.trim()
    if (!title) return
    await db.tasks.add({ id: newId(), title, dueDate: today, priority: 1, done: 0, createdAt: Date.now() })
    setDraft('')
  }

  return (
    <Card>
      <SectionTitle>{t('오늘 할 일', 'Today’s to-dos')}</SectionTitle>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          quickAdd()
        }}
        className="flex gap-2"
      >
        <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('할 일 추가', 'Add a to-do')} enterKeyHint="done" />
        <Button type="submit" variant="soft" className="shrink-0 !px-3.5" aria-label={t('할 일 추가', 'Add a to-do')} disabled={!draft.trim()}>
          <PlusIcon />
        </Button>
      </form>
      {data && (
        <AnimatedList className="divide-y divide-line mt-1">
          {data.tasks.map((t) => (
            <TaskRow key={t.id} task={t} goalColor={t.goalId != null ? data.goals.get(t.goalId)?.color : undefined} onOpen={() => onOpen(t)} />
          ))}
        </AnimatedList>
      )}
    </Card>
  )
}
