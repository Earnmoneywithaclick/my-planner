import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PlanEvent, type TimetableBlock } from '../db'
import { weekdayShort, WEEK_ORDER, fmt, friendlyDate, fromKey, nowHHmm, shiftKey, shortTime } from '../lib/date'
import { type AgendaItem, useAgenda, useNow, toggleAgendaDone } from '../lib/hooks'
import { Button, Card, IconButton, PageHeader, SectionTitle, Segmented } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { AgendaList } from '../components/AgendaList'
import { MonthCalendar } from '../components/MonthCalendar'
import { AnimatedList, FlashLi } from '../components/Animated'
import { BlockSheet, EventSheet } from '../components/ScheduleSheets'
import { t } from '../lib/i18n'

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
        title={t('시간표', 'Schedule')}
        right={
          <IconButton
            label={mode === 'week' ? t('반복 일정 만들기', 'New repeating item') : t('일정 추가', 'Add event')}
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
            { value: 'day', label: t('날짜별', 'By date') },
            { value: 'week', label: t('반복', 'Repeating') },
          ]}
        />
      </div>
      <div className="gutter space-y-3">
        {mode === 'day' ? (
          <DayView today={today} selected={selected} onSelect={setSelected} onBlock={setBlockEdit} onEvent={setEventEdit} />
        ) : (
          <RepeatView weekday={weekday} onWeekday={setWeekday} onBlock={setBlockEdit} />
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
  const upcoming = useLiveQuery(
    () =>
      db.events
        .where('date')
        .belowOrEqual(shiftKey(today, 60))
        .filter((e) => (e.endDate ?? e.date) > today)
        .sortBy('date'),
    [today],
  )

  return (
    <div className="board">
      <MonthCalendar today={today} selected={selected} onSelect={onSelect} onAdd={(d) => onEvent({ date: d })} />
      <Card>
        <SectionTitle>{friendlyDate(selected)}</SectionTitle>
        <AgendaList items={agenda} now={selected === today ? nowHHmm() : undefined} onOpen={(it) => (it.kind === 'block' ? onBlock(it.block) : onEvent(it.event))} onToggle={(it) => toggleAgendaDone(it, selected)} />
      </Card>
      {!!upcoming?.length && (
        <Card>
          <SectionTitle>{t('다가오는 일정', 'Upcoming')}</SectionTitle>
          <AnimatedList className="divide-y divide-line">
            {upcoming.slice(0, 20).map((e) => (
              <FlashLi key={e.id} signal={`${e.title}|${e.date}|${e.endDate}|${e.start}|${e.color}`}>
                <button type="button" onClick={() => onEvent(e)} className="w-full flex items-center gap-3 py-3 text-left">
                  <span className="w-1 self-stretch rounded-full" style={{ background: e.color }} />
                  <span className="flex-1 min-w-0 text-[17px] truncate">{e.title}</span>
                  <span className="text-[15px] text-ink-3 tabular-nums">
                    {fmt(e.date, 'M/d')}
                    {e.endDate && e.endDate > e.date ? `–${fmt(e.endDate, 'M/d')}` : e.start && ` ${shortTime(e.start)}`}
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

/** 반복 일정: 요일을 고르면 그 요일에 매주 반복되는 일정, 아래에는 매달 반복되는 일정 */
function RepeatView({ weekday, onWeekday, onBlock }: { weekday: number; onWeekday: (d: number) => void; onBlock: (b: Partial<TimetableBlock>) => void }) {
  const blocks = useLiveQuery(() => db.timetable.toArray(), [])
  const has = new Set(blocks?.map((b) => b.weekday))
  const items: AgendaItem[] = (blocks ?? [])
    .filter((b) => b.weekday === weekday)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((b) => ({ kind: 'block', key: `b${b.id}`, title: b.title, start: b.start, end: b.end, color: b.color, block: b }))
  const monthly = (blocks ?? []).filter((b) => b.weekday === -1).sort((a, b) => (a.monthDay ?? 0) - (b.monthDay ?? 0) || a.start.localeCompare(b.start))

  return (
    <>
      <Button variant="soft" className="w-full" onClick={() => onBlock({ weekday })}>
        {t('반복 일정 만들기', 'New repeating item')}
      </Button>
      <div className="flex gap-1.5">
        {WEEK_ORDER.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onWeekday(d)}
            aria-pressed={d === weekday}
            className={`relative flex-1 h-12 rounded-xl text-[17px] font-semibold ${d === weekday ? 'bg-accent text-bg' : `bg-card ${d === 0 ? 'text-danger' : 'text-ink-2'}`}`}
          >
            {weekdayShort(d)}
            {has.has(d) && d !== weekday && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>
      {items.length > 0 && (
        <Card>
          <AgendaList items={items} onOpen={(it) => it.kind === 'block' && onBlock(it.block)} />
        </Card>
      )}
      {monthly.length > 0 && (
        <Card>
          <SectionTitle>{t('매달', 'Monthly')}</SectionTitle>
          <AnimatedList className="space-y-1">
            {monthly.map((b) => (
              <FlashLi key={b.id} signal={`${b.title}|${b.monthDay}|${b.start}|${b.color}`}>
                <button type="button" onClick={() => onBlock(b)} className="w-full px-1 py-2.5 flex items-center gap-3 text-left rounded-xl active:bg-card-2">
                  <span className={`${t('w-[52px]', 'w-[64px]')} shrink-0 text-right text-[16px] font-semibold tabular-nums`}>{t(`${b.monthDay}일`, `Day ${b.monthDay}`)}</span>
                  <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: b.color }} />
                  <span className="min-w-0 flex-1 text-[17px] font-medium leading-snug">{b.title}</span>
                  <span className="shrink-0 text-[16px] text-ink-2 tabular-nums">{shortTime(b.start)}</span>
                </button>
              </FlashLi>
            ))}
          </AnimatedList>
        </Card>
      )}
    </>
  )
}
