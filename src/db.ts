import Dexie, { type Table } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'

// 불리언 값은 IndexedDB 인덱스에 쓸 수 있도록 0/1 로 저장한다.
// 기록은 Dexie Cloud 로 아이폰·아이패드 사이에 동기화된다. 기기끼리 번호가 겹치지 않도록
// 모든 기록은 무작위 문자열 id(newId)를 쓴다.

export const DATABASE_URL = 'https://zpf19f0bm.dexie.cloud'

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
  weekday: number // 0=일 … 6=토
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

export const newId = () => crypto.randomUUID()

export const db = new Dexie('planner-sync', { addons: [dexieCloud] }) as Dexie & {
  goals: Table<Goal, string>
  tasks: Table<Task, string>
  events: Table<PlanEvent, string>
  timetable: Table<TimetableBlock, string>
  questions: Table<Question, string>
  answers: Table<Answer, string>
  days: Table<DailyText, string>
  categories: Table<Category, string>
  bible: Table<BiblePlan, string>
  /** 예전 일일 기록 표(날짜가 기본 키). Dexie Cloud 의 id 는 모든 계정에서 유일해야 해서 days 로 옮겼다. */
  dailyText: Table<Omit<DailyText, 'id'>, string>
}

db.version(1).stores({
  goals: 'id, status',
  tasks: 'id, dueDate, goalId, done',
  events: 'id, date',
  timetable: 'id, weekday',
  questions: 'id, category, nextReview',
  answers: 'id, questionId, date',
  dailyText: 'date, read',
})
db.version(2).stores({ days: 'id, date, read' })
db.version(3).stores({ categories: 'id, color' })
db.version(4).stores({ bible: 'id' })

// 로그인 없이도 쓸 수 있다(손님 모드 — 기록은 이 기기에만). 로그인하면 그때까지의 기록이 그 계정으로 올라간다.
// 개발 중에는 ?demo=<데모 사용자> 로 열면 Dexie Cloud 데모 계정으로 바로 로그인한다 (배포 빌드에는 들어가지 않음).
const demoUser = import.meta.env.DEV ? new URLSearchParams(location.search).get('demo') : null
db.cloud.configure({ databaseUrl: DATABASE_URL, requireAuth: demoUser ? { grant_type: 'demo', userId: demoUser } : false, customLoginGui: true, socialAuth: false })

export const TABLES = ['goals', 'tasks', 'events', 'timetable', 'questions', 'answers', 'days', 'categories', 'bible'] as const
const LEGACY_TABLES = ['goals', 'tasks', 'events', 'timetable', 'questions', 'answers', 'dailyText'] as const

const GUEST_KEY = 'planner.guestKey'
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
const uid = () => (db.cloud.currentUser.value.isLoggedIn ? db.cloud.currentUserId : guestKey())

/** 날짜별 기록(성구·기도·연구)의 id. 날짜만 쓰면 다른 계정과 겹쳐 서버가 거절하므로 계정 id 를 붙인다. */
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
// Dexie Cloud 의 id 는 모든 계정을 통틀어 유일해야 하므로 계정 id 를 붙인다.
const defaultQuestionId = (i: number) => `qdefault${String(i + 1).padStart(2, '0')}-${uid()}`

/** 이 계정에 기본 질문을 아직 넣은 적이 없으면, 없는 것만 넣는다. */
async function seedDefaults() {
  const flag = `planner.defaults.v2:${uid()}`
  try {
    if (localStorage.getItem(flag)) return
  } catch {
    /* 저장소 접근 불가 시에는 매번 확인한다 (있는 질문은 건드리지 않으므로 안전) */
  }
  const ids = DEFAULT_QUESTIONS.map((_, i) => defaultQuestionId(i))
  const existing = await db.questions.bulkGet(ids)
  const now = Date.now()
  const missing = DEFAULT_QUESTIONS.map(([text, category], i) => ({ id: ids[i], text, category, pinned: 0 as const, createdAt: now + i })).filter((_, i) => !existing[i])
  if (missing.length) await db.questions.bulkAdd(missing)
  try {
    localStorage.setItem(flag, '1')
  } catch {
    /* 무시 */
  }
}

/** 예전 dailyText 표(날짜 기본 키)의 기록을 days 표로 옮긴다. 이미 days 에 같은 날이 있으면 그대로 둔다. */
async function migrateDailyTextTable() {
  const old = await db.dailyText.toArray()
  if (!old.length) return
  await db.transaction('rw', db.days, db.dailyText, async () => {
    const ids = old.map((r) => dayId(r.date))
    const existing = await db.days.bulkGet(ids)
    const rows = old.map((r, i) => ({ ...r, id: ids[i] })).filter((_, i) => !existing[i])
    if (rows.length) await db.days.bulkAdd(rows)
    await db.dailyText.clear()
  })
}

