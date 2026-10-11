import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { db, type PlanEvent } from '../db'
import { WEEKDAYS, WEEK_ORDER, fmt, fromKey, toKey } from '../lib/date'
import { Card, IconButton } from './ui'
import { ChevronLeft, ChevronRight } from './icons'

const MAX_PER_DAY = 2

/** 한 달 달력. 날짜 칸마다 그날 일정 제목을 색 막대로 짧게 보여준다 (넘치면 +n). */
export function MonthCalendar({ today, selected, onSelect }: { today: string; selected: string; onSelect: (k: string) => void }) {
  const month = startOfMonth(fromKey(selected))
  const gridStart = startOfWeek(month, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days: string[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(toKey(d))
  const monthKey = toKey(month).slice(0, 7)

  const byDate = useLiveQuery(async () => {
    const events = await db.events.where('date').between(days[0], days[days.length - 1], true, true).toArray()
    const map = new Map<string, PlanEvent[]>()
    for (const e of events.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return map
  }, [days[0], days[days.length - 1]])

  // 다른 달로 넘길 때는 같은 날짜(없으면 그 달 마지막 날)를 고른다
  const moveMonth = (n: number) => onSelect(toKey(addMonths(fromKey(selected), n)))

  return (
    <Card className="span-all !px-2 !py-3">
      <div className="flex items-center justify-between px-1 mb-1">
        <IconButton label="이전 달" onClick={() => moveMonth(-1)}>
          <ChevronLeft />
        </IconButton>
        <button type="button" onClick={() => onSelect(today)} className="text-[17px] font-bold h-11 px-2">
          {fmt(toKey(month), 'yyyy년 M월')}
        </button>
        <IconButton label="다음 달" onClick={() => moveMonth(1)}>
          <ChevronRight />
        </IconButton>
      </div>
      <div className="grid grid-cols-7">
        {WEEK_ORDER.map((wd) => (
          <span key={wd} className={`text-center text-[15px] font-semibold pb-1.5 ${wd === 0 ? 'text-danger' : 'text-ink-3'}`}>
            {WEEKDAYS[wd]}
          </span>
        ))}
        {days.map((d) => {
          const inMonth = d.startsWith(monthKey)
          const isSel = d === selected
          const isToday = d === today
          const events = byDate?.get(d) ?? []
          const more = events.length - MAX_PER_DAY
          const label = `${fmt(d, 'M월 d일 EEEE')}${events.length ? `, 일정 ${events.length}개` : ''}`
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-label={label}
              aria-pressed={isSel}
              className={`min-h-[76px] md:min-h-[96px] flex flex-col items-stretch gap-0.5 px-0.5 pt-1 pb-1.5 border-t border-line text-left min-w-0 ${inMonth ? '' : 'opacity-35'} ${isSel ? 'bg-accent-soft rounded-lg' : ''}`}
            >
              <span
                className={`self-center size-8 grid place-items-center rounded-full text-[16px] font-semibold tabular-nums ${isToday ? 'bg-accent text-bg' : fromKey(d).getDay() === 0 ? 'text-danger' : ''}`}
              >
                {fromKey(d).getDate()}
              </span>
              {events.slice(0, MAX_PER_DAY).map((e) => (
                <span key={e.id} className="block rounded-[5px] px-1 text-[15px] leading-[20px] font-medium text-white whitespace-nowrap overflow-hidden" style={{ background: e.color }}>
                  {e.title}
                </span>
              ))}
              {more > 0 && <span className="text-[15px] leading-[20px] font-semibold text-ink-3 text-center">+{more}</span>}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
