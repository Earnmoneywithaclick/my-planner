import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, startOfWeek } from 'date-fns'
import { db, type PlanEvent, type TimetableBlock } from '../db'
import { WEEKDAYS, WEEK_ORDER, fmt, friendlyDate, fromKey, nowHHmm, shiftKey, shortTime, toKey } from '../lib/date'
import { type AgendaItem, useAgenda, useNow } from '../lib/hooks'
import { Card, IconButton, PageHeader, SectionTitle, Segmented } from '../components/ui'
import { ChevronLeft, ChevronRight, PlusIcon } from '../components/icons'
import { AgendaList } from '../components/AgendaList'
import { BlockSheet, EventSheet } from '../components/ScheduleSheets'

type Mode = 'day' | 'week'

export default function Timetable() {
  const { today } = useNow()
  const [mode, setMode] = useState<Mode>('day')
  const [selected, setSelected] = useState(today)
  const [weekday, setWeekday] = useState(() => fromKey(today).getDay())
  const [blockEdit, setBlockEdit] = useState<Partial<TimetableBlock> | null>(null)
  const [eventEdit, setEventEdit] = useState<Partial<PlanEvent> | null>(null)

  return (
    <>
      <PageHeader
        title="시간표"
        right={
          <IconButton
            label={mode === 'week' ? '반복 시간표 추가' : '일정 추가'}
            className="bg-accent text-bg"
            onClick={() => (mode === 'week' ? setBlockEdit({ weekday }) : setEventEdit({ date: selected }))}
          >
            <PlusIcon />
          </IconButton>
        }
      />
      <div className="gutter pb-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'day', label: '날짜별' },
            { value: 'week', label: '매주 반복' },
          ]}
        />
      </div>
      <div className="gutter space-y-3">
        {mode === 'day' ? (
          <DayView today={today} selected={selected} onSelect={setSelected} onBlock={setBlockEdit} onEvent={setEventEdit} />
        ) : (
          <WeeklyView weekday={weekday} onWeekday={setWeekday} onBlock={setBlockEdit} />
        )}
      </div>
      {blockEdit && <BlockSheet initial={blockEdit} onClose={() => setBlockEdit(null)} />}
      {eventEdit && <EventSheet initial={eventEdit} onClose={() => setEventEdit(null)} />}
    </>
  )
}

function DayView({
  today,
  selected,
  onSelect,
  onBlock,
  onEvent,
}: {
  today: string
  selected: string
  onSelect: (k: string) => void
  onBlock: (b: TimetableBlock) => void
  onEvent: (e: Partial<PlanEvent>) => void
}) {
  const agenda = useAgenda(selected)
  const weekStart = startOfWeek(fromKey(selected), { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => toKey(addDays(weekStart, i)))
  const eventDays = useLiveQuery(async () => new Set(await db.events.where('date').between(days[0], days[6], true, true).keys()), [days[0]])
  const upcoming = useLiveQuery(() => db.events.where('date').between(shiftKey(today, 1), shiftKey(today, 60), true, true).sortBy('date'), [today])

  return (
    <div className="board">
      <Card className="!px-2 !py-3">
        <div className="flex items-center justify-between px-1 mb-1">
          <IconButton label="이전 주" onClick={() => onSelect(shiftKey(selected, -7))}>
            <ChevronLeft />
          </IconButton>
          <button type="button" onClick={() => onSelect(today)} className="text-[17px] font-bold h-11">
            {fmt(days[0], 'yyyy년 M월')}
          </button>
          <IconButton label="다음 주" onClick={() => onSelect(shiftKey(selected, 7))}>
            <ChevronRight />
          </IconButton>
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const isSel = d === selected
            const wd = fromKey(d).getDay()
            return (
              <button key={d} type="button" onClick={() => onSelect(d)} aria-label={fmt(d, 'M월 d일 EEEE')} aria-pressed={isSel} className="flex flex-col items-center gap-1 py-1">
                <span className={`text-[15px] font-semibold ${wd === 0 ? 'text-danger' : 'text-ink-3'}`}>{WEEKDAYS[wd]}</span>
                <span className={`size-10 grid place-items-center rounded-full text-[17px] font-semibold tabular-nums ${isSel ? 'bg-accent text-bg' : d === today ? 'text-accent' : ''}`}>
                  {fromKey(d).getDate()}
                </span>
                <span className={`size-1.5 rounded-full ${eventDays?.has(d) ? 'bg-gold' : 'bg-transparent'}`} />
              </button>
            )
          })}
        </div>
      </Card>
      <Card>
        <SectionTitle>{friendlyDate(selected)}</SectionTitle>
        <AgendaList items={agenda} now={selected === today ? nowHHmm() : undefined} onOpen={(it) => (it.kind === 'block' ? onBlock(it.block) : onEvent(it.event))} />
      </Card>
      {!!upcoming?.length && (
        <Card>
          <SectionTitle>다가오는 일정</SectionTitle>
          <ul className="divide-y divide-line">
            {upcoming.slice(0, 20).map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onEvent(e)} className="w-full flex items-center gap-3 py-3 text-left">
                  <span className="w-1 self-stretch rounded-full" style={{ background: e.color }} />
                  <span className="flex-1 min-w-0 text-[17px] truncate">{e.title}</span>
                  <span className="text-[15px] text-ink-3 tabular-nums">
                    {fmt(e.date, 'M/d')}
                    {e.start && ` ${shortTime(e.start)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

/** 요일을 고르면 그 요일에 매주 반복되는 시간표를 보여준다 */
function WeeklyView({ weekday, onWeekday, onBlock }: { weekday: number; onWeekday: (d: number) => void; onBlock: (b: TimetableBlock) => void }) {
  const blocks = useLiveQuery(() => db.timetable.toArray(), [])
  const has = new Set(blocks?.map((b) => b.weekday))
  const items: AgendaItem[] = (blocks ?? [])
    .filter((b) => b.weekday === weekday)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((b) => ({ kind: 'block', key: `b${b.id}`, title: b.title, start: b.start, end: b.end, color: b.color, block: b }))

  return (
    <>
      <div className="flex gap-1.5">
        {WEEK_ORDER.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onWeekday(d)}
            aria-pressed={d === weekday}
            className={`relative flex-1 h-12 rounded-xl text-[17px] font-semibold ${d === weekday ? 'bg-accent text-bg' : `bg-card ${d === 0 ? 'text-danger' : 'text-ink-2'}`}`}
          >
            {WEEKDAYS[d]}
            {has.has(d) && d !== weekday && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>
      {items.length > 0 && (
        <Card>
          <AgendaList items={items} onOpen={(it) => it.kind === 'block' && onBlock(it.block)} />
        </Card>
      )}
    </>
  )
}
