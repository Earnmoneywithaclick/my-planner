import { useSyncExternalStore } from 'react'

/** 화면 언어. 기기마다 따로 정한다 (설정 > 언어). */
export type Lang = 'ko' | 'en'

const KEY = 'planner.lang'

function load(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'ko'
  } catch {
    return 'ko'
  }
}

let current: Lang = load()
const listeners = new Set<() => void>()
document.documentElement.lang = current

export const getLang = () => current
export const isEn = () => current === 'en'

export function setLang(lang: Lang) {
  current = lang
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    /* 저장이 안 되면 이번 실행에만 적용 */
  }
  document.documentElement.lang = lang
  listeners.forEach((l) => l())
}

export function useLang() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getLang,
  )
}

/** 한국어와 영어를 나란히 적어 두고 지금 언어에 맞는 쪽을 쓴다 */
export const t = <T,>(ko: T, en: T): T => (current === 'en' ? en : ko)

/** 기본 카테고리 이름 (db.COLORS 순서) */
export const DEFAULT_CATEGORY_NAMES_EN = ['Spiritual', 'Meetings', 'Important', 'Appointment', 'Personal', 'Exercise·Health', 'Family', 'Other']

/** 기본 질문과 질문 분류 — 처음 넣은 그대로(한국어)인 것만 영어로 바꿔 보여준다 */
const QUESTION_EN: Record<string, string> = {
  '오늘 가장 감사했던 일은 무엇인가?': 'What was I most grateful for today?',
  '오늘 한 일 중 내일도 이어가고 싶은 것은?': 'What did I do today that I want to keep doing tomorrow?',
  '오늘 미룬 일이 있다면, 진짜 이유는 무엇이었나?': 'If I put something off today, what was the real reason?',
  '지금 내 시간을 가장 많이 쓰는 일은 정말 중요한 일인가?': 'Is what takes most of my time really what matters most?',
  '이번 주에 꼭 한 가지만 해낸다면 무엇이어야 할까?': 'If I could get just one thing done this week, what should it be?',
  '하지 않기로 정해야 할 일은 무엇인가?': 'What should I decide not to do?',
  '이 목표를 이루면 내 삶에서 무엇이 달라지는가?': 'What will change in my life if I reach this goal?',
  '지금의 계획이 1년 뒤의 나에게도 의미가 있을까?': 'Will my current plans still matter to me a year from now?',
  '목표를 향한 가장 작은 다음 한 걸음은 무엇인가?': 'What is the smallest next step toward my goal?',
  '요즘 나를 지치게 하는 것은 무엇이고, 줄일 수 있는가?': 'What is wearing me out lately, and can I cut it back?',
  '최근에 나를 가장 기쁘게 한 순간은 언제였나?': 'When was I happiest recently?',
  '내가 소중히 여기는 사람들에게 충분한 시간을 내고 있는가?': 'Am I making enough time for the people I care about?',
  '오늘 성구에서 내 생활에 적용할 점은 무엇인가?': 'How can I apply today’s text in my life?',
  '이번 주 영적인 활동에 충분한 시간을 계획했는가?': 'Have I planned enough time for spiritual activities this week?',
}
const QUESTION_CATEGORY_EN: Record<string, string> = {
  '하루 돌아보기': 'Daily review',
  우선순위: 'Priorities',
  목표: 'Goals',
  '나 자신': 'Myself',
  관계: 'Relationships',
  '영적인 것': 'Spiritual',
  기타: 'Other',
}
export const questionText = (text: string) => (current === 'en' ? (QUESTION_EN[text] ?? text) : text)
export const questionCategory = (c: string) => (current === 'en' ? (QUESTION_CATEGORY_EN[c] ?? c) : c)
