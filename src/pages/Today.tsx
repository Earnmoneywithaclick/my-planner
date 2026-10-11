import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PlanEvent, type Question, type Task, type TimetableBlock } from '../db'
import { dayHash, fmt, nowHHmm } from '../lib/date'
import { useAgenda, useNow } from '../lib/hooks'
import { Button, Card, Empty, IconButton, PageHeader, SectionTitle, TextArea, TextInput } from '../components/ui'
import { GearIcon, PlusIcon } from '../components/icons'
import { DailyTextCard } from '../components/DailyTextCard'
import { AgendaList } from '../components/AgendaList'
import { TaskRow, TaskSheet } from '../components/TaskSheet'
import { BlockSheet, EventSheet } from '../components/ScheduleSheets'
import { QuestionSheet, saveAnswer } from '../components/QuestionSheet'

function greeting(hour: number) {
  if (hour < 5) return '편안한 밤이에요'
  if (hour < 11) return '좋은 아침이에요'
  if (hour < 17) return '좋은 오후예요'
  return '오늘 하루 수고했어요'
}

export default function Today() {
  const { now, today } = useNow()
  const agenda = useAgenda(today)
  const [taskEdit, setTaskEdit] = useState<Partial<Task> | null>(null)
  const [eventEdit, setEventEdit] = useState<Partial<PlanEvent> | null>(null)
  const [blockEdit, setBlockEdit] = useState<Partial<TimetableBlock> | null>(null)

  return (
    <>
      <PageHeader
        sub={fmt(today, 'M월 d일 EEEE')}
        title={greeting(now.getHours())}
        right={
          <Link to="/settings" aria-label="설정" className="size-10 grid place-items-center rounded-full text-ink-3 active:bg-card-2">
            <GearIcon />
          </Link>
        }
      />
      <div className="px-4 space-y-3">
        <DailyTextCard key={today} date={today} />

        <Card>
          <SectionTitle
            right={
              <IconButton label="오늘 일정 추가" className="-my-2 -mr-2 text-accent" onClick={() => setEventEdit({ date: today })}>
                <PlusIcon width={22} height={22} />
              </IconButton>
            }
          >
            오늘 일정
          </SectionTitle>
          <AgendaList items={agenda} now={nowHHmm()} emptyText="오늘은 정해진 일정이 없어요" onOpen={(it) => (it.kind === 'block' ? setBlockEdit(it.block) : setEventEdit(it.event))} />
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

function TodayTasks({ today, onOpen }: { today: string; onOpen: (t: Partial<Task>) => void }) {
  const [draft, setDraft] = useState('')
  const data = useLiveQuery(async () => {
    const [open, all, goals] = await Promise.all([db.tasks.where('done').equals(0).toArray(), db.tasks.toArray(), db.goals.toArray()])
    const startOfToday = new Date(today + 'T00:00:00').getTime()
    const due = open.filter((t) => t.dueDate && t.dueDate <= today).sort((a, b) => b.priority - a.priority || a.dueDate!.localeCompare(b.dueDate!))
    const doneToday = all.filter((t) => t.done && (t.doneAt ?? 0) >= startOfToday)
    const noDate = open.filter((t) => !t.dueDate).length
    return { due, doneToday, noDate, goals: new Map(goals.map((g) => [g.id!, g])) }
  }, [today])

  async function quickAdd() {
    const title = draft.trim()
    if (!title) return
    await db.tasks.add({ title, dueDate: today, priority: 1, done: 0, createdAt: Date.now() })
    setDraft('')
  }

  const total = (data?.due.length ?? 0) + (data?.doneToday.length ?? 0)
  return (
    <Card>
      <SectionTitle right={total > 0 && <span className="text-[13px] font-semibold text-ink-3">{data!.doneToday.length} / {total}</span>}>오늘 할 일</SectionTitle>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          quickAdd()
        }}
        className="flex gap-2 mb-1"
      >
        <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="할 일을 적고 추가" enterKeyHint="done" />
        <Button type="submit" variant="soft" className="shrink-0 !px-3" aria-label="할 일 추가" disabled={!draft.trim()}>
          <PlusIcon width={20} height={20} />
        </Button>
      </form>
      {data && total === 0 && <Empty>오늘 마감인 할 일이 없어요</Empty>}
      <ul className="divide-y divide-line">
        {[...(data?.due ?? []), ...(data?.doneToday ?? [])].map((t) => {
          const g = t.goalId != null ? data?.goals.get(t.goalId) : undefined
          return <TaskRow key={t.id} task={t} goalName={g?.title} goalColor={g?.color} onOpen={() => onOpen(t)} />
        })}
      </ul>
      {data && data.noDate > 0 && (
        <Link to="/tasks" className="block text-[14px] font-semibold text-accent pt-2">
          마감일 없는 할 일 {data.noDate}개 보기 →
        </Link>
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

  if (!data) return null
  if (!data.q)
    return (
      <Card>
        <SectionTitle>오늘의 질문</SectionTitle>
        <Empty>
          <Link to="/questions" className="text-accent font-semibold">
            질문을 추가해 보세요 →
          </Link>
        </Empty>
      </Card>
    )

  const q = data.q
  return (
    <Card>
      <SectionTitle
        right={
          <button type="button" onClick={() => setOffset((o) => o + 1)} className="text-[13px] font-semibold text-ink-3 h-8 -my-2">
            다른 질문
          </button>
        }
      >
        {data.review ? '다시 생각해 볼 질문' : '오늘의 질문'}
      </SectionTitle>
      <button type="button" onClick={() => setOpen(q)} className="text-left w-full">
        <p className="text-[12px] font-semibold text-accent mb-0.5">{q.category}</p>
        <p className="text-[18px] font-bold leading-snug">{q.text}</p>
      </button>
      {data.answered.length > 0 ? (
        <div className="mt-3 space-y-2">
          {data.answered.map((t, i) => (
            <p key={i} className="bg-card-2 rounded-xl p-3 text-[15px] whitespace-pre-wrap leading-relaxed">
              {t}
            </p>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <TextArea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="생각을 짧게 적어 보세요" />
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
