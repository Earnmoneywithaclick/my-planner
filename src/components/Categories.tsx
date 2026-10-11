import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { COLORS, DEFAULT_CATEGORY_NAMES, categoryId, categorySlotId, db, type Category } from '../db'

export type CategoryInfo = { slot: number; color: string; name: string }

/** 저장된 기록으로 8칸의 지금 색·이름을 계산한다 (바꾸지 않은 칸은 기본값) */
function resolve(saved: Category[] | undefined): CategoryInfo[] {
  return COLORS.map((def, slot) => {
    const rec = saved?.find((c) => c.slot === slot)
    const legacy = saved?.find((c) => c.slot == null && c.color === def)
    return { slot, color: rec?.color ?? def, name: rec?.name || legacy?.name || DEFAULT_CATEGORY_NAMES[slot] }
  })
}

/** 카테고리 8칸과 불러오기가 끝났는지 */
export function useCategoryList() {
  const saved = useLiveQuery(() => db.categories.toArray(), [])
  return { list: resolve(saved), loaded: saved !== undefined }
}

export const useCategories = () => useCategoryList().list

async function writeSlot(slot: number, color: string, name: string) {
  await db.categories.delete(categoryId(COLORS[slot])) // 예전 방식 기록은 정리
  if (color === COLORS[slot] && name === DEFAULT_CATEGORY_NAMES[slot]) await db.categories.delete(categorySlotId(slot))
  else await db.categories.put({ id: categorySlotId(slot), slot, color, name })
}

/** 이름 바꾸기 — 비우면 기본 이름으로 */
export async function renameCategory(slot: number, name: string) {
  const cur = resolve(await db.categories.toArray())[slot]
  await writeSlot(slot, cur.color, name.trim() || DEFAULT_CATEGORY_NAMES[slot])
}

/** 색 바꾸기 — 이 카테고리였던 일정·반복 일정·묶음도 함께 새 색으로 */
export async function recolorCategory(slot: number, color: string) {
  await db.transaction('rw', [db.categories, db.events, db.timetable, db.goals], async () => {
    const all = resolve(await db.categories.toArray())
    const cur = all[slot]
    if (cur.color === color || all.some((c) => c.slot !== slot && c.color === color)) return
    await db.events.filter((x) => x.color === cur.color).modify({ color })
    await db.timetable.filter((x) => x.color === cur.color).modify({ color })
    await db.goals.filter((x) => x.color === cur.color).modify({ color })
    await writeSlot(slot, color, cur.name)
  })
}

/** 일정·시간표·묶음 입력 창에서 카테고리(색) 고르기 */
export function CategoryPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const { list, loaded } = useCategoryList()
  const colors = list.map((c) => c.color).join()
  // 기본 색으로 시작했는데 그 칸의 색이 바뀌었으면, 같은 칸의 지금 색으로 맞춘다
  useEffect(() => {
    if (!loaded || list.some((c) => c.color === value)) return
    const i = COLORS.indexOf(value)
    onChange(list[i >= 0 ? i : 0].color)
  }, [loaded, colors, value]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="카테고리">
      {list.map((c) => {
        const on = value === c.color
        return (
          <button
            key={c.slot}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c.color)}
            className={`h-10 pl-2.5 pr-3.5 rounded-full flex items-center gap-2 text-[15px] font-semibold transition-colors ${on ? 'text-bg' : 'bg-card-2 text-ink-2'}`}
            style={on ? { background: c.color } : undefined}
          >
            <span className="size-3.5 rounded-full shrink-0" style={{ background: on ? 'var(--bg)' : c.color }} />
            {c.name}
          </button>
        )
      })}
    </div>
  )
}

/** 색 → 카테고리 이름 설명 (달력 아래) */
export function CategoryLegend({ colors }: { colors: Set<string> }) {
  const categories = useCategories().filter((c) => colors.has(c.color))
  if (!categories.length) return null
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-3 pt-3">
      {categories.map((c) => (
        <span key={c.slot} className="flex items-center gap-1.5 text-[15px] text-ink-2">
          <span className="size-3 rounded-full" style={{ background: c.color }} />
          {c.name}
        </span>
      ))}
    </div>
  )
}
