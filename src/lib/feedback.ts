import { useEffect, useState } from 'react'
import { signInAnonymously } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { accountUser, auth, fs } from './firebase'

/** 기능 요청 — Firestore requests 에 쌓이고, 앱 주인 계정만 읽을 수 있다 (firestore.rules) */
export interface FeatureRequest {
  id: string
  text: string
  fromEmail?: string
  done?: boolean
  createdAt: number
}

/** 기능 요청 보내기. 로그인하지 않은 사람은 이름 없는(익명) 로그인으로 보낸다. */
export async function sendFeatureRequest(text: string) {
  if (!auth.currentUser) await signInAnonymously(auth)
  await addDoc(collection(fs, 'requests'), { text, fromEmail: accountUser()?.email ?? undefined, createdAt: Date.now() })
}

/** 받은 기능 요청 (앱 주인만). enabled 가 아니면 구독하지 않는다 */
export function useFeatureRequests(enabled: boolean) {
  const [list, setList] = useState<FeatureRequest[]>()
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(query(collection(fs, 'requests'), orderBy('createdAt', 'desc')), (snap) => setList(snap.docs.map((d) => ({ ...(d.data() as Omit<FeatureRequest, 'id'>), id: d.id }))))
  }, [enabled])
  return list
}

export const setRequestDone = (id: string, done: boolean) => updateDoc(doc(fs, 'requests', id), { done })
export const deleteRequest = (id: string) => deleteDoc(doc(fs, 'requests', id))

/** 가입한 사람 — 로그인할 때마다 members/{uid} 에 이메일과 마지막 접속을 남긴다 (sync.ts) */
export interface Member {
  uid: string
  email: string
  createdAt?: number
  lastSeen?: number
}

/** 가입한 사람 목록 (앱 주인만). 최근에 가입한 사람이 위로 */
export function useMembers(enabled: boolean) {
  const [list, setList] = useState<Member[]>()
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(collection(fs, 'members'), (snap) =>
      setList(snap.docs.map((d) => ({ ...(d.data() as Omit<Member, 'uid'>), uid: d.id })).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))),
    )
  }, [enabled])
  return list
}
