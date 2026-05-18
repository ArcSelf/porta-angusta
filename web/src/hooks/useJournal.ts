/**
 * useJournal - Local-only journal storage for the Bible app.
 *
 * Entries are saved to localStorage under "church_journal". Each entry
 * is plain text (optionally with a linked verse reference) — no audio
 * blobs, no backend, no multi-user concerns. Suitable for a solo iPhone
 * reflection journal.
 */

import { useState, useCallback, useEffect } from 'react'

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

const STORAGE_KEY = 'church_journal'

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
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

  // Persist whenever entries change
  useEffect(() => {
    saveEntries(entries)
  }, [entries])

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
