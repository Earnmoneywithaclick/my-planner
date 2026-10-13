import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { CheckIcon } from './icons'
import { useChanged } from '../lib/motion'

// 글자는 15px 미만으로 쓰지 않는다 — 보조 설명 글은 넣지 않고 꼭 필요한 정보만 보여준다.

export function PageHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="pt-safe px-5 md:px-7 pb-3 flex items-center justify-between gap-3">
      <h1 className="text-[28px] font-bold tracking-tight leading-tight">{title}</h1>
      {right}
    </header>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`bg-card rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>{children}</section>
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between min-h-8 mb-2">
      <h2 className="text-[17px] font-bold">{children}</h2>
      {right}
    </div>
  )
}

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-accent text-bg',
    soft: 'bg-accent-soft text-accent',
    ghost: 'bg-card-2 text-ink',
    danger: 'bg-transparent text-danger',
  }[variant]
  return <button className={`h-12 px-4 rounded-xl text-[16px] font-semibold active:opacity-70 disabled:opacity-40 ${styles} ${className}`} {...p} />
}

export function IconButton({ label, className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button aria-label={label} title={label} className={`size-11 grid place-items-center rounded-full active:bg-card-2 ${className}`} {...p} />
}

const inputCls = 'w-full rounded-xl bg-card-2 px-3.5 py-2.5 min-h-12 text-ink placeholder:text-ink-3 outline-none focus:ring-2 focus:ring-accent/40'

export function TextInput(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`${inputCls} ${p.className ?? ''}`} />
}

export function TextArea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={`${inputCls} resize-none leading-relaxed ${p.className ?? ''}`} />
}

export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={`${inputCls} ${p.className ?? ''}`} />
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex bg-card-2 rounded-xl p-1 gap-1 md:max-w-md">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 h-10 rounded-lg text-[15px] font-semibold transition-colors ${value === o.value ? 'bg-card text-ink shadow-sm' : 'text-ink-3'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 h-10 px-4 rounded-full text-[15px] font-semibold transition-colors ${active ? 'bg-accent text-bg' : 'bg-card-2 text-ink-2'}`}
    >
      {children}
    </button>
  )
}

export function CheckCircle({ checked, onChange, color, label }: { checked: boolean; onChange: () => void; color?: string; label: string }) {
  const popped = useChanged(checked, 350)
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange} className="size-11 -m-2 grid place-items-center shrink-0">
      <span
        className={`size-6 rounded-full border-2 grid place-items-center transition-colors ${popped && checked ? 'animate-pop' : ''}`}
        style={{ borderColor: color ?? 'var(--ink-3)', background: checked ? (color ?? 'var(--accent)') : 'transparent' }}
      >
        {checked && <CheckIcon width={15} height={15} strokeWidth={3} className="text-bg" />}
      </span>
    </button>
  )
}

/** 화면 아래에서 올라오는 입력 시트 */
/** 키보드를 뺀, 실제로 보이는 화면 영역 (iOS 키보드 대응) */
function useVisualViewport(active: boolean) {
  const [rect, setRect] = useState<{ top: number; height: number } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) return
    const update = () => setRect({ top: vv.offsetTop, height: vv.height })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])
  return rect
}

export function Sheet({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  // 시트는 부모가 바로 없애 버리므로, 사라지기 직전 모습을 복사해 아래로 내려가는 효과만 보여 준다
  const rootRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = rootRef.current
    return () => {
      if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const ghost = root.cloneNode(true) as HTMLElement
      ghost.removeAttribute('role')
      ghost.setAttribute('aria-hidden', 'true')
      ghost.style.pointerEvents = 'none'
      ghost.children[0]?.classList.replace('animate-fade', 'animate-fade-out')
      ghost.children[1]?.classList.replace('animate-sheet', 'animate-sheet-out')
      document.body.appendChild(ghost)
      setTimeout(() => ghost.remove(), 260)
    }
  }, [open])

  // iOS 는 키보드가 올라와도 화면(레이아웃) 크기는 그대로라 시트가 키보드 뒤로 숨는다.
  // 실제로 보이는 영역(visualViewport)에 시트를 맞추고, 지금 입력하는 칸이 시트 안에서 보이게 스크롤한다.
  const viewport = useVisualViewport(open)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = document.activeElement
    if (!open || !(el instanceof HTMLElement) || !scrollRef.current?.contains(el)) return
    el.scrollIntoView({ block: 'nearest' })
  }, [open, viewport?.height])

  if (!open) return null
  return (
    <div
      ref={rootRef}
      className="fixed inset-x-0 top-0 h-dvh z-50 flex flex-col justify-end"
      style={viewport ? { top: viewport.top, height: viewport.height } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onFocus={(e) => {
        // 키보드가 올라오며 크기가 바뀐 뒤에 한 번 더 맞춘다
        const el = e.target
        setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 300)
      }}
    >
      <div className="absolute inset-0 bg-black/60 animate-fade" onClick={onClose} />
      <div className="relative w-full md:max-w-xl md:mx-auto bg-card rounded-t-3xl max-h-[92%] flex flex-col animate-sheet">
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <button type="button" onClick={onClose} className="h-11 text-[16px] text-ink-3 font-medium">
            닫기
          </button>
          <h2 className="text-[17px] font-bold">{title}</h2>
          <span className="w-8" />
        </div>
        <div ref={scrollRef} className="overflow-y-auto overscroll-contain px-5 pb-4 space-y-4">
          {children}
        </div>
        {footer && <div className="px-5 pt-2 pb-[max(env(safe-area-inset-bottom),16px)] flex gap-2 border-t border-line">{footer}</div>}
      </div>
    </div>
  )
}

export const PRIORITY_LABEL = ['낮음', '보통', '높음'] as const
