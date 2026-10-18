import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type Question } from '../db'
import { shiftKey, todayKey } from '../lib/date'
import { Button, Chip, Sheet, TextArea } from './ui'
import { AnimatedDiv } from './Animated'
import { questionCategory, questionText, t } from '../lib/i18n'

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
    [t('내일 다시', 'Tomorrow'), 1],
    [t('1주 뒤 다시', 'In a week'), 7],
    [t('1달 뒤 다시', 'In a month'), 30],
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
  const [text, setText] = useState(questionText(initial.text ?? ''))
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
      // 기본 질문을 영어로 보고 그대로 저장하면 원래 글(한국어)을 그대로 둔다
      const same = initial.text != null && text.trim() === questionText(initial.text)
      await db.questions.update(q.id!, { text: same ? initial.text : text.trim(), category })
      setEditing(false)
    }
  }

  async function submitAnswer() {
    if (!answer.trim()) return
    await saveAnswer(q, answer)
    setAnswer('')
  }

  // 묻지 않고 질문과 그 답을 함께 지운다
  async function remove() {
    await db.answers.where('questionId').equals(q.id!).delete()
    await db.questions.delete(q.id!)
    onClose()
  }

  if (editing) {
    return (
      <Sheet
        open
        title={isNew ? t('새 질문', 'New question') : t('질문 수정', 'Edit question')}
        onClose={isNew ? onClose : () => setEditing(false)}
        footer={
          <Button className="flex-1" onClick={saveQuestion} disabled={!text.trim()}>
            {t('저장', 'Save')}
          </Button>
        }
      >
        <TextArea autoFocus placeholder={t('나에게 다시 묻고 싶은 질문', 'A question to ask myself again')} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {questionCategory(c)}
            </Chip>
          ))}
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      open
      title={t('질문', 'Question')}
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={remove}>
            {t('삭제', 'Delete')}
          </Button>
          <Button variant="ghost" onClick={() => db.questions.update(q.id!, { pinned: q.pinned ? 0 : 1 })}>
            {q.pinned ? t('고정 해제', 'Unpin') : t('고정', 'Pin')}
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => setEditing(true)}>
            {t('수정', 'Edit')}
          </Button>
        </>
      }
    >
      <p className="text-[21px] font-bold leading-snug">{questionText(q.text)}</p>
      <TextArea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t('떠오르는 대로 적어 보세요', 'Write whatever comes to mind')} rows={4} />
      <Button className="w-full" onClick={submitAnswer} disabled={!answer.trim()}>
        {t('답 저장', 'Save answer')}
      </Button>
      <ReviewButtons q={q} />
      <AnimatedDiv className="space-y-4">
        {answers?.map((a) => (
          <p key={a.id} className="bg-card-2 rounded-xl p-3.5 text-[16px] whitespace-pre-wrap leading-relaxed">
            {a.text}
          </p>
        ))}
      </AnimatedDiv>
    </Sheet>
  )
}
