import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Answer, type Question } from '../db'
import { fmt } from '../lib/date'
import { useNow } from '../lib/hooks'
import { Card, Chip, IconButton, PageHeader, Segmented } from '../components/ui'
import { PinIcon, PlusIcon } from '../components/icons'
import { CATEGORIES, QuestionSheet } from '../components/QuestionSheet'
import { AnimatedDiv, AnimatedList, FlashLi } from '../components/Animated'

export default function Questions() {
  const { today } = useNow()
  const [mode, setMode] = useState<'list' | 'log'>('list')
  const [cat, setCat] = useState<string | null>(null)
  const [open, setOpen] = useState<Partial<Question> | null>(null)

  const data = useLiveQuery(async () => {
    const [questions, answers] = await Promise.all([db.questions.toArray(), db.answers.toArray()])
    return { questions, answers, byId: new Map(questions.map((q) => [q.id!, q])) }
  }, [])

  // 다시 볼 때가 된 질문 → 고정 → 나머지 순
  const isDue = (q: Question) => !!q.nextReview && q.nextReview <= today
  const list = (data?.questions ?? [])
    .filter((q) => !cat || q.category === cat)
    .sort((a, b) => Number(isDue(b)) - Number(isDue(a)) || b.pinned - a.pinned || a.createdAt - b.createdAt)

  const usedCats = CATEGORIES.filter((c) => data?.questions.some((q) => q.category === c))

  return (
    <>
      <PageHeader
        title="질문"
        right={
          <IconButton label="질문 추가" className="bg-accent text-bg" onClick={() => setOpen({ category: cat ?? undefined })}>
            <PlusIcon />
          </IconButton>
        }
      />
      <div className="gutter pb-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'list', label: '질문' },
            { value: 'log', label: '나의 답' },
          ]}
        />
      </div>

      {mode === 'list' ? (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar gutter pb-3">
            <Chip active={!cat} onClick={() => setCat(null)}>
              전체
            </Chip>
            {usedCats.map((c) => (
              <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                {c}
              </Chip>
            ))}
          </div>
          {list.length > 0 && (
            <div className="gutter">
              <Card className="!py-1">
                <AnimatedList className="divide-y divide-line">
                  {list.map((q) => (
                    <FlashLi key={q.id} signal={`${q.text}|${q.pinned}|${q.nextReview}|${q.category}`}>
                      <button type="button" onClick={() => setOpen(q)} className="w-full text-left py-3.5 flex items-center gap-3">
                        {isDue(q) && <span className="size-2.5 rounded-full bg-gold shrink-0" aria-label="다시 볼 때" />}
                        <span className="flex-1 min-w-0 text-[17px] leading-snug">{q.text}</span>
                        {q.pinned === 1 && <PinIcon width={18} height={18} className="text-accent shrink-0" />}
                      </button>
                    </FlashLi>
                  ))}
                </AnimatedList>
              </Card>
            </div>
          )}
        </>
      ) : (
        <AnswerLog data={data} onOpen={setOpen} />
      )}

      {open && <QuestionSheet initial={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function AnswerLog({ data, onOpen }: { data: { answers: Answer[]; byId: Map<string, Question> } | undefined; onOpen: (q: Question) => void }) {
  if (!data?.answers.length) return null
  const sorted = [...data.answers].sort((a, b) => b.createdAt - a.createdAt)

  const groups: { date: string; items: Answer[] }[] = []
  for (const a of sorted) {
    const last = groups[groups.length - 1]
    if (last?.date === a.date) last.items.push(a)
    else groups.push({ date: a.date, items: [a] })
  }

  return (
    <AnimatedDiv className="gutter board">
      {groups.map((g) => (
        <section key={g.date}>
          <h2 className="text-[17px] font-bold px-1 mb-2">{fmt(g.date, 'M월 d일 (E)')}</h2>
          <div className="space-y-2">
            {g.items.map((a) => {
              const q = data.byId.get(a.questionId)
              return (
                <button key={a.id} type="button" onClick={() => q && onOpen(q)} className="block w-full text-left">
                  <Card>
                    {q && <p className="text-[16px] font-semibold text-accent leading-snug">{q.text}</p>}
                    <p className="text-[16px] mt-1.5 whitespace-pre-wrap leading-relaxed">{a.text}</p>
                  </Card>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </AnimatedDiv>
  )
}
