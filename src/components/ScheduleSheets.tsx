import { useState } from 'react'
import { COLORS, db, type PlanEvent, type TimetableBlock } from '../db'
import { WEEKDAYS, WEEK_ORDER } from '../lib/date'
import { Button, ColorPicker, Field, Sheet, TextArea, TextInput } from './ui'

function TimeRange({ start, end, onChange }: { start?: string; end?: string; onChange: (p: { start?: string; end?: string }) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="시작">
        <TextInput type="time" value={start ?? ''} onChange={(e) => onChange({ start: e.target.value })} />
      </Field>
      <Field label="끝">
        <TextInput type="time" value={end ?? ''} onChange={(e) => onChange({ end: e.target.value })} />
      </Field>
    </div>
  )
}

/** 요일마다 반복되는 시간표 칸 */
export function BlockSheet({ initial, onClose }: { initial: Partial<TimetableBlock>; onClose: () => void }) {
  const [b, setB] = useState<Partial<TimetableBlock>>({ color: COLORS[1], start: '09:00', end: '10:00', ...initial })
  const isNew = b.id == null
  const [days, setDays] = useState<number[]>(initial.weekday != null ? [initial.weekday] : [1])
  const set = (patch: Partial<TimetableBlock>) => setB((p) => ({ ...p, ...patch }))
  const valid = !!b.title?.trim() && !!b.start && !!b.end && b.start < b.end && days.length > 0

  async function save() {
    if (!valid) return
    const base = { title: b.title!.trim(), place: b.place?.trim() || undefined, start: b.start!, end: b.end!, color: b.color! }
    if (isNew) await db.timetable.bulkAdd(days.map((weekday) => ({ ...base, weekday })))
    else await db.timetable.update(b.id!, { ...base, weekday: days[0] })
    onClose()
  }

  async function remove() {
    if (b.id != null && confirm('이 시간표 칸을 삭제할까요?')) {
      await db.timetable.delete(b.id)
      onClose()
    }
  }

  const toggleDay = (d: number) => setDays((p) => (isNew ? (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]) : [d]))

  return (
    <Sheet
      open
      title={isNew ? '시간표 추가' : '시간표 수정'}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <Button variant="danger" onClick={remove}>
              삭제
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={!valid}>
            저장
          </Button>
        </>
      }
    >
      <TextInput autoFocus={isNew} placeholder="예: 운동, 수업, 성경 읽기" value={b.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
      <Field label={isNew ? '반복 요일 (여러 개 선택 가능)' : '요일'}>
        <div className="flex gap-1.5">
          {WEEK_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`flex-1 h-10 rounded-xl text-[14px] font-semibold ${days.includes(d) ? 'bg-accent text-bg' : 'bg-card-2 text-ink-2'} ${d === 0 ? 'text-danger' : ''}`}
            >
              {WEEKDAYS[d]}
            </button>
          ))}
        </div>
      </Field>
      <TimeRange start={b.start} end={b.end} onChange={set} />
      {b.start && b.end && b.start >= b.end && <p className="text-[13px] text-danger -mt-2">끝나는 시간이 시작보다 늦어야 해요.</p>}
      <Field label="장소 (선택)">
        <TextInput value={b.place ?? ''} onChange={(e) => set({ place: e.target.value })} />
      </Field>
      <Field label="색">
        <ColorPicker value={b.color!} onChange={(color) => set({ color })} />
      </Field>
    </Sheet>
  )
}

/** 특정 날짜의 일정 */
export function EventSheet({ initial, onClose }: { initial: Partial<PlanEvent>; onClose: () => void }) {
  const [ev, setEv] = useState<Partial<PlanEvent>>({ color: COLORS[2], ...initial })
  const [allDay, setAllDay] = useState(initial.id != null && !initial.start)
  const isNew = ev.id == null
  const set = (patch: Partial<PlanEvent>) => setEv((p) => ({ ...p, ...patch }))
  const timeOk = allDay || (!!ev.start && (!ev.end || ev.start < ev.end))
  const valid = !!ev.title?.trim() && !!ev.date && timeOk

  async function save() {
    if (!valid) return
    const data = {
      title: ev.title!.trim(),
      date: ev.date!,
      start: allDay ? undefined : ev.start,
      end: allDay ? undefined : ev.end || undefined,
      note: ev.note?.trim() || undefined,
      color: ev.color!,
    }
    if (isNew) await db.events.add({ ...data, createdAt: Date.now() })
    else await db.events.update(ev.id!, data)
    onClose()
  }

  async function remove() {
    if (ev.id != null && confirm('이 일정을 삭제할까요?')) {
      await db.events.delete(ev.id)
      onClose()
    }
  }

  return (
    <Sheet
      open
      title={isNew ? '새 일정' : '일정 수정'}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <Button variant="danger" onClick={remove}>
              삭제
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={!valid}>
            저장
          </Button>
        </>
      }
    >
      <TextInput autoFocus={isNew} placeholder="일정 이름" value={ev.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
      <Field label="날짜">
        <TextInput type="date" value={ev.date ?? ''} onChange={(e) => set({ date: e.target.value })} />
      </Field>
      <label className="flex items-center justify-between bg-card-2 rounded-xl px-3.5 h-11">
        <span className="text-[15px]">하루 종일</span>
        <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
      </label>
      {!allDay && <TimeRange start={ev.start} end={ev.end} onChange={set} />}
      <Field label="메모">
        <TextArea value={ev.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="장소, 준비물 등 (선택)" />
      </Field>
      <Field label="색">
        <ColorPicker value={ev.color!} onChange={(color) => set({ color })} />
      </Field>
    </Sheet>
  )
}
