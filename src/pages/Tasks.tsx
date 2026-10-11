import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task } from '../db'
import { friendlyDate, shiftKey } from '../lib/date'
import { useNow } from '../lib/hooks'
import { Card, Chip, IconButton, PageHeader } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { TaskRow, TaskSheet } from '../components/TaskSheet'

type Filter = 'open' | 'today' | 'upcoming' | 'nodate' | 'done'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: '전체' },
  { value: 'today', label: '오늘까지' },
  { value: 'upcoming', label: '예정' },
  { value: 'nodate', label: '마감 없음' },
  { value: 'done', label: '완료' },
]

export default function Tasks() {
  const { today } = useNow()
  const [filter, setFilter] = useState<Filter>('open')
  const [edit, setEdit] = useState<Partial<Task> | null>(null)

  const data = useLiveQuery(async () => {
    const [tasks, goals] = await Promise.all([db.tasks.toArray(), db.goals.toArray()])
    return { tasks, goals: new Map(goals.map((g) => [g.id!, g])) }
  }, [])

  const groups = groupTasks(data?.tasks ?? [], filter, today)

  return (
    <>
      <PageHeader
        title="할 일"
        right={
          <IconButton label="할 일 추가" className="bg-accent text-bg" onClick={() => setEdit({ dueDate: filter === 'today' ? today : undefined })}>
            <PlusIcon />
          </IconButton>
        }
      />
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
        {FILTERS.map((f) => (
          <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="px-4 space-y-3">
        {groups.map((g) => (
          <Card key={g.label}>
            <h2 className={`text-[17px] font-bold ${g.danger ? 'text-danger' : ''}`}>{g.label}</h2>
            <ul className="divide-y divide-line">
              {g.items.map((t) => (
                <TaskRow key={t.id} task={t} goalColor={t.goalId != null ? data?.goals.get(t.goalId)?.color : undefined} onOpen={() => setEdit(t)} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
      {edit && <TaskSheet initial={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function groupTasks(tasks: Task[], filter: Filter, today: string): { label: string; items: Task[]; danger?: boolean }[] {
  const byPriority = (a: Task, b: Task) => b.priority - a.priority || a.createdAt - b.createdAt
  if (filter === 'done') {
    const done = tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
    return done.length ? [{ label: '완료한 일', items: done.slice(0, 100) }] : []
  }
  const open = tasks.filter((t) => !t.done)
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
  const dueToday = open.filter((t) => t.dueDate === today).sort(byPriority)
  const upcoming = open.filter((t) => t.dueDate && t.dueDate > today).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || byPriority(a, b))
  const noDate = open.filter((t) => !t.dueDate).sort(byPriority)

  // 예정된 일은 날짜별로 묶되, 일주일이 넘으면 '나중에'로 모은다
  const weekEnd = shiftKey(today, 7)
  const upcomingGroups: { label: string; items: Task[] }[] = []
  for (const t of upcoming) {
    const label = t.dueDate! <= weekEnd ? friendlyDate(t.dueDate!) : '나중에'
    const last = upcomingGroups[upcomingGroups.length - 1]
    if (last?.label === label) last.items.push(t)
    else upcomingGroups.push({ label, items: [t] })
  }

  const all = [
    { label: '기한 지남', items: overdue, danger: true, in: ['open', 'today'] },
    { label: '오늘', items: dueToday, in: ['open', 'today'] },
    ...upcomingGroups.map((g) => ({ ...g, in: ['open', 'upcoming'] })),
    { label: '마감 없음', items: noDate, in: ['open', 'nodate'] },
  ]
  return all.filter((g) => g.items.length > 0 && g.in.includes(filter))
}
