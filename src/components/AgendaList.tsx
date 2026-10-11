import type { AgendaItem } from '../lib/hooks'
import { effectiveEnd, shortTime } from '../lib/date'

/** 시간순 일정 목록. now 를 주면 지금 진행 중인 칸을 강조하고 지난 칸은 흐리게 한다. */
export function AgendaList({ items, now, onOpen }: { items: AgendaItem[] | undefined; now?: string; onOpen: (item: AgendaItem) => void }) {
  if (!items?.length) return null
  return (
    <ul className="space-y-1">
      {items.map((it) => {
        const end = it.start ? effectiveEnd(it.start, it.end) : undefined
        const active = now != null && it.start != null && it.start <= now && now < end!
        const past = now != null && end != null && end <= now
        return (
          <li key={it.key}>
            <button
              type="button"
              onClick={() => onOpen(it)}
              className={`w-full flex items-center gap-3 text-left rounded-xl px-2 py-2.5 -mx-2 ${active ? 'bg-accent-soft' : 'active:bg-card-2'} ${past ? 'opacity-45' : ''}`}
            >
              <span className="w-[52px] shrink-0 text-right text-[16px] font-semibold tabular-nums">{it.start ? shortTime(it.start) : '종일'}</span>
              <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: it.color }} />
              <span className="min-w-0 flex-1 text-[17px] font-medium leading-snug">{it.title}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
