import { useState } from 'react'
import { db, type Goal } from '../db'
import { Button, Sheet, TextArea, TextInput } from './ui'
import { CategoryPicker } from './Categories'

export const STATUS_LABEL: Record<Goal['status'], string> = { active: '진행 중', paused: '멈춤', done: '이룸' }

/** 할 일 묶음(계획) 고치기 — 이름·이유·기간·상태·카테고리, 삭제 */
export function GoalSheet({ initial, onClose }: { initial: Goal; onClose: () => void }) {
  const [g, setG] = useState<Partial<Goal>>(initial)
  const set = (p: Partial<Goal>) => setG((x) => ({ ...x, ...p }))

  async function save() {
    if (!g.title?.trim()) return
    await db.goals.update(initial.id, {
      title: g.title.trim(),
      why: g.why?.trim() || undefined,
      startDate: g.startDate || undefined,
      endDate: g.endDate || undefined,
      color: g.color!,
      status: g.status!,
    })
    onClose()
  }

  // 묻지 않고 지운다. 안에 있던 할 일은 묶음에서만 빠지고 남는다.
  async function remove() {
    await db.tasks.where('goalId').equals(initial.id).modify((t) => {
      delete t.goalId
    })
    await db.goals.delete(initial.id)
    onClose()
  }

  return (
    <Sheet
      open
      title="묶음 수정"
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={remove}>
            삭제
          </Button>
          <Button className="flex-1" onClick={save} disabled={!g.title?.trim()}>
            저장
          </Button>
        </>
      }
    >
      <TextInput placeholder="이름" value={g.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
      <TextArea value={g.why ?? ''} onChange={(e) => set({ why: e.target.value })} placeholder="왜 하는지" />
      <div className="flex items-center gap-2">
        <TextInput type="date" aria-label="시작일" value={g.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value })} />
        <span className="text-ink-3 text-[17px]">~</span>
        <TextInput type="date" aria-label="목표일" value={g.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value })} />
      </div>
      <div className="flex gap-2">
        {(Object.keys(STATUS_LABEL) as Goal['status'][]).map((s) => (
          <button key={s} type="button" onClick={() => set({ status: s })} className={`flex-1 h-11 rounded-xl text-[16px] font-semibold ${g.status === s ? 'bg-accent text-bg' : 'bg-card-2 text-ink-2'}`}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <CategoryPicker value={g.color!} onChange={(color) => set({ color })} />
    </Sheet>
  )
}
