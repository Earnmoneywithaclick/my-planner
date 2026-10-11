import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, requestPersistence, TABLES } from '../db'
import { todayKey } from '../lib/date'
import { Button, Card, PageHeader, SectionTitle } from '../components/ui'
import { ChevronLeft } from '../components/icons'

const BACKUP_APP = 'my-planner'

async function exportBackup() {
  const data: Record<string, unknown[]> = {}
  for (const t of TABLES) data[t] = await db.table(t).toArray()
  const json = JSON.stringify({ app: BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), data }, null, 1)
  const name = `플래너-백업-${todayKey()}.json`
  const file = new File([json], name, { type: 'application/json' })

  // 아이폰에서는 공유 시트로 '파일에 저장'·메일·카카오톡 등으로 보낼 수 있다
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function importBackup(file: File) {
  const parsed = JSON.parse(await file.text())
  if (parsed?.app !== BACKUP_APP || typeof parsed.data !== 'object') throw new Error('이 앱의 백업 파일이 아니에요.')
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      const rows = parsed.data[t]
      if (Array.isArray(rows)) await db.table(t).bulkPut(rows)
    }
  })
}

export default function Settings() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setPersisted(navigator.storage?.persisted ? await navigator.storage.persisted() : null)
    const c: Record<string, number> = {}
    for (const t of TABLES) c[t] = await db.table(t).count()
    setCounts(c)
  }
  useEffect(() => {
    refresh()
  }, [])

  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone

  return (
    <>
      <PageHeader
        title="설정"
        right={
          <Link to="/" className="h-10 px-2 flex items-center text-accent font-semibold text-[15px]">
            <ChevronLeft width={20} height={20} /> 오늘
          </Link>
        }
      />
      <div className="px-4 space-y-3">
        <Card>
          <SectionTitle>백업</SectionTitle>
          <p className="text-[14px] text-ink-2 leading-relaxed mb-3">
            모든 기록은 이 아이폰 안에만 저장돼요. 휴대폰을 바꾸거나 앱을 지우기 전에 백업 파일을 '파일' 앱이나 iCloud Drive에 저장해 두세요.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => exportBackup().catch((e) => setMsg(String(e)))}>
              백업 내보내기
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => fileRef.current?.click()}>
              백업 불러오기
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f || !confirm('지금 기록을 모두 지우고 백업 파일의 내용으로 바꿀까요?')) return
              try {
                await importBackup(f)
                setMsg('백업을 불러왔어요.')
                refresh()
              } catch (err) {
                setMsg(`불러오지 못했어요: ${(err as Error).message}`)
              }
            }}
          />
          {msg && <p className="text-[14px] text-accent font-semibold mt-3">{msg}</p>}
        </Card>

        <Card>
          <SectionTitle>저장 상태</SectionTitle>
          <ul className="text-[14px] text-ink-2 space-y-1">
            <li>
              계획 {counts.goals ?? 0} · 할 일 {counts.tasks ?? 0} · 일정 {counts.events ?? 0} · 시간표 {counts.timetable ?? 0}
            </li>
            <li>
              질문 {counts.questions ?? 0} · 답 {counts.answers ?? 0} · 성구 기록 {counts.dailyText ?? 0}
            </li>
            <li>
              영구 저장:{' '}
              {persisted ? (
                <b className="text-accent">켜짐</b>
              ) : (
                <button type="button" className="text-accent font-semibold underline" onClick={() => requestPersistence().then(refresh)}>
                  요청하기
                </button>
              )}
            </li>
          </ul>
        </Card>

        {!standalone && (
          <Card>
            <SectionTitle>아이폰 홈 화면에 앱으로 추가</SectionTitle>
            <ol className="text-[14px] text-ink-2 leading-relaxed list-decimal pl-5 space-y-1">
              <li>Safari에서 이 페이지를 열어요</li>
              <li>아래쪽 공유 버튼(□↑)을 눌러요</li>
              <li>'홈 화면에 추가'를 누르고 '추가'</li>
              <li>이제 홈 화면의 '플래너' 아이콘으로 열면 앱처럼 전체 화면으로 열려요</li>
            </ol>
            <p className="text-[13px] text-ink-3 mt-2">※ Safari로 연 기록과 홈 화면 앱의 기록은 따로 저장돼요. 처음부터 홈 화면 앱으로 쓰세요.</p>
          </Card>
        )}

        <Card>
          <SectionTitle>초기화</SectionTitle>
          <Button
            variant="danger"
            className="!px-0"
            onClick={async () => {
              if (!confirm('모든 기록을 삭제할까요? 되돌릴 수 없어요.')) return
              if (!confirm('정말 삭제할까요? 백업을 먼저 해 두는 걸 권해요.')) return
              await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
                for (const t of TABLES) await db.table(t).clear()
              })
              setMsg('모든 기록을 삭제했어요.')
              refresh()
            }}
          >
            모든 기록 삭제
          </Button>
        </Card>
      </div>
    </>
  )
}
