import { HashRouter, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { LoginGate } from './components/LoginGate'
import Today from './pages/Today'
import Timetable from './pages/Timetable'
import Tasks from './pages/Tasks'
import Plans from './pages/Plans'
import Questions from './pages/Questions'
import Settings from './pages/Settings'

export default function App() {
  return (
    <HashRouter>
      <main className="max-w-xl mx-auto min-h-dvh pb-[calc(env(safe-area-inset-bottom)+84px)]">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/questions" element={<Questions />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <TabBar />
      <LoginGate />
    </HashRouter>
  )
}
