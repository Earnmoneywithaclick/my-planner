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
