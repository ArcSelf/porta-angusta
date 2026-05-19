/**
 * backupIO — Export / Import the user's complete Porta Angusta state.
 *
 * Despite the legacy filename (this used to be journal-only in an earlier
 * draft of v1.1), the module now covers every persistent piece of user
 * data the app stores:
 *
 *   - Journal entries, enriched with the full text of every linked verse
 *     so the backup file is self-contained even without the KJV CSV.
 *   - Saved verses (bookmarks).
 *   - Pinned searches with their filter state.
 *   - Reading preferences (font scale, daily-verse collapsed state).
 *
 * The file is a self-describing JSON document with a header (`format`,
 * `version`, `exportedAt`) so older payloads can be migrated. We accept
 * both v1 (journal-only) and v2 (full backup) shapes on import.
 *
 * Export hands the file to the iOS share sheet via the Web Share API so
 * users can route it to Files, AirDrop, Mail, iCloud Drive, etc. Import
 * opens the system file picker, validates, writes to localStorage, and
 * reloads the page so every hook re-initialises against the imported
 * data in one consistent transaction.
 */

import type { JournalEntry } from '@hooks/useJournal'
import type { BibleVerse } from '@hooks/useBibleData'
import type { SavedSearch } from '@hooks/useSavedSearches'

// ── Constants ──────────────────────────────────────────────────────────────

const FORMAT_NAME = 'porta-angusta-backup'
const FORMAT_VERSION = 2

// localStorage keys — must match what the rest of the app reads/writes.
const KEY_JOURNAL = 'kjv_journal'
const KEY_BOOKMARKS = 'kjv_bookmarks'
const KEY_PINNED_SEARCHES = 'kjv_pinned_searches'
const KEY_FONT_SCALE = 'kjv_font_scale'
const KEY_DAILY_COLLAPSED = 'kjv_daily_collapsed'

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * A journal entry as it lives in the exported payload — same shape as
 * in-memory, plus an optional dictionary of full verse text keyed by
 * reference. Verse texts are included so the file is meaningful even
 * if it's read on a platform that doesn't ship the KJV CSV.
 */
export interface ExportedJournalEntry extends JournalEntry {
  verseTexts?: Record<string, string>
}

export interface BackupPayload {
  format: typeof FORMAT_NAME | 'porta-angusta-journal' // legacy v1
  version: number
  exportedAt: string
  /** Optional human-friendly app version stamp. */
  app?: string

  journal: {
    entries: ExportedJournalEntry[]
  }
  bookmarks: BibleVerse[]
  pinnedSearches: SavedSearch[]
  preferences: {
    fontScale?: number
    dailyCollapsed?: boolean
  }
}

type VerseResolver = (reference: string) => BibleVerse | null

interface NavigatorWithShare extends Navigator {
  canShare?: (data?: ShareData) => boolean
  share?: (data: ShareData & { files?: File[] }) => Promise<void>
}

export type ExportResult = 'shared' | 'downloaded' | 'cancelled' | 'failed'

export type ImportResult =
  | { ok: true; payload: BackupPayload }
  | { ok: false; reason: string }

// ── Read helpers (localStorage → typed payload) ────────────────────────────

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed as T
  } catch {
    return fallback
  }
}

function readJournalEntries(): JournalEntry[] {
  const raw = readJSON<JournalEntry[]>(KEY_JOURNAL, [])
  if (!Array.isArray(raw)) return []
  return raw
}

function readBookmarks(): BibleVerse[] {
  const raw = readJSON<BibleVerse[]>(KEY_BOOKMARKS, [])
  if (!Array.isArray(raw)) return []
  return raw
}

function readPinnedSearches(): SavedSearch[] {
  const raw = readJSON<SavedSearch[]>(KEY_PINNED_SEARCHES, [])
  if (!Array.isArray(raw)) return []
  return raw
}

function readPreferences(): BackupPayload['preferences'] {
  const fs = parseFloat(localStorage.getItem(KEY_FONT_SCALE) ?? '')
  const dc = localStorage.getItem(KEY_DAILY_COLLAPSED)
  return {
    fontScale: Number.isFinite(fs) ? fs : undefined,
    dailyCollapsed: dc == null ? undefined : dc === '1',
  }
}

// ── Build the export payload ───────────────────────────────────────────────

/**
 * Snapshot every user-owned localStorage key into a single payload object.
 * If `resolveVerse` is provided, each journal entry's referenced verses
 * are inlined as full text so the backup is portable.
 */
