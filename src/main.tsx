import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { db, requestPersistence, startup } from './db'
import './index.css'

// 새 버전이 배포되면 바로 받아서 화면을 새로 고친다 (autoUpdate).
// Safari 탭이나 홈 화면 앱을 오래 열어 두면 새 버전 확인이 늦어지므로, 앱으로 돌아올 때와 30분마다 직접 확인한다.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => reg.update().catch(() => {})
    setInterval(check, 30 * 60_000)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
  },
})
startup()
requestPersistence()

// 앱을 다시 열 때(홈 화면에서 돌아올 때)마다 다른 기기의 변경을 받아온다
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && db.cloud.currentUser.value.isLoggedIn) db.cloud.sync({ wait: false, purpose: 'pull' }).catch(() => {})
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
