import { useSyncExternalStore } from 'react'
import type { Transaction } from 'dexie'
import { collection, deleteDoc, doc, getDocsFromServer, onSnapshot, setDoc, writeBatch, type FirestoreError } from 'firebase/firestore'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { adoptGuestRecords, db, migrateFromDexieCloud, migrateLegacyDb, TABLES } from '../db'
import { accountUser, auth, fs } from './firebase'

/*
 * 이 기기의 Dexie 표 ↔ Firestore users/{uid}/{표}/{id} 를 맞춘다.
 * - 이 기기에서 바뀐 기록: Dexie 훅으로 모아 두었다가 저장이 끝나면 Firestore 로 보낸다.
 *   (오프라인이면 Firestore 가 기기에 쌓아 두었다가 연결되면 보낸다)
 * - 다른 기기에서 바뀐 기록: onSnapshot 으로 받아 Dexie 에 넣는다. 이때는 다시 보내지 않는다(remote 표시).
 */

type Status = 'guest' | 'starting' | 'synced' | 'sending' | 'offline' | 'denied' | 'error'
let status: Status = 'guest'
let pending = 0
const listeners = new Set<() => void>()
function setStatus(s: Status) {
  status = s
  listeners.forEach((l) => l())
}
const refresh = () => {
  if (status === 'guest' || status === 'starting' || status === 'denied') return
  setStatus(!navigator.onLine ? 'offline' : pending > 0 ? 'sending' : 'synced')
}
window.addEventListener('online', refresh)
window.addEventListener('offline', refresh)

/** 동기화 상태 (설정 화면에 표시) */
export const useSyncStatus = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => status,
  )

let syncUid: string | null = null
const ref = (t: string, id: string) => doc(fs, 'users', syncUid!, t, id)

function onError(e: FirestoreError) {
  // 규칙(firestore.rules)에 막히면 permission-denied
  setStatus(e.code === 'permission-denied' ? 'denied' : 'error')
}

type Marked = Transaction & { __remote?: boolean; __pending?: Map<string, Set<string>> }

/** 다른 기기에서 온 변경을 넣는 저장 — 이 안의 변경은 다시 보내지 않는다 */
function remote(tables: string[], fn: () => Promise<void>) {
  return db.transaction('rw', tables, async (tx) => {
    ;(tx as Marked).__remote = true
    await fn()
  })
}

/** 저장이 끝난 기록을 Firestore 로 보낸다 (지워졌으면 지운다) */
async function flush(changes: Map<string, Set<string>>) {
  if (!syncUid) return
  for (const [t, ids] of changes)
    for (const id of ids) {
      const row = await db.table(t).get(id)
      pending++
      refresh()
      ;(row ? setDoc(ref(t, id), row) : deleteDoc(ref(t, id)))
        .catch(onError)
        .finally(() => {
          pending--
          refresh()
        })
    }
}

function mark(t: string, id: unknown, tx: Transaction) {
  const m = tx as Marked
  if (m.__remote || !syncUid || typeof id !== 'string') return
  if (!m.__pending) {
    const changes = (m.__pending = new Map())
    tx.on('complete', () => flush(changes))
  }
  if (!m.__pending.has(t)) m.__pending.set(t, new Set())
  m.__pending.get(t)!.add(id)
}

for (const t of TABLES) {
  const table = db.table(t)
  table.hook('creating', (pk, obj, tx) => mark(t, pk ?? (obj as { id?: string }).id, tx))
  table.hook('updating', (_mods, pk, _obj, tx) => mark(t, pk, tx))
  table.hook('deleting', (pk, _obj, tx) => mark(t, pk, tx))
}

/** 받은 문서를 Dexie 기록으로 (같은 내용이면 건너뛴다) */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

let unsubs: (() => void)[] = []

