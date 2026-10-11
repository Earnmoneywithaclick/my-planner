import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, startOfWeek } from 'date-fns'
import { db, type PlanEvent, type TimetableBlock } from '../db'
import { WEEKDAYS, WEEK_ORDER, fmt, friendlyDate, fromKey, nowHHmm, shiftKey, toKey } from '../lib/date'
import { useAgenda, useNow } from '../lib/hooks'
import { Card, Empty, IconButton, PageHeader, SectionTitle, Segmented } from '../components/ui'
import { ChevronLeft, ChevronRight, PlusIcon } from '../components/icons'
import { AgendaList } from '../components/AgendaList'
import { BlockSheet, EventSheet } from '../components/ScheduleSheets'

type Mode = 'week' | 'day'

export default function Timetable() {
  const { today } = useNow()
  const [mode, setMode] = useState<Mode>('day')
  const [selected, setSelected] = useState(today)
  const [blockEdit, setBlockEdit] = useState<Partial<TimetableBlock> | null>(null)
  const [eventEdit, setEventEdit] = useState<Partial<PlanEvent> | null>(null)

  return (
    <>
      <PageHeader
        title="시간표"
        right={
          <IconButton
            label={mode === 'week' ? '시간표 추가' : '일정 추가'}
            className="bg-accent text-bg"
            onClick={() => (mode === 'week' ? setBlockEdit({ weekday: fromKey(selected).getDay() }) : setEventEdit({ date: selected }))}
          >
            <PlusIcon />
          </IconButton>
        }
      />
      <div className="px-4 pb-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'day', label: '날짜별 일정' },
            { value: 'week', label: '주간 시간표' },
          ]}
        />
      </div>
      <div className="px-4 space-y-3">
        {mode === 'day' ? (
          <DayView today={today} selected={selected} onSelect={setSelected} onBlock={setBlockEdit} onEvent={setEventEdit} />
        ) : (
          <WeekGrid today={today} onBlock={setBlockEdit} />
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
  const upcoming = useLiveQuery(
    () =>
      db.events
        .where('date')
        .between(shiftKey(today, 1), shiftKey(today, 60), true, true)
        .sortBy('date'),
    [today],
  )

  return (
    <>
      <Card className="!px-2 !py-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <IconButton label="이전 주" onClick={() => onSelect(shiftKey(selected, -7))}>
            <ChevronLeft width={20} height={20} />
          </IconButton>
          <button type="button" onClick={() => onSelect(today)} className="text-[15px] font-bold">
            {fmt(days[0], 'yyyy년 M월')}
            {selected !== today && <span className="ml-2 text-[13px] text-accent">오늘로</span>}
          </button>
          <IconButton label="다음 주" onClick={() => onSelect(shiftKey(selected, 7))}>
            <ChevronRight width={20} height={20} />
          </IconButton>
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const isSel = d === selected
            const wd = fromKey(d).getDay()
            return (
              <button key={d} type="button" onClick={() => onSelect(d)} aria-label={fmt(d, 'M월 d일 EEEE')} aria-pressed={isSel} className="flex flex-col items-center gap-1 py-1">
                <span className={`text-[12px] font-semibold ${wd === 0 ? 'text-danger' : 'text-ink-3'}`}>{WEEKDAYS[wd]}</span>
                <span
                  className={`size-9 grid place-items-center rounded-full text-[16px] font-semibold tabular-nums ${isSel ? 'bg-accent text-bg' : d === today ? 'text-accent' : ''}`}
                >
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
        <AgendaList
          items={agenda}
          now={selected === today ? nowHHmm() : undefined}
          emptyText="일정이 없어요. + 로 추가해 보세요"
          onOpen={(it) => (it.kind === 'block' ? onBlock(it.block) : onEvent(it.event))}
        />
      </Card>
      <Card>
        <SectionTitle>다가오는 일정</SectionTitle>
        {upcoming && upcoming.length === 0 && <Empty>앞으로 60일 안에 잡힌 일정이 없어요</Empty>}
        <ul className="divide-y divide-line">
          {upcoming?.slice(0, 20).map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onEvent(e)} className="w-full flex items-center gap-3 py-2.5 text-left">
                <span className="w-1 self-stretch rounded-full" style={{ background: e.color }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] truncate">{e.title}</span>
                  <span className="block text-[13px] text-ink-3">
                    {fmt(e.date, 'M월 d일 (E)')}
                    {e.start && ` · ${e.start}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

const HOUR_PX = 44
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** 월~일 7칸 반복 시간표 */
function WeekGrid({ today, onBlock }: { today: string; onBlock: (b: TimetableBlock) => void }) {
  const blocks = useLiveQuery(() => db.timetable.toArray(), [])
  if (!blocks) return null
  if (blocks.length === 0)
    return (
      <Card>
        <Empty>매주 반복되는 일정(수업, 운동, 모임 등)을 + 로 추가해 보세요</Empty>
      </Card>
    )

  const firstHour = Math.min(7, ...blocks.map((b) => Math.floor(toMin(b.start) / 60)))
  const lastHour = Math.max(21, ...blocks.map((b) => Math.ceil(toMin(b.end) / 60)))
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i)
  const todayWd = fromKey(today).getDay()

  return (
    <Card className="!p-2">
      <div className="grid grid-cols-[28px_repeat(7,1fr)] sticky top-0">
        <span />
        {WEEK_ORDER.map((d) => (
          <span key={d} className={`text-center text-[12px] font-bold py-1.5 ${d === todayWd ? 'text-accent' : d === 0 ? 'text-danger' : 'text-ink-3'}`}>
            {WEEKDAYS[d]}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-[28px_repeat(7,1fr)] relative" style={{ height: hours.length * HOUR_PX }}>
        <div className="relative">
          {hours.map((h, i) => (
            <span key={h} className="absolute right-1 text-[10px] text-ink-3 tabular-nums -translate-y-1/2" style={{ top: i * HOUR_PX }}>
              {i > 0 && h}
            </span>
          ))}
        </div>
        {WEEK_ORDER.map((d) => (
          <div key={d} className={`relative border-l border-line ${d === todayWd ? 'bg-accent-soft/40' : ''}`}>
            {hours.map((h, i) => (
              <span key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * HOUR_PX }} />
            ))}
            {blocks
              .filter((b) => b.weekday === d)
              .map((b) => {
                const top = ((toMin(b.start) - firstHour * 60) / 60) * HOUR_PX
                const height = Math.max(((toMin(b.end) - toMin(b.start)) / 60) * HOUR_PX, 18)
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onBlock(b)}
                    className="absolute inset-x-[2px] rounded-md px-1 py-0.5 text-left overflow-hidden text-white"
                    style={{ top, height, background: b.color }}
                  >
                    <span className="block text-[11px] font-semibold leading-tight break-all">{b.title}</span>
                  </button>
                )
              })}
          </div>
        ))}
      </div>
    </Card>
  )
}
