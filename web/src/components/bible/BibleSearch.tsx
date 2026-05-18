/**
 * BibleSearch - Offline client-side Bible verse search with stats.
 *
 * Drives search from the in-memory verse array via the searchText
 * function exposed by useBibleData. No backend required.
 *
 * Includes a collapsible Search Stats panel mirroring the arcade Church
 * overlay: total occurrences, OT vs NT split, and per-book breakdown
 * with click-to-filter drill-down.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { BibleVerse, BibleBook, SearchResult } from '@hooks/useBibleData'
import { isNewTestament } from '@hooks/useBibleData'
import { shareVerse } from '@/utils/share'

export interface BibleSearchProps {
  searchText: (query: string, limit?: number) => SearchResult[]
  books: BibleBook[]
  onNavigate?: (verse: BibleVerse) => void
  onBookmark?: (verse: BibleVerse) => void
  onListen?: (verse: BibleVerse) => void
  onReflect?: (verse: BibleVerse) => void
  isBookmarked?: (verse: BibleVerse) => boolean
  /** Optional cap on results. Omit for "show all matches". */
  limit?: number
  placeholder?: string
  /**
   * Capture the current query + filter state for "Pin this search". The
   * parent decides what to do with the snapshot (we just hand it up).
   */
  onPin?: (snapshot: {
    query: string
    filterTestament: 'old' | 'new' | null
    filterBook: string | null
    filterChapter: number | null
  }) => void
  /**
   * Predicate the parent provides so we can self-check whether the current
   * (committed) query + filters are already in the user's pinned list.
   */
  isPinned?: (
    query: string,
    filterTestament: 'old' | 'new' | null,
    filterBook: string | null,
    filterChapter: number | null
  ) => boolean
  /**
   * Programmatically restore a previously-pinned search. The component
   * watches this prop for a new identity and rehydrates query + filters.
   */
  restoreSearch?: {
    id: string
    query: string
    filterTestament?: 'old' | 'new'
    filterBook?: string
    filterChapter?: number
  } | null
  /** Called after restoreSearch has been consumed so the parent can clear it. */
  onRestoreSearchConsumed?: () => void
}

interface BookStat {
  count: number
  shortName: string
  testament: 'old' | 'new'
}

