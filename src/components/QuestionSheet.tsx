import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Question } from '../db'
import { friendlyDate, fmt, shiftKey, todayKey } from '../lib/date'
import { Button, Field, Sheet, TextArea } from './ui'

export const CATEGORIES = ['하루 돌아보기', '우선순위', '목표', '나 자신', '관계', '영적인 것', '기타']

/** 답을 저장하고, '다시 보기' 예약이 지났다면 예약을 지운다 */
export async function saveAnswer(q: Question, text: string) {
  const today = todayKey()
  await db.answers.add({ questionId: q.id!, date: today, text: text.trim(), createdAt: Date.now() })
  if (q.nextReview && q.nextReview <= today) await db.questions.update(q.id!, { nextReview: undefined })
}

export function ReviewButtons({ q }: { q: Question }) {
  const today = todayKey()
  const opts: [string, number][] = [
    ['내일', 1],
    ['1주 뒤', 7],
    ['1달 뒤', 30],
  ]
  return (
    <div className="flex gap-2 flex-wrap items-center">
      {opts.map(([label, days]) => {
        const key = shiftKey(today, days)
        return (
          <button
            key={label}
            type="button"
            onClick={() => db.questions.update(q.id!, { nextReview: q.nextReview === key ? undefined : key })}
            className={`h-8 px-3 rounded-full text-[13px] font-semibold ${q.nextReview === key ? 'bg-gold text-bg' : 'bg-gold-soft text-gold'}`}
          >
            {label}
          </button>
        )
      })}
      {q.nextReview && <span className="text-[13px] text-ink-3">{friendlyDate(q.nextReview)} 다시 보기</span>}
    </div>
  )
}

/** 질문 상세: 답 쓰기 · 지난 답 · 다시 보기 예약 · 편집 */
export function QuestionSheet({ initial, onClose }: { initial: Partial<Question>; onClose: () => void }) {
  const isNew = initial.id == null
  const live = useLiveQuery(() => (initial.id != null ? db.questions.get(initial.id) : undefined), [initial.id])
  const answers = useLiveQuery(() => (initial.id != null ? db.answers.where('questionId').equals(initial.id).reverse().sortBy('createdAt') : []), [initial.id])
  const [text, setText] = useState(initial.text ?? '')
  const [category, setCategory] = useState(initial.category ?? CATEGORIES[0])
  const [answer, setAnswer] = useState('')
  const [editing, setEditing] = useState(isNew)
  const q = live ?? (initial as Question)

  async function saveQuestion() {
    if (!text.trim()) return
    if (isNew) {
      await db.questions.add({ text: text.trim(), category, pinned: 0, createdAt: Date.now() })
      onClose()
    } else {
      await db.questions.update(q.id!, { text: text.trim(), category })
      setEditing(false)
    }
  }

  async function submitAnswer() {
    if (!answer.trim()) return
    await saveAnswer(q, answer)
    setAnswer('')
  }

  async function remove() {
    if (confirm('이 질문과 지금까지의 답을 모두 삭제할까요?')) {
      await db.answers.where('questionId').equals(q.id!).delete()
      await db.questions.delete(q.id!)
      onClose()
    }
  }

  if (editing) {
    return (
      <Sheet
        open
        title={isNew ? '새 질문' : '질문 수정'}
        onClose={isNew ? onClose : () => setEditing(false)}
        footer={
          <Button className="flex-1" onClick={saveQuestion} disabled={!text.trim()}>
            저장
          </Button>
        }
      >
        <TextArea autoFocus placeholder="나에게 다시 묻고 싶은 질문" value={text} onChange={(e) => setText(e.target.value)} />
        <Field label="분류">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={`h-8 px-3 rounded-full text-[13px] font-semibold ${category === c ? 'bg-accent text-bg' : 'bg-card-2 text-ink-2'}`}>
                {c}
              </button>
            ))}
          </div>
        </Field>
      </Sheet>
    )
  }

  return (
    <Sheet
      open
      title="질문"
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={remove}>
            삭제
          </Button>
          <Button variant="ghost" onClick={() => db.questions.update(q.id!, { pinned: q.pinned ? 0 : 1 })}>
            {q.pinned ? '고정 해제' : '고정'}
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => setEditing(true)}>
            수정
          </Button>
        </>
      }
    >
      <div>
        <p className="text-[13px] font-semibold text-accent mb-1">{q.category}</p>
        <p className="text-[20px] font-bold leading-snug">{q.text}</p>
      </div>
      <Field label="오늘의 생각">
        <TextArea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="떠오르는 대로 적어 보세요" rows={4} />
      </Field>
      <Button className="w-full" onClick={submitAnswer} disabled={!answer.trim()}>
        답 저장
      </Button>
      <Field label="다시 생각해 보기">
        <ReviewButtons q={q} />
      </Field>
      {answers && answers.length > 0 && (
        <div>
          <p className="text-[13px] font-medium text-ink-3 mb-2">지난 답 {answers.length}개</p>
          <ul className="space-y-2">
            {answers.map((a) => (
              <li key={a.id} className="bg-card rounded-xl p-3">
                <p className="text-[12px] text-ink-3 mb-1">{fmt(a.date, 'yyyy년 M월 d일 (E)')}</p>
                <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{a.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  )
}
