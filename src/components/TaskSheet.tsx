import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task } from '../db'
import { Button, CheckCircle, Field, PRIORITY_LABEL, Segmented, Sheet, TextArea, TextInput } from './ui'
import { friendlyDate, todayKey, shiftKey } from '../lib/date'

export function TaskSheet({ initial, onClose }: { initial: Partial<Task>; onClose: () => void }) {
  const [t, setT] = useState<Partial<Task>>({ priority: 1, ...initial })
  const goals = useLiveQuery(() => db.goals.where('status').notEqual('done').toArray(), [])
  const set = (patch: Partial<Task>) => setT((p) => ({ ...p, ...patch }))
  const isNew = t.id == null

  async function save() {
    const title = t.title?.trim()
    if (!title) return
    const data = { ...t, title, note: t.note?.trim() || undefined, dueDate: t.dueDate || undefined }
    if (isNew) await db.tasks.add({ done: 0, createdAt: Date.now(), priority: 1, ...data, title } as Task)
    else await db.tasks.update(t.id!, data)
    onClose()
  }

  async function remove() {
    if (t.id != null && confirm('이 할 일을 삭제할까요?')) {
      await db.tasks.delete(t.id)
      onClose()
    }
  }

  const today = todayKey()
  return (
    <Sheet
      open
      title={isNew ? '새 할 일' : '할 일 수정'}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <Button variant="danger" onClick={remove}>
              삭제
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={!t.title?.trim()}>
            저장
          </Button>
        </>
      }
    >
      <TextInput autoFocus={isNew} placeholder="무엇을 해야 하나요?" value={t.title ?? ''} onChange={(e) => set({ title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
      <Field label="마감일">
        <div className="flex gap-2 mb-2 flex-wrap">
          {[
            ['오늘', today],
            ['내일', shiftKey(today, 1)],
            ['다음 주', shiftKey(today, 7)],
            ['없음', ''],
          ].map(([label, key]) => (
            <button
              key={label}
              type="button"
              onClick={() => set({ dueDate: key })}
              className={`h-8 px-3 rounded-full text-[13px] font-semibold ${(t.dueDate ?? '') === key ? 'bg-accent text-bg' : 'bg-card-2 text-ink-2'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <TextInput type="date" value={t.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value })} />
      </Field>
      <Field label="중요도">
        <Segmented value={t.priority ?? 1} onChange={(v) => set({ priority: v as Task['priority'] })} options={PRIORITY_LABEL.map((label, i) => ({ value: i, label }))} />
      </Field>
      <Field label="연결된 계획">
        <select className="w-full rounded-xl bg-card-2 px-3.5 py-2.5 min-h-11 text-ink outline-none" value={t.goalId ?? ''} onChange={(e) => set({ goalId: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">없음</option>
          {goals?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="메모">
        <TextArea value={t.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="자세한 내용 (선택)" />
      </Field>
    </Sheet>
  )
}

export function TaskRow({ task, goalName, goalColor, onOpen }: { task: Task; goalName?: string; goalColor?: string; onOpen: () => void }) {
  const today = todayKey()
  const overdue = !task.done && task.dueDate && task.dueDate < today
  const toggle = () => db.tasks.update(task.id!, task.done ? { done: 0, doneAt: undefined } : { done: 1, doneAt: Date.now() })
  return (
    <li className="flex items-start gap-3 py-2.5">
      <div className="pt-0.5">
        <CheckCircle checked={!!task.done} onChange={toggle} color={goalColor} label={`${task.title} 완료`} />
      </div>
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
        <p className={`text-[16px] leading-snug ${task.done ? 'line-through text-ink-3' : ''}`}>
          {task.priority === 2 && !task.done && <span className="text-danger font-bold mr-1">!</span>}
          {task.title}
        </p>
        {(task.dueDate || goalName || task.note) && (
          <p className="text-[13px] text-ink-3 mt-0.5 truncate">
            {task.dueDate && <span className={overdue ? 'text-danger font-semibold' : ''}>{overdue ? `${friendlyDate(task.dueDate)} 지남` : friendlyDate(task.dueDate)}</span>}
            {task.dueDate && goalName && ' · '}
            {goalName && <span style={{ color: goalColor }}>{goalName}</span>}
            {!task.dueDate && !goalName && task.note}
          </p>
        )}
      </button>
    </li>
  )
}
