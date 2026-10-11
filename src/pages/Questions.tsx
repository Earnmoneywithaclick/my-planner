import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Answer, type Question } from '../db'
import { fmt, friendlyDate } from '../lib/date'
import { useNow } from '../lib/hooks'
import { Card, Chip, Empty, IconButton, PageHeader, Segmented } from '../components/ui'
import { PinIcon, PlusIcon } from '../components/icons'
import { CATEGORIES, QuestionSheet } from '../components/QuestionSheet'

export default function Questions() {
  const { today } = useNow()
  const [mode, setMode] = useState<'list' | 'log'>('list')
  const [cat, setCat] = useState<string | null>(null)
  const [open, setOpen] = useState<Partial<Question> | null>(null)

  const data = useLiveQuery(async () => {
    const [questions, answers] = await Promise.all([db.questions.toArray(), db.answers.toArray()])
    const counts = new Map<number, number>()
    for (const a of answers) counts.set(a.questionId, (counts.get(a.questionId) ?? 0) + 1)
    return { questions, answers, counts, byId: new Map(questions.map((q) => [q.id!, q])) }
  }, [])

  const isDue = (q: Question) => !!q.nextReview && q.nextReview <= today
  const list = (data?.questions ?? [])
    .filter((q) => !cat || q.category === cat)
    .sort((a, b) => Number(isDue(b)) - Number(isDue(a)) || b.pinned - a.pinned || (a.nextReview ?? '9').localeCompare(b.nextReview ?? '9') || a.createdAt - b.createdAt)

  const usedCats = CATEGORIES.filter((c) => data?.questions.some((q) => q.category === c))

  return (
    <>
      <PageHeader
        title="질문"
        sub="다시 생각해 볼 것들"
        right={
          <IconButton label="질문 추가" className="bg-accent text-bg" onClick={() => setOpen({ category: cat ?? undefined })}>
            <PlusIcon />
          </IconButton>
        }
      />
      <div className="px-4 pb-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'list', label: '질문 목록' },
            { value: 'log', label: '나의 답 기록' },
          ]}
        />
      </div>

      {mode === 'list' ? (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
            <Chip active={!cat} onClick={() => setCat(null)}>
              전체
            </Chip>
            {usedCats.map((c) => (
              <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                {c}
              </Chip>
            ))}
          </div>
          <div className="px-4">
            <Card className="!py-1">
              {data && list.length === 0 && <Empty>질문이 없어요</Empty>}
              <ul className="divide-y divide-line">
                {list.map((q) => {
                  const n = data?.counts.get(q.id!) ?? 0
                  return (
                    <li key={q.id}>
                      <button type="button" onClick={() => setOpen(q)} className="w-full text-left py-3 flex gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[16px] leading-snug font-medium">{q.text}</p>
                          <p className="text-[12px] text-ink-3 mt-1 flex flex-wrap gap-x-2">
                            <span>{q.category}</span>
                            {n > 0 && <span>답 {n}개</span>}
                            {q.nextReview && <span className={isDue(q) ? 'text-gold font-bold' : ''}>{isDue(q) ? '지금 다시 볼 때' : `${friendlyDate(q.nextReview)} 다시 보기`}</span>}
                          </p>
                        </div>
                        {q.pinned === 1 && <PinIcon width={16} height={16} className="text-accent shrink-0 mt-1" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </div>
        </>
      ) : (
        <AnswerLog data={data} onOpen={setOpen} />
      )}

      {open && <QuestionSheet initial={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function AnswerLog({ data, onOpen }: { data: { answers: Answer[]; byId: Map<number, Question> } | undefined; onOpen: (q: Question) => void }) {
  if (!data) return null
  const sorted = [...data.answers].sort((a, b) => b.createdAt - a.createdAt)
  if (sorted.length === 0)
    return (
      <div className="px-4">
        <Card>
          <Empty>아직 적은 답이 없어요. 오늘 탭의 질문에 답해 보세요</Empty>
        </Card>
      </div>
    )

  const groups: { date: string; items: typeof sorted }[] = []
  for (const a of sorted) {
    const last = groups[groups.length - 1]
    if (last?.date === a.date) last.items.push(a)
    else groups.push({ date: a.date, items: [a] })
  }

  return (
    <div className="px-4 space-y-3">
      {groups.map((g) => (
        <section key={g.date}>
          <h2 className="text-[13px] font-bold text-ink-3 px-1 mb-1.5">{fmt(g.date, 'yyyy년 M월 d일 (E)')}</h2>
          <div className="space-y-2">
            {g.items.map((a) => {
              const q = data.byId.get(a.questionId)
              return (
                <button key={a.id} type="button" onClick={() => q && onOpen(q)} className="block w-full text-left">
                  <Card>
                    <p className="text-[13px] font-semibold text-accent leading-snug">{q?.text ?? '(삭제된 질문)'}</p>
                    <p className="text-[15px] mt-1.5 whitespace-pre-wrap leading-relaxed">{a.text}</p>
                  </Card>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
