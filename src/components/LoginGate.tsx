import { useState, useSyncExternalStore } from 'react'
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { Button, TextInput } from './ui'
import { setLang, t, useLang } from '../lib/i18n'

// 로그인 화면을 여닫는 작은 저장소 (설정 > 동기화 > 로그인 버튼이 연다)
let open = false
const subs = new Set<() => void>()
const setOpen = (v: boolean) => ((open = v), subs.forEach((s) => s()))
export const openLogin = () => setOpen(true)

const errorText = (code: string) =>
  ({
    'auth/invalid-credential': t('이메일이나 비밀번호가 맞지 않아요', 'Wrong email or password'),
    'auth/wrong-password': t('이메일이나 비밀번호가 맞지 않아요', 'Wrong email or password'),
    'auth/user-not-found': t('가입하지 않은 이메일이에요. 처음이면 가입해 주세요', 'No account with this email. Sign up first'),
    'auth/invalid-email': t('이메일 주소를 확인해 주세요', 'Please check the email address'),
    'auth/email-already-in-use': t('이미 가입한 이메일이에요. 로그인해 주세요', 'Already signed up. Please log in'),
    'auth/weak-password': t('비밀번호는 6자 이상으로 해 주세요', 'Use at least 6 characters'),
    'auth/too-many-requests': t('너무 많이 시도했어요. 잠시 뒤에 다시 해 주세요', 'Too many tries. Try again later'),
    'auth/network-request-failed': t('인터넷 연결을 확인해 주세요', 'Check your internet connection'),
  })[code] ?? t('잠시 뒤에 다시 해 주세요', 'Please try again later')

/** 로그인 전에도 언어를 바꿀 수 있게 오른쪽 위에 */
function LangSwitch() {
  const lang = useLang()
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}
      className="absolute right-4 top-[calc(env(safe-area-inset-top)+12px)] h-11 px-3 rounded-xl text-[16px] font-semibold text-accent active:bg-card-2"
    >
      {lang === 'en' ? '한국어' : 'English'}
    </button>
  )
}

type Mode = 'login' | 'signup' | 'reset'

/** 이메일 + 비밀번호 로그인 화면. 처음에는 손님으로 쓰고, 설정에서 로그인할 때만 뜬다. */
export function LoginGate() {
  const isOpen = useSyncExternalStore(
    (s) => (subs.add(s), () => subs.delete(s)),
    () => open,
  )
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{ error?: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  if (!isOpen) return null

  const go = (m: Mode) => (setMode(m), setMsg(null))
  const close = () => (setOpen(false), go('login'), setPassword(''))

  async function submit() {
    const mail = email.trim().toLowerCase()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, mail)
        setMsg({ text: t('비밀번호를 바꾸는 메일을 보냈어요', 'We emailed you a link to reset your password') })
        return
      }
      if (mode === 'signup') await createUserWithEmailAndPassword(auth, mail, password)
      else await signInWithEmailAndPassword(auth, mail, password)
      close()
    } catch (e) {
      setMsg({ error: true, text: errorText((e as { code?: string }).code ?? '') })
    } finally {
      setBusy(false)
    }
  }

  const title = { login: t('로그인', 'Log in'), signup: t('처음 가입하기', 'Sign up'), reset: t('비밀번호 찾기', 'Reset password') }[mode]
  const needsPassword = mode !== 'reset'

  return (
    <div className="fixed inset-0 z-[60] bg-bg flex flex-col justify-center px-6 pt-safe pb-safe" role="dialog" aria-modal="true" aria-label={title}>
      <LangSwitch />
      <form
        className="space-y-4 max-w-sm w-full mx-auto"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <h1 className="text-[28px] font-bold">{title}</h1>
        {msg && <p className={`text-[16px] leading-relaxed ${msg.error ? 'text-danger' : 'text-accent'}`}>{msg.text}</p>}
        <TextInput autoFocus type="email" inputMode="email" autoComplete="email" placeholder={t('이메일', 'Email')} value={email} onChange={(e) => setEmail(e.target.value)} />
        {needsPassword && (
          <TextInput
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder={mode === 'signup' ? t('새 비밀번호 (6자 이상)', 'New password (6+ characters)') : t('비밀번호', 'Password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        <Button type="submit" className="w-full" disabled={busy || !email.trim() || (needsPassword && !password)}>
          {{ login: t('로그인', 'Log in'), signup: t('가입하고 로그인', 'Sign up'), reset: t('메일 보내기', 'Send email') }[mode]}
        </Button>
        {mode === 'login' ? (
          <div className="flex gap-2">
            <Button type="button" variant="soft" className="flex-1" onClick={() => go('signup')}>
              {t('처음이에요', 'I’m new')}
            </Button>
            <Button type="button" variant="ghost" className="flex-1" onClick={() => go('reset')}>
              {t('비밀번호 찾기', 'Forgot password')}
            </Button>
          </div>
        ) : (
          <Button type="button" variant="soft" className="w-full" onClick={() => go('login')}>
            {t('로그인으로 돌아가기', 'Back to log in')}
          </Button>
        )}
        <Button type="button" variant="ghost" className="w-full" onClick={close}>
          {t('취소', 'Cancel')}
        </Button>
      </form>
    </div>
  )
}
