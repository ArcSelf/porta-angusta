/**
 * useJournal - Journal storage for the Bible app.
 *
 * Entries are saved to localStorage under "kjv_journal" (matching the
 * naming convention of every other key written by this app —
 * kjv_bookmarks, kjv_pinned_searches, kjv_font_scale, etc.).
 *
 * When the native iCloud bridge is available (inside the Porta Angusta
 * iOS app), entries are *also* mirrored to NSUbiquitousKeyValueStore.
 * That mirror means journal entries survive a fresh app install on the
 * same iCloud account, and sync across iPhone + iPad. When the bridge
 * isn't available (web dev mode, future Android port without an
 * equivalent), this falls back to localStorage-only behavior.
 *
 * Earlier prototypes wrote to "church_journal"; on first read we
 * migrate that key into the new one so users upgrading from
 * v1.0.0 keep their reflections.
 *
 * Each entry is plain text (optionally with one or more linked verse
 * references) — no audio blobs, no backend, no multi-user concerns.
 * Suitable for a solo iPhone reflection journal.
 */

import { useState, useCallback, useEffect } from 'react'
import { cloudBridge, isCloudBridgeAvailable } from '../utils/cloudBridge'

export interface JournalEntry {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  content: string
  /** Linked verses, e.g. ["John 3:16", "Romans 5:8"]. May be empty. */
  verseRefs?: string[]
}

/** Internal shape that may live on disk from older versions of the app. */
interface LegacyJournalEntry extends Omit<JournalEntry, 'verseRefs'> {
  verseRef?: string
  verseRefs?: string[]
}

const STORAGE_KEY = 'kjv_journal'
const LEGACY_STORAGE_KEY = 'church_journal'

/**
 * One-shot migration of entries written by earlier prototype builds
 * under the "church_journal" key into the canonical "kjv_journal" key.
 *
 * Idempotent — safe to invoke on every load. After the first successful
 * call, the legacy key is gone and this becomes a no-op.
 */
function migrateLegacyKey(): void {
  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw === null) return

    const currentRaw = localStorage.getItem(STORAGE_KEY)
    if (currentRaw === null) {
      // New key is empty — adopt the legacy payload wholesale.
      localStorage.setItem(STORAGE_KEY, legacyRaw)
    }
    // Either we migrated, or the new key already had data and the legacy
    // copy is stale. Either way, the legacy key has no further job.
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // localStorage unavailable, quota exceeded, or read-only mode —
    // leave both keys untouched. Future loads will retry.
  }
}

function normalizeEntry(e: LegacyJournalEntry): JournalEntry {
  // Migrate the old single-verse field into the new array form.
  const refs: string[] = Array.isArray(e.verseRefs)
    ? e.verseRefs.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    : e.verseRef
      ? [e.verseRef]
      : []
  return {
    id: e.id,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    title: e.title || '',
    content: e.content || '',
    verseRefs: refs,
  }
}

function loadEntries(): JournalEntry[] {
  migrateLegacyKey()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LegacyJournalEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeEntry)
  } catch {
    return []
  }
}

function saveEntries(entries: JournalEntry[]) {
  const json = JSON.stringify(entries)
  try {
    localStorage.setItem(STORAGE_KEY, json)
  } catch {
    // localStorage quota exceeded or unavailable. The iCloud mirror
    // (below) still gets the write if the bridge is around.
  }
  if (isCloudBridgeAvailable()) {
    cloudBridge.set(STORAGE_KEY, json).catch(() => {
      // Swift bridge unavailable or iCloud signed out — silently retry
      // on next change. Local copy is already saved above.
    })
  }
}

/**
 * Pick the most-up-to-date entry list between local and cloud copies.
 * Used at startup to reconcile after a fresh install (cloud wins) or
 * a brief offline edit (local wins).
 *
 * Heuristic: whichever side has the newer `updatedAt` timestamp
 * wins. Empty wins nothing — if one side is empty and the other
 * isn't, the non-empty side wins.
 */
function pickAuthoritative(
  local: JournalEntry[],
  cloud: JournalEntry[]
): { winner: 'local' | 'cloud' | 'equal'; merged: JournalEntry[] } {
  if (local.length === 0 && cloud.length === 0) return { winner: 'equal', merged: [] }
  if (local.length === 0) return { winner: 'cloud', merged: cloud }
  if (cloud.length === 0) return { winner: 'local', merged: local }

  const newest = (xs: JournalEntry[]) =>
    xs.reduce((max, e) => Math.max(max, Date.parse(e.updatedAt) || 0), 0)

  const newestLocal = newest(local)
  const newestCloud = newest(cloud)

  if (newestCloud > newestLocal) return { winner: 'cloud', merged: cloud }
  if (newestLocal > newestCloud) return { winner: 'local', merged: local }
  return { winner: 'equal', merged: local }
}

function generateId(): string {
  return (
    (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

export interface UseJournalReturn {
  entries: JournalEntry[]
  addEntry: (partial: Partial<Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>>) => JournalEntry
  updateEntry: (id: string, patch: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>) => void
  deleteEntry: (id: string) => void
}

export function useJournal(): UseJournalReturn {
  const [entries, setEntries] = useState<JournalEntry[]>(loadEntries)

  // Persist whenever entries change — to localStorage and (if available)
  // to the iCloud key-value mirror.
  useEffect(() => {
    saveEntries(entries)
  }, [entries])

  // On mount, reconcile with iCloud (if we're inside the iOS app).
  // Also subscribe to external changes — i.e. data syncing in from
  // another device on the same iCloud account, or arriving after a
  // fresh install once iCloud finishes pulling the user's data.
  useEffect(() => {
    if (!isCloudBridgeAvailable()) return
    let cancelled = false

    function ingestCloudPayload(raw: string | null) {
      if (cancelled || !raw) return
      try {
        const parsed = JSON.parse(raw) as LegacyJournalEntry[]
        if (!Array.isArray(parsed)) return
        const cloudEntries = parsed.map(normalizeEntry)
        setEntries((local) => {
          const { winner, merged } = pickAuthoritative(local, cloudEntries)
          // If local was newer, push it up to iCloud so other devices catch up.
          if (winner === 'local') {
            cloudBridge.set(STORAGE_KEY, JSON.stringify(local)).catch(() => {})
            return local
          }
          return merged
        })
      } catch {
        // Corrupt cloud payload — ignore, keep local state.
      }
    }

    // Initial pull
    cloudBridge.get(STORAGE_KEY).then(ingestCloudPayload)

    // Subscribe to future external changes
    const unsubscribe = cloudBridge.onExternalChange((keys) => {
      if (!keys.includes(STORAGE_KEY)) return
      cloudBridge.get(STORAGE_KEY).then(ingestCloudPayload)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addEntry = useCallback(
    (partial: Partial<Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>>): JournalEntry => {
      const now = new Date().toISOString()
      const entry: JournalEntry = {
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        title: partial.title?.trim() || '',
        content: partial.content?.trim() || '',
        verseRefs: (partial.verseRefs ?? []).filter(
          (r) => typeof r === 'string' && r.trim().length > 0
        ),
      }
      setEntries((prev) => [entry, ...prev])
      return entry
    },
    []
  )

  const updateEntry = useCallback(
    (id: string, patch: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>) => {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                ...patch,
                title: patch.title !== undefined ? patch.title.trim() : e.title,
                content: patch.content !== undefined ? patch.content.trim() : e.content,
                updatedAt: new Date().toISOString(),
              }
            : e
        )
      )
    },
    []
  )

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { entries, addEntry, updateEntry, deleteEntry }
}

export default useJournal
