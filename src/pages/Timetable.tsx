import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PlanEvent, type TimetableBlock } from '../db'
import { WEEKDAYS, WEEK_ORDER, fmt, friendlyDate, fromKey, nowHHmm, shiftKey, shortTime } from '../lib/date'
import { type AgendaItem, useAgenda, useNow } from '../lib/hooks'
import { Card, IconButton, PageHeader, SectionTitle, Segmented } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { AgendaList } from '../components/AgendaList'
import { MonthCalendar } from '../components/MonthCalendar'
import { AnimatedList, FlashLi } from '../components/Animated'
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
  const upcoming = useLiveQuery(() => db.events.where('date').between(shiftKey(today, 1), shiftKey(today, 60), true, true).sortBy('date'), [today])

  return (
    <div className="board">
      <MonthCalendar today={today} selected={selected} onSelect={onSelect} onAdd={(d) => onEvent({ date: d })} />
      <Card>
        <SectionTitle>{friendlyDate(selected)}</SectionTitle>
        <AgendaList items={agenda} now={selected === today ? nowHHmm() : undefined} onOpen={(it) => (it.kind === 'block' ? onBlock(it.block) : onEvent(it.event))} />
      </Card>
      {!!upcoming?.length && (
        <Card>
          <SectionTitle>다가오는 일정</SectionTitle>
          <AnimatedList className="divide-y divide-line">
            {upcoming.slice(0, 20).map((e) => (
              <FlashLi key={e.id} signal={`${e.title}|${e.date}|${e.start}|${e.color}`}>
                <button type="button" onClick={() => onEvent(e)} className="w-full flex items-center gap-3 py-3 text-left">
                  <span className="w-1 self-stretch rounded-full" style={{ background: e.color }} />
                  <span className="flex-1 min-w-0 text-[17px] truncate">{e.title}</span>
                  <span className="text-[15px] text-ink-3 tabular-nums">
                    {fmt(e.date, 'M/d')}
                    {e.start && ` ${shortTime(e.start)}`}
                  </span>
                </button>
              </FlashLi>
            ))}
          </AnimatedList>
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
