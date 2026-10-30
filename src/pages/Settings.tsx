import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, deleteAll, PALETTE, replaceAll, TABLES } from '../db'
import { todayKey } from '../lib/date'
import { Button, Card, CheckCircle, IconButton, PageHeader, SectionTitle, Segmented, TextArea, TextInput } from '../components/ui'
import { recolorCategory, renameCategory, useCategories } from '../components/Categories'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from '../components/icons'
import { deleteRequest, sendFeatureRequest, setRequestDone, useFeatureRequests, useMembers } from '../lib/feedback'
import { isOwner, useAccount } from '../lib/firebase'
import { logout, retrySync, useSyncStatus } from '../lib/sync'
import { openLogin } from '../components/LoginGate'
import { fmt, toKey } from '../lib/date'
import { saveTodayLayout, todayCardName, useTodayLayout, type TodayCard } from '../lib/layout'
import { setLang, t, useLang } from '../lib/i18n'

const BACKUP_APP = 'my-planner'

async function exportBackup() {
  const data: Record<string, unknown[]> = {}
  for (const t of TABLES) data[t] = await db.table(t).toArray()
  const json = JSON.stringify({ app: BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), data }, null, 1)
  const name = `${t('플래너-백업', 'planner-backup')}-${todayKey()}.json`
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
  if (parsed?.app !== BACKUP_APP || typeof parsed.data !== 'object') throw new Error(t('이 앱의 백업 파일이 아니에요.', 'This isn’t a backup file from this app.'))
  // 예전(동기화 전) 백업은 숫자 id 라서 replaceAll 이 새 id 로 바꿔 넣는다
  await replaceAll(parsed.data)
}

const syncLabel = (): Record<string, string> =>
  t(
    { synced: '동기화됨', sending: '보내는 중', starting: '준비 중', offline: '오프라인', denied: '동기화 오류', error: '동기화 오류', guest: '' },
    { synced: 'Synced', sending: 'Sending', starting: 'Starting', offline: 'Offline', denied: 'Sync error', error: 'Sync error', guest: '' },
  )

/** 화면 언어 (이 기기에만 적용) */
function LanguageCard() {
  const lang = useLang()
  return (
    <Card>
      <SectionTitle>{t('언어', 'Language')}</SectionTitle>
      <Segmented
        value={lang}
        onChange={setLang}
        options={[
          { value: 'ko', label: '한국어' },
          { value: 'en', label: 'English' },
        ]}
      />
    </Card>
  )
}

function SyncCard() {
  const user = useAccount()
  const status = useSyncStatus()

  return (
    <Card>
      <SectionTitle right={user && <span className={`text-[15px] font-semibold ${status === 'error' || status === 'denied' ? 'text-danger' : 'text-accent'}`}>{syncLabel()[status]}</span>}>{t('동기화', 'Sync')}</SectionTitle>
      {user && <p className="text-[16px] mb-3 break-all">{user.email}</p>}
      {user === null && (
        <>
          <p className="text-[16px] leading-relaxed text-ink-2 mb-3">
            {t('지금은 기록이 이 기기에만 저장돼요. 이메일로 로그인하면 그때부터 지금까지의 기록이 계정으로 올라가고 다른 기기와 맞춰져요.', 'Right now your data is stored on this device only. Log in with email to upload it to your account and sync with your other devices from then on.')}
          </p>
          <Button className="w-full" onClick={openLogin}>
            {t('이메일로 로그인', 'Log in with email')}
          </Button>
        </>
      )}
      {user && (
        <div className="flex gap-2">
          {(status === 'denied' || status === 'error') && (
            <Button variant="soft" className="flex-1" onClick={retrySync}>
              {t('다시 시도', 'Try again')}
            </Button>
          )}
          <Button
            variant="ghost"
            className="flex-1"
            onClick={async () => {
              if (confirm(t('로그아웃할까요? 이 기기의 기록은 지워지고(계정에는 남아요), 빈 상태로 다시 시작해요.', 'Log out? Data on this device will be cleared (it stays in your account) and the app starts empty.'))) await logout()
            }}
          >
            {t('로그아웃', 'Log out')}
          </Button>
        </div>
      )}
    </Card>
  )
}

/**
 * 카테고리 이름·색 바꾸기. 이름은 입력칸에서 나가면 저장 (비우면 기본 이름으로),
 * 색은 동그라미를 누르면 펼쳐지는 색 중에서 고른다 (다른 카테고리가 쓰는 색은 고를 수 없음).
 */
