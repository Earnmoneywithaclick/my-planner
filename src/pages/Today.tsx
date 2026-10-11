import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type PlanEvent, type Question, type Task, type TimetableBlock } from '../db'
import { dayHash, fmt, nowHHmm } from '../lib/date'
import { useAgenda, useNow } from '../lib/hooks'
import { Button, Card, IconButton, PageHeader, SectionTitle, TextArea, TextInput } from '../components/ui'
import { GearIcon, PlusIcon } from '../components/icons'
import { DailyTextCard } from '../components/DailyTextCard'
import { AgendaList } from '../components/AgendaList'
import { TaskRow, TaskSheet } from '../components/TaskSheet'
import { BlockSheet, EventSheet } from '../components/ScheduleSheets'
import { QuestionSheet, saveAnswer } from '../components/QuestionSheet'
import { AnimatedList } from '../components/Animated'

export default function Today() {
  const { today } = useNow()
  const agenda = useAgenda(today)
  const [taskEdit, setTaskEdit] = useState<Partial<Task> | null>(null)
  const [eventEdit, setEventEdit] = useState<Partial<PlanEvent> | null>(null)
  const [blockEdit, setBlockEdit] = useState<Partial<TimetableBlock> | null>(null)

  return (
    <>
      <PageHeader
        title={fmt(today, 'M월 d일 EEEE')}
        right={
          <Link to="/settings" aria-label="설정" className="size-11 grid place-items-center rounded-full text-ink-3 active:bg-card-2">
            <GearIcon />
          </Link>
        }
      />
      <div className="gutter board">
        <DailyTextCard key={today} date={today} />

        <Card>
          <SectionTitle
            right={
              <IconButton label="오늘 일정 추가" className="-my-2 -mr-2 text-accent" onClick={() => setEventEdit({ date: today })}>
                <PlusIcon />
              </IconButton>
            }
          >
            오늘 일정
          </SectionTitle>
          <AgendaList items={agenda} now={nowHHmm()} onOpen={(it) => (it.kind === 'block' ? setBlockEdit(it.block) : setEventEdit(it.event))} />
        </Card>

        <TodayTasks today={today} onOpen={setTaskEdit} />

        <TodayQuestion today={today} />
      </div>

      {taskEdit && <TaskSheet initial={taskEdit} onClose={() => setTaskEdit(null)} />}
      {eventEdit && <EventSheet initial={eventEdit} onClose={() => setEventEdit(null)} />}
      {blockEdit && <BlockSheet initial={blockEdit} onClose={() => setBlockEdit(null)} />}
    </>
  )
}

/** 오늘까지 마감인 일(지난 것 포함) + 오늘 끝낸 일 */
function TodayTasks({ today, onOpen }: { today: string; onOpen: (t: Partial<Task>) => void }) {
  const [draft, setDraft] = useState('')
  const data = useLiveQuery(async () => {
    const [all, goals] = await Promise.all([db.tasks.toArray(), db.goals.toArray()])
    const startOfToday = new Date(today + 'T00:00:00').getTime()
    const due = all.filter((t) => !t.done && t.dueDate && t.dueDate <= today).sort((a, b) => b.priority - a.priority || a.dueDate!.localeCompare(b.dueDate!))
    const doneToday = all.filter((t) => t.done && (t.doneAt ?? 0) >= startOfToday)
    return { tasks: [...due, ...doneToday], goals: new Map(goals.map((g) => [g.id!, g])) }
  }, [today])

  async function quickAdd() {
    const title = draft.trim()
    if (!title) return
    await db.tasks.add({ id: newId(), title, dueDate: today, priority: 1, done: 0, createdAt: Date.now() })
    setDraft('')
  }

  return (
    <Card>
      <SectionTitle>오늘 할 일</SectionTitle>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          quickAdd()
        }}
        className="flex gap-2"
      >
        <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="할 일 추가" enterKeyHint="done" />
        <Button type="submit" variant="soft" className="shrink-0 !px-3.5" aria-label="할 일 추가" disabled={!draft.trim()}>
          <PlusIcon />
        </Button>
      </form>
      {data && (
        <AnimatedList className="divide-y divide-line mt-1">
          {data.tasks.map((t) => (
            <TaskRow key={t.id} task={t} goalColor={t.goalId != null ? data.goals.get(t.goalId)?.color : undefined} onOpen={() => onOpen(t)} />
          ))}
        </AnimatedList>
      )}
    </Card>
  )
}

function TodayQuestion({ today }: { today: string }) {
  const [offset, setOffset] = useState(0)
  const [answer, setAnswer] = useState('')
  const [open, setOpen] = useState<Question | null>(null)
  const data = useLiveQuery(async () => {
    const qs = await db.questions.toArray()
    if (qs.length === 0) return { q: undefined, review: false, answered: [] as string[] }
    // '다시 보기'로 예약된 질문이 먼저, 없으면 고정 질문 중에서, 그것도 없으면 전체에서 날짜마다 돌아가며
    const due = qs.filter((q) => q.nextReview && q.nextReview <= today).sort((a, b) => a.nextReview!.localeCompare(b.nextReview!))
    const pinned = qs.filter((q) => q.pinned)
    const pool = due.length ? due : pinned.length ? pinned : qs
    // 오늘 이미 답한 질문이 있으면 그 질문을 계속 보여준다 (답하면 다시 보기 예약이 풀려 목록이 바뀌므로)
    const answeredToday = await db.answers.where('date').equals(today).last()
    const q = (offset === 0 && answeredToday && qs.find((x) => x.id === answeredToday.questionId)) || pool[(dayHash(today) + offset) % pool.length]
    const answered = (await db.answers.where('questionId').equals(q.id!).filter((a) => a.date === today).toArray()).map((a) => a.text)
    return { q, review: due.includes(q), answered }
  }, [today, offset])

  if (!data?.q) return null
  const q = data.q
  return (
    <Card>
      <SectionTitle
        right={
          <button type="button" onClick={() => setOffset((o) => o + 1)} className="text-[15px] font-semibold text-accent h-11 -my-2">
            다른 질문
          </button>
        }
      >
        {data.review ? '다시 생각해 볼 질문' : '오늘의 질문'}
      </SectionTitle>
      <button type="button" onClick={() => setOpen(q)} className="text-left w-full text-[19px] font-bold leading-snug">
        {q.text}
      </button>
      {data.answered.length > 0 ? (
        <div className="mt-3 space-y-2">
          {data.answered.map((t, i) => (
            <p key={i} className="bg-card-2 rounded-xl p-3.5 text-[16px] whitespace-pre-wrap leading-relaxed animate-fade">
              {t}
            </p>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <TextArea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="생각 적기" />
          <Button
            variant="soft"
            className="w-full"
            disabled={!answer.trim()}
            onClick={async () => {
              await saveAnswer(q, answer)
              setAnswer('')
            }}
          >
            답 저장
          </Button>
        </div>
      )}
      {open && <QuestionSheet initial={open} onClose={() => setOpen(null)} />}
    </Card>
  )
}
