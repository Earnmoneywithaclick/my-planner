import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Goal, type Task } from '../db'
import { friendlyDate, shiftKey } from '../lib/date'
import { useNow } from '../lib/hooks'
import { Card, Chip, IconButton, PageHeader } from '../components/ui'
import { ChevronRight, ListPlusIcon, PlusIcon } from '../components/icons'
import { BulkTaskSheet, TaskRow, TaskSheet } from '../components/TaskSheet'

// 접어 둔 카드는 이 기기에만 기억한다
const COLLAPSED_KEY = 'planner.tasks.collapsed'
function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

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
  // null: 닫힘, '': 새 묶음, 그 밖: 그 이름의 묶음에 추가
  const [bulk, setBulk] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const toggle = (label: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (!next.delete(label)) next.add(label)
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
      } catch {
        /* 저장 못 해도 이번 화면에서는 접힌다 */
      }
      return next
    })

  const data = useLiveQuery(async () => {
    const [tasks, goals] = await Promise.all([db.tasks.toArray(), db.goals.toArray()])
    return { tasks, goals: new Map(goals.map((g) => [g.id!, g])) }
  }, [])

  const groups = groupTasks(data?.tasks ?? [], filter, today, data?.goals ?? new Map())

  return (
    <>
      <PageHeader
        title="할 일"
        right={
          <div className="flex gap-2">
            <IconButton label="묶음으로 추가" className="bg-accent-soft text-accent" onClick={() => setBulk('')}>
              <ListPlusIcon />
            </IconButton>
            <IconButton label="할 일 추가" className="bg-accent text-bg" onClick={() => setEdit({ dueDate: filter === 'today' ? today : undefined })}>
              <PlusIcon />
            </IconButton>
          </div>
        }
      />
      <div className="flex gap-2 overflow-x-auto no-scrollbar gutter pb-3">
        {FILTERS.map((f) => (
          <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="gutter board board-3">
        {groups.map((g) => {
          const open = !collapsed.has(g.label)
          return (
            <Card key={g.label}>
              <div className="flex items-center gap-1">
                {/* 제목을 누르면 접기 / 펴기 */}
                <button type="button" onClick={() => toggle(g.label)} aria-expanded={open} className="flex-1 min-w-0 flex items-center gap-2 min-h-11 -my-2 text-left">
                  {g.color && <span className="size-3 rounded-full shrink-0" style={{ background: g.color }} />}
                  <h2 className={`text-[17px] font-bold truncate ${g.danger ? 'text-danger' : ''}`}>{g.label}</h2>
                  {!open && <span className="text-[17px] font-semibold text-ink-3 tabular-nums">{g.items.length}</span>}
                  <ChevronRight width={20} height={20} className={`ml-auto shrink-0 text-ink-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
                </button>
                {g.group && (
                  <IconButton label={`${g.label}에 추가`} className="-my-2 -mr-2 text-accent" onClick={() => setBulk(g.label)}>
                    <PlusIcon />
                  </IconButton>
                )}
              </div>
              {open && (
                <ul className="divide-y divide-line mt-1">
                  {g.items.map((t) => (
                    <TaskRow key={t.id} task={t} goalColor={t.goalId != null ? data?.goals.get(t.goalId)?.color : undefined} onOpen={() => setEdit(t)} />
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>
      {edit && <TaskSheet initial={edit} onClose={() => setEdit(null)} />}
      {bulk !== null && <BulkTaskSheet existingGroup={bulk || undefined} onClose={() => setBulk(null)} />}
    </>
  )
}

function groupTasks(tasks: Task[], filter: Filter, today: string, goals: Map<string, Goal>): { label: string; items: Task[]; danger?: boolean; color?: string; group?: boolean }[] {
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

  // 마감 없는 일은 묶음(계획)별로 따로 모으고, 묶음이 없는 일만 '마감 없음'에
  const byGoal = new Map<string, Task[]>()
  for (const t of noDate) if (t.goalId && goals.has(t.goalId)) byGoal.set(t.goalId, [...(byGoal.get(t.goalId) ?? []), t])
  const loose = noDate.filter((t) => !t.goalId || !goals.has(t.goalId))
  const goalGroups = [...byGoal].map(([id, items]) => ({ label: goals.get(id)!.title, color: goals.get(id)!.color, group: true, items, in: ['open', 'nodate'] }))

  const all = [
    { label: '기한 지남', items: overdue, danger: true, in: ['open', 'today'] },
    { label: '오늘', items: dueToday, in: ['open', 'today'] },
    ...upcomingGroups.map((g) => ({ ...g, in: ['open', 'upcoming'] })),
    ...goalGroups,
    { label: '마감 없음', items: loose, in: ['open', 'nodate'] },
  ]
  return all.filter((g) => g.items.length > 0 && g.in.includes(filter))
}
