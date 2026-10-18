import { useLayoutEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { db, type PlanEvent } from '../db'
import { weekdayShort, WEEK_ORDER, fmt, fromKey, toKey } from '../lib/date'
import { Card, IconButton } from './ui'
import { ChevronLeft, ChevronRight } from './icons'
import { CategoryLegend } from './Categories'
import { AnimatedSpan } from './Animated'
import { t } from '../lib/i18n'

const MAX_PER_DAY = 6
const MAX_LANES = 3

const isMultiDay = (e: PlanEvent) => !!e.endDate && e.endDate > e.date
const DOUBLE_TAP_MS = 400
const LEAVE_MS = 170

type CalItem = { key: string; title: string; color: string; start?: string }

/**
 * 한 달 달력. 하루짜리 일정은 카테고리 색 점, 며칠 이어지는 일정은 날짜를 가로지르는 색 막대로 보여주고,
 * 아래에 색 → 카테고리 설명을 단다.
 * 매주 반복 시간표는 매번 찍히면 어지러워서 달력에는 넣지 않는다 (날짜를 고르면 아래 목록에는 나온다).
 * 한 번 탭하면 그 날짜 선택, 같은 날짜를 빠르게 두 번 탭하면 일정 추가.
 */
export function MonthCalendar({ today, selected, onSelect, onAdd }: { today: string; selected: string; onSelect: (k: string) => void; onAdd: (k: string) => void }) {
  const month = startOfMonth(fromKey(selected))
  const gridStart = startOfWeek(month, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
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
    const first = days[0]
    const last = days[days.length - 1]
    const events = await db.events.where('date').belowOrEqual(last).filter((e) => (e.endDate ?? e.date) >= first).toArray()
    // 하루짜리 일정은 그날의 점으로
    const byDate = new Map<string, CalItem[]>()
    for (const e of events.filter((e) => !isMultiDay(e))) byDate.set(e.date, [...(byDate.get(e.date) ?? []), { key: e.id, title: e.title, color: e.color, start: e.start }])

    // 며칠 이어지는 일정은 한 주(달력 한 줄)마다 줄(lane)을 정해 막대로 잇는다.
    // 같은 주 안에서는 같은 일정이 늘 같은 높이에 오도록, 겹치지 않는 일정끼리 한 줄을 나눠 쓴다.
    const lanesByDay = new Map<string, (PlanEvent | null)[]>()
    const multi = events.filter(isMultiDay).sort((a, b) => a.date.localeCompare(b.date) || b.endDate!.localeCompare(a.endDate!))
    for (let w = 0; w < days.length; w += 7) {
      const week = days.slice(w, w + 7)
      const lanes: PlanEvent[][] = []
      for (const e of multi) {
        if (e.date > week[6] || e.endDate! < week[0]) continue
        const lane = lanes.find((l) => l[l.length - 1].endDate! < e.date)
        if (lane) lane.push(e)
        else lanes.push([e])
      }
      for (const d of week) lanesByDay.set(d, lanes.slice(0, MAX_LANES).map((l) => l.find((e) => e.date <= d && d <= e.endDate!) ?? null))
    }
    return { byDate, lanesByDay, events }
  }, [days[0], days[days.length - 1]])

  const itemsOf = (d: string) => [...(data?.byDate.get(d) ?? [])].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
  const monthColors = new Set((data?.events ?? []).filter((e) => e.date <= toKey(endOfMonth(month)) && (e.endDate ?? e.date) >= toKey(month)).map((e) => e.color))

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
        <IconButton label={t('이전 달', 'Previous month')} onClick={() => goMonth(-1)}>
          <ChevronLeft />
        </IconButton>
        <button type="button" onClick={() => onSelect(today)} className="text-[17px] font-bold h-11 px-2">
          {fmt(toKey(month), 'yyyy년 M월')}
        </button>
        <IconButton label={t('다음 달', 'Next month')} onClick={() => goMonth(1)}>
          <ChevronRight />
        </IconButton>
      </div>
      <div className="grid grid-cols-7">
        {WEEK_ORDER.map((wd) => (
          <span key={wd} className={`text-center text-[15px] font-semibold pb-1.5 ${wd === 0 ? 'text-danger' : 'text-ink-3'}`}>
            {weekdayShort(wd)}
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
          const lanes = data?.lanesByDay.get(d) ?? []
          const titles = [...lanes.filter(Boolean).map((e) => e!.title), ...items.map((i) => i.title)]
          return (
            <button
              key={d}
              type="button"
              onClick={() => tap(d)}
              aria-label={`${fmt(d, 'M월 d일 EEEE')}${titles.length ? `, ${titles.join(', ')}` : ''}`}
              aria-pressed={isSel}
              className={`touch-manipulation select-none min-h-[62px] md:min-h-[84px] flex flex-col items-stretch gap-[3px] px-px pt-1 pb-1.5 border-t border-line text-left min-w-0 ${inMonth ? '' : 'opacity-35'} ${isSel ? 'bg-accent-soft rounded-lg' : ''}`}
            >
              <span
                className={`self-center size-8 grid place-items-center rounded-full text-[16px] font-semibold tabular-nums ${isToday ? 'bg-accent text-bg' : fromKey(d).getDay() === 0 ? 'text-danger' : ''}`}
              >
                {fromKey(d).getDate()}
              </span>
              {lanes.map((e, i) =>
                e ? (
                  // 막대: 칸 끝까지 이어 붙이고, 시작·마지막 날만 둥글게
                  <span
                    key={`${e.id}-${i}`}
                    className={`block h-[7px] md:h-[9px] -mx-px ${d === e.date ? 'ml-[3px] rounded-l-full' : ''} ${d === e.endDate ? 'mr-[3px] rounded-r-full' : ''}`}
                    style={{ background: e.color }}
                  />
                ) : (
                  <span key={`empty-${i}`} className="block h-[7px] md:h-[9px]" />
                ),
              )}
              <AnimatedSpan className="flex flex-wrap justify-center gap-[4px] px-1 pt-0.5">
                {items.slice(0, MAX_PER_DAY).map((it) => (
                  <span key={it.key} className="size-[9px] md:size-[11px] rounded-full transition-colors" style={{ background: it.color }} />
                ))}
              </AnimatedSpan>
            </button>
          )
        })}
      </div>
      </div>
      <CategoryLegend colors={monthColors} />
    </Card>
  )
}
