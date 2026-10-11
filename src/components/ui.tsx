import { useEffect, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from 'react'
import { COLORS } from '../db'
import { CheckIcon } from './icons'

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="pt-safe px-5 pb-3 flex items-end justify-between gap-3">
      <div>
        {sub && <p className="text-[13px] font-medium text-ink-3">{sub}</p>}
        <h1 className="text-[28px] font-bold tracking-tight leading-tight">{title}</h1>
      </div>
      {right}
    </header>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`bg-card rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>{children}</section>
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h2 className="text-[15px] font-semibold text-ink-2">{children}</h2>
      {right}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[14px] text-ink-3 py-3 text-center">{children}</p>
}

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-accent text-bg',
    soft: 'bg-accent-soft text-accent',
    ghost: 'bg-card-2 text-ink',
    danger: 'bg-transparent text-danger',
  }[variant]
  return <button className={`h-11 px-4 rounded-xl text-[15px] font-semibold active:opacity-70 disabled:opacity-40 ${styles} ${className}`} {...p} />
}

export function IconButton({ label, className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button aria-label={label} title={label} className={`size-10 grid place-items-center rounded-full active:bg-card-2 ${className}`} {...p} />
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-ink-3 mb-1.5">{label}</span>
      {children}
    </label>
  )
}

const inputCls = 'w-full rounded-xl bg-card-2 px-3.5 py-2.5 text-ink placeholder:text-ink-3 outline-none focus:ring-2 focus:ring-accent/40'

export function TextInput(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`${inputCls} ${p.className ?? ''}`} />
}

export function TextArea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={`${inputCls} resize-none leading-relaxed ${p.className ?? ''}`} />
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex bg-card-2 rounded-xl p-1 gap-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 h-9 rounded-lg text-[14px] font-semibold transition-colors ${value === o.value ? 'bg-card text-ink shadow-sm' : 'text-ink-3'}`}
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
      className={`shrink-0 h-8 px-3.5 rounded-full text-[13px] font-semibold border transition-colors ${active ? 'bg-ink text-bg border-ink' : 'bg-card text-ink-2 border-line'}`}
    >
      {children}
    </button>
  )
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`색상 ${c}`}
          onClick={() => onChange(c)}
          className="size-8 rounded-full grid place-items-center"
          style={{ background: c, boxShadow: value === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${c}` : undefined }}
        />
      ))}
    </div>
  )
}

export function CheckCircle({ checked, onChange, color, label }: { checked: boolean; onChange: () => void; color?: string; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="size-11 -m-2 grid place-items-center shrink-0"
    >
      <span
        className="size-[22px] rounded-full border-2 grid place-items-center transition-colors"
        style={{ borderColor: color ?? 'var(--ink-3)', background: checked ? (color ?? 'var(--accent)') : 'transparent' }}
      >
        {checked && <CheckIcon width={14} height={14} strokeWidth={3} className="text-bg" />}
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
      <div className="absolute inset-0 bg-black/35 animate-fade" onClick={onClose} />
      <div className="relative bg-bg rounded-t-3xl max-h-[92dvh] flex flex-col animate-sheet">
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <button type="button" onClick={onClose} className="h-10 text-[15px] text-ink-3 font-medium">
            닫기
          </button>
          <h2 className="text-[16px] font-bold">{title}</h2>
          <span className="w-8" />
        </div>
        <div className="overflow-y-auto px-5 pb-4 space-y-4">{children}</div>
        {footer && <div className="px-5 pt-2 pb-[max(env(safe-area-inset-bottom),16px)] flex gap-2 border-t border-line">{footer}</div>}
      </div>
    </div>
  )
}

export const PRIORITY_LABEL = ['낮음', '보통', '높음'] as const
