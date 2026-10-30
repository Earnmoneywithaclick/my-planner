import { useSyncExternalStore } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// 웹 앱 설정값은 공개해도 되는 값이다. 누가 무엇을 읽고 쓸 수 있는지는 firestore.rules 가 정한다.
const app = initializeApp({
  apiKey: 'AIzaSyBdeViT8qrXLb1w7ofGA2Li4kSgei1wG5Q',
  authDomain: 'my-plan-ec92d.firebaseapp.com',
  projectId: 'my-plan-ec92d',
  storageBucket: 'my-plan-ec92d.firebasestorage.app',
  messagingSenderId: '689992532043',
  appId: '1:689992532043:web:d9a1344e7b753c7c4bcdce',
})

export const auth = getAuth(app)
// 보내지 못한 변경은 기기에 남겨 두었다가 연결되면 보낸다 (앱을 닫았다 열어도)
export const fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }), ignoreUndefinedProperties: true })

/** 기능 요청과 가입한 사람 목록을 보는 앱 주인 */
export const OWNER_EMAIL = 'hawon1914@gmail.com'
export const isOwner = (u?: User | null) => !!u && !u.isAnonymous && u.email?.toLowerCase() === OWNER_EMAIL

/** 이메일로 로그인한 사람 (익명 로그인은 손님으로 본다) */
export const accountUser = () => {
  const u = auth.currentUser
  return u && !u.isAnonymous ? u : null
}

let authVersion = 0
const subscribeAuth = (cb: () => void) => onAuthStateChanged(auth, () => (authVersion++, cb()))
/** 로그인한 계정 (손님이면 null). 로그인 정보를 읽는 중이면 undefined */
export function useAccount(): User | null | undefined {
  useSyncExternalStore(subscribeAuth, () => authVersion)
  // authStateReady 전에는 currentUser 가 null 이라 손님처럼 보인다
  return authVersion === 0 ? undefined : accountUser()
}