interface SearchStats {
  totalOccurrences: number
  versesFound: number
  booksWithMatches: number
  otCount: number
  ntCount: number
  otPercent: number
  ntPercent: number
  bookStats: Record<string, BookStat>
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function computeStats(results: BibleVerse[], query: string, books: BibleBook[]): SearchStats {
  const testamentByShort = new Map<string, 'old' | 'new'>()
  for (const b of books) testamentByShort.set(b.shortName, b.testament)

  const regex = new RegExp(escapeRegExp(query.toLowerCase()), 'gi')
  const bookStats: Record<string, BookStat> = {}
  let totalOccurrences = 0
  let otCount = 0
  let ntCount = 0

  for (const v of results) {
    const matches = v.text.match(regex)
    const count = matches ? matches.length : 1
    totalOccurrences += count

    const testament = testamentByShort.get(v.shortBook) ?? 'old'
    if (testament === 'old') otCount += count
    else ntCount += count

    if (!bookStats[v.shortBook]) {
      bookStats[v.shortBook] = { count: 0, shortName: v.shortBook, testament }
    }
    bookStats[v.shortBook].count += count
  }

  return {
    totalOccurrences,
    versesFound: results.length,
    booksWithMatches: Object.keys(bookStats).length,
    otCount,
    ntCount,
    otPercent: totalOccurrences ? Math.round((otCount / totalOccurrences) * 100) : 0,
    ntPercent: totalOccurrences ? Math.round((ntCount / totalOccurrences) * 100) : 0,
    bookStats,
  }
}

export default function BibleSearch({
  searchText,
  books,
  onNavigate,
  onBookmark,
  onListen,
  onReflect,
  isBookmarked,
  limit,
  placeholder = 'Search any text or reference (e.g. "love", "John 3:16")',
  onPin,
  isPinned,
  restoreSearch = null,
  onRestoreSearchConsumed,
}: BibleSearchProps) {
  const [query, setQuery] = useState('')
  // `committedQuery` is what's actually being searched on — set only when
  // the user submits. Keeps the text field decoupled from the heavy filter
  // chain so typing stays instant and 30k-verse scans only run on intent.
  const [committedQuery, setCommittedQuery] = useState('')
  const [results, setResults] = useState<BibleVerse[]>([])
  const [searching, setSearching] = useState(false)
  const [statsCollapsed, setStatsCollapsed] = useState(false)
  const [filterTestament, setFilterTestament] = useState<'old' | 'new' | null>(null)
  const [filterBook, setFilterBook] = useState<string | null>(null)
  const [filterChapter, setFilterChapter] = useState<number | null>(null)

  const doSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim()
      if (!trimmed) {
        setResults([])
        setSearching(false)
        setCommittedQuery('')
        return
      }
      setSearching(true)
      const matches = searchText(trimmed, limit)
      setResults(matches.map((m) => m.verse))
      setCommittedQuery(trimmed)
      setSearching(false)
      // Reset filters on each new search
      setFilterTestament(null)
      setFilterBook(null)
      setFilterChapter(null)
    },
    [searchText, limit]
  )

  // Clear the result list immediately when the field is emptied — but only
  // *clearing*, not searching. Typing two letters does nothing on its own.
  useEffect(() => {
    if (!query.trim() && (results.length > 0 || committedQuery)) {
      setResults([])
      setCommittedQuery('')
      setFilterTestament(null)
      setFilterBook(null)
      setFilterChapter(null)
    }
  }, [query, results.length, committedQuery])

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      doSearch(query)
    },
    [doSearch, query]
  )

  // Restore a previously-pinned search when one is handed in. Keyed on .id
  // so the effect runs exactly once per pinned-search tap.
  const consumedRestoreRef = useRef<string | null>(null)
  useEffect(() => {
    if (!restoreSearch) return
    if (consumedRestoreRef.current === restoreSearch.id) return
    consumedRestoreRef.current = restoreSearch.id
    const trimmed = restoreSearch.query.trim()
    setQuery(trimmed)
    if (!trimmed) {
      // Empty query — just clear and bail.
      setResults([])
      setCommittedQuery('')
      onRestoreSearchConsumed?.()
      return
    }
    // Run the search synchronously so filters apply to the fresh result set.
    const matches = searchText(trimmed, limit)
    setResults(matches.map((m) => m.verse))
    setCommittedQuery(trimmed)
    setSearching(false)
    setFilterTestament(restoreSearch.filterTestament ?? null)
    setFilterBook(restoreSearch.filterBook ?? null)
    setFilterChapter(
      typeof restoreSearch.filterChapter === 'number' ? restoreSearch.filterChapter : null
    )
    onRestoreSearchConsumed?.()
  }, [restoreSearch, searchText, limit, onRestoreSearchConsumed])

  // `trimmed` is the committed query — used by the stats panel + highlight.
  // (Live query text is `query` and only controls the input field.)
  const trimmed = committedQuery
  const isPunc = /^[^\w\s]+$/.test(trimmed)
  const isReferenceLike = /^\d?\s*\w+\s+\d+:\d+$/i.test(trimmed)

  // Apply testament / book / chapter filters to results.
  // Chapter filter only makes sense when a book is also selected.
  const filteredResults = useMemo(() => {
    let r = results
    if (filterTestament) {
      const allow = new Set(
        books.filter((b) => b.testament === filterTestament).map((b) => b.shortName)
      )
      r = r.filter((v) => allow.has(v.shortBook))
    }
    if (filterBook) {
      r = r.filter((v) => v.shortBook === filterBook)
    }
    if (filterBook && filterChapter !== null) {
      r = r.filter((v) => v.chapter === filterChapter)
    }
    return r
  }, [results, filterTestament, filterBook, filterChapter, books])

  // Is the *currently displayed* committed search already on the user's
  // pinned list? Drives the Pin button label (★ Pinned vs ☆ Pin).
  const currentIsPinned = !!(
    isPinned && trimmed && isPinned(trimmed, filterTestament, filterBook, filterChapter)
  )

  // Stats RE-COMPUTE on the filtered set, so OT/NT/book/chapter selection
  // updates the pills and per-book breakdown immediately.
  const stats = useMemo(
    () =>
      trimmed && filteredResults.length > 0
        ? computeStats(filteredResults, trimmed, books)
        : null,
    [filteredResults, trimmed, books]
  )

  // Always-on totals across the unfiltered result set, used to show
  // "X of Y verses" once a filter is active.
  const totalStats = useMemo(
    () =>
      trimmed && results.length > 0 ? computeStats(results, trimmed, books) : null,
    [results, trimmed, books]
  )

  // When a book is selected, group its verses by chapter for the drilldown.
  const chapterStats = useMemo(() => {
    if (!filterBook) return [] as { chapter: number; verses: number; occurrences: number }[]
    const m = new Map<number, { verses: number; occurrences: number }>()
    const regex = new RegExp(escapeRegExp(trimmed.toLowerCase()), 'gi')
    for (const v of results) {
      if (v.shortBook !== filterBook) continue
      const matches = v.text.match(regex)
      const cnt = matches ? matches.length : 1
      const entry = m.get(v.chapter) ?? { verses: 0, occurrences: 0 }
      entry.verses += 1
      entry.occurrences += cnt
      m.set(v.chapter, entry)
    }
    return Array.from(m.entries())
      .map(([chapter, x]) => ({ chapter, ...x }))
      .sort((a, b) => a.chapter - b.chapter)
  }, [filterBook, results, trimmed])

  const highlightText = (text: string) => {
    if (!trimmed) return text
    const lower = text.toLowerCase()
    const qLower = trimmed.toLowerCase()
    const idx = lower.indexOf(qLower)
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark>{text.slice(idx, idx + trimmed.length)}</mark>
        {text.slice(idx + trimmed.length)}
      </>
    )
  }

  const clearFilter = () => {
    setFilterTestament(null)
    setFilterBook(null)
    setFilterChapter(null)
  }

  const sortedBookStats = useMemo(() => {
    if (!stats) return []
    return Object.entries(stats.bookStats).sort((a, b) => b[1].count - a[1].count)
  }, [stats])

  const maxBookCount = sortedBookStats.length ? sortedBookStats[0][1].count : 1

  return (
    <div className="bible-search">
      <form className="search-input-wrapper" onSubmit={handleSubmit} role="search">
        <button
          type="submit"
          className="search-icon search-submit-btn"
          aria-label="Search"
          title="Search"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="#94A3B8" strokeWidth="1.5" />
            <line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <input
          className="search-input"
          type="search"
          enterKeyHint="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </form>

      {searching && (
        <div style={{ textAlign: 'center', color: 'var(--church-text-muted, #94A3B8)', padding: '12px' }}>
          Searching...
        </div>
      )}

      {/* ── Search Stats Panel ──────────────────────────────────────────── */}
      {!searching && stats && stats.totalOccurrences > 0 && !isReferenceLike && (
        <div className="search-stats">
          <button
            className="search-stats-header"
            onClick={() => setStatsCollapsed((c) => !c)}
            aria-expanded={!statsCollapsed}
          >
            <span className="search-stats-title">
              Stats for <em>"{trimmed}"</em>
            </span>
            <span className="search-stats-toggle">{statsCollapsed ? '▼' : '▲'}</span>
          </button>

          {!statsCollapsed && (
            <div className="search-stats-body">
              {/* Summary row */}
              <div className="search-stats-summary">
                <button
                  className={`search-stats-pill ${!filterTestament && !filterBook ? 'active' : ''}`}
                  onClick={clearFilter}
                  title="Show all results"
                >
                  <span className="search-stats-pill-label">Occurrences</span>
                  <span className="search-stats-pill-val">{stats.totalOccurrences}</span>
                </button>
                <button
                  className={`search-stats-pill ${!filterTestament && !filterBook ? 'active' : ''}`}
                  onClick={clearFilter}
                  title="Show all results"
                >
                  <span className="search-stats-pill-label">Verses</span>
                  <span className="search-stats-pill-val">{stats.versesFound}</span>
                </button>
                <div className="search-stats-pill">
                  <span className="search-stats-pill-label">Books</span>
                  <span className="search-stats-pill-val">{stats.booksWithMatches} / 66</span>
                </div>
              </div>

              {/* OT / NT bars */}
              <div className="search-stats-testaments">
                <button
                  className={`search-stats-bar-row ${filterTestament === 'old' ? 'active' : ''}`}
                  onClick={() =>
                    setFilterTestament((t) => {
                      setFilterBook(null)
                      setFilterChapter(null)
                      return t === 'old' ? null : 'old'
                    })
                  }
                >
                  <span className="search-stats-bar-label">Old Testament</span>
                  <div className="search-stats-bar-track">
                    <div
                      className="search-stats-bar-fill search-stats-bar-fill--ot"
                      style={{ width: `${stats.otPercent}%` }}
                    />
                  </div>
                  <span className="search-stats-bar-val">
                    {stats.otCount} ({stats.otPercent}%)
                  </span>
                </button>
                <button
                  className={`search-stats-bar-row ${filterTestament === 'new' ? 'active' : ''}`}
                  onClick={() =>
                    setFilterTestament((t) => {
                      setFilterBook(null)
                      setFilterChapter(null)
                      return t === 'new' ? null : 'new'
                    })
                  }
                >
                  <span className="search-stats-bar-label">New Testament</span>
                  <div className="search-stats-bar-track">
                    <div
                      className="search-stats-bar-fill search-stats-bar-fill--nt"
                      style={{ width: `${stats.ntPercent}%` }}
                    />
                  </div>
                  <span className="search-stats-bar-val">
                    {stats.ntCount} ({stats.ntPercent}%)
                  </span>
                </button>
              </div>

              {/* Chapter drilldown (visible when a book is selected) */}
              {filterBook && chapterStats.length > 0 && (
                <>
                  <div className="search-stats-books-title">
                    Chapters in {filterBook} — tap to filter
                  </div>
                  <div className="search-stats-chapters">
                    {chapterStats.map(({ chapter, verses, occurrences }) => {
                      const isActive = filterChapter === chapter
                      return (
                        <button
                          key={chapter}
                          className={`search-stats-chapter-chip ${isActive ? 'active' : ''}`}
                          onClick={() =>
                            setFilterChapter((c) => (c === chapter ? null : chapter))
                          }
                          title={`${verses} verse${verses !== 1 ? 's' : ''}, ${occurrences} occurrence${occurrences !== 1 ? 's' : ''}`}
                        >
                          <span className="search-stats-chapter-num">Ch {chapter}</span>
                          <span className="search-stats-chapter-count">{occurrences}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Per-book breakdown */}
              <div className="search-stats-books-title">
                Books ({sortedBookStats.length}) — tap to filter
              </div>
              <div className="search-stats-books">
                {sortedBookStats.map(([book, data]) => {
                  const barW = Math.max(3, Math.round((data.count / maxBookCount) * 100))
                  const isActive = filterBook === book
                  return (
                    <button
                      key={book}
                      className={`search-stats-book-row ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setFilterTestament(null)
                        setFilterChapter(null)
                        setFilterBook((b) => (b === book ? null : book))
                      }}
                    >
                      <span className="search-stats-book-name">{data.shortName}</span>
                      <div className="search-stats-bar-track">
                        <div
                          className={`search-stats-bar-fill search-stats-bar-fill--${data.testament === 'old' ? 'ot' : 'nt'}`}
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                      <span className="search-stats-book-count">{data.count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filter chip + result count + pin action ─────────────────────── */}
      {!searching && results.length > 0 && (
        <div className="search-result-count">
          {(filterTestament || filterBook || filterChapter !== null) ? (
            <>
              <span>
                {filteredResults.length} of {results.length} verses
                {filterBook && filterChapter !== null && ` in ${filterBook} ${filterChapter}`}
                {filterBook && filterChapter === null && ` in ${filterBook}`}
                {filterTestament && !filterBook && ` in ${filterTestament === 'old' ? 'Old' : 'New'} Testament`}
              </span>
              <span className="search-result-actions">
                {onPin && (
                  <button
                    type="button"
                    className={`search-pin-btn ${currentIsPinned ? 'search-pin-btn--pinned' : ''}`}
                    onClick={() =>
                      onPin({
                        query: trimmed,
                        filterTestament,
                        filterBook,
                        filterChapter,
                      })
                    }
                    disabled={currentIsPinned}
                    title={currentIsPinned ? 'Already pinned' : 'Pin this search'}
                    aria-label={currentIsPinned ? 'Already pinned' : 'Pin this search'}
                  >
                    {currentIsPinned ? '★ Pinned' : '☆ Pin'}
                  </button>
                )}
                <button className="search-clear-filter" onClick={clearFilter}>
                  Clear filter
                </button>
              </span>
            </>
          ) : (
            <>
              <span>
                {results.length} verse{results.length !== 1 ? 's' : ''} found
                {isPunc && ` containing "${trimmed}"`}
              </span>
              {onPin && (
                <button
                  type="button"
                  className={`search-pin-btn ${currentIsPinned ? 'search-pin-btn--pinned' : ''}`}
                  onClick={() =>
                    onPin({
                      query: trimmed,
                      filterTestament,
                      filterBook,
                      filterChapter,
                    })
                  }
                  disabled={currentIsPinned}
                  title={currentIsPinned ? 'Already pinned' : 'Pin this search'}
                >
                  {currentIsPinned ? '★ Pinned' : '☆ Pin'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="search-results">
        {filteredResults.map((verse) => {
          const bookmarked = isBookmarked ? isBookmarked(verse) : false
          return (
            <div
              className="verse-card"
              key={verse.reference}
              data-testament={isNewTestament(verse.shortBook) ? 'new' : 'old'}
              onDoubleClick={() => onListen?.(verse)}
              title="Double-tap to read aloud"
            >
              <div className="verse-ref">{verse.reference}</div>
              <div className="verse-text">{highlightText(verse.text)}</div>
              <div className="verse-actions">
                {onListen && (
                  <button className="verse-action-btn" onClick={() => onListen(verse)}>
                    Listen
                  </button>
                )}
                {onNavigate && (
                  <button className="verse-action-btn" onClick={() => onNavigate(verse)}>
                    Read in context
                  </button>
                )}
                {onReflect && (
                  <button className="verse-action-btn" onClick={() => onReflect(verse)}>
                    Reflect
                  </button>
                )}
                <button
                  className="verse-action-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    shareVerse(verse)
                  }}
                  aria-label="Share verse"
                >
                  Share
                </button>
                {onBookmark && (
                  <button
                    className="verse-action-btn"
                    onClick={() => onBookmark(verse)}
                    style={bookmarked ? { background: 'rgba(239,68,68,0.2)', color: '#EF4444' } : {}}
                  >
                    {bookmarked ? 'Saved' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {!searching && trimmed.length >= 1 && results.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--church-text-muted, #94A3B8)', padding: '20px' }}>
            No verses found for "{trimmed}"
          </div>
        )}
      </div>
    </div>
  )
}
