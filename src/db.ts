import Dexie, { type Table } from 'dexie'
import { accountUser } from './lib/firebase'

// 불리언 값은 IndexedDB 인덱스에 쓸 수 있도록 0/1 로 저장한다.
// 기록은 먼저 이 기기(IndexedDB)에 저장되고, 로그인했으면 Firebase 로 아이폰·아이패드 사이에 동기화된다 (lib/sync.ts).
// 기기끼리 번호가 겹치지 않도록 모든 기록은 무작위 문자열 id(newId)를 쓴다.

export interface Goal {
  id: string
  title: string
  why?: string
  startDate?: string // yyyy-MM-dd
  endDate?: string
  color: string
  status: 'active' | 'paused' | 'done'
  createdAt: number
}

export interface Task {
  id: string
  title: string
  note?: string
  dueDate?: string
  priority: 0 | 1 | 2 // 낮음 · 보통 · 높음
  goalId?: string
  done: 0 | 1
  doneAt?: number
  createdAt: number
}

export interface PlanEvent {
  id: string
  title: string
  date: string // 시작 날짜
  endDate?: string // 며칠 이어지는 일정의 마지막 날 (없으면 하루짜리)
  start?: string // HH:mm — 없으면 하루 종일
  end?: string
  note?: string
  color: string
  check?: boolean // 했는지 체크하는 일정
  doneDates?: string[] // 체크한 날짜들 (며칠짜리는 날마다 따로)
  createdAt: number
}

export interface TimetableBlock {
  id: string
  weekday: number // 0=일 … 6=토, 매달 반복이면 -1
  monthDay?: number // 매달 반복하는 날짜 (1~31). 그 달에 없는 날이면 말일에 나온다
  calendar?: boolean // 매달 반복을 시간표 달력에 점으로 표시할지
  seriesId?: string // 함께 만든 반복 일정(여러 요일)을 묶는 id — 한 번에 고치고 지운다
  start: string
  end?: string // 없으면 시작 시간만 표시
  title: string
  place?: string
  color: string
  check?: boolean // 했는지 체크하는 일정
  doneDates?: string[] // 체크한 날짜들 (반복 일정은 날마다 따로)
}

export interface Question {
  id: string
  text: string
  category: string
  pinned: 0 | 1
  nextReview?: string // 이 날짜부터 '다시 볼 질문'으로 올라온다
  createdAt: number
}

export interface Answer {
  id: string
  questionId: string
  date: string
  text: string
  createdAt: number
}

export interface DailyText {
  id: string // dayId(date) — 같은 계정·같은 날짜면 기기가 달라도 같은 기록으로 합쳐진다
  date: string
  read: 0 | 1
  prayed?: 0 | 1 // 오늘 기도했는지
  study?: 0 | 1 // 오늘 개인 연구했는지
  serviceMin?: number // 오늘 봉사한 시간 (분)
  bibleFrom?: number // 오늘 '다 읽었어요'로 표시한 성경 읽기 범위 (계획 안의 순번, 1부터)
  bibleTo?: number
  memo: string
  updatedAt: number
}

/** 색마다 붙는 카테고리 이름. 사용자가 이름을 바꾼 색만 저장한다. 일정·시간표·계획은 color 로 카테고리를 가리킨다. */
/**
 * 카테고리 8칸(slot)마다의 색과 이름. 바꾼 칸만 저장한다 (id = categorySlotId(slot)).
 * 예전에는 기본 색으로만 이름을 저장했다 (slot 없음, id = categoryId(color)) — 읽을 때 함께 본다.
 */
export interface Category {
  id: string
  slot?: number
  color: string
  name?: string
}

/** 성경 읽기 계획 — 계정마다 하나 (id = biblePlanId()) */
export interface BiblePlan {
  id: string
  fromBook: number // 1 = 창세기 … 66 = 요한 계시록
  toBook: number
  startDate: string
  endDate: string
  perDay: number // 하루에 읽을 장 수
  readUpTo: number // 계획 범위 안에서 지금까지 읽은 장 수 (순서대로)
  updatedAt: number
}

/** 오늘 화면 카드 순서·숨김 — 계정마다 하나 (id = layoutId()) */
export interface Layout {
  id: string
  order: string[] // 카드 이름 순서 (TODAY_CARDS 의 key)
  hidden: string[] // 숨긴 카드
  updatedAt: number
}


export const newId = () => crypto.randomUUID()

