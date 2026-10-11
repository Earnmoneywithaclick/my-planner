import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PlanEvent, type TimetableBlock } from '../db'
import { fromKey, toKey } from './date'

/** 1분마다 갱신되는 현재 시각 — 자정이 지나면 '오늘'도 바뀐다 */
export function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return { now, today: toKey(now) }
}

export type AgendaItem =
  | { kind: 'block'; key: string; title: string; start: string; end?: string; color: string; block: TimetableBlock }
  | { kind: 'event'; key: string; title: string; start?: string; end?: string; color: string; event: PlanEvent }

/** 그 날의 반복 시간표 + 일정을 시간순으로 합친다 */
export function useAgenda(dateKey: string): AgendaItem[] | undefined {
  return useLiveQuery(async () => {
    const weekday = fromKey(dateKey).getDay()
    const [blocks, events] = await Promise.all([db.timetable.where('weekday').equals(weekday).toArray(), db.events.where('date').equals(dateKey).toArray()])
    const items: AgendaItem[] = [
      ...blocks.map((b) => ({ kind: 'block' as const, key: `b${b.id}`, title: b.title, start: b.start, end: b.end, color: b.color, block: b })),
      ...events.map((e) => ({ kind: 'event' as const, key: `e${e.id}`, title: e.title, start: e.start, end: e.end, color: e.color, event: e })),
    ]
    // 하루 종일 일정이 맨 위, 나머지는 시작 시간순
    return items.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
  }, [dateKey])
}
