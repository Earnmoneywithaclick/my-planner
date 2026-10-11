import { useEffect, useState } from 'react'
import { useObservable } from 'dexie-react-hooks'
import type { DXCAlert } from 'dexie-cloud-addon'
import { db } from '../db'
import { Button, TextInput } from './ui'

const ALERT_TEXT: Record<string, string> = {
  INVALID_OTP: '인증 코드가 맞지 않아요',
  INVALID_EMAIL: '이메일 주소를 확인해 주세요',
  OTP_SENT: '메일로 인증 코드를 보냈어요',
  // 관리자가 등록한 이메일만 쓸 수 있게 막아 두었을 때
  USER_NOT_REGISTERED: '등록되지 않은 이메일이에요. 관리자에게 등록을 부탁하세요.',
  USER_NOT_ACCEPTED: '등록되지 않은 이메일이에요. 관리자에게 등록을 부탁하세요.',
  LICENSE_LIMIT_REACHED: '사용자 자리가 다 찼어요. 관리자에게 알려주세요.',
  NO_SEATS_AVAILABLE: '사용자 자리가 다 찼어요. 관리자에게 알려주세요.',
  USER_DEACTIVATED: '사용이 중지된 계정이에요.',
  LOGOUT_CONFIRMATION: '아직 동기화되지 않은 기록이 있어요. 지금 로그아웃하면 그 기록은 사라져요.',
}
const alertText = (a: DXCAlert) => ALERT_TEXT[a.messageCode] ?? a.message

/** Dexie Cloud 로그인(이메일 → 인증 코드) 화면. 기본 영어 대화상자 대신 앱 화면으로 보여준다. */
export function LoginGate() {
  const ui = useObservable(db.cloud.userInteraction)
  const user = useObservable(db.cloud.currentUser)
  const [value, setValue] = useState('')
  useEffect(() => setValue(''), [ui?.type])

  const startLogin = () => db.cloud.login().catch(() => {})

  // 로그인을 취소했거나 거절당해 로그인 안 된 채로 남으면 다시 로그인 화면을 보여준다
  if (!ui) {
    if (!user || user.isLoggedIn) return null
    return (
      <div className="fixed inset-0 z-[60] bg-bg flex flex-col justify-center px-6 pt-safe pb-safe" role="dialog" aria-modal="true" aria-label="로그인">
        <div className="space-y-4 max-w-sm w-full mx-auto">
          <h1 className="text-[28px] font-bold">로그인</h1>
          <Button className="w-full" onClick={startLogin}>
            이메일로 로그인
          </Button>
        </div>
      </div>
    )
  }

  const isEmail = ui.type === 'email'
  const isOtp = ui.type === 'otp'
  const submit = () => {
    if (isEmail) ui.onSubmit({ email: value.trim() })
    else if (isOtp) ui.onSubmit({ otp: value.trim() })
    else ui.onSubmit({})
  }

  const title = isEmail ? '로그인' : isOtp ? '인증 코드 입력' : ui.type === 'logout-confirmation' ? '로그아웃' : '알림'
  const submitLabel = isEmail ? '인증 코드 받기' : isOtp ? '로그인' : ui.type === 'logout-confirmation' ? '로그아웃' : '확인'

  return (
    <div className="fixed inset-0 z-[60] bg-bg flex flex-col justify-center px-6 pt-safe pb-safe" role="dialog" aria-modal="true" aria-label={title}>
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
          <TextInput autoFocus type="email" inputMode="email" autoComplete="email" placeholder="이메일" value={value} onChange={(e) => setValue(e.target.value)} />
        )}
        {isOtp && (
          <TextInput autoFocus inputMode="text" autoComplete="one-time-code" autoCapitalize="characters" placeholder="인증 코드" value={value} onChange={(e) => setValue(e.target.value)} />
        )}
        <Button type="submit" className="w-full" disabled={(isEmail || isOtp) && !value.trim()}>
          {submitLabel}
        </Button>
        {(isOtp || ui.type === 'logout-confirmation') && (
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
            {isOtp ? '이메일 다시 입력' : '취소'}
          </Button>
        )}
      </form>
    </div>
  )
}
