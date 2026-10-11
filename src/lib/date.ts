import { addDays, format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
/** 한 주를 월요일부터 보여줄 때의 요일 순서 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const toKey = (d: Date) => format(d, 'yyyy-MM-dd')
export const todayKey = () => toKey(new Date())
export const fromKey = (key: string) => parseISO(key)
export const shiftKey = (key: string, days: number) => toKey(addDays(fromKey(key), days))

export const fmt = (key: string, pattern: string) => format(fromKey(key), pattern, { locale: ko })

/** 'M월 d일 (E)' 형태, 오늘·내일·어제는 말로 */
export function friendlyDate(key: string) {
  const today = todayKey()
  if (key === today) return '오늘'
  if (key === shiftKey(today, 1)) return '내일'
  if (key === shiftKey(today, -1)) return '어제'
  return fmt(key, 'M월 d일 (E)')
}

export const nowHHmm = () => format(new Date(), 'HH:mm')

/** 그 날짜의 '일용할 성구' 페이지 (워치타워 온라인 라이브러리, 한국어) */
export function dailyTextUrl(key: string) {
  const d = fromKey(key)
  return `https://wol.jw.org/ko/wol/h/r8/lp-ko/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

/** 날짜 문자열로 만드는 간단한 해시 — 매일 다른 질문을 고정적으로 고를 때 사용 */
export function dayHash(key: string) {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}
