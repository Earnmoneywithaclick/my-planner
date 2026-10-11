import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { eachDayOfInterval, endOfMonth, startOfMonth } from 'date-fns'
import { db, type DailyText } from '../db'
import { dailyTextUrl, fromKey, shiftKey, toKey } from '../lib/date'
import { Card, TextArea } from './ui'
import { BookIcon, CheckIcon, ExternalIcon } from './icons'

async function patchDaily(date: string, patch: Partial<DailyText>) {
  const cur = await db.dailyText.get(date)
  await db.dailyText.put({ date, read: 0, memo: '', ...cur, ...patch, updatedAt: Date.now() })
}

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

export function DailyTextCard({ date }: { date: string }) {
  const rec = useLiveQuery(() => db.dailyText.get(date), [date])
  const readKeys = useLiveQuery(() => db.dailyText.where('read').equals(1).primaryKeys(), [])
  const [memo, setMemo] = useState<string | null>(null)
  const [memoOpen, setMemoOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const readSet = new Set(readKeys ?? [])
  const isRead = rec?.read === 1
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
      <div className="p-4 pb-3 bg-gold-soft/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gold">
            <BookIcon width={20} height={20} />
            <h2 className="text-[15px] font-bold">일용할 성구</h2>
          </div>
          {streak > 0 && <span className="text-[13px] font-bold text-gold">🔥 {streak}일 연속</span>}
        </div>
        <div className="flex gap-2 mt-3">
          <a
            href={dailyTextUrl(date)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-11 rounded-xl bg-gold text-bg font-semibold text-[15px] flex items-center justify-center gap-1.5 active:opacity-70"
          >
            오늘의 성구 열기 <ExternalIcon width={17} height={17} />
          </a>
          <button
            type="button"
            onClick={() => patchDaily(date, { read: isRead ? 0 : 1 })}
            aria-pressed={isRead}
            className={`h-11 px-4 rounded-xl font-semibold text-[15px] flex items-center gap-1.5 active:opacity-70 ${isRead ? 'bg-accent text-bg' : 'bg-card text-ink-2'}`}
          >
            {isRead && <CheckIcon width={18} height={18} strokeWidth={2.6} />}
            {isRead ? '읽었어요' : '읽음'}
          </button>
        </div>
        {/* 이번 달 읽은 날 */}
        <div className="flex flex-wrap gap-[5px] mt-3" aria-label="이번 달 읽은 날">
          {monthDays.map((d) => (
            <span
              key={d}
              title={d}
              className={`size-[9px] rounded-full ${readSet.has(d) ? 'bg-gold' : d > date ? 'bg-ink-3/15' : 'bg-ink-3/35'} ${d === date ? 'ring-2 ring-gold/50' : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="px-4 py-3">
        {memoOpen || memoValue ? (
          <TextArea value={memoValue} onChange={(e) => onMemo(e.target.value)} onBlur={() => memo != null && patchDaily(date, { memo })} placeholder="오늘 성구의 구절이나 적용할 점을 적어 보세요" rows={3} autoFocus={memoOpen && !memoValue} />
        ) : (
          <button type="button" onClick={() => setMemoOpen(true)} className="text-[14px] font-semibold text-ink-3 h-8">
            + 묵상 메모 쓰기
          </button>
        )}
      </div>
    </Card>
  )
}
