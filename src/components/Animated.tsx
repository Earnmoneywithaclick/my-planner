import type { HTMLAttributes } from 'react'
import { useChanged, useListAnimation } from '../lib/motion'

/** 안의 항목이 추가·삭제·이동할 때 부드럽게 움직이는 목록 (ul) */
export function AnimatedList(p: HTMLAttributes<HTMLUListElement>) {
  const ref = useListAnimation<HTMLUListElement>()
  return <ul ref={ref} {...p} />
}

/** AnimatedList 와 같지만 div */
export function AnimatedDiv(p: HTMLAttributes<HTMLDivElement>) {
  const ref = useListAnimation<HTMLDivElement>()
  return <div ref={ref} {...p} />
}

/** AnimatedList 와 같지만 span (달력 점처럼 줄 안에 들어가는 것) */
export function AnimatedSpan(p: HTMLAttributes<HTMLSpanElement>) {
  const ref = useListAnimation<HTMLSpanElement>()
  return <span ref={ref} {...p} />
}

/** 내용(signal)이 바뀌면 잠깐 반짝이는 목록 항목 */
export function FlashLi({ signal, className = '', ...p }: HTMLAttributes<HTMLLIElement> & { signal: unknown }) {
  const on = useChanged(signal)
  return <li {...p} className={`${className} ${on ? 'animate-flash' : ''}`} />
}

/** 내용(signal)이 바뀌면 테두리가 잠깐 빛나는 카드 감싸개 */
export function FlashBox({ signal, className = '', ...p }: HTMLAttributes<HTMLDivElement> & { signal: unknown }) {
  const on = useChanged(signal)
  return <div {...p} className={`${className} rounded-2xl ${on ? 'animate-ring' : ''}`} />
}
