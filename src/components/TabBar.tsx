import { NavLink } from 'react-router-dom'
import { SunIcon, CalendarIcon, CheckSquareIcon } from './icons'
import { t } from '../lib/i18n'

export function TabBar() {
  const TABS = [
    { to: '/', label: t('오늘', 'Today'), Icon: SunIcon },
    { to: '/timetable', label: t('시간표', 'Schedule'), Icon: CalendarIcon },
    { to: '/tasks', label: t('할 일', 'To-do'), Icon: CheckSquareIcon },
  ]
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-bg/90 backdrop-blur-xl border-t border-line pb-safe">
      <ul className="flex max-w-xl md:max-w-2xl mx-auto">
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
