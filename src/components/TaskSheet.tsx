import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task } from '../db'
import { Button, CheckCircle, PRIORITY_LABEL, Segmented, Select, Sheet, TextArea, TextInput } from './ui'
import { todayKey, shiftKey } from '../lib/date'

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
  const quickDates: [string, string][] = [
    ['오늘', today],
    ['내일', shiftKey(today, 1)],
    ['다음 주', shiftKey(today, 7)],
    ['마감 없음', ''],
  ]
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
      <div className="flex gap-2 flex-wrap">
        {quickDates.map(([label, key]) => (
          <button
            key={label}
            type="button"
            onClick={() => set({ dueDate: key })}
            className={`h-10 px-4 rounded-full text-[15px] font-semibold ${(t.dueDate ?? '') === key ? 'bg-accent text-bg' : 'bg-card-2 text-ink-2'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <TextInput type="date" aria-label="마감일" value={t.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value })} />
      <Segmented value={t.priority ?? 1} onChange={(v) => set({ priority: v as Task['priority'] })} options={PRIORITY_LABEL.map((label, i) => ({ value: i, label: `중요도 ${label}` }))} />
      {!!goals?.length && (
        <Select aria-label="연결된 계획" value={t.goalId ?? ''} onChange={(e) => set({ goalId: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">계획 연결 안 함</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </Select>
      )}
      <TextArea value={t.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="메모" />
    </Sheet>
  )
}

/** 할 일 한 줄 — 제목만 보여준다. 기한이 지난 일은 빨간 글자, 계획에 연결된 일은 체크 원이 계획 색. */
export function TaskRow({ task, goalColor, onOpen }: { task: Task; goalColor?: string; onOpen: () => void }) {
  const overdue = !task.done && !!task.dueDate && task.dueDate < todayKey()
  const toggle = () => db.tasks.update(task.id!, task.done ? { done: 0, doneAt: undefined } : { done: 1, doneAt: Date.now() })
  return (
    <li className="flex items-center gap-3 py-3">
      <CheckCircle checked={!!task.done} onChange={toggle} color={goalColor} label={`${task.title} 완료`} />
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
        <p className={`text-[17px] leading-snug ${task.done ? 'line-through text-ink-3' : overdue ? 'text-danger' : ''}`}>
          {task.priority === 2 && !task.done && <span className="text-danger font-bold mr-1">!</span>}
          {task.title}
        </p>
      </button>
    </li>
  )
}