export const db = new Dexie('planner-local') as Dexie & {
  goals: Table<Goal, string>
  tasks: Table<Task, string>
  events: Table<PlanEvent, string>
  timetable: Table<TimetableBlock, string>
  questions: Table<Question, string>
  answers: Table<Answer, string>
  days: Table<DailyText, string>
  categories: Table<Category, string>
  bible: Table<BiblePlan, string>
  layout: Table<Layout, string>
}

db.version(1).stores({
  goals: 'id, status',
  tasks: 'id, dueDate, goalId, done',
  events: 'id, date',
  timetable: 'id, weekday',
  questions: 'id, category, nextReview',
  answers: 'id, questionId, date',
  days: 'id, date, read',
  categories: 'id, color',
  bible: 'id',
  layout: 'id',
})

/** 동기화하고 백업하는 표 */
export const TABLES = ['goals', 'tasks', 'events', 'timetable', 'questions', 'answers', 'days', 'categories', 'bible', 'layout'] as const
export type TableName = (typeof TABLES)[number]
const LEGACY_TABLES = ['goals', 'tasks', 'events', 'timetable', 'questions', 'answers', 'dailyText'] as const

export const GUEST_KEY = 'planner.guestKey'

/** 로그인하지 않은 기기의 고유 이름. 손님 기록의 id 가 다른 기기의 손님 기록과 겹치지 않게 한다. */
function guestKey() {
  try {
    let k = localStorage.getItem(GUEST_KEY)
    if (!k) localStorage.setItem(GUEST_KEY, (k = `guest${newId().slice(0, 8)}`))
    return k
  } catch {
    return 'guest'
  }
}
/** 고정 id 에 붙이는 계정 표시 — 로그인했으면 계정 id, 아니면 이 기기의 손님 이름 */
const uid = () => accountUser()?.uid ?? guestKey()

/** 날짜별 기록(성구·기도·연구)의 id. 계정 id 를 붙여 손님 기록과 계정 기록을 구분한다. */
export const dayId = (date: string) => `day-${date}-${uid()}`
/** 그 날짜의 기록(성구·기도·연구·봉사)을 일부만 고친다. 없으면 새로 만든다. */
export async function patchDay(date: string, patch: Partial<DailyText>) {
  const id = dayId(date)
  const cur = await db.days.get(id)
  await db.days.put({ read: 0, memo: '', ...cur, ...patch, id, date, updatedAt: Date.now() })
}

/** 카테고리 이름 기록의 id (색 + 계정) */
export const categoryId = (color: string) => `cat-${color.replace('#', '')}-${uid()}`
export const categorySlotId = (slot: number) => `catslot${slot}-${uid()}`
export const biblePlanId = () => `bibleplan-${uid()}`
export const layoutId = () => `layout-${uid()}`

export const COLORS = ['#2f5d50', '#3b6ea5', '#b5543c', '#c58a1c', '#7a5aa6', '#4f8a3c', '#a2456e', '#5f6b73']
/** 카테고리 색으로 고를 수 있는 색 (앞 8개가 기본 색) */
export const PALETTE = [...COLORS, '#2e8b8b', '#d0743c', '#8a6d3b', '#5468c4', '#c2549b', '#6b8f2a', '#3f7fbf', '#9c3d3d']
/** COLORS 순서와 같은 기본 카테고리 이름 */
export const DEFAULT_CATEGORY_NAMES = ['영적 활동', '집회', '중요', '약속', '개인', '운동·건강', '가족', '기타']

const DEFAULT_QUESTIONS: [string, string][] = [
  ['오늘 가장 감사했던 일은 무엇인가?', '하루 돌아보기'],
  ['오늘 한 일 중 내일도 이어가고 싶은 것은?', '하루 돌아보기'],
  ['오늘 미룬 일이 있다면, 진짜 이유는 무엇이었나?', '하루 돌아보기'],
  ['지금 내 시간을 가장 많이 쓰는 일은 정말 중요한 일인가?', '우선순위'],
  ['이번 주에 꼭 한 가지만 해낸다면 무엇이어야 할까?', '우선순위'],
  ['하지 않기로 정해야 할 일은 무엇인가?', '우선순위'],
  ['이 목표를 이루면 내 삶에서 무엇이 달라지는가?', '목표'],
  ['지금의 계획이 1년 뒤의 나에게도 의미가 있을까?', '목표'],
  ['목표를 향한 가장 작은 다음 한 걸음은 무엇인가?', '목표'],
  ['요즘 나를 지치게 하는 것은 무엇이고, 줄일 수 있는가?', '나 자신'],
  ['최근에 나를 가장 기쁘게 한 순간은 언제였나?', '나 자신'],
  ['내가 소중히 여기는 사람들에게 충분한 시간을 내고 있는가?', '관계'],
  ['오늘 성구에서 내 생활에 적용할 점은 무엇인가?', '영적인 것'],
  ['이번 주 영적인 활동에 충분한 시간을 계획했는가?', '영적인 것'],
]

