import { useLayoutEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { db } from '../db'
import { WEEKDAYS, WEEK_ORDER, fmt, fromKey, toKey } from '../lib/date'
import { Card, IconButton } from './ui'
import { ChevronLeft, ChevronRight } from './icons'
import { CategoryLegend } from './Categories'

const MAX_PER_DAY = 6
const DOUBLE_TAP_MS = 400
const LEAVE_MS = 170

type CalItem = { key: string; title: string; color: string; start?: string; repeat: boolean }

/**
 * 한 달 달력. 날짜 칸마다 그날 일정을 카테고리 색 점으로만 보여주고, 아래에 색 → 카테고리 설명을 단다.
 * 날짜 일정은 꽉 찬 점, 매주 반복 시간표는 테두리만 있는 점.
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
  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; dx: number; at: number; horizontal: boolean | null } | null>(null)
  const leaving = useRef(false)

  // 달이 바뀐 방향(다음 달 → 오른쪽에서, 이전 달 → 왼쪽에서)으로 살짝 밀려 들어오게 한다.
  // 일정을 다시 읽어 와 다시 그려져도 애니메이션이 끊기지 않도록 방향을 state 로 들고 있는다.
  const prevMonth = useRef(monthKey)
  const [slide, setSlide] = useState('')
  useLayoutEffect(() => {
    if (monthKey === prevMonth.current) return
    setSlide(monthKey > prevMonth.current ? 'animate-month-next' : 'animate-month-prev')
    prevMonth.current = monthKey
  }, [monthKey])

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

  /** 지금 달을 옆으로 살짝 밀어 내보낸 뒤 달을 바꾼다 (새 달은 반대쪽에서 미끄러져 들어온다) */
  function goMonth(n: number) {
    const el = gridRef.current
    if (leaving.current) return
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return moveMonth(n)
    leaving.current = true
    el.style.transition = `transform ${LEAVE_MS}ms cubic-bezier(0.4, 0, 1, 1), opacity ${LEAVE_MS}ms ease-in`
    el.style.transform = `translateX(${n > 0 ? -35 : 35}%)`
    el.style.opacity = '0'
    setTimeout(() => {
      leaving.current = false
      moveMonth(n)
    }, LEAVE_MS - 10)
  }

  // 손가락을 따라 달력이 움직이고, 놓으면 넘어가거나 제자리로 돌아온다
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    drag.current = { x: t.clientX, y: t.clientY, dx: 0, at: Date.now(), horizontal: null }
    if (gridRef.current) gridRef.current.style.transition = 'none'
  }
  function onTouchMove(e: React.TouchEvent) {
    const d = drag.current
    const el = gridRef.current
    if (!d || !el || leaving.current) return
    const dx = e.touches[0].clientX - d.x
    const dy = e.touches[0].clientY - d.y
    if (d.horizontal === null && Math.hypot(dx, dy) > 8) d.horizontal = Math.abs(dx) > Math.abs(dy)
    if (!d.horizontal) return
    d.dx = dx
    el.style.transform = `translateX(${dx}px)`
    el.style.opacity = String(1 - Math.min(Math.abs(dx) / el.offsetWidth, 1) * 0.6)
  }
  function onTouchEnd() {
    const d = drag.current
    const el = gridRef.current
    drag.current = null
    if (!d?.horizontal || !el) return
    const speed = Math.abs(d.dx) / Math.max(Date.now() - d.at, 1) // px/ms
    if (Math.abs(d.dx) > el.offsetWidth * 0.18 || (speed > 0.45 && Math.abs(d.dx) > 24)) goMonth(d.dx < 0 ? 1 : -1)
    else {
      el.style.transition = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease-out'
      el.style.transform = ''
      el.style.opacity = ''
    }
  }

  return (
    <Card className="span-all !px-1 md:!px-2 !py-3">
      <div className="flex items-center justify-between px-1 mb-1">
        <IconButton label="이전 달" onClick={() => goMonth(-1)}>
          <ChevronLeft />
        </IconButton>
        <button type="button" onClick={() => onSelect(today)} className="text-[17px] font-bold h-11 px-2">
          {fmt(toKey(month), 'yyyy년 M월')}
        </button>
        <IconButton label="다음 달" onClick={() => goMonth(1)}>
          <ChevronRight />
        </IconButton>
      </div>
      <div className="grid grid-cols-7">
        {WEEK_ORDER.map((wd) => (
          <span key={wd} className={`text-center text-[15px] font-semibold pb-1.5 ${wd === 0 ? 'text-danger' : 'text-ink-3'}`}>
            {WEEKDAYS[wd]}
          </span>
        ))}
      </div>
      {/* 좌우로 밀어서 달 넘기기 (세로 스크롤은 그대로) */}
      <div className="overflow-hidden touch-pan-y" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <div ref={gridRef} key={monthKey} className={`grid grid-cols-7 will-change-transform ${slide}`}>
        {days.map((d) => {
          const inMonth = d.startsWith(monthKey)
          const isSel = d === selected
          const isToday = d === today
          const items = itemsOf(d)
          return (
            <button
              key={d}
              type="button"
              onClick={() => tap(d)}
              aria-label={`${fmt(d, 'M월 d일 EEEE')}${items.length ? `, ${items.map((i) => i.title).join(', ')}` : ''}`}
              aria-pressed={isSel}
              className={`touch-manipulation select-none min-h-[62px] md:min-h-[84px] flex flex-col items-stretch gap-[3px] px-px pt-1 pb-1.5 border-t border-line text-left min-w-0 ${inMonth ? '' : 'opacity-35'} ${isSel ? 'bg-accent-soft rounded-lg' : ''}`}
            >
              <span
                className={`self-center size-8 grid place-items-center rounded-full text-[16px] font-semibold tabular-nums ${isToday ? 'bg-accent text-bg' : fromKey(d).getDay() === 0 ? 'text-danger' : ''}`}
              >
                {fromKey(d).getDate()}
              </span>
              {items.length > 0 && (
                <span className="flex flex-wrap justify-center gap-[4px] px-1 pt-0.5">
                  {items.slice(0, MAX_PER_DAY).map((it) => (
                    <span
                      key={it.key}
                      className="size-[9px] md:size-[11px] rounded-full"
                      // 날짜 일정은 꽉 찬 점, 매주 반복 시간표는 테두리만 있는 점
                      style={it.repeat ? { boxShadow: `inset 0 0 0 2px ${it.color}` } : { background: it.color }}
                    />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
      </div>
      <CategoryLegend colors={new Set(days.filter((d) => d.startsWith(monthKey)).flatMap((d) => itemsOf(d).map((i) => i.color)))} />
    </Card>
  )
}
