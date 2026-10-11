import { useState } from 'react'
import { COLORS, db, type PlanEvent, type TimetableBlock } from '../db'
import { TIME_SLOTS, WEEKDAYS, WEEK_ORDER, timeLabel } from '../lib/date'
import { Button, ColorPicker, Select, Sheet, TextArea, TextInput } from './ui'

/** 30분 단위 시간 고르기. 예전에 저장한 다른 값이 있으면 그 값도 목록에 넣는다. */
function TimeSelect({ value, onChange, emptyLabel, after, label }: { value?: string; onChange: (v?: string) => void; emptyLabel?: string; after?: string; label: string }) {
  let slots = value && !TIME_SLOTS.includes(value) ? [...TIME_SLOTS, value].sort() : TIME_SLOTS
  if (after) slots = slots.filter((t) => t > after)
  return (
    <Select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      {emptyLabel && <option value="">{emptyLabel}</option>}
      {slots.map((t) => (
        <option key={t} value={t}>
          {timeLabel(t)}
        </option>
      ))}
    </Select>
  )
}

/** 시작 ~ 끝. 끝 시간은 비워둘 수 있고, 시작보다 늦은 시간만 고를 수 있다. */
function TimeRange({ start, end, onChange, startEmptyLabel }: { start?: string; end?: string; onChange: (p: { start?: string; end?: string }) => void; startEmptyLabel?: string }) {
  return (
    <div className="flex items-center gap-2">
      <TimeSelect
        label="시작 시간"
        value={start}
        emptyLabel={startEmptyLabel}
        onChange={(s) => onChange({ start: s, end: !s || (end && end <= s) ? undefined : end })}
      />
      <span className="text-ink-3 text-[17px]">~</span>
      <TimeSelect label="끝 시간" value={end} emptyLabel="끝 없음" after={start} onChange={(e) => onChange({ end: e })} />
    </div>
  )
}

function WeekdayPicker({ days, onToggle }: { days: number[]; onToggle: (d: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {WEEK_ORDER.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onToggle(d)}
          aria-pressed={days.includes(d)}
          className={`flex-1 h-11 rounded-xl text-[16px] font-semibold ${days.includes(d) ? 'bg-accent text-bg' : `bg-card-2 ${d === 0 ? 'text-danger' : 'text-ink-2'}`}`}
        >
          {WEEKDAYS[d]}
        </button>
      ))}
    </div>
  )
}

function Footer({ isNew, valid, onSave, onRemove }: { isNew: boolean; valid: boolean; onSave: () => void; onRemove: () => void }) {
  return (
    <>
      {!isNew && (
        <Button variant="danger" onClick={onRemove}>
          삭제
        </Button>
      )}
      <Button className="flex-1" onClick={onSave} disabled={!valid}>
        저장
      </Button>
    </>
  )
}

/** 요일마다 반복되는 시간표 칸 */
export function BlockSheet({ initial, onClose }: { initial: Partial<TimetableBlock>; onClose: () => void }) {
  const [b, setB] = useState<Partial<TimetableBlock>>({ color: COLORS[1], start: '09:00', ...initial })
  const isNew = b.id == null
  const [days, setDays] = useState<number[]>(initial.weekday != null ? [initial.weekday] : [1])
  const set = (patch: Partial<TimetableBlock>) => setB((p) => ({ ...p, ...patch }))
  const valid = !!b.title?.trim() && !!b.start && days.length > 0

  async function save() {
    if (!valid) return
    const base = { title: b.title!.trim(), place: b.place?.trim() || undefined, start: b.start!, end: b.end || undefined, color: b.color! }
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

  // 새로 만들 때는 여러 요일을 한 번에, 고칠 때는 한 요일만
  const toggleDay = (d: number) => setDays((p) => (isNew ? (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]) : [d]))

  return (
    <Sheet open title={isNew ? '시간표 추가' : '시간표 수정'} onClose={onClose} footer={<Footer isNew={isNew} valid={valid} onSave={save} onRemove={remove} />}>
      <TextInput autoFocus={isNew} placeholder="무엇을 하나요?" value={b.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
      <WeekdayPicker days={days} onToggle={toggleDay} />
      <TimeRange start={b.start} end={b.end} onChange={set} />
      <TextInput placeholder="장소" value={b.place ?? ''} onChange={(e) => set({ place: e.target.value })} />
      <ColorPicker value={b.color!} onChange={(color) => set({ color })} />
    </Sheet>
  )
}

/** 특정 날짜의 일정 — 시작 시간을 비우면 하루 종일 */
export function EventSheet({ initial, onClose }: { initial: Partial<PlanEvent>; onClose: () => void }) {
  const [ev, setEv] = useState<Partial<PlanEvent>>({ color: COLORS[2], ...initial })
  const isNew = ev.id == null
  const set = (patch: Partial<PlanEvent>) => setEv((p) => ({ ...p, ...patch }))
  const valid = !!ev.title?.trim() && !!ev.date

  async function save() {
    if (!valid) return
    const data = {
      title: ev.title!.trim(),
      date: ev.date!,
      start: ev.start || undefined,
      end: (ev.start && ev.end) || undefined,
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
    <Sheet open title={isNew ? '새 일정' : '일정 수정'} onClose={onClose} footer={<Footer isNew={isNew} valid={valid} onSave={save} onRemove={remove} />}>
      <TextInput autoFocus={isNew} placeholder="일정 이름" value={ev.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
      <TextInput type="date" aria-label="날짜" value={ev.date ?? ''} onChange={(e) => set({ date: e.target.value })} />
      <TimeRange start={ev.start} end={ev.end} onChange={set} startEmptyLabel="하루 종일" />
      <TextArea placeholder="메모" value={ev.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
      <ColorPicker value={ev.color!} onChange={(color) => set({ color })} />
    </Sheet>
  )
}
