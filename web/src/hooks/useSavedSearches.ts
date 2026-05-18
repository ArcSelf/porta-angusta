/**
 * useSavedSearches — local-only "pinned searches" storage.
 *
 * Each entry captures the search query plus the active filters (testament,
 * book, chapter) so re-running it restores exactly the result list the user
 * was looking at when they pinned it. Lives in localStorage, no backend.
 */

import { useState, useCallback, useEffect } from 'react'

export interface SavedSearch {
  id: string
  /** Free-text query as the user typed it. */
  query: string
  /** Optional friendly label; falls back to the query itself when absent. */
  name?: string
  /** Optional filter state captured at pin time. */
  filterTestament?: 'old' | 'new'
  filterBook?: string
  filterChapter?: number
  createdAt: string
}

const STORAGE_KEY = 'kjv_pinned_searches'

function loadEntries(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedSearch[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function saveEntries(entries: SavedSearch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* localStorage may be disabled */
  }
}

function generateId(): string {
  return (
    (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

export interface UseSavedSearchesReturn {
  entries: SavedSearch[]
  add: (partial: Omit<SavedSearch, 'id' | 'createdAt'>) => SavedSearch
  remove: (id: string) => void
  rename: (id: string, name: string) => void
  /** Quick check: do we already have this query + filter combination? */
  hasMatching: (q: string, t?: 'old' | 'new' | null, b?: string | null, c?: number | null) => boolean
}

export function useSavedSearches(): UseSavedSearchesReturn {
  const [entries, setEntries] = useState<SavedSearch[]>(loadEntries)

  useEffect(() => {
    saveEntries(entries)
  }, [entries])

  const add = useCallback(
    (partial: Omit<SavedSearch, 'id' | 'createdAt'>): SavedSearch => {
      const entry: SavedSearch = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        ...partial,
        // Strip undefined / empty filter fields so the stored object is tidy.
        filterTestament: partial.filterTestament || undefined,
        filterBook: partial.filterBook || undefined,
        filterChapter:
          typeof partial.filterChapter === 'number' && !Number.isNaN(partial.filterChapter)
            ? partial.filterChapter
            : undefined,
      }
      setEntries((prev) => [entry, ...prev])
      return entry
    },
    []
  )

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const rename = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, name: trimmed || undefined } : e))
    )
  }, [])

  const hasMatching = useCallback(
    (
      q: string,
      t?: 'old' | 'new' | null,
      b?: string | null,
      c?: number | null
    ): boolean => {
      const qNorm = q.trim().toLowerCase()
      return entries.some(
        (e) =>
          e.query.trim().toLowerCase() === qNorm &&
          (e.filterTestament || null) === (t || null) &&
          (e.filterBook || null) === (b || null) &&
          (e.filterChapter ?? null) === (c ?? null)
      )
    },
    [entries]
  )

  return { entries, add, remove, rename, hasMatching }
}

export default useSavedSearches