export function gatherBackup(resolveVerse?: VerseResolver): BackupPayload {
  const entries = readJournalEntries()
  const enrichedEntries: ExportedJournalEntry[] = entries.map((e) => {
    const refs = e.verseRefs ?? []
    if (!resolveVerse || refs.length === 0) return e
    const verseTexts: Record<string, string> = {}
    for (const ref of refs) {
      const v = resolveVerse(ref)
      if (v) verseTexts[ref] = v.text
    }
    return Object.keys(verseTexts).length > 0 ? { ...e, verseTexts } : e
  })

  return {
    format: FORMAT_NAME,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'Porta Angusta',

    journal: { entries: enrichedEntries },
    bookmarks: readBookmarks(),
    pinnedSearches: readPinnedSearches(),
    preferences: readPreferences(),
  }
}

function buildFilename(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `porta-angusta-backup-${yyyy}-${mm}-${dd}.json`
}

/**
 * Export the user's full state. Opens the iOS share sheet (Files,
 * AirDrop, Mail, iCloud Drive, etc.) via the Web Share API on iOS;
 * falls back to a download in regular browsers.
 */
export async function exportBackup(resolveVerse?: VerseResolver): Promise<ExportResult> {
  const payload = gatherBackup(resolveVerse)
  const json = JSON.stringify(payload, null, 2)
  const filename = buildFilename()

  const nav = navigator as NavigatorWithShare
  if (typeof nav.share === 'function') {
    try {
      const file = new File([json], filename, { type: 'application/json' })
      const canShareFile =
        typeof nav.canShare === 'function' ? nav.canShare({ files: [file] }) : true
      if (canShareFile) {
        await nav.share({
          files: [file],
          title: 'Porta Angusta backup',
        })
        return 'shared'
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // fall through
    }
  }

  // Download fallback for plain browsers / older WKWebView.
  try {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}

// ── Validation (parsed JSON → BackupPayload) ───────────────────────────────

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function normalizeJournalEntry(raw: unknown): ExportedJournalEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const e = raw as Record<string, unknown>
  const id =
    typeof e.id === 'string' && e.id.length > 0
      ? e.id
      : crypto?.randomUUID?.() ?? `imported-${Date.now()}-${Math.random()}`
  const createdAt = typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString()
  const updatedAt = typeof e.updatedAt === 'string' ? e.updatedAt : createdAt
  const title = typeof e.title === 'string' ? e.title : ''
  const content = typeof e.content === 'string' ? e.content : ''
  const verseRefs = isStringArray(e.verseRefs)
    ? e.verseRefs
    : typeof (e as { verseRef?: unknown }).verseRef === 'string'
      ? [(e as { verseRef: string }).verseRef]
      : []
  if (!title && !content && verseRefs.length === 0) return null
  const verseTexts =
    typeof e.verseTexts === 'object' && e.verseTexts !== null
      ? (e.verseTexts as Record<string, string>)
      : undefined
  return { id, createdAt, updatedAt, title, content, verseRefs, verseTexts }
}

function normalizeBookmark(raw: unknown): BibleVerse | null {
  if (typeof raw !== 'object' || raw === null) return null
  const v = raw as Record<string, unknown>
  if (
    typeof v.reference !== 'string' ||
    typeof v.text !== 'string' ||
    typeof v.book !== 'string'
  ) {
    return null
  }
  return {
    book: v.book as string,
    shortBook: typeof v.shortBook === 'string' ? v.shortBook : (v.book as string),
    chapter: typeof v.chapter === 'number' ? v.chapter : 0,
    verse: typeof v.verse === 'number' ? v.verse : 0,
    text: v.text as string,
    reference: v.reference as string,
  }
}

function normalizePinnedSearch(raw: unknown): SavedSearch | null {
  if (typeof raw !== 'object' || raw === null) return null
  const s = raw as Record<string, unknown>
  if (typeof s.query !== 'string' || s.query.trim().length === 0) return null
  return {
    id:
      typeof s.id === 'string'
        ? s.id
        : crypto?.randomUUID?.() ?? `imported-${Date.now()}-${Math.random()}`,
    query: s.query,
    name: typeof s.name === 'string' ? s.name : undefined,
    filterTestament:
      s.filterTestament === 'old' || s.filterTestament === 'new'
        ? s.filterTestament
        : undefined,
    filterBook: typeof s.filterBook === 'string' ? s.filterBook : undefined,
    filterChapter: typeof s.filterChapter === 'number' ? s.filterChapter : undefined,
    createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date().toISOString(),
  }
}

function validatePayload(parsed: unknown): ImportResult {
  if (parsed === null || typeof parsed !== 'object') {
    return { ok: false, reason: 'The file did not contain JSON in the expected format.' }
  }

  const root = parsed as Record<string, unknown>

  // Where to find journal entries (handles both v2 and v1 shapes, plus
  // a bare array of entries from a hand-trimmed file).
  let entriesRaw: unknown
  if (Array.isArray(parsed)) {
    entriesRaw = parsed
  } else if (
    typeof root.journal === 'object' &&
    root.journal !== null &&
    Array.isArray((root.journal as { entries?: unknown }).entries)
  ) {
    entriesRaw = (root.journal as { entries: unknown[] }).entries
  } else if (Array.isArray(root.entries)) {
    entriesRaw = root.entries
  } else {
    entriesRaw = []
  }

  const journalEntries: ExportedJournalEntry[] = Array.isArray(entriesRaw)
    ? entriesRaw
        .map(normalizeJournalEntry)
        .filter((e): e is ExportedJournalEntry => e !== null)
    : []

  const bookmarksRaw = Array.isArray(root.bookmarks) ? root.bookmarks : []
  const bookmarks = bookmarksRaw
    .map(normalizeBookmark)
    .filter((b): b is BibleVerse => b !== null)

  const pinnedRaw = Array.isArray(root.pinnedSearches) ? root.pinnedSearches : []
  const pinnedSearches = pinnedRaw
    .map(normalizePinnedSearch)
    .filter((s): s is SavedSearch => s !== null)

  const prefsRaw =
    typeof root.preferences === 'object' && root.preferences !== null
      ? (root.preferences as Record<string, unknown>)
      : {}
  const preferences: BackupPayload['preferences'] = {
    fontScale: typeof prefsRaw.fontScale === 'number' ? prefsRaw.fontScale : undefined,
    dailyCollapsed:
      typeof prefsRaw.dailyCollapsed === 'boolean' ? prefsRaw.dailyCollapsed : undefined,
  }

  // Reject only if nothing usable came through.
  const totalImportable =
    journalEntries.length + bookmarks.length + pinnedSearches.length +
    Object.values(preferences).filter((v) => v !== undefined).length
  if (totalImportable === 0) {
    return { ok: false, reason: 'File contained no usable journal, bookmarks, or pinned searches.' }
  }

  const formatRaw = typeof root.format === 'string' ? root.format : 'porta-angusta-backup'
  const versionRaw = typeof root.version === 'number' ? root.version : 1
  const exportedAt =
    typeof root.exportedAt === 'string' ? root.exportedAt : new Date().toISOString()

  return {
    ok: true,
    payload: {
      format: formatRaw as BackupPayload['format'],
      version: versionRaw,
      exportedAt,
      journal: { entries: journalEntries },
      bookmarks,
      pinnedSearches,
      preferences,
    },
  }
}

// ── Import (file picker → validated payload) ───────────────────────────────

/**
 * Opens the system file picker, reads the chosen JSON file, validates,
 * and returns the parsed payload (or an error). Resolves with `ok:false`
 * on user cancellation, read failure, or invalid content.
 */
export async function importBackup(): Promise<ImportResult> {
  return new Promise<ImportResult>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.style.display = 'none'
    document.body.appendChild(input)

    let resolved = false
    const cleanup = () => {
      try {
        document.body.removeChild(input)
      } catch {
        /* already gone */
      }
    }
    const finish = (result: ImportResult) => {
      if (resolved) return
      resolved = true
      cleanup()
      resolve(result)
    }

    input.addEventListener('cancel', () => finish({ ok: false, reason: 'Import cancelled.' }))

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        finish({ ok: false, reason: 'No file selected.' })
        return
      }
      const reader = new FileReader()
      reader.onerror = () =>
        finish({ ok: false, reason: 'Could not read the selected file.' })
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : ''
        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          finish({ ok: false, reason: 'The file is not valid JSON.' })
          return
        }
        finish(validatePayload(parsed))
      }
      reader.readAsText(file)
    })

    input.click()
  })
}