// 기본 질문은 같은 계정이면 기기가 달라도 같은 id 를 써서 하나로 합쳐지게 한다.
// 계정 id 를 붙여 다른 계정의 기록과 섞이지 않게 한다.
const defaultQuestionId = (i: number) => `qdefault${String(i + 1).padStart(2, '0')}-${uid()}`

type Rows = Partial<Record<(typeof TABLES)[number] | 'dailyText', Record<string, unknown>[]>>

/**
 * 예전 형식(숫자 id) 기록을 동기화용 문자열 id 로 바꾼다. 계획↔할 일, 질문↔답 연결도 함께 고친다.
 * 이미 문자열 id 인 기록은 그대로 둔다. 다른 계정의 소유 정보(owner, realmId)는 지운다.
 */
export function normalizeRows(rows: Rows): Rows {
  const strip = (r: Record<string, unknown>): Record<string, unknown> => {
    const { owner: _o, realmId: _r, $ts: _t, ...rest } = r
    return rest
  }
  const goalIds = new Map<unknown, string>()
  const questionIds = new Map<unknown, string>()
  const remap = (r: Record<string, unknown>, map?: Map<unknown, string>, preset?: string): Record<string, unknown> => {
    const id = typeof r.id === 'string' ? r.id : (preset ?? newId())
    map?.set(r.id, id)
    return { ...strip(r), id }
  }
  const defaultIndex = (text: unknown) => DEFAULT_QUESTIONS.findIndex(([t]) => t === text)

  const out: Rows = {}
  out.goals = (rows.goals ?? []).map((r) => remap(r, goalIds))
  out.questions = (rows.questions ?? []).map((r) => {
    const i = defaultIndex(r.text)
    return remap(r, questionIds, i >= 0 ? defaultQuestionId(i) : undefined)
  })
  out.tasks = (rows.tasks ?? []).map((r) => {
    const t = remap(r)
    if (t.goalId != null) {
      const g = goalIds.get(t.goalId) ?? (typeof t.goalId === 'string' ? t.goalId : undefined)
      if (g) t.goalId = g
      else delete t.goalId
    }
    return t
  })
  out.answers = (rows.answers ?? [])
    .map((r) => {
      const a = remap(r)
      a.questionId = questionIds.get(a.questionId) ?? (typeof a.questionId === 'string' ? a.questionId : undefined)
      return a
    })
    .filter((a) => a.questionId)
  out.events = (rows.events ?? []).map((r) => remap(r))
  out.timetable = (rows.timetable ?? []).map((r) => remap(r))
  // 예전 백업의 dailyText 와 새 days 모두, 지금 계정 기준 id 로 다시 만든다
  out.days = [...(rows.dailyText ?? []), ...(rows.days ?? [])].map((r) => ({ ...strip(r), id: dayId(String(r.date)) }))
  out.bible = (rows.bible ?? []).slice(0, 1).map((r) => ({ ...strip(r), id: biblePlanId() }))
  out.layout = (rows.layout ?? []).slice(0, 1).map((r) => ({ ...strip(r), id: layoutId() }))
  out.categories = (rows.categories ?? []).map((r) => ({ ...strip(r), id: r.slot != null ? categorySlotId(Number(r.slot)) : categoryId(String(r.color)) }))
  return out
}


/** 모든 표를 지우고 rows 로 채운다 (백업 불러오기). 하나씩 지워야 동기화에도 삭제가 전해진다. */
export async function replaceAll(rows: Rows) {
  const data = normalizeRows(rows)
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).toCollection().delete()
      if (data[t]?.length) await db.table(t).bulkPut(data[t]!)
    }
  })
}

/** 모든 표의 기록을 지운다 (동기화 중이면 계정의 기록도 지워진다) */
export async function deleteAll() {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) await db.table(t).toCollection().delete()
  })
}

