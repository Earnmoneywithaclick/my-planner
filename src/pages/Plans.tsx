import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { COLORS, db, type Goal, type Task } from '../db'
import { fmt } from '../lib/date'
import { Button, Card, Chip, ColorPicker, Empty, Field, IconButton, PageHeader, Sheet, TextArea, TextInput } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { TaskRow, TaskSheet } from '../components/TaskSheet'

const STATUS_LABEL: Record<Goal['status'], string> = { active: '진행 중', paused: '잠시 멈춤', done: '이룸' }

export default function Plans() {
  const [show, setShow] = useState<'active' | 'other'>('active')
  const [edit, setEdit] = useState<Partial<Goal> | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)

  const data = useLiveQuery(async () => {
    const [goals, tasks] = await Promise.all([db.goals.toArray(), db.tasks.where('goalId').above(0).toArray()])
    const stats = new Map<number, { done: number; total: number }>()
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
      <div className="flex gap-2 px-4 pb-3">
        <Chip active={show === 'active'} onClick={() => setShow('active')}>
          진행 중
        </Chip>
        <Chip active={show === 'other'} onClick={() => setShow('other')}>
          이룸 · 멈춤
        </Chip>
      </div>
      <div className="px-4 space-y-3">
        {data && goals.length === 0 && (
          <Card>
            <Empty>{show === 'active' ? '이루고 싶은 목표나 계획을 + 로 추가해 보세요' : '아직 없어요'}</Empty>
          </Card>
        )}
        {goals.map((g) => {
          const s = data?.stats.get(g.id!) ?? { done: 0, total: 0 }
          const pct = s.total ? Math.round((s.done / s.total) * 100) : 0
          return (
            <button key={g.id} type="button" onClick={() => setOpenId(g.id!)} className="block w-full text-left">
              <Card className="active:opacity-80">
                <div className="flex items-start gap-3">
                  <span className="size-3 rounded-full mt-1.5 shrink-0" style={{ background: g.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[17px] font-bold leading-snug">{g.title}</p>
                    {g.why && <p className="text-[14px] text-ink-2 mt-0.5 line-clamp-2">{g.why}</p>}
                    <p className="text-[12px] text-ink-3 mt-1">
                      {g.status !== 'active' && `${STATUS_LABEL[g.status]} · `}
                      {periodText(g) || '기간 없음'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-card-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                  </div>
                  <span className="text-[13px] font-semibold text-ink-3 tabular-nums">
                    {s.done}/{s.total}
                  </span>
                </div>
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

function periodText(g: Goal) {
  if (!g.startDate && !g.endDate) return ''
  return `${g.startDate ? fmt(g.startDate, 'M.d') : ''} ~ ${g.endDate ? fmt(g.endDate, 'yyyy.M.d') : ''}`
}

function GoalEditSheet({ initial, onClose }: { initial: Partial<Goal>; onClose: () => void }) {
  const [g, setG] = useState<Partial<Goal>>({ color: COLORS[0], status: 'active', ...initial })
  const set = (p: Partial<Goal>) => setG((x) => ({ ...x, ...p }))
  const isNew = g.id == null

  async function save() {
    if (!g.title?.trim()) return
    const data = { title: g.title.trim(), why: g.why?.trim() || undefined, startDate: g.startDate || undefined, endDate: g.endDate || undefined, color: g.color!, status: g.status! }
    if (isNew) await db.goals.add({ ...data, createdAt: Date.now() })
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
      <TextInput autoFocus={isNew} placeholder="예: 매일 성경 읽기, 영어 회화 3개월" value={g.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
      <Field label="왜 이 계획을 세웠나요?">
        <TextArea value={g.why ?? ''} onChange={(e) => set({ why: e.target.value })} placeholder="이유를 적어 두면 흔들릴 때 다시 볼 수 있어요" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="시작">
          <TextInput type="date" value={g.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value })} />
        </Field>
        <Field label="목표일">
          <TextInput type="date" value={g.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value })} />
        </Field>
      </div>
      {!isNew && (
        <Field label="상태">
          <div className="flex gap-2">
            {(Object.keys(STATUS_LABEL) as Goal['status'][]).map((s) => (
              <button key={s} type="button" onClick={() => set({ status: s })} className={`flex-1 h-10 rounded-xl text-[14px] font-semibold ${g.status === s ? 'bg-accent text-bg' : 'bg-card-2 text-ink-2'}`}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="색">
        <ColorPicker value={g.color!} onChange={(color) => set({ color })} />
      </Field>
    </Sheet>
  )
}

function GoalDetailSheet({ id, onClose }: { id: number; onClose: () => void }) {
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
    await db.tasks.add({ title: draft.trim(), goalId: id, priority: 1, done: 0, createdAt: Date.now() })
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
      <div className="flex items-start gap-3">
        <span className="size-3.5 rounded-full mt-2 shrink-0" style={{ background: goal.color }} />
        <div>
          <p className="text-[22px] font-bold leading-snug">{goal.title}</p>
          <p className="text-[13px] text-ink-3 mt-0.5">
            {STATUS_LABEL[goal.status]}
            {periodText(goal) && ` · ${periodText(goal)}`}
          </p>
        </div>
      </div>
      {goal.why && (
        <div className="bg-card rounded-xl p-3">
          <p className="text-[12px] font-semibold text-ink-3 mb-1">이 계획을 세운 이유</p>
          <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{goal.why}</p>
        </div>
      )}
      <div>
        <p className="text-[13px] font-medium text-ink-3 mb-1.5">단계 · 할 일</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addStep()
          }}
          className="flex gap-2"
        >
          <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="다음 단계 추가" enterKeyHint="done" />
          <Button type="submit" variant="soft" className="shrink-0 !px-3" aria-label="단계 추가" disabled={!draft.trim()}>
            <PlusIcon width={20} height={20} />
          </Button>
        </form>
        <ul className="divide-y divide-line mt-1">
          {sorted.map((t) => (
            <TaskRow key={t.id} task={t} goalColor={goal.color} onOpen={() => setTaskEdit(t)} />
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
