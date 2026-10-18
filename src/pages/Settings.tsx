import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useObservable } from 'dexie-react-hooks'
import { db, PALETTE, replaceAll, TABLES } from '../db'
import { todayKey } from '../lib/date'
import { Button, Card, PageHeader, SectionTitle, Segmented, TextInput } from '../components/ui'
import { recolorCategory, renameCategory, useCategories } from '../components/Categories'
import { ChevronLeft, ChevronRight } from '../components/icons'
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
    { 'in-sync': '동기화됨', pushing: '보내는 중', pulling: '받는 중', initial: '준비 중', 'not-in-sync': '기다리는 중', offline: '오프라인', error: '동기화 오류' },
    { 'in-sync': 'Synced', pushing: 'Sending', pulling: 'Receiving', initial: 'Starting', 'not-in-sync': 'Waiting', offline: 'Offline', error: 'Sync error' },
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
  const user = useObservable(db.cloud.currentUser)
  const sync = useObservable(db.cloud.syncState)
  const [busy, setBusy] = useState(false)
  const status = sync?.phase === 'offline' || sync?.status === 'offline' ? 'offline' : sync?.error ? 'error' : (sync?.phase ?? 'initial')

  return (
    <Card>
      <SectionTitle right={<span className={`text-[15px] font-semibold ${status === 'error' ? 'text-danger' : 'text-accent'}`}>{syncLabel()[status] ?? status}</span>}>{t('동기화', 'Sync')}</SectionTitle>
      {user?.isLoggedIn && <p className="text-[16px] mb-3 break-all">{user.email}</p>}
      {user && !user.isLoggedIn && !user.isLoading && (
        <>
          <p className="text-[16px] leading-relaxed text-ink-2 mb-3">
            {t('지금은 기록이 이 기기에만 저장돼요. 이메일로 로그인하면 그때부터 지금까지의 기록이 계정으로 올라가고 다른 기기와 맞춰져요.', 'Right now your data is stored on this device only. Log in with email to upload it to your account and sync with your other devices from then on.')}
          </p>
          <Button className="w-full" onClick={() => db.cloud.login().catch(() => {})}>
            {t('이메일로 로그인', 'Log in with email')}
          </Button>
        </>
      )}
      <div className={`flex gap-2 ${user?.isLoggedIn ? '' : 'hidden'}`}>
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
          {t('지금 동기화', 'Sync now')}
        </Button>
        {user?.isLoggedIn && (
          <Button
            variant="ghost"
            onClick={async () => {
              if (confirm(t('로그아웃할까요? 이 기기의 기록은 지워지고(계정에는 남아요), 빈 상태로 다시 시작해요.', 'Log out? Data on this device will be cleared (it stays in your account) and the app starts empty.'))) await db.cloud.logout()
            }}
          >
            {t('로그아웃', 'Log out')}
          </Button>
        )}
      </div>
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
              await db.transaction('rw', [...TABLES, 'dailyText'].map((t) => db.table(t)), async () => {
                for (const t of [...TABLES, 'dailyText']) await db.table(t).clear()
              })
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
