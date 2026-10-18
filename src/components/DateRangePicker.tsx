import { useState } from 'react'
import { addDays, addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { weekdayShort, WEEK_ORDER, fmt, fromKey, toKey, todayKey } from '../lib/date'
import { IconButton } from './ui'
import { ChevronLeft, ChevronRight } from './icons'
import { t } from '../lib/i18n'

/**
 * 입력 창 안의 작은 달력. 한 번 탭하면 시작 날, 이어서 한 번 더 탭하면 마지막 날.
 * 시작보다 앞선 날을 누르면 그 날이 새 시작 날, 같은 날을 다시 누르면 하루짜리.
 * awaitEnd: 처음부터 '마지막 날'을 고르는 단계로 시작할지 (새 일정은 시작 날이 이미 정해져 있으므로 true)
 */
export function DateRangePicker({ start, end, onChange, awaitEnd = false }: { start?: string; end?: string; onChange: (r: { date: string; endDate?: string }) => void; awaitEnd?: boolean }) {
  const today = todayKey()
  const [view, setView] = useState(() => startOfMonth(fromKey(start ?? today)))
  const [waiting, setWaiting] = useState(awaitEnd && !end)

  const gridStart = startOfWeek(view, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(endOfMonth(view), { weekStartsOn: 0 })
  const days: string[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(toKey(d))
  const monthKey = toKey(view).slice(0, 7)
  const last = end ?? start

  function pick(d: string) {
    if (waiting && start) {
      if (d < start) return onChange({ date: d }) // 더 앞선 날 → 새 시작 날, 계속 마지막 날 고르기
      setWaiting(false)
      return onChange({ date: start, endDate: d > start ? d : undefined })
    }
    setWaiting(true)
    onChange({ date: d })
  }

  const label = (k: string) => fmt(k, 'M월 d일 (E)')
  return (
    <div className="bg-card-2 rounded-2xl p-2">
      <p className="text-[17px] font-semibold text-center pt-1 pb-1.5">
        {start ? (end && end > start ? `${label(start)} ~ ${label(end)}` : label(start)) : t('날짜를 고르세요', 'Pick a date')}
      </p>
      <div className="flex items-center justify-between">
        <IconButton label={t('이전 달', 'Previous month')} onClick={() => setView((v) => addMonths(v, -1))}>
          <ChevronLeft />
        </IconButton>
        <span className="text-[16px] font-bold">{fmt(toKey(view), 'yyyy년 M월')}</span>
        <IconButton label={t('다음 달', 'Next month')} onClick={() => setView((v) => addMonths(v, 1))}>
          <ChevronRight />
        </IconButton>
      </div>
      <div className="grid grid-cols-7">
        {WEEK_ORDER.map((wd) => (
          <span key={wd} className={`text-center text-[15px] font-semibold py-1 ${wd === 0 ? 'text-danger' : 'text-ink-3'}`}>
            {weekdayShort(wd)}
          </span>
        ))}
        {days.map((d) => {
          const wd = fromKey(d).getDay()
          const isStart = d === start
          const isEnd = d === last
          const inRange = !!start && !!last && d >= start && d <= last
          const multi = !!end && end > start!
          // 기간은 한 줄로 이어진 띠로, 시작·끝 날과 주의 양 끝은 둥글게
          const band = inRange && multi ? `bg-accent-soft ${isStart || wd === 0 ? 'rounded-l-full' : ''} ${isEnd || wd === 6 ? 'rounded-r-full' : ''}` : ''
          return (
            <button
              key={d}
              type="button"
              onClick={() => pick(d)}
              aria-label={label(d)}
              aria-pressed={inRange}
              className={`h-11 grid place-items-center touch-manipulation ${band} ${d.startsWith(monthKey) ? '' : 'opacity-35'}`}
            >
              <span
                className={`size-10 grid place-items-center rounded-full text-[16px] font-semibold tabular-nums ${
                  isStart || isEnd ? 'bg-accent text-bg' : d === today ? 'text-accent' : wd === 0 ? 'text-danger' : ''
                }`}
              >
                {fromKey(d).getDate()}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
