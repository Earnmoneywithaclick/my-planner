import { useState } from 'react'
import { useLiveQuery, useObservable } from 'dexie-react-hooks'
import { db, patchDay, type DailyText } from '../db'
import { dailyTextUrl, fmt } from '../lib/date'
import { Sheet, TextArea, TextInput } from './ui'
import { ExternalIcon } from './icons'
import { AnimatedList } from './Animated'

/** 묵상 메모 한 개 — 누르면 그 자리에서 고친다 (칸에서 나가면 저장) */
function MemoItem({ day }: { day: DailyText }) {
  const [editing, setEditing] = useState(false)
  return (
    <li className="py-3.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[17px] font-bold">{fmt(day.date, 'yyyy년 M월 d일 (E)')}</span>
        <a href={dailyTextUrl(day.date)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[15px] font-semibold text-gold shrink-0">
          그날 성구 <ExternalIcon width={16} height={16} />
        </a>
      </div>
      {editing ? (
        <TextArea
          autoFocus
          rows={4}
          defaultValue={day.memo}
          onBlur={(e) => {
            if (e.target.value !== day.memo) patchDay(day.date, { memo: e.target.value })
            setEditing(false)
          }}
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="w-full text-left text-[16px] leading-relaxed whitespace-pre-wrap text-ink-2">
          {day.memo}
        </button>
      )}
    </li>
  )
}

/** 지금까지 적은 일용할 성구 묵상 메모 모아 보기 (최신순, 검색) */
export function MemoSheet({ onClose }: { onClose: () => void }) {
  const userId = useObservable(db.cloud.currentUser)?.userId
  const [query, setQuery] = useState('')
  const memos = useLiveQuery(
    async () =>
      (await db.days.toArray())
        .filter((d) => d.memo?.trim())
        .sort((a, b) => b.date.localeCompare(a.date)),
    [userId],
  )
  const q = query.trim()
  const shown = (memos ?? []).filter((d) => !q || d.memo.includes(q))

  return (
    <Sheet open title="묵상 메모" onClose={onClose}>
      {!!memos?.length && <TextInput type="search" placeholder="검색" value={query} onChange={(e) => setQuery(e.target.value)} />}
      {memos && !memos.length && <p className="text-[16px] text-ink-2 py-2">아직 적은 메모가 없어요.</p>}
      <AnimatedList className="divide-y divide-line">
        {shown.map((d) => (
          <MemoItem key={d.id} day={d} />
        ))}
      </AnimatedList>
    </Sheet>
  )
}
