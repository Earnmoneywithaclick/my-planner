import { useEffect, useRef, useState } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'

/** 목록에 붙이면 항목이 추가·삭제·순서 변경될 때 부드럽게 움직인다 (동작 줄이기 설정이면 꺼짐). */
export const useListAnimation = <T extends HTMLElement = HTMLElement>() => useAutoAnimate<T>({ duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })[0]

/**
 * 값이 바뀐 직후 잠깐 true 가 된다 — 고친 항목을 반짝이거나 체크를 '톡' 튀게 할 때 쓴다.
 * 처음 화면에 나타날 때는 반응하지 않는다.
 */
export function useChanged(value: unknown, ms = 700) {
  const prev = useRef(value)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (Object.is(prev.current, value)) return
    prev.current = value
    setOn(true)
    const t = setTimeout(() => setOn(false), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return on
}
