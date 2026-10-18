import { useEffect, useRef, useState } from 'react'
import { useLiveQuery, useObservable } from 'dexie-react-hooks'
import { eachDayOfInterval, endOfMonth, startOfMonth } from 'date-fns'
import { db, dayId, patchDay as patchDaily } from '../db'
import { dailyTextUrl, fromKey, shiftKey, toKey } from '../lib/date'
import { Card, TextArea } from './ui'
import { BookIcon, CheckIcon, ExternalIcon, FlameIcon, NotesIcon } from './icons'
import { MemoSheet } from './MemoSheet'
import { useChanged } from '../lib/motion'
import { t } from '../lib/i18n'

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
  const [memosOpen, setMemosOpen] = useState(false)
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
            <h2 className="text-[17px] font-bold">{t('일용할 성구', 'Daily Text')}</h2>
          </div>
          <div className="flex items-center gap-1">
            {streak > 0 && (
              <span className="flex items-center gap-1 text-[17px] font-bold tabular-nums" aria-label={t(`${streak}일 연속`, `${streak}-day streak`)}>
                <FlameIcon width={20} height={20} strokeWidth={2.1} />
                {streak}
              </span>
            )}
            {/* 지금까지 적은 묵상 메모 모아 보기 */}
            <button type="button" aria-label={t('묵상 메모 모아 보기', 'All meditation notes')} onClick={() => setMemosOpen(true)} className="size-11 -my-3 -mr-2 grid place-items-center rounded-full active:bg-gold-soft">
              <NotesIcon width={21} height={21} />
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <a
            href={dailyTextUrl(date)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-12 rounded-xl bg-gold text-bg font-semibold text-[16px] flex items-center justify-center gap-1.5 active:opacity-70"
          >
            {t('성구 열기', 'Open text')} <ExternalIcon width={18} height={18} />
          </a>
          <button
            type="button"
            onClick={() => patchDaily(date, { read: isRead ? 0 : 1 })}
            aria-pressed={isRead}
            aria-label={isRead ? t('읽음 취소', 'Undo read') : t('읽음', 'Read')}
            className={`h-12 rounded-xl font-semibold text-[16px] flex items-center justify-center active:opacity-70 ${isRead ? 'w-12 bg-accent text-bg' : 'px-4 bg-card text-ink-2'}`}
          >
            {isRead ? <CheckIcon width={22} height={22} strokeWidth={2.6} className={readPopped ? 'animate-pop' : ''} /> : t('읽음', 'Read')}
          </button>
        </div>
        {/* 이번 달 읽은 날 */}
        <div className="flex flex-wrap gap-[6px] mt-3.5" aria-label={t('이번 달 읽은 날', 'Days read this month')}>
          {monthDays.map((d) => (
            <span
              key={d}
              className={`size-[10px] rounded-full ${readSet.has(d) ? 'bg-gold' : d > date ? 'bg-ink-3/15' : 'bg-ink-3/35'} ${d === date ? 'ring-2 ring-gold/50' : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 p-3 border-b border-line">
        <DailyCheck label={t('기도', 'Prayer')} checked={rec?.prayed === 1} onToggle={() => patchDaily(date, { prayed: rec?.prayed === 1 ? 0 : 1 })} />
        <DailyCheck label={t('개인 연구', 'Personal Study')} checked={rec?.study === 1} onToggle={() => patchDaily(date, { study: rec?.study === 1 ? 0 : 1 })} />
      </div>
      {memoOpen || memoValue ? (
        <div className="p-3">
          <TextArea value={memoValue} onChange={(e) => onMemo(e.target.value)} onBlur={() => memo != null && patchDaily(date, { memo })} placeholder={t('묵상 메모', 'Meditation note')} rows={3} autoFocus={memoOpen && !memoValue} />
        </div>
      ) : (
        <button type="button" onClick={() => setMemoOpen(true)} className="w-full h-12 text-[16px] font-semibold text-ink-3 active:bg-card-2">
          {t('+ 묵상 메모', '+ Meditation note')}
        </button>
      )}
      {memosOpen && <MemoSheet onClose={() => setMemosOpen(false)} />}
    </Card>
  )
}