// ── Apply (validated payload → localStorage + reload) ──────────────────────

export interface ApplyCounts {
  journal: { added: number; updated: number; unchanged: number }
  bookmarks: { added: number; unchanged: number }
  pinnedSearches: { added: number; unchanged: number }
  preferencesRestored: boolean
}

/**
 * Apply a validated payload to localStorage, merging with whatever's
 * already there. Conflict-free: for the journal, the entry with the
 * newer `updatedAt` wins. Bookmarks and pinned searches dedupe by
 * reference / query (case-insensitive). Preferences overwrite.
 *
 * After writing, by default the page is reloaded so every hook
 * re-initialises against the new persistent state. Pass
 * `{reload:false}` to suppress the reload (the caller is expected
 * to drive its own state refresh).
 */
export function applyBackup(
  payload: BackupPayload,
  options: { reload?: boolean } = {}
): ApplyCounts {
  // ── Journal (merge by id, newer updatedAt wins) ──────────────────────────
  const existingEntries = readJournalEntries()
  const byId = new Map<string, JournalEntry>(existingEntries.map((e) => [e.id, e]))
  let jAdded = 0
  let jUpdated = 0
  let jUnchanged = 0
  for (const inc of payload.journal?.entries ?? []) {
    // Strip the verseTexts before storing — the live store only holds refs.
    const stripped: JournalEntry = {
      id: inc.id,
      createdAt: inc.createdAt,
      updatedAt: inc.updatedAt,
      title: inc.title,
      content: inc.content,
      verseRefs: inc.verseRefs,
    }
    const existing = byId.get(inc.id)
    if (!existing) {
      byId.set(inc.id, stripped)
      jAdded++
    } else {
      const incTime = Date.parse(inc.updatedAt) || 0
      const exTime = Date.parse(existing.updatedAt) || 0
      if (incTime > exTime) {
        byId.set(inc.id, stripped)
        jUpdated++
      } else {
        jUnchanged++
      }
    }
  }
  const mergedJournal = Array.from(byId.values()).sort(
    (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
  )
  try {
    localStorage.setItem(KEY_JOURNAL, JSON.stringify(mergedJournal))
  } catch {
    /* quota / disabled */
  }

  // ── Bookmarks (dedupe by reference, preserve order) ──────────────────────
  const existingBookmarks = readBookmarks()
  const haveRefs = new Set(existingBookmarks.map((b) => b.reference))
  let bAdded = 0
  let bUnchanged = 0
  const mergedBookmarks = [...existingBookmarks]
  for (const inc of payload.bookmarks ?? []) {
    if (haveRefs.has(inc.reference)) {
      bUnchanged++
    } else {
      mergedBookmarks.push(inc)
      haveRefs.add(inc.reference)
      bAdded++
    }
  }
  try {
    localStorage.setItem(KEY_BOOKMARKS, JSON.stringify(mergedBookmarks))
  } catch {
    /* */
  }

  // ── Pinned searches (dedupe by query + filter combination) ──────────────
  const existingPinned = readPinnedSearches()
  const pinnedKey = (s: SavedSearch) =>
    [
      s.query.trim().toLowerCase(),
      s.filterTestament ?? '',
      s.filterBook ?? '',
      s.filterChapter ?? '',
    ].join('|')
  const havePinned = new Set(existingPinned.map(pinnedKey))
  let pAdded = 0
  let pUnchanged = 0
  const mergedPinned = [...existingPinned]
  for (const inc of payload.pinnedSearches ?? []) {
    const key = pinnedKey(inc)
    if (havePinned.has(key)) {
      pUnchanged++
    } else {
      mergedPinned.push(inc)
      havePinned.add(key)
      pAdded++
    }
  }
  try {
    localStorage.setItem(KEY_PINNED_SEARCHES, JSON.stringify(mergedPinned))
  } catch {
    /* */
  }

  // ── Preferences (overwrite when present in payload) ─────────────────────
  let preferencesRestored = false
  if (typeof payload.preferences?.fontScale === 'number') {
    try {
      localStorage.setItem(KEY_FONT_SCALE, String(payload.preferences.fontScale))
      preferencesRestored = true
    } catch {
      /* */
    }
  }
  if (typeof payload.preferences?.dailyCollapsed === 'boolean') {
    try {
      localStorage.setItem(KEY_DAILY_COLLAPSED, payload.preferences.dailyCollapsed ? '1' : '0')
      preferencesRestored = true
    } catch {
      /* */
    }
  }

  // ── Reload the page so all hooks pick up the new state ──────────────────
  if (options.reload !== false) {
    // Small delay so the caller can show a toast before the page swaps.
    setTimeout(() => {
      try {
        window.location.reload()
      } catch {
        /* */
      }
    }, 600)
  }

  return {
    journal: { added: jAdded, updated: jUpdated, unchanged: jUnchanged },
    bookmarks: { added: bAdded, unchanged: bUnchanged },
    pinnedSearches: { added: pAdded, unchanged: pUnchanged },
    preferencesRestored,
  }
}
