import { addDays, format, parseISO } from 'date-fns'
import { enUS, ko } from 'date-fns/locale'
import { isEn, t } from './i18n'

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** 짧은 요일 이름 (0=일) */
export const weekdayShort = (d: number) => (isEn() ? WEEKDAYS_EN : WEEKDAYS_KO)[d]
/** 한 주를 보여줄 때의 요일 순서 (일요일부터) */
export const WEEK_ORDER = [0, 1, 2, 3, 4, 5, 6]

export const toKey = (d: Date) => format(d, 'yyyy-MM-dd')
export const todayKey = () => toKey(new Date())
export const fromKey = (key: string) => parseISO(key)
export const shiftKey = (key: string, days: number) => toKey(addDays(fromKey(key), days))

/** 한국어 날짜 형식 → 같은 뜻의 영어 형식 */
const EN_PATTERN: Record<string, string> = {
  'yyyy년 M월 d일 (E)': 'EEE, MMM d, yyyy',
  'yyyy년 M월 d일': 'MMM d, yyyy',
  'yyyy년 M월': 'MMMM yyyy',
  'M월 d일 EEEE': 'EEEE, MMMM d',
  'M월 d일 (E)': 'EEE, MMM d',
  'M월 d일': 'MMM d',
}

/** 날짜 표시. 형식은 한국어로 적고, 영어일 때는 위 표의 형식으로 바꾼다. */
export const fmt = (key: string, pattern: string) =>
  isEn() ? format(fromKey(key), EN_PATTERN[pattern] ?? pattern, { locale: enUS }) : format(fromKey(key), pattern, { locale: ko })

/** 'M월 d일 (E)' 형태, 오늘·내일·어제는 말로 */
export function friendlyDate(key: string) {
  const today = todayKey()
  if (key === today) return t('오늘', 'Today')
  if (key === shiftKey(today, 1)) return t('내일', 'Tomorrow')
  if (key === shiftKey(today, -1)) return t('어제', 'Yesterday')
  return fmt(key, 'M월 d일 (E)')
}

export const nowHHmm = () => format(new Date(), 'HH:mm')

/** 시간은 30분 단위로만 고른다 */
export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

/** '07:30' → '오전 7시 30분' */
export function timeLabel(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  if (isEn()) return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${m ? ` ${m}분` : ''}`
}

/** '07:30' → '7:30' (목록에 짧게 표시) */
export const shortTime = (hhmm: string) => hhmm.replace(/^0/, '')

/** 끝 시간이 없으면 시작부터 1시간으로 보고 '지금' 여부를 판단한다 */
export function effectiveEnd(start: string, end?: string) {
  if (end) return end
  const [h, m] = start.split(':').map(Number)
  return `${String(Math.min(h + 1, 24)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 그 날짜의 '일용할 성구' 링크 (한국어). jw.org 공유 링크라서, 아이폰에 JW Library 앱이 있으면 앱에서 열리고
 * (앱은 다크 모드 지원) 없으면 워치타워 온라인 라이브러리 웹 페이지로 이동한다.
 */
export function dailyTextUrl(key: string) {
  return `https://www.jw.org/finder?srcid=jwlshare&wtlocale=${t('KO', 'E')}&prefer=lang&alias=daily-text&date=${key.replaceAll('-', '')}`
}

/** 날짜 문자열로 만드는 간단한 해시 — 매일 다른 질문을 고정적으로 고를 때 사용 */
export function dayHash(key: string) {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}
