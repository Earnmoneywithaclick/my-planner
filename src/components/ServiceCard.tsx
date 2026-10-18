import { useState } from 'react'
import { useLiveQuery, useObservable } from 'dexie-react-hooks'
import { addMonths, endOfMonth, startOfMonth } from 'date-fns'
import { db, dayId, patchDay } from '../db'
import { fmt, fromKey, toKey } from '../lib/date'
import { useChanged } from '../lib/motion'
import { Card, IconButton, Sheet, TextInput } from './ui'
import { BagIcon, ChevronLeft, ChevronRight } from './icons'
import { AnimatedList, FlashLi } from './Animated'
import { t } from '../lib/i18n'

/** 90 → '1시간 30분', 45 → '45분', 0 → '0분' */
export function formatMinutes(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return t(`${m}분`, `${m}m`)
  return m ? t(`${h}시간 ${m}분`, `${h}h ${m}m`) : t(`${h}시간`, `${h}h`)
}

/** 그 날 봉사 시간을 delta 분만큼 더하거나 뺀다 (0 아래로는 내려가지 않음) */
async function addService(date: string, delta: number) {
  const cur = (await db.days.get(dayId(date)))?.serviceMin ?? 0
  await patchDay(date, { serviceMin: Math.max(0, cur + delta) })
}

/** 그 달에 봉사한 날들 (날짜순) */
function useServiceMonth(monthStart: string) {
  const userId = useObservable(db.cloud.currentUser)?.userId
  return useLiveQuery(async () => {
    const end = toKey(endOfMonth(fromKey(monthStart)))
    const days = await db.days.where('date').between(monthStart, end, true, true).toArray()
    const served = days.filter((d) => (d.serviceMin ?? 0) > 0).sort((a, b) => a.date.localeCompare(b.date))
    return { days: served, total: served.reduce((s, d) => s + (d.serviceMin ?? 0), 0) }
  }, [monthStart, userId])
}

/** 15분 단위로 더하고 빼는 버튼들 */
function Steps({ date, withMinus = true }: { date: string; withMinus?: boolean }) {
  const steps: [string, number][] = [
    ...(withMinus ? ([[t('−15분', '−15m'), -15]] as [string, number][]) : []),
    [t('+15분', '+15m'), 15],
    [t('+30분', '+30m'), 30],
    [t('+1시간', '+1h'), 60],
  ]
  return (
    <div className="flex gap-2">
      {steps.map(([label, delta]) => (
        <button
          key={label}
          type="button"
          onClick={() => addService(date, delta)}
          className={`flex-1 h-12 rounded-xl text-[16px] font-semibold active:opacity-70 ${delta < 0 ? 'bg-card-2 text-ink-3' : 'bg-accent-soft text-accent'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** 오늘 화면의 봉사 카드 — 오늘 시간을 더하고, 이번 달 합계를 본다. 누르면 달별 기록(결산). */
export function ServiceCard({ date }: { date: string }) {
  const userId = useObservable(db.cloud.currentUser)?.userId
  const todayMin = useLiveQuery(async () => (await db.days.get(dayId(date)))?.serviceMin ?? 0, [date, userId])
  const month = useServiceMonth(toKey(startOfMonth(fromKey(date))))
  const [open, setOpen] = useState(false)
  const popped = useChanged(todayMin, 400)

  return (
    <Card>
      <button type="button" onClick={() => setOpen(true)} className="w-full flex items-center justify-between min-h-8 mb-2 text-left">
        <span className="flex items-center gap-2">
          <BagIcon width={21} height={21} className="text-accent" />
          <h2 className="text-[17px] font-bold">{t('봉사', 'Ministry')}</h2>
        </span>
        {/* 이번 달 합계 — 누르면 결산 */}
        <span className="flex items-center gap-1 text-[16px] font-semibold text-ink-2 tabular-nums">
          {t('이번 달', 'This month')} {formatMinutes(month?.total ?? 0)}
          <ChevronRight width={18} height={18} className="text-ink-3" />
        </span>
      </button>
      <p className="text-[15px] font-semibold text-ink-3">{t('오늘', 'Today')}</p>
      <p className={`text-[30px] font-bold tabular-nums leading-tight mb-3 ${popped ? 'animate-pop' : ''} ${todayMin ? '' : 'text-ink-3'}`}>{formatMinutes(todayMin ?? 0)}</p>
      <Steps date={date} withMinus={!!todayMin} />
      {open && <ServiceSheet today={date} onClose={() => setOpen(false)} />}
    </Card>
  )
}

/** 달별 봉사 기록과 결산 — 다른 날 시간도 여기서 고친다 */
function ServiceSheet({ today, onClose }: { today: string; onClose: () => void }) {
  const [monthStart, setMonthStart] = useState(() => toKey(startOfMonth(fromKey(today))))
  const [editDate, setEditDate] = useState(today)
  const month = useServiceMonth(monthStart)
  const userId = useObservable(db.cloud.currentUser)?.userId
  const editMin = useLiveQuery(async () => (await db.days.get(dayId(editDate)))?.serviceMin ?? 0, [editDate, userId])
  const move = (n: number) => setMonthStart(toKey(addMonths(fromKey(monthStart), n)))

  return (
    <Sheet open title={t('봉사 기록', 'Ministry log')} onClose={onClose}>
      {/* 달 결산 */}
      <div className="bg-card-2 rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <IconButton label={t('이전 달', 'Previous month')} onClick={() => move(-1)}>
            <ChevronLeft />
          </IconButton>
          <span className="text-[17px] font-bold">{fmt(monthStart, 'yyyy년 M월')}</span>
          <IconButton label={t('다음 달', 'Next month')} onClick={() => move(1)}>
            <ChevronRight />
          </IconButton>
        </div>
        <p className="text-center text-[34px] font-bold tabular-nums leading-tight mt-1">{formatMinutes(month?.total ?? 0)}</p>
        <p className="text-center text-[16px] text-ink-2 mt-1 mb-1">{t(`봉사한 날 ${month?.days.length ?? 0}일`, `${month?.days.length ?? 0} days of ministry`)}</p>
      </div>

      {/* 날짜를 골라 시간 고치기 (깜빡한 날 채우기) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TextInput type="date" aria-label={t('고칠 날짜', 'Date to edit')} value={editDate} onChange={(e) => e.target.value && setEditDate(e.target.value)} />
          <span className="shrink-0 w-[112px] text-right text-[20px] font-bold tabular-nums">{formatMinutes(editMin ?? 0)}</span>
        </div>
        <Steps date={editDate} />
      </div>

      {/* 그 달 날짜별 기록 — 누르면 위에서 고칠 날짜로 */}
      <AnimatedList className="divide-y divide-line">
        {month?.days.map((d) => (
          <FlashLi key={d.id} signal={d.serviceMin}>
            <button type="button" onClick={() => setEditDate(d.date)} className={`w-full flex items-center justify-between py-3 text-left ${d.date === editDate ? 'text-accent' : ''}`}>
              <span className="text-[17px]">{fmt(d.date, 'M월 d일 (E)')}</span>
              <span className="text-[17px] font-semibold tabular-nums">{formatMinutes(d.serviceMin ?? 0)}</span>
            </button>
          </FlashLi>
        ))}
      </AnimatedList>
    </Sheet>
  )
}
