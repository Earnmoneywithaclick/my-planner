import { useEffect, useRef, useState } from 'react'
import { useLiveQuery, useObservable } from 'dexie-react-hooks'
import { eachDayOfInterval, endOfMonth, startOfMonth } from 'date-fns'
import { db, dayId, patchDay as patchDaily } from '../db'
import { dailyTextUrl, fromKey, shiftKey, toKey } from '../lib/date'
import { Card, TextArea } from './ui'
import { BookIcon, CheckIcon, ExternalIcon, FlameIcon } from './icons'
import { useChanged } from '../lib/motion'

/** 오늘부터(오늘 아직 안 읽었으면 어제부터) 거꾸로 연속해서 읽은 날 수 */
function streakOf(readDays: Set<string>, today: string) {
  let day = readDays.has(today) ? today : shiftKey(today, -1)
  let n = 0
  while (readDays.has(day)) {
    n++
    day = shiftKey(day, -1)
  }
  return n
}

/** 오늘 했는지 체크하는 버튼 (기도 · 개인 연구) */
function DailyCheck({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  const popped = useChanged(checked, 350)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`flex-1 h-12 rounded-xl font-semibold text-[16px] flex items-center justify-center gap-2 active:opacity-70 ${checked ? 'bg-accent text-bg' : 'bg-card-2 text-ink-2'}`}
    >
      <span className={`size-[22px] rounded-full border-2 grid place-items-center ${checked ? 'border-bg' : 'border-ink-3'} ${popped && checked ? 'animate-pop' : ''}`}>
        {checked && <CheckIcon width={14} height={14} strokeWidth={3} />}
      </span>
      {label}
    </button>
  )
}

export function DailyTextCard({ date }: { date: string }) {
  // id 에 계정이 들어가므로, 로그인이 끝나 계정이 바뀌면 다시 읽는다
  const userId = useObservable(db.cloud.currentUser)?.userId
  const rec = useLiveQuery(() => db.days.get(dayId(date)), [date, userId])
  const readKeys = useLiveQuery(async () => (await db.days.where('read').equals(1).toArray()).map((d) => d.date), [])
  const [memo, setMemo] = useState<string | null>(null)
  const [memoOpen, setMemoOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const readSet = new Set(readKeys ?? [])
  const isRead = rec?.read === 1
  const readPopped = useChanged(isRead, 350)
  const streak = streakOf(readSet, date)
  const memoValue = memo ?? rec?.memo ?? ''

  const monthDays = eachDayOfInterval({ start: startOfMonth(fromKey(date)), end: endOfMonth(fromKey(date)) }).map(toKey)

  function onMemo(v: string) {
    setMemo(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => patchDaily(date, { memo: v }), 500)
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="p-4 bg-gold-soft/60">
        <div className="flex items-center justify-between text-gold">
          <div className="flex items-center gap-2">
            <BookIcon width={22} height={22} />
            <h2 className="text-[17px] font-bold">일용할 성구</h2>
          </div>
          {streak > 0 && (
            <span className="flex items-center gap-1 text-[17px] font-bold tabular-nums" aria-label={`${streak}일 연속`}>
              <FlameIcon width={20} height={20} strokeWidth={2.1} />
              {streak}
            </span>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <a
            href={dailyTextUrl(date)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-12 rounded-xl bg-gold text-bg font-semibold text-[16px] flex items-center justify-center gap-1.5 active:opacity-70"
          >
            성구 열기 <ExternalIcon width={18} height={18} />
          </a>
          <button
            type="button"
            onClick={() => patchDaily(date, { read: isRead ? 0 : 1 })}
            aria-pressed={isRead}
            className={`h-12 px-4 rounded-xl font-semibold text-[16px] flex items-center gap-1.5 active:opacity-70 ${isRead ? 'bg-accent text-bg' : 'bg-card text-ink-2'}`}
          >
            {isRead && <CheckIcon width={18} height={18} strokeWidth={2.6} className={readPopped ? 'animate-pop' : ''} />}
            {isRead ? '읽었어요' : '읽음'}
          </button>
        </div>
        {/* 이번 달 읽은 날 */}
        <div className="flex flex-wrap gap-[6px] mt-3.5" aria-label="이번 달 읽은 날">
          {monthDays.map((d) => (
            <span
              key={d}
              className={`size-[10px] rounded-full ${readSet.has(d) ? 'bg-gold' : d > date ? 'bg-ink-3/15' : 'bg-ink-3/35'} ${d === date ? 'ring-2 ring-gold/50' : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 p-3 border-b border-line">
        <DailyCheck label="기도" checked={rec?.prayed === 1} onToggle={() => patchDaily(date, { prayed: rec?.prayed === 1 ? 0 : 1 })} />
        <DailyCheck label="개인 연구" checked={rec?.study === 1} onToggle={() => patchDaily(date, { study: rec?.study === 1 ? 0 : 1 })} />
      </div>
      {memoOpen || memoValue ? (
        <div className="p-3">
          <TextArea value={memoValue} onChange={(e) => onMemo(e.target.value)} onBlur={() => memo != null && patchDaily(date, { memo })} placeholder="묵상 메모" rows={3} autoFocus={memoOpen && !memoValue} />
        </div>
      ) : (
        <button type="button" onClick={() => setMemoOpen(true)} className="w-full h-12 text-[16px] font-semibold text-ink-3 active:bg-card-2">
          + 묵상 메모
        </button>
      )}
    </Card>
  )
}
