import { useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { db } from '../db'
import { WEEKDAYS, WEEK_ORDER, fmt, fromKey, toKey } from '../lib/date'
import { Card, IconButton } from './ui'
import { ChevronLeft, ChevronRight } from './icons'

const MAX_PER_DAY = 3
const DOUBLE_TAP_MS = 400

type CalItem = { key: string; title: string; color: string; start?: string; repeat: boolean }

/**
 * 한 달 달력. 날짜 칸마다 그날 일정 제목을 바로 보여준다 (칸이 좁으면 두 줄까지 접어서).
 * 날짜 일정은 색으로 채운 막대, 매주 반복 시간표는 왼쪽 색 줄만 있는 막대. 넘치면 +n.
 * 한 번 탭하면 그 날짜 선택, 같은 날짜를 빠르게 두 번 탭하면 일정 추가.
 */
export function MonthCalendar({ today, selected, onSelect, onAdd }: { today: string; selected: string; onSelect: (k: string) => void; onAdd: (k: string) => void }) {
  const month = startOfMonth(fromKey(selected))
  const gridStart = startOfWeek(month, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days: string[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(toKey(d))
  const monthKey = toKey(month).slice(0, 7)
  const lastTap = useRef<{ day: string; at: number } | null>(null)

  const data = useLiveQuery(async () => {
    const [events, blocks] = await Promise.all([db.events.where('date').between(days[0], days[days.length - 1], true, true).toArray(), db.timetable.toArray()])
    const byDate = new Map<string, CalItem[]>()
    for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), { key: e.id, title: e.title, color: e.color, start: e.start, repeat: false }])
    const byWeekday = new Map<number, CalItem[]>()
    for (const b of blocks) byWeekday.set(b.weekday, [...(byWeekday.get(b.weekday) ?? []), { key: b.id, title: b.title, color: b.color, start: b.start, repeat: true }])
    return { byDate, byWeekday }
  }, [days[0], days[days.length - 1]])

  const itemsOf = (d: string) => {
    const byTime = (a: CalItem, b: CalItem) => (a.start ?? '').localeCompare(b.start ?? '')
    // 날짜에 잡은 일정이 먼저, 그다음 매주 반복 시간표
    return [...(data?.byDate.get(d) ?? []).sort(byTime), ...(data?.byWeekday.get(fromKey(d).getDay()) ?? []).sort(byTime)]
  }

  function tap(d: string) {
    const now = Date.now()
    if (lastTap.current?.day === d && now - lastTap.current.at < DOUBLE_TAP_MS) {
      lastTap.current = null
      onAdd(d)
    } else {
      lastTap.current = { day: d, at: now }
      onSelect(d)
    }
  }

  // 다른 달로 넘길 때는 같은 날짜(없으면 그 달 마지막 날)를 고른다
  const moveMonth = (n: number) => onSelect(toKey(addMonths(fromKey(selected), n)))

  return (
    <Card className="span-all !px-1 md:!px-2 !py-3">
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
          const items = itemsOf(d)
          const more = items.length - MAX_PER_DAY
          return (
            <button
              key={d}
              type="button"
              onClick={() => tap(d)}
              aria-label={`${fmt(d, 'M월 d일 EEEE')}${items.length ? `, ${items.map((i) => i.title).join(', ')}` : ''}`}
              aria-pressed={isSel}
              className={`touch-manipulation select-none min-h-[84px] md:min-h-[110px] flex flex-col items-stretch gap-[3px] px-px pt-1 pb-1.5 border-t border-line text-left min-w-0 ${inMonth ? '' : 'opacity-35'} ${isSel ? 'bg-accent-soft rounded-lg' : ''}`}
            >
              <span
                className={`self-center size-8 grid place-items-center rounded-full text-[16px] font-semibold tabular-nums ${isToday ? 'bg-accent text-bg' : fromKey(d).getDay() === 0 ? 'text-danger' : ''}`}
              >
                {fromKey(d).getDate()}
              </span>
              {items.slice(0, MAX_PER_DAY).map((it) =>
                it.repeat ? (
                  <span key={it.key} className="block rounded-[4px] pl-[3px] pr-[1px] text-[15px] leading-[18px] font-medium text-ink-2 bg-card-2 tracking-[-0.06em] [word-break:keep-all] [overflow-wrap:anywhere] line-clamp-2" style={{ borderLeft: `3px solid ${it.color}` }}>
                    {it.title}
                  </span>
                ) : (
                  <span key={it.key} className="block rounded-[4px] px-px text-[15px] leading-[18px] font-semibold text-white tracking-[-0.06em] [word-break:keep-all] [overflow-wrap:anywhere] line-clamp-2" style={{ background: it.color }}>
                    {it.title}
                  </span>
                ),
              )}
              {more > 0 && <span className="text-[15px] leading-[18px] font-semibold text-ink-3 text-center">+{more}</span>}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
