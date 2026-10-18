import { useState } from 'react'
import { useLiveQuery, useObservable } from 'dexie-react-hooks'
import { addDays, differenceInCalendarDays } from 'date-fns'
import { biblePlanId, db, dayId, patchDay, type BiblePlan } from '../db'
import { BOOKS, bookName, scopes, chaptersOf, rangeLabel, readingUrl } from '../lib/bible'
import { fmt, fromKey, toKey } from '../lib/date'
import { useChanged } from '../lib/motion'
import { Button, Card, Chip, Segmented, Select, Sheet, TextInput } from './ui'
import { CheckIcon, ChevronRight, ExternalIcon } from './icons'
import { t } from '../lib/i18n'

const periods = (): [string, number][] => [
  [t('90일', '90 days'), 90],
  [t('180일', '180 days'), 180],
  [t('1년', '1 year'), 365],
  [t('2년', '2 years'), 730],
]

/** 계획 + 오늘 기록 */
function usePlan(today: string) {
  const userId = useObservable(db.cloud.currentUser)?.userId
  return useLiveQuery(async () => {
    const [plan, day] = await Promise.all([db.bible.get(biblePlanId()), db.days.get(dayId(today))])
    return { plan, day }
  }, [today, userId])
}

/** 오늘 화면의 '성경 읽기' 카드 */
export function BibleCard({ today }: { today: string }) {
  const data = usePlan(today)
  const [sheet, setSheet] = useState<'plan' | 'detail' | null>(null)
  const popped = useChanged(data?.day?.bibleTo, 400)
  if (!data) return null
  const { plan, day } = data

  if (!plan) {
    return (
      <Card>
        <h2 className="text-[17px] font-bold mb-3">{t('성경 읽기', 'Bible Reading')}</h2>
        <Button variant="soft" className="w-full" onClick={() => setSheet('plan')}>
          {t('읽기 계획 세우기', 'Make a reading plan')}
        </Button>
        {sheet === 'plan' && <PlanSheet today={today} onClose={() => setSheet(null)} />}
      </Card>
    )
  }

  const chapters = chaptersOf(plan.fromBook, plan.toBook)
  const total = chapters.length
  const doneToday = day?.bibleFrom != null && day?.bibleTo != null
  // 오늘 분량: 이미 '다 읽었어요'를 눌렀으면 그 범위, 아니면 지금 위치부터 하루 분량만큼
  const from = doneToday ? day!.bibleFrom! : plan.readUpTo + 1
  const to = doneToday ? day!.bibleTo! : Math.min(total, plan.readUpTo + plan.perDay)
  const finished = plan.readUpTo >= total && !doneToday
  const pct = Math.round((plan.readUpTo / total) * 100)
  // 계획대로라면 읽었어야 할 장 수와 비교 — 오늘 분량은 오늘 읽기 전까지는 셈에 넣지 않는다
  const elapsed = differenceInCalendarDays(fromKey(today), fromKey(plan.startDate)) + (doneToday ? 1 : 0)
  const expected = elapsed <= 0 ? 0 : Math.min(total, elapsed * plan.perDay)
  const diff = plan.readUpTo - expected
  const status = finished
    ? t('다 읽었어요', 'Finished')
    : diff === 0
      ? t('계획대로 가고 있어요', 'On track')
      : diff > 0
        ? t(`계획보다 ${diff}장 앞서요`, `${diff} chapter${diff > 1 ? 's' : ''} ahead`)
        : t(`계획보다 ${-diff}장 밀렸어요`, `${-diff} chapter${-diff > 1 ? 's' : ''} behind`)

  async function toggleDone() {
    if (!plan) return
    if (doneToday) {
      // 되돌리기: 오늘 표시한 범위 앞으로 위치를 돌려놓는다
      await db.bible.update(plan.id, { readUpTo: Math.min(plan.readUpTo, from - 1), updatedAt: Date.now() })
      await patchDay(today, { bibleFrom: undefined, bibleTo: undefined })
    } else {
      await db.bible.update(plan.id, { readUpTo: to, updatedAt: Date.now() })
      await patchDay(today, { bibleFrom: from, bibleTo: to })
    }
  }

  return (
    <Card>
      <button type="button" onClick={() => setSheet('detail')} className="w-full flex items-center justify-between min-h-8 mb-2 text-left">
        <h2 className="text-[17px] font-bold">{t('성경 읽기', 'Bible Reading')}</h2>
        <span className="flex items-center gap-1 text-[16px] font-semibold text-ink-2 tabular-nums">
          {pct}%
          <ChevronRight width={18} height={18} className="text-ink-3" />
        </span>
      </button>

      {finished ? (
        <p className="text-[19px] font-bold leading-snug mb-3">{t('계획한 범위를 모두 읽었어요', 'You’ve read the whole plan')}</p>
      ) : (
        <>
          <p className="text-[15px] font-semibold text-ink-3">{doneToday ? t('오늘 읽은 곳', 'Read today') : t('오늘 읽을 곳', 'Today’s reading')}</p>
          <p className={`text-[20px] font-bold leading-snug mb-3 ${popped ? 'animate-pop' : ''}`}>{rangeLabel(chapters[from - 1], chapters[to - 1])}</p>
          <div className="flex gap-2">
            <a
              href={readingUrl(chapters[from - 1], chapters[to - 1])}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-12 rounded-xl bg-card-2 text-ink font-semibold text-[16px] flex items-center justify-center gap-1.5 active:opacity-70"
            >
              {t('읽기', 'Read')} <ExternalIcon width={18} height={18} />
            </a>
            <button
              type="button"
              aria-pressed={doneToday}
              onClick={toggleDone}
              className={`flex-1 h-12 rounded-xl font-semibold text-[16px] flex items-center justify-center gap-1.5 active:opacity-70 ${doneToday ? 'bg-accent text-bg' : 'bg-accent-soft text-accent'}`}
            >
              {doneToday && <CheckIcon width={18} height={18} strokeWidth={2.6} className={popped ? 'animate-pop' : ''} />}
              {doneToday ? t('다 읽었어요', 'Done') : t('다 읽음', 'Mark done')}
            </button>
          </div>
        </>
      )}

      {/* 전체 진행률과 계획 대비 */}
      <div className="mt-3.5 h-2 rounded-full bg-card-2 overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-[15px] mt-2 ${diff < 0 && !finished ? 'text-gold' : 'text-ink-2'}`}>{status}</p>

      {sheet === 'plan' && <PlanSheet today={today} plan={plan} onClose={() => setSheet(null)} />}
      {sheet === 'detail' && <DetailSheet plan={plan} onEdit={() => setSheet('plan')} onClose={() => setSheet(null)} />}
    </Card>
  )
}

