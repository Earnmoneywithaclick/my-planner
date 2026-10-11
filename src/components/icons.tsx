import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

function Base({ children, ...p }: P) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {children}
    </svg>
  )
}

export const SunIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
)
export const CalendarIcon = (p: P) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Base>
)
export const CheckSquareIcon = (p: P) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M8 12l3 3 5-6" />
  </Base>
)
export const FlagIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Base>
)
export const QuestionIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6V14M12 17.5h.01" />
  </Base>
)
export const PlusIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
)
export const GearIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Base>
)
export const BookIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
  </Base>
)
export const ChevronLeft = (p: P) => (
  <Base {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Base>
)
export const ChevronRight = (p: P) => (
  <Base {...p}>
    <path d="M9 18l6-6-6-6" />
  </Base>
)
export const ExternalIcon = (p: P) => (
  <Base {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Base>
)
export const PinIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3z" />
  </Base>
)
export const ListPlusIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 6h11M4 12h11M4 18h7M18 15v6M15 18h6" />
  </Base>
)
export const FlameIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 3c.6 3.2 2.4 4.9 3.8 6.6C17.2 11.3 18 12.9 18 15a6 6 0 0 1-12 0c0-2 .8-3.6 2-4.8.2 1.5 1 2.6 2.3 3.1C10 10 10.8 6.4 12 3z" />
  </Base>
)
export const CheckIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Base>
)
