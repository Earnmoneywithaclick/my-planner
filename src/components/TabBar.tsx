import { NavLink } from 'react-router-dom'
import { SunIcon, CalendarIcon, CheckSquareIcon, FlagIcon, QuestionIcon } from './icons'

const TABS = [
  { to: '/', label: '오늘', Icon: SunIcon },
  { to: '/timetable', label: '시간표', Icon: CalendarIcon },
  { to: '/tasks', label: '할 일', Icon: CheckSquareIcon },
  { to: '/plans', label: '계획', Icon: FlagIcon },
  { to: '/questions', label: '질문', Icon: QuestionIcon },
]

export function TabBar() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-bg/90 backdrop-blur-xl border-t border-line pb-safe">
      <ul className="flex max-w-xl mx-auto">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              aria-label={label}
              className={({ isActive }) => `flex justify-center py-3.5 ${isActive ? 'text-accent' : 'text-ink-3'}`}
            >
              <Icon width={28} height={28} />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
