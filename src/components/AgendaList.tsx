import type { AgendaItem } from '../lib/hooks'
import { effectiveEnd, shortTime } from '../lib/date'
import { AnimatedList, FlashLi } from './Animated'
import { CheckCircle } from './ui'

/**
 * 시간순 일정 목록. now 를 주면 지금 진행 중인 칸을 강조하고 지난 칸은 흐리게 한다.
 * onToggle 을 주면 '했는지 체크'하는 일정 오른쪽에 체크 동그라미가 나온다.
 */
export function AgendaList({ items, now, onOpen, onToggle }: { items: AgendaItem[] | undefined; now?: string; onOpen: (item: AgendaItem) => void; onToggle?: (item: AgendaItem) => void }) {
  if (!items) return null
  // 비어 있어도 목록은 그려 둔다 — 첫 일정이 추가될 때도 미끄러져 들어오도록
  return (
    <AnimatedList className="space-y-1">
      {items.map((it) => {
        const end = it.start ? effectiveEnd(it.start, it.end) : undefined
        const active = now != null && it.start != null && it.start <= now && now < end!
        const past = now != null && end != null && end <= now
        const checkable = onToggle != null && it.check
        return (
          <FlashLi key={it.key} signal={`${it.title}|${it.start}|${it.end}|${it.color}|${it.check}`}>
            <div className={`flex items-center rounded-xl -mx-2 ${active ? 'bg-accent-soft' : ''} ${past && !checkable ? 'opacity-45' : ''}`}>
              <button type="button" onClick={() => onOpen(it)} className={`min-w-0 flex-1 flex items-center gap-3 text-left rounded-xl px-2 py-2.5 ${active ? '' : 'active:bg-card-2'}`}>
                <span className={`w-[52px] shrink-0 text-right text-[16px] font-semibold tabular-nums ${checkable && past ? 'opacity-45' : ''}`}>{it.start ? shortTime(it.start) : '종일'}</span>
                <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: it.color }} />
                <span className={`min-w-0 flex-1 text-[17px] font-medium leading-snug transition-colors ${checkable && it.done ? 'text-ink-3 line-through' : ''}`}>{it.title}</span>
              </button>
              {checkable && (
                <span className="pr-3 pl-1">
                  <CheckCircle checked={!!it.done} onChange={() => onToggle(it)} color={it.color} label={`${it.title} 했어요`} />
                </span>
              )}
            </div>
          </FlashLi>
        )
      })}
    </AnimatedList>
  )
}
