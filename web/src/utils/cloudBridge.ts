/**
 * cloudBridge — async wrapper around the native iCloud key-value store.
 *
 * On iOS (inside the Porta Angusta WKWebView), this proxies get/set/remove
 * calls through the Swift CloudStore.swift handler, which writes to
 * NSUbiquitousKeyValueStore — Apple's free, automatic iCloud sync for
 * small per-app data. Values are mirrored across the user's devices and
 * survive a fresh app install on the same iCloud account.
 *
 * Outside the iOS shell (e.g. when developing in a plain browser via
 * `npm run dev`), the bridge is unavailable and every call resolves to
 * a no-op. The journal hook detects this and falls back to localStorage
 * only — same behavior as v1.0.
 */

interface ScriptMessageHandler {
  postMessage(message: unknown): void
}

interface WebKitMessageHandlers {
  cloudStore?: ScriptMessageHandler
}

interface WebKit {
  messageHandlers?: WebKitMessageHandlers
}

interface WindowWithWebKit extends Window {
  webkit?: WebKit
  __cloudStoreReply?: (envelope: { id: number; value: string | null }) => void
  __cloudStoreExternalChange?: (keys: string[]) => void
}

type Pending = (value: string | null) => void

const pending = new Map<number, Pending>()
let nextId = 1

const externalHandlers = new Set<(keys: string[]) => void>()

/**
 * Install the global callbacks Swift calls into. Idempotent — safe to
 * import this module multiple times.
 */
function installGlobals(): void {
  const w = window as WindowWithWebKit
  if (!w.__cloudStoreReply) {
    w.__cloudStoreReply = ({ id, value }) => {
      const resolve = pending.get(id)
      if (resolve) {
        pending.delete(id)
        resolve(value ?? null)
      }
    }
  }
  if (!w.__cloudStoreExternalChange) {
    w.__cloudStoreExternalChange = (keys) => {
      const safeKeys = Array.isArray(keys) ? keys : []
      for (const handler of externalHandlers) {
        try {
          handler(safeKeys)
        } catch {
          // Handler bugs shouldn't kill the bridge.
        }
      }
    }
  }
}

installGlobals()

/** True when the native bridge is wired up (i.e. running inside the iOS app). */
export function isCloudBridgeAvailable(): boolean {
  const w = window as WindowWithWebKit
  return typeof w.webkit?.messageHandlers?.cloudStore?.postMessage === 'function'
}

function postMessage(
  op: 'get' | 'set' | 'remove',
  key: string,
  value?: string
): Promise<string | null> {
  if (!isCloudBridgeAvailable()) {
    return Promise.resolve(null)
  }
  const id = nextId++
  return new Promise<string | null>((resolve) => {
    pending.set(id, resolve)
    const handler = (window as WindowWithWebKit).webkit!.messageHandlers!.cloudStore!
    handler.postMessage({ op, key, value, id })

    // Safety net: if Swift never replies (shouldn't happen, but if iCloud
    // is misconfigured we don't want a forever-pending promise), time out.
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        resolve(null)
      }
    }, 5000)
  })
}

export const cloudBridge = {
  get: (key: string): Promise<string | null> => postMessage('get', key),
  set: (key: string, value: string): Promise<void> =>
    postMessage('set', key, value).then(() => undefined),
  remove: (key: string): Promise<void> =>
    postMessage('remove', key).then(() => undefined),

  /**
   * Subscribe to externally-arriving changes (iCloud pushed an update
   * from another device on the same Apple ID, or finished syncing after
   * a fresh install).
   *
   * Returns an unsubscribe function.
   */
  onExternalChange(handler: (keys: string[]) => void): () => void {
    externalHandlers.add(handler)
    return () => {
      externalHandlers.delete(handler)
    }
  },
}
