import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { db, requestPersistence, startup } from './db'
import './index.css'

registerSW({ immediate: true })
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