/** 동기화 이전 버전(이 기기에만 저장하던 'planner' DB)의 기록을 한 번만 옮겨오고 옛 DB 는 지운다. */
export async function migrateLegacyDb() {
  if (!(await Dexie.exists('planner'))) return
  const legacy = new Dexie('planner')
  legacy.version(1).stores({
    goals: '++id',
    tasks: '++id',
    events: '++id',
    timetable: '++id',
    questions: '++id',
    answers: '++id',
    dailyText: 'date',
  })
  const rows: Rows = {}
  for (const t of LEGACY_TABLES) rows[t] = await legacy.table(t).toArray()
  legacy.close()

  const data = normalizeRows(rows)
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) if (data[t]?.length) await db.table(t).bulkPut(data[t]!)
  })
  await Dexie.delete('planner')
}


// 첫 버전은 엉뚱한 DB 이름('planner-sync')을 봐서 아무것도 옮기지 못했다 — 표시 이름을 바꿔 다시 옮긴다
const CLOUD_MIGRATED = 'planner.cloudMigrated2'
/** Dexie Cloud 는 DB 이름 뒤에 데이터베이스 id 를 붙여 저장한다 ('planner-sync-zpf19f0bm') */
const CLOUD_DB = 'planner-sync-zpf19f0bm'

/**
 * Dexie Cloud 로 동기화하던 버전의 기록을 한 번만 이 기기의 새 DB 로 옮긴다. 옮긴 기록 수를 돌려준다.
 * 로그인 전이면 손님 기록이 되고(로그인하면 계정으로 올라간다), 이미 있는 기록은 건드리지 않는다. 옛 DB 는 만일을 위해 남겨 둔다.
 */
export async function migrateFromDexieCloud(): Promise<number> {
  try {
    if (localStorage.getItem(CLOUD_MIGRATED)) return 0
  } catch {
    return 0
  }
  let names: string[]
  try {
    names = (await indexedDB.databases()).map((d) => d.name ?? '').filter((n) => n.startsWith('planner-sync-'))
  } catch {
    names = (await Dexie.exists(CLOUD_DB)) ? [CLOUD_DB] : []
  }
  let added = 0
  for (const name of names) {
    const old = new Dexie(name)
    await old.open()
    const rows: Rows = {}
    for (const t of [...TABLES, 'dailyText'] as const) if (old.tables.some((x) => x.name === t)) rows[t] = await old.table(t).toArray()
    old.close()
    const data = normalizeRows(rows)
    await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
      for (const t of TABLES) {
        const list = (data[t] ?? []) as { id: string }[]
        if (!list.length) continue
        const existing = await db.table(t).bulkGet(list.map((r) => r.id))
        const fresh = list.filter((_, i) => !existing[i])
        if (fresh.length) await db.table(t).bulkAdd(fresh)
        added += fresh.length
      }
    })
  }
  localStorage.setItem(CLOUD_MIGRATED, '1')
  return added
}

/**
 * 손님으로 쓰다가 로그인하면, 손님 이름이 붙은 고정 id(날짜별 기록·카테고리·성경 계획·기본 질문)를 계정 id 로 바꾼다.
 * 계정에 같은 기록이 이미 있으면 계정 쪽을 두고 비어 있는 값만 손님 기록으로 채운다.
 */
export async function adoptGuestRecords() {
  const me = accountUser()
  if (!me) return
  let key: string | null = null
  try {
    key = localStorage.getItem(GUEST_KEY)
  } catch {
    /* 무시 */
  }
  if (!key) return
  const suffix = `-${key}`
  const mine = `-${me.uid}`
  const questionMap = new Map<string, string>()
  await db.transaction('rw', [db.days, db.categories, db.bible, db.layout, db.questions, db.answers], async () => {
    for (const table of [db.days, db.categories, db.bible, db.layout, db.questions] as Table<{ id: string }, string>[]) {
      const rows = await table.filter((r) => r.id.endsWith(suffix)).toArray()
      for (const r of rows) {
        const id = r.id.slice(0, -suffix.length) + mine
        const cur = await table.get(id)
        await table.delete(r.id)
        await table.put(cur ? { ...r, ...cur, id } : { ...r, id })
        if (table === db.questions) questionMap.set(r.id, id)
      }
    }
    for (const [from, to] of questionMap) await db.answers.where('questionId').equals(from).modify({ questionId: to })
  })
}


/** 기기가 저장 공간을 임의로 비우지 않도록 요청한다. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
