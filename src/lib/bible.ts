// 신세계역 연구용 성경 (jw.org) 기준 책 이름과 장 수. 책 번호 = 배열 순서 + 1.
export const BOOKS: { name: string; chapters: number }[] = [
  ['창세기', 50], ['출애굽기', 40], ['레위기', 27], ['민수기', 36], ['신명기', 34], ['여호수아', 24], ['사사기', 21], ['룻기', 4],
  ['사무엘상', 31], ['사무엘하', 24], ['열왕기상', 22], ['열왕기하', 25], ['역대기상', 29], ['역대기하', 36], ['에스라', 10], ['느헤미야', 13],
  ['에스더', 10], ['욥기', 42], ['시편', 150], ['잠언', 31], ['전도서', 12], ['솔로몬의 노래', 8], ['이사야', 66], ['예레미야', 52],
  ['예레미야 애가', 5], ['에스겔', 48], ['다니엘', 12], ['호세아', 14], ['요엘', 3], ['아모스', 9], ['오바댜', 1], ['요나', 4],
  ['미가', 7], ['나훔', 3], ['하박국', 3], ['스바냐', 3], ['학개', 2], ['스가랴', 14], ['말라기', 4],
  ['마태복음', 28], ['마가복음', 16], ['누가복음', 24], ['요한복음', 21], ['사도행전', 28], ['로마서', 16], ['고린도 전서', 16], ['고린도 후서', 13],
  ['갈라디아서', 6], ['에베소서', 6], ['빌립보서', 4], ['골로새서', 4], ['데살로니가 전서', 5], ['데살로니가 후서', 3], ['디모데 전서', 6], ['디모데 후서', 4],
  ['디도서', 3], ['빌레몬서', 1], ['히브리서', 13], ['야고보서', 5], ['베드로 전서', 5], ['베드로 후서', 3], ['요한 1서', 5], ['요한 2서', 1],
  ['요한 3서', 1], ['유다서', 1], ['요한 계시록', 22],
].map(([name, chapters]) => ({ name: name as string, chapters: chapters as number }))

/** 읽기 범위 빠른 선택 */
export const SCOPES = [
  { label: '성경 전체', from: 1, to: 66 },
  { label: '히브리어-아람어 성경', from: 1, to: 39 },
  { label: '그리스도인 그리스어 성경', from: 40, to: 66 },
]

export type Chapter = { book: number; chapter: number }

/** fromBook ~ toBook 의 모든 장을 순서대로 (책 번호는 1부터) */
export function chaptersOf(fromBook: number, toBook: number): Chapter[] {
  const out: Chapter[] = []
  for (let b = fromBook; b <= toBook; b++) for (let c = 1; c <= BOOKS[b - 1].chapters; c++) out.push({ book: b, chapter: c })
  return out
}

/** '창세기 4–6장', '시편 119장', '창세기 50장 – 출애굽기 2장' */
export function rangeLabel(from: Chapter, to: Chapter) {
  const a = BOOKS[from.book - 1].name
  if (from.book === to.book) return from.chapter === to.chapter ? `${a} ${from.chapter}장` : `${a} ${from.chapter}–${to.chapter}장`
  return `${a} ${from.chapter}장 – ${BOOKS[to.book - 1].name} ${to.chapter}장`
}

const verseCode = (book: number, chapter: number, verse: number) => `${String(book).padStart(2, '0')}${String(chapter).padStart(3, '0')}${String(verse).padStart(3, '0')}`

/**
 * 오늘 읽을 곳을 여는 jw.org 공유 링크 (연구용 성경). JW Library 앱이 있으면 앱에서 그 장이 바로 열리고,
 * 없으면 jw.org 웹 성경으로 간다. 같은 책 안의 여러 장이면 마지막 장까지 범위로 건넨다.
 */
export function readingUrl(from: Chapter, to: Chapter = from) {
  const end = to.book === from.book ? to.chapter : from.chapter
  const range = `${verseCode(from.book, from.chapter, 1)}-${verseCode(from.book, end, 999)}`
  return `https://www.jw.org/finder?srcid=jwlshare&wtlocale=KO&prefer=lang&pub=nwtsty&bible=${range}`
}