function listen(uid: string) {
  for (const t of TABLES) {
    let reconciled = false
    unsubs.push(
      onSnapshot(
        collection(fs, 'users', uid, t),
        { includeMetadataChanges: true },
        (snap) => {
          const changes = snap.docChanges({ includeMetadataChanges: true }).filter((c) => !c.doc.metadata.hasPendingWrites)
          // 서버에서 처음 받은 전체 목록에 없는 기록은 다른 기기에서 지운 것 — 이 기기에서도 지운다
          const reconcile = !reconciled && !snap.metadata.fromCache && !snap.metadata.hasPendingWrites
          if (reconcile) reconciled = true
          if (!changes.length && !reconcile) return refresh()
          remote([t], async () => {
            const table = db.table(t)
            for (const c of changes) {
              if (c.type === 'removed') await table.delete(c.doc.id)
              else {
                const data = c.doc.data()
                if (!same(await table.get(c.doc.id), data)) await table.put(data)
              }
            }
            if (reconcile) {
              const ids = new Set(snap.docs.map((d) => d.id))
              const gone = (await table.toCollection().primaryKeys()).filter((k) => !ids.has(k as string))
              if (gone.length) await table.bulkDelete(gone)
            }
          })
            .then(refresh)
            .catch(() => {})
        },
        onError,
      ),
    )
  }
}

const JOINED = 'planner.syncedUid'

/**
 * 이 기기에서 처음 이 계정으로 동기화할 때: 계정의 기록을 먼저 받고, 손님 기록을 계정 기록으로 바꾼 뒤,
 * 이 기기의 기록을 모두 올린다 (서버 기록을 손님 기록으로 덮어쓰지 않도록 받기가 먼저).
 */
async function join(uid: string) {
  for (const t of TABLES) {
    const snap = await getDocsFromServer(collection(fs, 'users', uid, t))
    await remote([t], async () => {
      for (const d of snap.docs) {
        const local = await db.table(t).get(d.id)
        // 계정에 이미 있는 기록이 기준, 비어 있는 값만 이 기기 기록으로 채운다
        await db.table(t).put(local ? { ...local, ...d.data() } : d.data())
      }
    })
  }
  await adoptGuestRecords()
  for (const t of TABLES) {
    const rows = await db.table(t).toArray()
    for (let i = 0; i < rows.length; i += 400) {
      const batch = writeBatch(fs)
      for (const r of rows.slice(i, i + 400)) batch.set(doc(fs, 'users', uid, t, r.id), r)
      await batch.commit()
    }
  }
  localStorage.setItem(JOINED, uid)
}

/** 가입한 사람 목록(members)에 이메일과 마지막 접속을 남긴다 — 앱 주인이 설정에서 본다 */
function recordMember() {
  const u = accountUser()
  if (!u?.email) return
  const createdAt = Date.parse(u.metadata.creationTime ?? '') || undefined
  setDoc(doc(fs, 'members', u.uid), { email: u.email, createdAt, lastSeen: Date.now() }).catch(() => {})
}

async function start(uid: string) {
  syncUid = uid
  setStatus('starting')
  try {
    if (localStorage.getItem(JOINED) !== uid) await join(uid)
    setStatus('synced')
    refresh()
    listen(uid)
    recordMember()
  } catch (e) {
    syncUid = null
    onError(e as FirestoreError)
  }
}

function stop() {
  unsubs.forEach((u) => u())
  unsubs = []
  syncUid = null
  setStatus('guest')
}

/** 로그아웃: 이 기기의 기록을 지운다 (계정에는 남는다) */
export async function logout() {
  stop()
  await signOut(auth)
  await remote([...TABLES], async () => {
    for (const t of TABLES) await db.table(t).clear()
  })
  localStorage.removeItem(JOINED)
}

/** 동기화 다시 시도 */
export function retrySync() {
  const u = accountUser()
  if (!u) return
  stop()
  localStorage.removeItem(JOINED)
  start(u.uid)
}

/** 앱 시작: 옛 기록 옮기기 → 로그인 상태에 따라 동기화 시작 */
export async function startup() {
  await db.open()
  await auth.authStateReady()
  await migrateLegacyDb()
  // 옛 기록을 새로 옮겼으면, 로그인한 계정에도 다시 올리도록 '처음 동기화'부터 한다
  if (await migrateFromDexieCloud()) localStorage.removeItem(JOINED)
  onAuthStateChanged(auth, (u) => {
    const uid = u && !u.isAnonymous ? u.uid : null
    if (uid === syncUid) return
    stop()
    if (uid) start(uid)
  })
}
