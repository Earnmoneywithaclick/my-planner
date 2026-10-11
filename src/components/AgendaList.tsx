import type { AgendaItem } from '../lib/hooks'
import { Empty } from './ui'

/** 시간순 일정 목록. now 를 주면 지금 진행 중인 칸을 강조한다. */
export function AgendaList({ items, now, onOpen, emptyText }: { items: AgendaItem[] | undefined; now?: string; onOpen: (item: AgendaItem) => void; emptyText: string }) {
  if (!items) return null
  if (items.length === 0) return <Empty>{emptyText}</Empty>
  return (
    <ul className="space-y-1.5">
      {items.map((it) => {
        const active = now != null && it.start != null && it.end != null && it.start <= now && now < it.end
        const past = now != null && it.end != null && it.end <= now
        return (
          <li key={it.key}>
            <button
              type="button"
              onClick={() => onOpen(it)}
              className={`w-full flex items-stretch gap-3 text-left rounded-xl px-2 py-2 -mx-2 ${active ? 'bg-accent-soft' : 'active:bg-card-2'} ${past ? 'opacity-50' : ''}`}
            >
              <div className="w-[52px] shrink-0 text-right tabular-nums">
                {it.start ? (
                  <>
                    <p className="text-[15px] font-semibold leading-tight">{it.start}</p>
                    {it.end && <p className="text-[12px] text-ink-3 leading-tight">{it.end}</p>}
                  </>
                ) : (
                  <p className="text-[12px] font-semibold text-ink-3 pt-0.5">종일</p>
                )}
              </div>
              <span className="w-1 rounded-full shrink-0" style={{ background: it.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-medium leading-snug">
                  {it.title}
                  {active && <span className="ml-2 text-[11px] font-bold text-accent align-middle">지금</span>}
                </p>
                <p className="text-[13px] text-ink-3 truncate">
                  {it.kind === 'block' ? '시간표' : '일정'}
                  {it.sub && ` · ${it.sub}`}
                </p>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