function CategoryCard() {
  const categories = useCategories()
  const [picking, setPicking] = useState<number | null>(null)
  return (
    <Card>
      <SectionTitle>{t('카테고리', 'Categories')}</SectionTitle>
      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.slot}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t(`${c.name} 색 바꾸기`, `Change ${c.name} color`)}
                aria-expanded={picking === c.slot}
                onClick={() => setPicking(picking === c.slot ? null : c.slot)}
                className="size-11 grid place-items-center shrink-0"
              >
                <span
                  className="size-7 rounded-full transition-colors"
                  style={{ background: c.color, boxShadow: picking === c.slot ? `0 0 0 2px var(--card), 0 0 0 4px ${c.color}` : undefined }}
                />
              </button>
              <TextInput
                key={c.name}
                aria-label={t('카테고리 이름', 'Category name')}
                defaultValue={c.name}
                enterKeyHint="done"
                onBlur={(e) => e.target.value !== c.name && renameCategory(c.slot, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            </div>
            {picking === c.slot && (
              <div className="grid grid-cols-8 gap-2.5 py-3 px-1 animate-fade">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={t(`색 ${color}`, `Color ${color}`)}
                    disabled={categories.some((o) => o.slot !== c.slot && o.color === color)}
                    onClick={async () => {
                      await recolorCategory(c.slot, color)
                      setPicking(null)
                    }}
                    className="aspect-square rounded-full disabled:opacity-15"
                    style={{ background: color, boxShadow: c.color === color ? `0 0 0 2px var(--card), 0 0 0 4px ${color}` : undefined }}
                  />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** 오늘 화면 카드 순서 바꾸기 · 보이기/숨기기 (계정마다 따로, 기기끼리 동기화) */
function LayoutCard() {
  const layout = useTodayLayout()
  if (!layout) return null
  const { order, hidden } = layout
  const move = (i: number, d: -1 | 1) => {
    const next = [...order]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    saveTodayLayout({ order: next, hidden })
  }
  const toggle = (k: TodayCard) => saveTodayLayout({ order, hidden: hidden.includes(k) ? hidden.filter((h) => h !== k) : [...hidden, k] })
  return (
    <Card>
      <SectionTitle>{t('오늘 화면', 'Today screen')}</SectionTitle>
      <ul className="divide-y divide-line">
        {order.map((k, i) => {
          const name = todayCardName(k)
          const shown = !hidden.includes(k)
          return (
            <li key={k} className="flex items-center gap-2 py-1">
              <CheckCircle checked={shown} onChange={() => toggle(k)} label={t(`${name} 보이기`, `Show ${name}`)} />
              <span className={`flex-1 text-[16px] font-semibold ${shown ? '' : 'text-ink-3'}`}>{name}</span>
              <IconButton label={t(`${name} 위로`, `Move ${name} up`)} disabled={i === 0} className="text-ink-2 disabled:opacity-25" onClick={() => move(i, -1)}>
                <ChevronUp />
              </IconButton>
              <IconButton label={t(`${name} 아래로`, `Move ${name} down`)} disabled={i === order.length - 1} className="text-ink-2 disabled:opacity-25" onClick={() => move(i, 1)}>
                <ChevronDown />
              </IconButton>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** 원하는 기능 적어 보내기 (손님도 보낼 수 있다) */
function RequestCard() {
  const [draft, setDraft] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Card>
      <SectionTitle>{t('기능 요청', 'Feature request')}</SectionTitle>
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const text = draft.trim()
          if (!text) return
          setBusy(true)
          try {
            await sendFeatureRequest(text)
            setDraft('')
            setMsg(t('보냈어요. 고마워요!', 'Sent. Thank you!'))
          } catch {
            setMsg(t('보내지 못했어요. 인터넷 연결을 확인해 주세요.', 'Couldn’t send. Check your internet connection.'))
          } finally {
            setBusy(false)
          }
        }}
      >
        <TextArea value={draft} maxLength={2000} onChange={(e) => (setDraft(e.target.value), setMsg(''))} placeholder={t('원하는 기능을 적어 주세요', 'Describe a feature you’d like')} />
        <Button type="submit" className="w-full" disabled={busy || !draft.trim()}>
          {t('보내기', 'Send')}
        </Button>
      </form>
      {msg && <p className="text-[16px] text-accent font-semibold mt-3">{msg}</p>}
    </Card>
  )
}

/** 받은 기능 요청 — 앱 주인 계정에서만 보인다 */
function RequestInbox() {
  const owner = isOwner(useAccount())
  const requests = useFeatureRequests(owner)
  if (!owner || !requests) return null
  const done = requests.filter((r) => r.done)
  return (
    <Card>
      <SectionTitle
        right={
          done.length > 0 && (
            <button type="button" className="h-11 -my-2 px-1 text-[15px] font-semibold text-danger" onClick={() => done.forEach((r) => deleteRequest(r.id))}>
              {t('완료 지우기', 'Clear done')}
            </button>
          )
        }
      >
        {t(`받은 요청 ${requests.length - done.length}`, `Requests ${requests.length - done.length}`)}
      </SectionTitle>
      <ul className="divide-y divide-line">
        {requests.map((r) => (
          <li key={r.id} className="flex gap-3 py-3">
            <div className="pt-0.5">
              <CheckCircle checked={!!r.done} onChange={() => setRequestDone(r.id, !r.done)} label={t('완료', 'Done')} />
            </div>
            <div className={`flex-1 min-w-0 ${r.done ? 'opacity-45' : ''}`}>
              <p className="text-[16px] leading-relaxed whitespace-pre-wrap break-words">{r.text}</p>
              <p className="text-[15px] text-ink-2 mt-1 break-all">
                {r.fromEmail ?? t('손님', 'Guest')} · {fmt(toKey(new Date(r.createdAt)), 'M/d')}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** 가입한 사람 목록 — 앱 주인 계정에서만 보인다 */
function MembersCard() {
  const owner = isOwner(useAccount())
  const members = useMembers(owner)
  if (!owner || !members) return null
  const day = (ms?: number) => (ms ? fmt(toKey(new Date(ms)), 'yy.M.d') : '')
  return (
    <Card>
      <SectionTitle>{t(`가입한 사람 ${members.length}`, `Members ${members.length}`)}</SectionTitle>
      <ul className="divide-y divide-line">
        {members.map((m) => (
          <li key={m.uid} className="py-2.5">
            <p className="text-[16px] break-all">{m.email}</p>
            <p className="text-[15px] text-ink-2 mt-0.5">
              {t(`가입 ${day(m.createdAt)} · 최근 ${day(m.lastSeen)}`, `Joined ${day(m.createdAt)} · Last seen ${day(m.lastSeen)}`)}
            </p>
          </li>
        ))}
      </ul>
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
        title={t('설정', 'Settings')}
        right={
          <Link to="/" className="h-11 px-2 flex items-center text-accent font-semibold text-[16px]">
            <ChevronLeft width={22} height={22} /> {t('오늘', 'Today')}
          </Link>
        }
      />
      <div className="gutter board">
        {/* 사용 안내 */}
        <Link to="/guide" className="block">
          <Card className="flex items-center justify-between active:opacity-80">
            <span className="text-[17px] font-bold">{t('사용 안내', 'User guide')}</span>
            <ChevronRight width={20} height={20} className="text-ink-3" />
          </Card>
        </Link>

        <LanguageCard />

        <SyncCard />

        <LayoutCard />

        <RequestInbox />

        <MembersCard />

        <RequestCard />

        <CategoryCard />

        <Card>
          <SectionTitle>{t('백업', 'Backup')}</SectionTitle>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => exportBackup().catch((e) => setMsg(String(e)))}>
              {t('내보내기', 'Export')}
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => fileRef.current?.click()}>
              {t('불러오기', 'Import')}
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
              if (!f || !confirm(t('지금 기록을 모두 지우고 백업 파일의 내용으로 바꿀까요?', 'Replace all current data with the contents of this backup?'))) return
              try {
                await importBackup(f)
                setMsg(t('백업을 불러왔어요.', 'Backup imported.'))
              } catch (err) {
                setMsg(t(`불러오지 못했어요: ${(err as Error).message}`, `Couldn’t import: ${(err as Error).message}`))
              }
            }}
          />
          {msg && <p className="text-[16px] text-accent font-semibold mt-3">{msg}</p>}
        </Card>

        {!standalone && (
          <Card>
            <SectionTitle>{t('홈 화면에 추가', 'Add to Home Screen')}</SectionTitle>
            <p className="text-[16px] leading-relaxed">{t('Safari 공유 버튼 → 홈 화면에 추가', 'Safari Share button → Add to Home Screen')}</p>
          </Card>
        )}

        <Card>
          <Button
            variant="danger"
            className="!px-0"
            onClick={async () => {
              if (!confirm(t('모든 기록을 삭제할까요? 되돌릴 수 없어요.', 'Delete all data? This can’t be undone.'))) return
              if (!confirm(t('정말 삭제할까요? 백업을 먼저 해 두는 걸 권해요.', 'Really delete? Exporting a backup first is a good idea.'))) return
              await deleteAll()
              setMsg(t('모든 기록을 삭제했어요.', 'All data deleted.'))
            }}
          >
            {t('모든 기록 삭제', 'Delete all data')}
          </Button>
        </Card>
      </div>
    </>
  )
}