/** 계정 id 가 붙기 전의 기본 질문 id(qdefault01 등)를 가리키는 답을 새 id 로 고친다. */
async function repairDefaultAnswers() {
  const old = await db.answers.filter((a) => /^qdefault\d\d$/.test(a.questionId)).toArray()
  for (const a of old) await db.answers.update(a.id, { questionId: defaultQuestionId(Number(a.questionId.slice(8)) - 1) })
}

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
  out.categories = (rows.categories ?? []).map((r) => ({ ...strip(r), id: r.slot != null ? categorySlotId(Number(r.slot)) : categoryId(String(r.color)) }))
  return out
}

/** 모든 표를 지우고 rows 로 채운다 (백업 불러오기) */
export async function replaceAll(rows: Rows) {
  const data = normalizeRows(rows)
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      if (data[t]?.length) await db.table(t).bulkPut(data[t]!)
    }
  })
}

/** 동기화 이전 버전(이 기기에만 저장하던 'planner' DB)의 기록을 한 번만 옮겨오고 옛 DB 는 지운다. */
async function migrateLegacyDb() {
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

/**
 * 손님으로 쓰다가 로그인하면, 손님 이름이 붙은 고정 id(날짜별 기록·카테고리·성경 계획·기본 질문)를 계정 id 로 바꾼다.
 * 계정에 같은 기록이 이미 있으면 계정 쪽을 두고 비어 있는 값만 손님 기록으로 채운다.
 */
async function adoptGuestRecords() {
  if (!db.cloud.currentUser.value.isLoggedIn) return
  let key: string | null = null
  try {
    key = localStorage.getItem(GUEST_KEY)
  } catch {
    /* 무시 */
  }
  if (!key) return
  const suffix = `-${key}`
  const me = `-${db.cloud.currentUserId}`
  const questionMap = new Map<string, string>()
  await db.transaction('rw', [db.days, db.categories, db.bible, db.questions, db.answers], async () => {
    for (const table of [db.days, db.categories, db.bible, db.questions] as Table<{ id: string }, string>[]) {
      const rows = await table.filter((r) => r.id.endsWith(suffix)).toArray()
      for (const r of rows) {
        const id = r.id.slice(0, -suffix.length) + me
        const cur = await table.get(id)
        await table.delete(r.id)
        await table.put(cur ? { ...r, ...cur, id } : { ...r, id })
        if (table === db.questions) questionMap.set(r.id, id)
      }
    }
    for (const [from, to] of questionMap) await db.answers.where('questionId').equals(from).modify({ questionId: to })
  })
}

/** 로그인 → 서버 기록 받아오기 → 옛 기록 옮기기 → 기본 질문 */
export async function startup() {
  await db.open()
  // 저장된 로그인 정보를 다 읽을 때까지 기다린다 (그 전에는 손님처럼 보여서 손님 id 로 기록이 생길 수 있다)
  await new Promise<void>((resolve) => {
    const sub = db.cloud.currentUser.subscribe((u) => {
      if ((u as { isLoading?: boolean }).isLoading) return
      resolve()
      setTimeout(() => sub.unsubscribe())
    })
  })
  // 서버 기록을 먼저 받아오되, 첫 로그인 직후에는 이 대기가 끝나지 않는 경우가 있어 최대 8초만 기다린다.
  // 오프라인이면 다음에 연결될 때 자동으로 동기화된다.
  await Promise.race([db.cloud.sync({ wait: true, purpose: 'pull' }).catch(() => {}), new Promise((r) => setTimeout(r, 8000))])
  await migrateLegacyDb()
  await migrateDailyTextTable()
  await repairDefaultAnswers()
  await adoptGuestRecords()
  await seedDefaults()
  // 손님으로 쓰다가 로그인한 경우
  let wasLoggedIn = db.cloud.currentUser.value.isLoggedIn
  db.cloud.currentUser.subscribe((u) => {
    // 계정의 서버 기록을 먼저 받아온 뒤에 합쳐야 서버 기록을 손님 기록으로 덮어쓰지 않는다
    if (u.isLoggedIn && !wasLoggedIn)
      Promise.race([db.cloud.sync({ wait: true, purpose: 'pull' }).catch(() => {}), new Promise((r) => setTimeout(r, 8000))])
        .then(adoptGuestRecords)
        .then(seedDefaults)
        .catch(() => {})
    wasLoggedIn = !!u.isLoggedIn
  })
}

/** 기기가 저장 공간을 임의로 비우지 않도록 요청한다. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
