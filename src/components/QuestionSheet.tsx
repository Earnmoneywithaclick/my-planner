import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type Question } from '../db'
import { shiftKey, todayKey } from '../lib/date'
import { Button, Chip, Sheet, TextArea } from './ui'

export const CATEGORIES = ['하루 돌아보기', '우선순위', '목표', '나 자신', '관계', '영적인 것', '기타']

/** 답을 저장하고, '다시 보기' 예약이 지났다면 예약을 지운다 */
export async function saveAnswer(q: Question, text: string) {
  const today = todayKey()
  await db.answers.add({ id: newId(), questionId: q.id!, date: today, text: text.trim(), createdAt: Date.now() })
  if (q.nextReview && q.nextReview <= today) await db.questions.update(q.id!, { nextReview: undefined })
}

/** 내일 / 1주 뒤 / 1달 뒤 다시 보기 예약 (다시 누르면 취소) */
function ReviewButtons({ q }: { q: Question }) {
  const today = todayKey()
  const opts: [string, number][] = [
    ['내일 다시', 1],
    ['1주 뒤 다시', 7],
    ['1달 뒤 다시', 30],
  ]
  return (
    <div className="flex gap-2">
      {opts.map(([label, days]) => {
        const key = shiftKey(today, days)
        const on = q.nextReview === key
        return (
          <button
            key={label}
            type="button"
            aria-pressed={on}
            onClick={() => db.questions.update(q.id!, { nextReview: on ? undefined : key })}
            className={`flex-1 h-11 rounded-xl text-[15px] font-semibold ${on ? 'bg-gold text-bg' : 'bg-gold-soft text-gold'}`}
          >
            {label}
          </button>
        )
      })}
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
      await db.questions.add({ id: newId(), text: text.trim(), category, pinned: 0, createdAt: Date.now() })
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
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>
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
      <p className="text-[21px] font-bold leading-snug">{q.text}</p>
      <TextArea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="떠오르는 대로 적어 보세요" rows={4} />
      <Button className="w-full" onClick={submitAnswer} disabled={!answer.trim()}>
        답 저장
      </Button>
      <ReviewButtons q={q} />
      {answers?.map((a) => (
        <p key={a.id} className="bg-card-2 rounded-xl p-3.5 text-[16px] whitespace-pre-wrap leading-relaxed">
          {a.text}
        </p>
      ))}
    </Sheet>
  )
}
