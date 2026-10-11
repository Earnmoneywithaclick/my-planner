import { useLiveQuery } from 'dexie-react-hooks'
import { COLORS, DEFAULT_CATEGORY_NAMES, categoryId, db } from '../db'

export type CategoryInfo = { color: string; name: string }

/** 8가지 색과 그 카테고리 이름 (이름을 바꾸지 않은 색은 기본 이름) */
export function useCategories(): CategoryInfo[] {
  const saved = useLiveQuery(() => db.categories.toArray(), [])
  const names = new Map(saved?.map((c) => [c.color, c.name]))
  return COLORS.map((color, i) => ({ color, name: names.get(color) || DEFAULT_CATEGORY_NAMES[i] }))
}

export async function renameCategory(color: string, name: string) {
  const i = COLORS.indexOf(color)
  const trimmed = name.trim()
  // 비우거나 기본 이름으로 되돌리면 저장된 이름을 지운다
  if (!trimmed || trimmed === DEFAULT_CATEGORY_NAMES[i]) await db.categories.delete(categoryId(color))
  else await db.categories.put({ id: categoryId(color), color, name: trimmed })
}

/** 일정·시간표·계획 입력 창에서 카테고리(색) 고르기 */
export function CategoryPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const categories = useCategories()
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="카테고리">
      {categories.map((c) => {
        const on = value === c.color
        return (
          <button
            key={c.color}
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
        <span key={c.color} className="flex items-center gap-1.5 text-[15px] text-ink-2">
          <span className="size-3 rounded-full" style={{ background: c.color }} />
          {c.name}
        </span>
      ))}
    </div>
  )
}
