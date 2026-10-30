import { useLiveQuery } from 'dexie-react-hooks'
import { db, layoutId } from '../db'
import { t } from './i18n'

/** 오늘 화면에 놓이는 카드 (기본 순서) */
export const TODAY_CARDS = ['dailyText', 'bible', 'service', 'agenda', 'tasks'] as const
export type TodayCard = (typeof TODAY_CARDS)[number]

export const todayCardName = (k: TodayCard) =>
  ({
    dailyText: t('일용할 성구', 'Daily Text'),
    bible: t('성경 읽기', 'Bible Reading'),
    service: t('봉사', 'Field Service'),
    agenda: t('오늘 일정', 'Today’s schedule'),
    tasks: t('오늘 할 일', 'Today’s to-dos'),
  })[k]

export type TodayLayout = { order: TodayCard[]; hidden: TodayCard[] }

/** 저장된 순서에 없는 카드(새로 생긴 카드)는 기본 순서의 제자리에 끼워 넣는다 */
function resolve(saved?: { order: string[]; hidden: string[] }): TodayLayout {
  if (!saved) return { order: [...TODAY_CARDS], hidden: [] }
  const order = saved.order.filter((k): k is TodayCard => (TODAY_CARDS as readonly string[]).includes(k))
  TODAY_CARDS.forEach((k, i) => {
    if (order.includes(k)) return
    const prev = TODAY_CARDS.slice(0, i).reverse().find((p) => order.includes(p))
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, k)
  })
  return { order, hidden: saved.hidden.filter((k): k is TodayCard => order.includes(k as TodayCard)) }
}

/** 이 계정의 오늘 화면 배치. 불러오기 전에는 undefined */
export function useTodayLayout(): TodayLayout | undefined {
  const saved = useLiveQuery(async () => (await db.layout.get(layoutId())) ?? null, [])
  return saved === undefined ? undefined : resolve(saved ?? undefined)
}

export async function saveTodayLayout(layout: TodayLayout) {
  const isDefault = layout.hidden.length === 0 && layout.order.every((k, i) => k === TODAY_CARDS[i])
  if (isDefault) await db.layout.delete(layoutId())
  else await db.layout.put({ id: layoutId(), ...layout, updatedAt: Date.now() })
}
