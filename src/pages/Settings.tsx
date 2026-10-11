import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useObservable } from 'dexie-react-hooks'
import { db, replaceAll, TABLES } from '../db'
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
  // 예전(동기화 전) 백업은 숫자 id 라서 replaceAll 이 새 id 로 바꿔 넣는다
  await replaceAll(parsed.data)
}

const SYNC_LABEL: Record<string, string> = {
  'in-sync': '동기화됨',
  pushing: '보내는 중',
  pulling: '받는 중',
  initial: '준비 중',
  'not-in-sync': '기다리는 중',
  offline: '오프라인',
  error: '동기화 오류',
}

function SyncCard() {
  const user = useObservable(db.cloud.currentUser)
  const sync = useObservable(db.cloud.syncState)
  const [busy, setBusy] = useState(false)
  const status = sync?.phase === 'offline' || sync?.status === 'offline' ? 'offline' : sync?.error ? 'error' : (sync?.phase ?? 'initial')

  return (
    <Card>
      <SectionTitle right={<span className={`text-[15px] font-semibold ${status === 'error' ? 'text-danger' : 'text-accent'}`}>{SYNC_LABEL[status] ?? status}</span>}>동기화</SectionTitle>
      {user?.isLoggedIn && <p className="text-[16px] mb-3 break-all">{user.email}</p>}
      <div className="flex gap-2">
        <Button
          variant="soft"
          className="flex-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await db.cloud.sync({ wait: true, purpose: 'pull' })
            } finally {
              setBusy(false)
            }
          }}
        >
          지금 동기화
        </Button>
        {user?.isLoggedIn && (
          <Button
            variant="ghost"
            onClick={async () => {
              if (confirm('로그아웃할까요? 이 기기의 기록은 지워지고, 다시 로그인하면 받아와요.')) await db.cloud.logout()
            }}
          >
            로그아웃
          </Button>
        )}
      </div>
    </Card>
  )
}

export default function Settings() {
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone

  return (
    <>
      <PageHeader
        title="설정"
        right={
          <Link to="/" className="h-11 px-2 flex items-center text-accent font-semibold text-[16px]">
            <ChevronLeft width={22} height={22} /> 오늘
          </Link>
        }
      />
      <div className="gutter board">
        <SyncCard />

        <Card>
          <SectionTitle>백업</SectionTitle>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => exportBackup().catch((e) => setMsg(String(e)))}>
              내보내기
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => fileRef.current?.click()}>
              불러오기
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
              } catch (err) {
                setMsg(`불러오지 못했어요: ${(err as Error).message}`)
              }
            }}
          />
          {msg && <p className="text-[16px] text-accent font-semibold mt-3">{msg}</p>}
        </Card>

        {!standalone && (
          <Card>
            <SectionTitle>홈 화면에 추가</SectionTitle>
            <p className="text-[16px] leading-relaxed">Safari 공유 버튼 → 홈 화면에 추가</p>
          </Card>
        )}

        <Card>
          <Button
            variant="danger"
            className="!px-0"
            onClick={async () => {
              if (!confirm('모든 기록을 삭제할까요? 되돌릴 수 없어요.')) return
              if (!confirm('정말 삭제할까요? 백업을 먼저 해 두는 걸 권해요.')) return
              await db.transaction('rw', [...TABLES, 'dailyText'].map((t) => db.table(t)), async () => {
                for (const t of [...TABLES, 'dailyText']) await db.table(t).clear()
              })
              setMsg('모든 기록을 삭제했어요.')
            }}
          >
            모든 기록 삭제
          </Button>
        </Card>
      </div>
    </>
  )
}
