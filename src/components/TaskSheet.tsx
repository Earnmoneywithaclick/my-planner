import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { COLORS, db, newId, type Task } from '../db'
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
    if (isNew) await db.tasks.add({ done: 0, createdAt: Date.now(), priority: 1, ...data, title, id: newId() } as Task)
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
        <Select aria-label="연결된 계획" value={t.goalId ?? ''} onChange={(e) => set({ goalId: e.target.value || undefined })}>
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

/** 줄마다 하나씩 할 일로 나눈다. 앞의 '-', '•', '1.' 같은 목록 기호는 뗀다. */
export const splitLines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-•*·]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)

/** 같은 이름의 계획(묶음)이 있으면 거기에, 없으면 새로 만들어서 할 일 여러 개를 한 번에 넣는다. */
export async function addTaskGroup(groupName: string, titles: string[]) {
  const name = groupName.trim()
  let goalId: string | undefined
  if (name) {
    const existing = (await db.goals.toArray()).find((g) => g.title === name && g.status !== 'done')
    goalId = existing?.id
    if (!goalId) {
      goalId = newId()
      await db.goals.add({ id: goalId, title: name, color: COLORS[4], status: 'active', createdAt: Date.now() })
    }
  }
  const now = Date.now()
  await db.tasks.bulkAdd(titles.map((title, i) => ({ id: newId(), title, goalId, priority: 1 as const, done: 0 as const, createdAt: now + i })))
}

/** 할 일 여러 개를 한 묶음으로 한 번에 추가. existingGroup 을 주면 그 묶음에 바로 추가한다. */
export function BulkTaskSheet({ onClose, existingGroup }: { onClose: () => void; existingGroup?: string }) {
  const [group, setGroup] = useState(existingGroup ?? '')
  const [text, setText] = useState('')
  const titles = splitLines(text)

  async function save() {
    if (!titles.length) return
    await addTaskGroup(group, titles)
    onClose()
  }

  return (
    <Sheet
      open
      title={existingGroup ? `${existingGroup}에 추가` : '묶음으로 추가'}
      onClose={onClose}
      footer={
        <Button className="flex-1" onClick={save} disabled={!titles.length}>
          {titles.length ? `할 일 ${titles.length}개 추가` : '추가'}
        </Button>
      }
    >
      {!existingGroup && <TextInput autoFocus placeholder="묶음 이름" value={group} onChange={(e) => setGroup(e.target.value)} />}
      <TextArea autoFocus={!!existingGroup} rows={10} placeholder="한 줄에 하나씩" value={text} onChange={(e) => setText(e.target.value)} />
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
