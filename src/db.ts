import Dexie, { type EntityTable } from 'dexie'

// 불리언 값은 IndexedDB 인덱스에 쓸 수 있도록 0/1 로 저장한다.

export interface Goal {
  id?: number
  title: string
  why?: string
  startDate?: string // yyyy-MM-dd
  endDate?: string
  color: string
  status: 'active' | 'paused' | 'done'
  createdAt: number
}

export interface Task {
  id?: number
  title: string
  note?: string
  dueDate?: string
  priority: 0 | 1 | 2 // 낮음 · 보통 · 높음
  goalId?: number
  done: 0 | 1
  doneAt?: number
  createdAt: number
}

export interface PlanEvent {
  id?: number
  title: string
  date: string
  start?: string // HH:mm — 없으면 하루 종일
  end?: string
  note?: string
  color: string
  createdAt: number
}

export interface TimetableBlock {
  id?: number
  weekday: number // 0=일 … 6=토
  start: string
  end: string
  title: string
  place?: string
  color: string
}

export interface Question {
  id?: number
  text: string
  category: string
  pinned: 0 | 1
  nextReview?: string // 이 날짜부터 '다시 볼 질문'으로 올라온다
  createdAt: number
}

export interface Answer {
  id?: number
  questionId: number
  date: string
  text: string
  createdAt: number
}

export interface DailyText {
  date: string // 기본 키
  read: 0 | 1
  memo: string
  updatedAt: number
}

export const db = new Dexie('planner') as Dexie & {
  goals: EntityTable<Goal, 'id'>
  tasks: EntityTable<Task, 'id'>
  events: EntityTable<PlanEvent, 'id'>
  timetable: EntityTable<TimetableBlock, 'id'>
  questions: EntityTable<Question, 'id'>
  answers: EntityTable<Answer, 'id'>
  dailyText: EntityTable<DailyText, 'date'>
}

db.version(1).stores({
  goals: '++id, status',
  tasks: '++id, dueDate, goalId, done',
  events: '++id, date',
  timetable: '++id, weekday',
  questions: '++id, category, nextReview',
  answers: '++id, questionId, date',
  dailyText: 'date, read',
})

export const TABLES = ['goals', 'tasks', 'events', 'timetable', 'questions', 'answers', 'dailyText'] as const

export const COLORS = ['#2f5d50', '#3b6ea5', '#b5543c', '#c58a1c', '#7a5aa6', '#4f8a3c', '#a2456e', '#5f6b73']

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

/** 처음 실행할 때 기본 질문을 넣는다. */
export async function seedIfEmpty() {
  const flag = 'planner.seeded.v1'
  try {
    if (localStorage.getItem(flag)) return
  } catch {
    /* 저장소 접근 불가 시에도 아래 count 검사로 중복을 막는다 */
  }
  if ((await db.questions.count()) === 0) {
    const now = Date.now()
    await db.questions.bulkAdd(
      DEFAULT_QUESTIONS.map(([text, category], i) => ({ text, category, pinned: 0, createdAt: now + i })),
    )
  }
  try {
    localStorage.setItem(flag, '1')
  } catch {
    /* 무시 */
  }
}

/** 기기가 저장 공간을 임의로 비우지 않도록 요청한다. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
