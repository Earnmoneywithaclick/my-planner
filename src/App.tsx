import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { LoginGate } from './components/LoginGate'
import Today from './pages/Today'
import Timetable from './pages/Timetable'
import Tasks from './pages/Tasks'
import Questions from './pages/Questions'
import Settings from './pages/Settings'

export default function App() {
  return (
    <HashRouter>
      <main className="max-w-xl md:max-w-none mx-auto min-h-dvh pb-[calc(env(safe-area-inset-bottom)+84px)]">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/tasks" element={<Tasks />} />
          {/* 계획 탭은 할 일 탭에 합쳐졌다 */}
          <Route path="/plans" element={<Navigate to="/tasks" replace />} />
          <Route path="/questions" element={<Questions />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <TabBar />
      <LoginGate />
    </HashRouter>
  )
}
