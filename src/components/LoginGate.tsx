import { useEffect, useState } from 'react'
import { useObservable } from 'dexie-react-hooks'
import type { DXCAlert } from 'dexie-cloud-addon'
import { db } from '../db'
import { Button, TextInput } from './ui'
import { setLang, t, useLang } from '../lib/i18n'

const notRegistered = () => t('등록되지 않은 이메일이에요. 관리자에게 등록을 부탁하세요.', 'This email isn’t registered. Ask the admin to add it.')
const seatsFull = () => t('사용자 자리가 다 찼어요. 관리자에게 알려주세요.', 'No user seats left. Please tell the admin.')
const alertTexts = (): Record<string, string> => ({
  INVALID_OTP: t('인증 코드가 맞지 않아요', 'That code isn’t right'),
  INVALID_EMAIL: t('이메일 주소를 확인해 주세요', 'Please check the email address'),
  OTP_SENT: t('메일로 인증 코드를 보냈어요', 'We emailed you a code'),
  // 관리자가 등록한 이메일만 쓸 수 있게 막아 두었을 때
  USER_NOT_REGISTERED: notRegistered(),
  USER_NOT_ACCEPTED: notRegistered(),
  LICENSE_LIMIT_REACHED: seatsFull(),
  NO_SEATS_AVAILABLE: seatsFull(),
  USER_DEACTIVATED: t('사용이 중지된 계정이에요.', 'This account has been deactivated.'),
  LOGOUT_CONFIRMATION: t('아직 동기화되지 않은 기록이 있어요. 지금 로그아웃하면 그 기록은 사라져요.', 'Some data hasn’t synced yet. If you log out now, it will be lost.'),
})
const alertText = (a: DXCAlert) => alertTexts()[a.messageCode] ?? a.message

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

/** Dexie Cloud 로그인(이메일 → 인증 코드) 화면. 기본 영어 대화상자 대신 앱 화면으로 보여준다. */
export function LoginGate() {
  const ui = useObservable(db.cloud.userInteraction)
  const [value, setValue] = useState('')
  useEffect(() => setValue(''), [ui?.type])

  const startLogin = () => db.cloud.login().catch(() => {})

  // 처음에는 로그인 없이(손님으로) 쓰고, 설정에서 이메일로 로그인할 때만 이 화면이 뜬다
  if (!ui) return null

  const isEmail = ui.type === 'email'
  const isOtp = ui.type === 'otp'
  const submit = () => {
    if (isEmail) ui.onSubmit({ email: value.trim() })
    else if (isOtp) ui.onSubmit({ otp: value.trim() })
    else ui.onSubmit({})
  }

  const title = isEmail ? t('로그인', 'Log in') : isOtp ? t('인증 코드 입력', 'Enter code') : ui.type === 'logout-confirmation' ? t('로그아웃', 'Log out') : t('알림', 'Notice')
  const submitLabel = isEmail ? t('인증 코드 받기', 'Get code') : isOtp ? t('로그인', 'Log in') : ui.type === 'logout-confirmation' ? t('로그아웃', 'Log out') : t('확인', 'OK')

  return (
    <div className="fixed inset-0 z-[60] bg-bg flex flex-col justify-center px-6 pt-safe pb-safe" role="dialog" aria-modal="true" aria-label={title}>
      {(isEmail || isOtp) && <LangSwitch />}
      <form
        className="space-y-4 max-w-sm w-full mx-auto"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <h1 className="text-[28px] font-bold">{title}</h1>
        {ui.alerts.map((a, i) => (
          <p key={i} className={`text-[16px] leading-relaxed ${a.type === 'error' ? 'text-danger' : 'text-ink-2'}`}>
            {alertText(a)}
          </p>
        ))}
        {isEmail && (
          <TextInput autoFocus type="email" inputMode="email" autoComplete="email" placeholder={t('이메일', 'Email')} value={value} onChange={(e) => setValue(e.target.value)} />
        )}
        {isOtp && (
          <TextInput autoFocus inputMode="text" autoComplete="one-time-code" autoCapitalize="characters" placeholder={t('인증 코드', 'Code')} value={value} onChange={(e) => setValue(e.target.value)} />
        )}
        <Button type="submit" className="w-full" disabled={(isEmail || isOtp) && !value.trim()}>
          {submitLabel}
        </Button>
        {(isEmail || isOtp || ui.type === 'logout-confirmation') && (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              ui.onCancel()
              // 인증 코드 화면에서 돌아가면 이메일 입력부터 다시
              if (isOtp) setTimeout(startLogin, 0)
            }}
          >
            {isOtp ? t('이메일 다시 입력', 'Use a different email') : t('취소', 'Cancel')}
          </Button>
        )}
      </form>
    </div>
  )
}
