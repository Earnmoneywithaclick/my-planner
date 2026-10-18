import { useSyncExternalStore } from 'react'

/** 로그인 화면에서 '로그인 없이 쓰기'를 골랐는지 (이 기기에만 기억) */
const KEY = 'planner.guest'
const listeners = new Set<() => void>()

export function isGuest() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setGuest(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* 저장이 안 되면 이번 실행에만 */
  }
  listeners.forEach((l) => l())
}

export function useGuest() {
  return useSyncExternalStore((l) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }, isGuest)
}
