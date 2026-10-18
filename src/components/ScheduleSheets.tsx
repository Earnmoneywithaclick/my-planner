import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { COLORS, db, newId, type PlanEvent, type TimetableBlock } from '../db'
import { TIME_SLOTS, weekdayShort, WEEK_ORDER, timeLabel, shiftKey, todayKey } from '../lib/date'
import { Button, Select, Sheet, TextArea, TextInput } from './ui'
import { CategoryPicker } from './Categories'
import { DateRangePicker } from './DateRangePicker'
import { t } from '../lib/i18n'

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
        label={t('시작 시간', 'Start time')}
        value={start}
        emptyLabel={startEmptyLabel}
        onChange={(s) => onChange({ start: s, end: !s || (end && end <= s) ? undefined : end })}
      />
      <span className="text-ink-3 text-[17px]">~</span>
      <TimeSelect label={t('끝 시간', 'End time')} value={end} emptyLabel={t('끝 없음', 'No end')} after={start} onChange={(e) => onChange({ end: e })} />
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
          {weekdayShort(d)}
        </button>
      ))}
    </div>
  )
}

/** 했는지 체크하는 일정으로 만들기 — 켜면 일정 목록 오른쪽에 체크 동그라미가 생긴다 */
function CheckToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="w-full h-12 rounded-xl bg-card-2 px-3.5 flex items-center justify-between text-[16px] font-medium text-ink"
    >
      {t('했는지 체크', 'Check when done')}
      <span className={`w-12 h-7 rounded-full p-0.5 transition-colors ${on ? 'bg-accent' : 'bg-ink-3/35'}`}>
        <span className={`block size-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}

function Footer({ isNew, valid, onSave, onRemove }: { isNew: boolean; valid: boolean; onSave: () => void; onRemove: () => void }) {
  return (
    <>
      {!isNew && (
        <Button variant="danger" onClick={onRemove}>
          {t('삭제', 'Delete')}
        </Button>
      )}
      <Button className="flex-1" onClick={onSave} disabled={!valid}>
        {t('저장', 'Save')}
      </Button>
    </>
  )
}

/** 같은 반복 일정에 속한 요일들인지. 예전 기록(seriesId 없음)은 이름·시간·장소·카테고리가 모두 같으면 한 묶음으로 본다. */
function sameSeries(a: TimetableBlock, b: TimetableBlock) {
  if (a.seriesId || b.seriesId) return a.seriesId === b.seriesId
  return a.title === b.title && a.start === b.start && (a.end ?? '') === (b.end ?? '') && a.color === b.color && (a.place ?? '') === (b.place ?? '')
}

/** 요일마다 반복되는 시간표. 고치거나 지우면 같은 반복 일정의 모든 요일에 한 번에 적용된다. */
export function BlockSheet({ initial, onClose }: { initial: Partial<TimetableBlock>; onClose: () => void }) {
  const [b, setB] = useState<Partial<TimetableBlock>>({ color: COLORS[4], start: '09:00', ...initial })
  const isNew = b.id == null
  const siblings = useLiveQuery(async () => {
    if (initial.id == null) return []
    const all = await db.timetable.toArray()
    const me = all.find((x) => x.id === initial.id)
    return me ? all.filter((x) => sameSeries(x, me)) : []
  }, [initial.id])
  // 사용자가 요일을 건드리기 전까지는 같은 반복 일정의 요일들을 그대로 보여준다
  const [pickedDays, setPickedDays] = useState<number[] | null>(isNew ? [initial.weekday ?? 1] : null)
  const days = pickedDays ?? [...new Set(siblings?.map((x) => x.weekday) ?? (initial.weekday != null ? [initial.weekday] : []))]
  const set = (patch: Partial<TimetableBlock>) => setB((p) => ({ ...p, ...patch }))
  const valid = !!b.title?.trim() && !!b.start && days.length > 0 && (isNew || siblings !== undefined)

  async function save() {
    if (!valid) return
    const seriesId = siblings?.find((x) => x.seriesId)?.seriesId ?? newId()
    const base = { title: b.title!.trim(), place: b.place?.trim() || undefined, start: b.start!, end: b.end || undefined, color: b.color!, check: b.check || undefined, seriesId }
    await db.transaction('rw', db.timetable, async () => {
      // 요일마다 하나씩만 남기고 고친다. 빠진 요일은 지우고, 새로 고른 요일은 추가한다.
      const keep = new Map<number, TimetableBlock>()
      for (const s of siblings ?? []) {
        if (days.includes(s.weekday) && !keep.has(s.weekday)) keep.set(s.weekday, s)
        else await db.timetable.delete(s.id)
      }
      for (const weekday of days) {
        const s = keep.get(weekday)
        if (s) await db.timetable.update(s.id, { ...base, weekday })
        else await db.timetable.add({ ...base, weekday, id: newId() })
      }
    })
    onClose()
  }

  async function remove() {
    // 묻지 않고 같은 반복 일정의 모든 요일을 지운다
    if (!siblings?.length) return
    await db.timetable.bulkDelete(siblings.map((x) => x.id))
    onClose()
  }

  // 연달아 빠르게 눌러도 앞의 선택이 사라지지 않도록 직전 값을 기준으로 바꾼다
  const toggleDay = (d: number) =>
    setPickedDays((p) => {
      const cur = p ?? days
      return cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]
    })

  return (
    <Sheet open title={isNew ? t('반복 일정 추가', 'New weekly item') : t('반복 일정 수정', 'Edit weekly item')} onClose={onClose} footer={<Footer isNew={isNew} valid={valid} onSave={save} onRemove={remove} />}>
      <TextInput autoFocus={isNew} placeholder={t('무엇을 하나요?', 'What is it?')} value={b.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
      <WeekdayPicker days={days} onToggle={toggleDay} />
      <TimeRange start={b.start} end={b.end} onChange={set} />
      <TextInput placeholder={t('장소', 'Place')} value={b.place ?? ''} onChange={(e) => set({ place: e.target.value })} />
      <CheckToggle on={!!b.check} onChange={(check) => set({ check })} />
      <CategoryPicker value={b.color!} onChange={(color) => set({ color })} />
    </Sheet>
  )
}

/** 날짜를 정한 일정 — 시작 시간을 비우면 하루 종일, 마지막 날을 고르면 며칠 이어지는 일정 */
export function EventSheet({ initial, onClose, quickDates = false }: { initial: Partial<PlanEvent>; onClose: () => void; quickDates?: boolean }) {
  const [ev, setEv] = useState<Partial<PlanEvent>>({ color: COLORS[3], ...initial })
  const isNew = ev.id == null
  const set = (patch: Partial<PlanEvent>) => setEv((p) => ({ ...p, ...patch }))
  const valid = !!ev.title?.trim() && !!ev.date

  async function save() {
    if (!valid) return
    const data = {
      title: ev.title!.trim(),
      date: ev.date!,
      endDate: ev.endDate && ev.endDate > ev.date! ? ev.endDate : undefined,
      start: ev.start || undefined,
      end: (ev.start && ev.end) || undefined,
      note: ev.note?.trim() || undefined,
      color: ev.color!,
      check: ev.check || undefined,
    }
    if (isNew) await db.events.add({ ...data, id: newId(), createdAt: Date.now() })
    else await db.events.update(ev.id!, data)
    onClose()
  }

  async function remove() {
    if (ev.id == null) return
    await db.events.delete(ev.id)
    onClose()
  }

  return (
    <Sheet open title={isNew ? t('새 일정', 'New event') : t('일정 수정', 'Edit event')} onClose={onClose} footer={<Footer isNew={isNew} valid={valid} onSave={save} onRemove={remove} />}>
      <TextInput autoFocus={isNew} placeholder={t('일정 이름', 'Event name')} value={ev.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
      {/* 한 달력에서 시작 날 → 마지막 날 차례로 탭 */}
      {quickDates ? (
        // 오늘 화면에서 바로 추가할 때는 큰 달력 대신 오늘·내일·모레만
        <div className="flex gap-2">
          {t(['오늘', '내일', '모레'], ['Today', 'Tomorrow', 'In 2 days']).map((label, i) => {
            const key = shiftKey(todayKey(), i)
            return (
              <button
                key={label}
                type="button"
                onClick={() => set({ date: key, endDate: undefined })}
                className={`flex-1 h-11 rounded-xl text-[16px] font-semibold ${ev.date === key ? 'bg-accent text-bg' : 'bg-card-2 text-ink-2'}`}
              >
                {label}
              </button>
            )
          })}
        </div>
      ) : (
        <DateRangePicker start={ev.date} end={ev.endDate} awaitEnd={isNew} onChange={({ date, endDate }) => set({ date, endDate })} />
      )}
      <TimeRange start={ev.start} end={ev.end} onChange={set} startEmptyLabel={t('하루 종일', 'All day')} />
      <CheckToggle on={!!ev.check} onChange={(check) => set({ check })} />
      <TextArea placeholder={t('메모', 'Note')} value={ev.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
      <CategoryPicker value={ev.color!} onChange={(color) => set({ color })} />
    </Sheet>
  )
}
