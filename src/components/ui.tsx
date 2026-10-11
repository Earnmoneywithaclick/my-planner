import { useEffect, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { COLORS } from '../db'
import { CheckIcon } from './icons'

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

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`색상 ${c}`}
          onClick={() => onChange(c)}
          className="size-9 rounded-full"
          style={{ background: c, boxShadow: value === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${c}` : undefined }}
        />
      ))}
    </div>
  )
}

export function CheckCircle({ checked, onChange, color, label }: { checked: boolean; onChange: () => void; color?: string; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange} className="size-11 -m-2 grid place-items-center shrink-0">
      <span
        className="size-6 rounded-full border-2 grid place-items-center transition-colors"
        style={{ borderColor: color ?? 'var(--ink-3)', background: checked ? (color ?? 'var(--accent)') : 'transparent' }}
      >
        {checked && <CheckIcon width={15} height={15} strokeWidth={3} className="text-bg" />}
      </span>
    </button>
  )
}

/** 화면 아래에서 올라오는 입력 시트 */
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

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 animate-fade" onClick={onClose} />
      <div className="relative w-full md:max-w-xl md:mx-auto bg-card rounded-t-3xl max-h-[92dvh] flex flex-col animate-sheet">
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <button type="button" onClick={onClose} className="h-11 text-[16px] text-ink-3 font-medium">
            닫기
          </button>
          <h2 className="text-[17px] font-bold">{title}</h2>
          <span className="w-8" />
        </div>
        <div className="overflow-y-auto px-5 pb-4 space-y-4">{children}</div>
        {footer && <div className="px-5 pt-2 pb-[max(env(safe-area-inset-bottom),16px)] flex gap-2 border-t border-line">{footer}</div>}
      </div>
    </div>
  )
}

export const PRIORITY_LABEL = ['낮음', '보통', '높음'] as const
