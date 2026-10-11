import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Goal, type Task } from '../db'
import { friendlyDate, shiftKey } from '../lib/date'
import { useNow } from '../lib/hooks'
import { Card, Chip, IconButton, PageHeader } from '../components/ui'
import { ChevronRight, ListPlusIcon, MoreIcon, PlusIcon } from '../components/icons'
import { BulkTaskSheet, TaskRow, TaskSheet } from '../components/TaskSheet'
import { GoalSheet } from '../components/GoalSheet'
import { AnimatedDiv, AnimatedList } from '../components/Animated'

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

type Group = { key: string; label: string; items: Task[]; danger?: boolean; goal?: Goal; progress?: { done: number; total: number } }

/** 할 일과 묶음(계획)을 한 화면에서 — 날짜별 카드 + 묶음별 카드 */
export default function Tasks() {
  const { today } = useNow()
  const [filter, setFilter] = useState<Filter>('open')
  const [edit, setEdit] = useState<Partial<Task> | null>(null)
  // null: 닫힘, '': 새 묶음, 그 밖: 그 이름의 묶음에 추가
  const [bulk, setBulk] = useState<string | null>(null)
  const [goalEdit, setGoalEdit] = useState<Goal | null>(null)
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
      } catch {
        /* 저장 못 해도 이번 화면에서는 접힌다 */
      }
      return next
    })

  const data = useLiveQuery(async () => {
    const [tasks, goals] = await Promise.all([db.tasks.toArray(), db.goals.toArray()])
    return { tasks, goals: new Map(goals.map((g) => [g.id, g])) }
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
      <AnimatedDiv className="gutter board board-3">
        {groups.map((g) => {
          const open = !collapsed.has(g.label)
          const pct = g.progress?.total ? Math.round((g.progress.done / g.progress.total) * 100) : 0
          return (
            <Card key={g.key}>
              <div className="flex items-center gap-1">
                {/* 제목을 누르면 접기 / 펴기 */}
                <button type="button" onClick={() => toggle(g.label)} aria-expanded={open} className="flex-1 min-w-0 flex items-center gap-2 min-h-11 -my-2 text-left">
                  {g.goal && <span className="size-3 rounded-full shrink-0" style={{ background: g.goal.color }} />}
                  <h2 className={`text-[17px] font-bold truncate ${g.danger ? 'text-danger' : ''}`}>{g.label}</h2>
                  {!open && g.items.length > 0 && <span className="text-[17px] font-semibold text-ink-3 tabular-nums">{g.items.length}</span>}
                  <ChevronRight width={20} height={20} className={`ml-auto shrink-0 text-ink-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
                </button>
                {g.goal && (
                  <>
                    <IconButton label={`${g.label} 수정`} className="-my-2 text-ink-3" onClick={() => setGoalEdit(g.goal!)}>
                      <MoreIcon />
                    </IconButton>
                    {g.goal.status === 'active' && (
                      <IconButton label={`${g.label}에 추가`} className="-my-2 -mr-2 text-accent" onClick={() => setBulk(g.label)}>
                        <PlusIcon />
                      </IconButton>
                    )}
                  </>
                )}
              </div>
              {/* 묶음의 진행률 (날짜가 잡힌 일과 끝낸 일까지 모두 셈) */}
              {g.progress && g.progress.total > 0 && (
                <div className="mt-2.5 h-2 rounded-full bg-card-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: g.goal!.color }} />
                </div>
              )}
              {open && (
                <AnimatedList className="divide-y divide-line mt-1">
                  {g.items.map((t) => (
                    <TaskRow key={t.id} task={t} goalColor={t.goalId != null ? data?.goals.get(t.goalId)?.color : undefined} onOpen={() => setEdit(t)} />
                  ))}
                </AnimatedList>
              )}
            </Card>
          )
        })}
      </AnimatedDiv>
      {edit && <TaskSheet initial={edit} onClose={() => setEdit(null)} />}
      {bulk !== null && <BulkTaskSheet existingGroup={bulk || undefined} onClose={() => setBulk(null)} />}
      {goalEdit && <GoalSheet initial={goalEdit} onClose={() => setGoalEdit(null)} />}
    </>
  )
}

function groupTasks(tasks: Task[], filter: Filter, today: string, goals: Map<string, Goal>): Group[] {
  const byPriority = (a: Task, b: Task) => b.priority - a.priority || a.createdAt - b.createdAt
  const progressOf = (goalId: string) => {
    const mine = tasks.filter((t) => t.goalId === goalId)
    return { done: mine.filter((t) => t.done).length, total: mine.length }
  }
  const byCreated = (a: Goal, b: Goal) => a.createdAt - b.createdAt
  const inClosedGoal = (t: Task) => !!t.goalId && goals.has(t.goalId) && goals.get(t.goalId)!.status !== 'active'

  if (filter === 'done') {
    // 끝낸 할 일 + 이룬·멈춘 묶음
    const done = tasks.filter((t) => t.done && !inClosedGoal(t)).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
    const closedGoals = [...goals.values()].filter((g) => g.status !== 'active').sort(byCreated)
    return [
      ...(done.length ? [{ key: 'done', label: '완료한 일', items: done.slice(0, 100) }] : []),
      ...closedGoals.map((g) => ({
        key: g.id,
        label: g.title,
        goal: g,
        progress: progressOf(g.id),
        items: tasks.filter((t) => t.goalId === g.id).sort((a, b) => a.done - b.done || a.createdAt - b.createdAt),
      })),
    ]
  }

  // 멈추거나 이룬 묶음의 할 일은 '완료'에서만 보인다
  const open = tasks.filter((t) => !t.done && !inClosedGoal(t))
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
  const dueToday = open.filter((t) => t.dueDate === today).sort(byPriority)
  const upcoming = open.filter((t) => t.dueDate && t.dueDate > today).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || byPriority(a, b))
  const noDate = open.filter((t) => !t.dueDate).sort(byPriority)

  // 예정된 일은 날짜별로 묶되, 일주일이 넘으면 '나중에'로 모은다
  const weekEnd = shiftKey(today, 7)
  const upcomingGroups: Group[] = []
  for (const t of upcoming) {
    const label = t.dueDate! <= weekEnd ? friendlyDate(t.dueDate!) : '나중에'
    const last = upcomingGroups[upcomingGroups.length - 1]
    if (last?.label === label) last.items.push(t)
    else upcomingGroups.push({ key: `d-${label}`, label, items: [t] })
  }

  // 진행 중인 묶음은 할 일이 없어도 카드로 보여 준다. 마감 없는 일은 묶음 카드 안에, 묶음 없는 일만 '마감 없음'에.
  const goalGroups: Group[] = [...goals.values()]
    .filter((g) => g.status === 'active')
    .sort(byCreated)
    .map((g) => ({ key: g.id, label: g.title, goal: g, progress: progressOf(g.id), items: noDate.filter((t) => t.goalId === g.id) }))
  const loose = noDate.filter((t) => !t.goalId || !goals.has(t.goalId))

  const dated: (Group & { in: Filter[] })[] = [
    { key: 'overdue', label: '기한 지남', items: overdue, danger: true, in: ['open', 'today'] },
    { key: 'today', label: '오늘', items: dueToday, in: ['open', 'today'] },
    ...upcomingGroups.map((g) => ({ ...g, in: ['open', 'upcoming'] as Filter[] })),
  ]
  const showGroups = filter === 'open' || filter === 'nodate'
  return [
    ...dated.filter((g) => g.items.length > 0 && g.in.includes(filter)),
    ...(showGroups ? goalGroups : []),
    ...(showGroups && loose.length ? [{ key: 'loose', label: '마감 없음', items: loose }] : []),
  ]
}
