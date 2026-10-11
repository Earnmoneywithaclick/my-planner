import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { COLORS, db, newId, type Goal, type Task } from '../db'
import { Button, Card, Chip, IconButton, PageHeader, Sheet, TextArea, TextInput } from '../components/ui'
import { CategoryPicker } from '../components/Categories'
import { PlusIcon } from '../components/icons'
import { TaskRow, TaskSheet } from '../components/TaskSheet'

const STATUS_LABEL: Record<Goal['status'], string> = { active: '진행 중', paused: '멈춤', done: '이룸' }

export default function Plans() {
  const [show, setShow] = useState<'active' | 'other'>('active')
  const [edit, setEdit] = useState<Partial<Goal> | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const data = useLiveQuery(async () => {
    const [goals, tasks] = await Promise.all([db.goals.toArray(), db.tasks.where('goalId').above('').toArray()])
    const stats = new Map<string, { done: number; total: number }>()
    for (const t of tasks) {
      const s = stats.get(t.goalId!) ?? { done: 0, total: 0 }
      s.total++
      if (t.done) s.done++
      stats.set(t.goalId!, s)
    }
    return { goals: goals.sort((a, b) => b.createdAt - a.createdAt), stats }
  }, [])

  const goals = data?.goals.filter((g) => (show === 'active' ? g.status === 'active' : g.status !== 'active')) ?? []

  return (
    <>
      <PageHeader
        title="계획"
        right={
          <IconButton label="계획 추가" className="bg-accent text-bg" onClick={() => setEdit({})}>
            <PlusIcon />
          </IconButton>
        }
      />
      <div className="flex gap-2 gutter pb-3">
        <Chip active={show === 'active'} onClick={() => setShow('active')}>
          진행 중
        </Chip>
        <Chip active={show === 'other'} onClick={() => setShow('other')}>
          이룸 · 멈춤
        </Chip>
      </div>
      <div className="gutter board board-3">
        {goals.map((g) => {
          const s = data?.stats.get(g.id!) ?? { done: 0, total: 0 }
          const pct = s.total ? Math.round((s.done / s.total) * 100) : 0
          return (
            <button key={g.id} type="button" onClick={() => setOpenId(g.id!)} className="block w-full text-left">
              <Card className="active:opacity-80">
                <div className="flex items-center gap-3">
                  <span className="size-3.5 rounded-full shrink-0" style={{ background: g.color }} />
                  <p className="flex-1 min-w-0 text-[18px] font-bold leading-snug">{g.title}</p>
                </div>
                {s.total > 0 && (
                  <div className="mt-3 h-2.5 rounded-full bg-card-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                  </div>
                )}
              </Card>
            </button>
          )
        })}
      </div>
      {edit && <GoalEditSheet initial={edit} onClose={() => setEdit(null)} />}
      {openId != null && <GoalDetailSheet id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}

function GoalEditSheet({ initial, onClose }: { initial: Partial<Goal>; onClose: () => void }) {
  const [g, setG] = useState<Partial<Goal>>({ color: COLORS[0], status: 'active', ...initial })
  const set = (p: Partial<Goal>) => setG((x) => ({ ...x, ...p }))
  const isNew = g.id == null

  async function save() {
    if (!g.title?.trim()) return
    const data = { title: g.title.trim(), why: g.why?.trim() || undefined, startDate: g.startDate || undefined, endDate: g.endDate || undefined, color: g.color!, status: g.status! }
    if (isNew) await db.goals.add({ ...data, id: newId(), createdAt: Date.now() })
    else await db.goals.update(g.id!, data)
    onClose()
  }

  return (
    <Sheet
      open
      title={isNew ? '새 계획' : '계획 수정'}
      onClose={onClose}
      footer={
        <Button className="flex-1" onClick={save} disabled={!g.title?.trim()}>
          저장
        </Button>
      }
    >
      <TextInput autoFocus={isNew} placeholder="이루고 싶은 것" value={g.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
      <TextArea value={g.why ?? ''} onChange={(e) => set({ why: e.target.value })} placeholder="왜 이 계획을 세웠나요?" />
      <div className="flex items-center gap-2">
        <TextInput type="date" aria-label="시작일" value={g.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value })} />
        <span className="text-ink-3 text-[17px]">~</span>
        <TextInput type="date" aria-label="목표일" value={g.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value })} />
      </div>
      {!isNew && (
        <div className="flex gap-2">
          {(Object.keys(STATUS_LABEL) as Goal['status'][]).map((s) => (
            <button key={s} type="button" onClick={() => set({ status: s })} className={`flex-1 h-11 rounded-xl text-[16px] font-semibold ${g.status === s ? 'bg-accent text-bg' : 'bg-card-2 text-ink-2'}`}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}
      <CategoryPicker value={g.color!} onChange={(color) => set({ color })} />
    </Sheet>
  )
}

function GoalDetailSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const goal = useLiveQuery(() => db.goals.get(id), [id])
  const tasks = useLiveQuery(() => db.tasks.where('goalId').equals(id).toArray(), [id])
  const [draft, setDraft] = useState('')
  const [editGoal, setEditGoal] = useState(false)
  const [taskEdit, setTaskEdit] = useState<Partial<Task> | null>(null)

  if (!goal) return null
  if (editGoal) return <GoalEditSheet initial={goal} onClose={() => setEditGoal(false)} />
  if (taskEdit) return <TaskSheet initial={taskEdit} onClose={() => setTaskEdit(null)} />

  async function addStep() {
    if (!draft.trim()) return
    await db.tasks.add({ id: newId(), title: draft.trim(), goalId: id, priority: 1, done: 0, createdAt: Date.now() })
    setDraft('')
  }

  async function remove() {
    if (confirm('이 계획을 삭제할까요? 연결된 할 일은 남아 있어요.')) {
      await db.tasks.where('goalId').equals(id).modify((t) => {
        delete t.goalId
      })
      await db.goals.delete(id)
      onClose()
    }
  }

  const sorted = [...(tasks ?? [])].sort((a, b) => a.done - b.done || a.createdAt - b.createdAt)
  return (
    <Sheet
      open
      title="계획"
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={remove}>
            삭제
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => setEditGoal(true)}>
            수정
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <span className="size-4 rounded-full shrink-0" style={{ background: goal.color }} />
        <p className="text-[22px] font-bold leading-snug">{goal.title}</p>
      </div>
      {goal.why && <p className="bg-card-2 rounded-xl p-3.5 text-[16px] whitespace-pre-wrap leading-relaxed">{goal.why}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          addStep()
        }}
        className="flex gap-2"
      >
        <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="다음 단계 추가" enterKeyHint="done" />
        <Button type="submit" variant="soft" className="shrink-0 !px-3.5" aria-label="단계 추가" disabled={!draft.trim()}>
          <PlusIcon />
        </Button>
      </form>
      <ul className="divide-y divide-line">
        {sorted.map((t) => (
          <TaskRow key={t.id} task={t} goalColor={goal.color} onOpen={() => setTaskEdit(t)} />
        ))}
      </ul>
    </Sheet>
  )
}