/** 계획 세우기·고치기: 범위, 시작일, 기간 또는 하루 분량 */
function PlanSheet({ today, plan, onClose }: { today: string; plan?: BiblePlan; onClose: () => void }) {
  const [fromBook, setFromBook] = useState(plan?.fromBook ?? 1)
  const [toBook, setToBook] = useState(plan?.toBook ?? 66)
  const [startDate, setStartDate] = useState(plan?.startDate ?? today)
  const [mode, setMode] = useState<'days' | 'perDay'>('days')
  const initialDays = plan ? differenceInCalendarDays(fromKey(plan.endDate), fromKey(plan.startDate)) + 1 : 365
  const [days, setDays] = useState(initialDays)
  const [perDay, setPerDay] = useState(plan?.perDay ?? 3)

  const total = chaptersOf(fromBook, Math.max(fromBook, toBook)).length
  const daily = mode === 'days' ? Math.max(1, Math.ceil(total / Math.max(1, days))) : perDay
  const length = Math.ceil(total / daily)
  const endDate = toKey(addDays(fromKey(startDate), length - 1))
  const scope = scopes().find((s) => s.from === fromBook && s.to === toBook)
  const [custom, setCustom] = useState(!scope)

  async function save() {
    const value: BiblePlan = {
      id: biblePlanId(),
      fromBook,
      toBook: Math.max(fromBook, toBook),
      startDate,
      endDate,
      perDay: daily,
      // 범위가 같으면 읽은 위치를 유지, 바뀌면 처음부터
      readUpTo: plan && plan.fromBook === fromBook && plan.toBook === toBook ? Math.min(plan.readUpTo, total) : 0,
      updatedAt: Date.now(),
    }
    await db.bible.put(value)
    onClose()
  }

  return (
    <Sheet
      open
      title={plan ? t('읽기 계획 수정', 'Edit reading plan') : t('성경 읽기 계획', 'Bible reading plan')}
      onClose={onClose}
      footer={
        <Button className="flex-1" onClick={save}>
          {t('저장', 'Save')}
        </Button>
      }
    >
      {/* 범위 */}
      <div className="flex flex-wrap gap-2">
        {scopes().map((s) => (
          <Chip
            key={s.label}
            active={!custom && s.from === fromBook && s.to === toBook}
            onClick={() => {
              setCustom(false)
              setFromBook(s.from)
              setToBook(s.to)
            }}
          >
            {s.label}
          </Chip>
        ))}
        <Chip active={custom} onClick={() => setCustom(true)}>
          {t('직접 고르기', 'Custom')}
        </Chip>
      </div>
      {custom && (
        <div className="flex items-center gap-2">
          <Select aria-label={t('시작 책', 'First book')} value={fromBook} onChange={(e) => setFromBook(Number(e.target.value))}>
            {BOOKS.map((b, i) => (
              <option key={b.name} value={i + 1}>
                {t(b.name, b.nameEn)}
              </option>
            ))}
          </Select>
          <span className="text-ink-3 text-[17px]">~</span>
          <Select aria-label={t('마지막 책', 'Last book')} value={toBook} onChange={(e) => setToBook(Number(e.target.value))}>
            {BOOKS.map((b, i) => (
              <option key={b.name} value={i + 1} disabled={i + 1 < fromBook}>
                {t(b.name, b.nameEn)}
              </option>
            ))}
          </Select>
        </div>
      )}

      <TextInput type="date" aria-label={t('시작일', 'Start date')} value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />

      {/* 기간으로 정할지, 하루 분량으로 정할지 */}
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'days', label: t('기간으로', 'By length') },
          { value: 'perDay', label: t('하루 분량으로', 'By daily amount') },
        ]}
      />
      {mode === 'days' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {periods().map(([label, d]) => (
              <Chip key={label} active={days === d} onClick={() => setDays(d)}>
                {label}
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <TextInput type="number" inputMode="numeric" min={1} aria-label={t('며칠 동안', 'Number of days')} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} />
            <span className="text-[17px] shrink-0">{t('일 동안', 'days')}</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="w-12 !px-0" aria-label={t('하루 분량 줄이기', 'Fewer per day')} onClick={() => setPerDay((n) => Math.max(1, n - 1))}>
            −
          </Button>
          <span className="flex-1 text-center text-[20px] font-bold tabular-nums">{t(`하루 ${perDay}장`, `${perDay} ch. a day`)}</span>
          <Button variant="ghost" className="w-12 !px-0" aria-label={t('하루 분량 늘리기', 'More per day')} onClick={() => setPerDay((n) => n + 1)}>
            +
          </Button>
        </div>
      )}

      {/* 계산 결과 */}
      <div className="bg-card-2 rounded-2xl p-4 text-center">
        <p className="text-[20px] font-bold">{t(`하루 ${daily}장`, `${daily} ch. a day`)}</p>
        <p className="text-[16px] text-ink-2 mt-1">
          {t(`${total}장 · ${fmt(endDate, 'yyyy년 M월 d일')}까지 ${length}일`, `${total} chapters · ${length} days, until ${fmt(endDate, 'yyyy년 M월 d일')}`)}
        </p>
      </div>
    </Sheet>
  )
}

/** 계획 자세히: 어디까지 읽었는지 고치기, 계획 수정·삭제 */
function DetailSheet({ plan, onEdit, onClose }: { plan: BiblePlan; onEdit: () => void; onClose: () => void }) {
  const chapters = chaptersOf(plan.fromBook, plan.toBook)
  const last = plan.readUpTo > 0 ? chapters[plan.readUpTo - 1] : undefined
  const [book, setBook] = useState(last?.book ?? plan.fromBook)
  const [chapter, setChapter] = useState(last?.chapter ?? 0)

  async function savePosition(b: number, c: number) {
    setBook(b)
    setChapter(c)
    const idx = c === 0 ? chapters.findIndex((x) => x.book === b) : chapters.findIndex((x) => x.book === b && x.chapter === c) + 1
    await db.bible.update(plan.id, { readUpTo: Math.max(0, idx), updatedAt: Date.now() })
  }

  return (
    <Sheet
      open
      title={t('성경 읽기', 'Bible Reading')}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="danger"
            onClick={async () => {
              await db.bible.delete(plan.id)
              onClose()
            }}
          >
            {t('계획 삭제', 'Delete plan')}
          </Button>
          <Button variant="ghost" className="flex-1" onClick={onEdit}>
            {t('계획 수정', 'Edit plan')}
          </Button>
        </>
      }
    >
      <div className="bg-card-2 rounded-2xl p-4">
        <p className="text-[18px] font-bold">
          {bookName(plan.fromBook)} ~ {bookName(plan.toBook)}
        </p>
        <p className="text-[16px] text-ink-2 mt-1">
          {t(`하루 ${plan.perDay}장`, `${plan.perDay} ch. a day`)} · {fmt(plan.startDate, 'M월 d일')} ~ {fmt(plan.endDate, 'yyyy년 M월 d일')}
        </p>
        <p className="text-[16px] text-ink-2">
          {t(`${chapters.length}장 중 ${plan.readUpTo}장 읽음`, `${plan.readUpTo} of ${chapters.length} chapters read`)}
        </p>
      </div>

      {/* 어디까지 읽었는지 */}
      <div className="space-y-2">
        <p className="text-[17px] font-bold">{t('어디까지 읽었나요?', 'How far have you read?')}</p>
        <div className="flex gap-2">
          <Select aria-label={t('책', 'Book')} value={book} onChange={(e) => savePosition(Number(e.target.value), 0)}>
            {BOOKS.slice(plan.fromBook - 1, plan.toBook).map((b, i) => (
              <option key={b.name} value={plan.fromBook + i}>
                {t(b.name, b.nameEn)}
              </option>
            ))}
          </Select>
          <Select aria-label={t('장', 'Chapter')} value={chapter} onChange={(e) => savePosition(book, Number(e.target.value))} className="!w-32 shrink-0">
            <option value={0}>{t('읽기 전', 'Not started')}</option>
            {Array.from({ length: BOOKS[book - 1].chapters }, (_, i) => (
              <option key={i} value={i + 1}>
                {t(`${i + 1}장까지`, `Through ch. ${i + 1}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Sheet>
  )
}
