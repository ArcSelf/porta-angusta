/**
 * BibleApp - Top-level KJV Bible reader.
 *
 * Six features (search, read, listen, topics, entities, bookmarks) selected
 * from a native-feeling bottom tab bar. No church/stained-glass/avatar chrome —
 * just the book.
 */

import { useState, useCallback, useEffect } from 'react'
import { useBibleData } from '@hooks/useBibleData'
import type { BibleVerse } from '@hooks/useBibleData'
import { useBibleEntities } from '@hooks/useBibleEntities'
import { useTextToSpeech } from '@hooks/useTextToSpeech'
import { useSavedSearches } from '@hooks/useSavedSearches'
import type { SavedSearch } from '@hooks/useSavedSearches'
import BibleEntityExplorer from '@components/bible/BibleEntityExplorer'
import BibleSearch from '@components/bible/BibleSearch'
import VerseCard from '@components/bible/VerseCard'
import Journal from '@components/bible/Journal'
import './bible.css'

type Tab = 'search' | 'read' | 'pinned' | 'entities' | 'bookmarks' | 'journal'

/**
 * Convert "John 3:16" into "John, chapter 3, verse 16" before sending to
 * AVSpeechSynthesizer. Without this, the iOS TTS engine interprets the
 * "N:M" pattern as a time-of-day ("three sixteen P.M."). Pulpit-style
 * spoken form is unambiguous and matches how a pastor would read aloud.
 */
function speakableReference(ref: string): string {
  // Book name may include digits ("1 John") and spaces ("Song of Solomon").
  // Lock the match to chapter:verse at the very end of the string.
  const m = ref.match(/^(.+?)\s+(\d+):(\d+)\s*$/)
  if (!m) return ref
  const [, book, ch, v] = m
  return `${book}, chapter ${ch}, verse ${v}`
}

/** Convenience wrapper so the speak-call sites stay readable. */
function speakableVerse(reference: string, text: string): string {
  return `${speakableReference(reference)}. ${text}`
}

function loadBookmarks(): BibleVerse[] {
  try {
    const raw = localStorage.getItem('kjv_bookmarks')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveBookmarks(bookmarks: BibleVerse[]) {
  try {
    localStorage.setItem('kjv_bookmarks', JSON.stringify(bookmarks))
  } catch {
    /* localStorage may be disabled */
  }
}

// User-adjustable reading text size. Stored as a multiplier; applied to the
// .bible-page root via the `--bible-font-scale` CSS variable.
const FONT_SCALES = [0.85, 1.0, 1.15, 1.3, 1.5, 1.75] as const
const DEFAULT_FONT_SCALE = 1.0

function loadFontScale(): number {
  try {
    const raw = localStorage.getItem('kjv_font_scale')
    const n = raw ? parseFloat(raw) : DEFAULT_FONT_SCALE
    return FONT_SCALES.includes(n as (typeof FONT_SCALES)[number])
      ? n
      : DEFAULT_FONT_SCALE
  } catch {
    return DEFAULT_FONT_SCALE
  }
}

function saveFontScale(n: number) {
  try {
    localStorage.setItem('kjv_font_scale', String(n))
  } catch {
    /* ignore */
  }
}

function loadDailyCollapsed(): boolean {
  try {
    return localStorage.getItem('kjv_daily_collapsed') === '1'
  } catch {
    return false
  }
}

function saveDailyCollapsed(v: boolean) {
  try {
    localStorage.setItem('kjv_daily_collapsed', v ? '1' : '0')
  } catch {
    /* ignore */
  }
}

const TAB_LABELS: Record<Tab, string> = {
  search: 'Search',
  read: 'Read',
  pinned: 'Pinned',
  entities: 'People',
  bookmarks: 'Saved',
  journal: 'Journal',
}

function TabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const stroke = active ? '#FCD34D' : '#94A3B8'
  const fill = active ? '#FCD34D' : 'none'
  switch (tab) {
    case 'search':
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="6" stroke={stroke} strokeWidth="1.8" />
          <line x1="15" y1="15" x2="19" y2="19" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'read':
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path d="M3,4 L10,6 L10,19 L3,17 Z" stroke={stroke} strokeWidth="1.6" fill={active ? 'rgba(252,211,77,0.15)' : 'none'} />
          <path d="M19,4 L12,6 L12,19 L19,17 Z" stroke={stroke} strokeWidth="1.6" fill={active ? 'rgba(252,211,77,0.15)' : 'none'} />
        </svg>
      )
    case 'pinned':
      // Pushpin icon — the "pin this search" metaphor.
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path
            d="M11,2 L15,6 L13,8 L14,14 L8,14 L9,8 L7,6 Z"
            stroke={stroke}
            strokeWidth="1.6"
            fill={active ? 'rgba(252,211,77,0.15)' : 'none'}
            strokeLinejoin="round"
          />
          <line x1="11" y1="14" x2="11" y2="20" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'entities':
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <circle cx="11" cy="7" r="3" stroke={stroke} strokeWidth="1.6" fill={fill === 'none' ? 'none' : 'rgba(252,211,77,0.15)'} />
          <path d="M4,19 Q4,12 11,12 Q18,12 18,19" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'bookmarks':
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path d="M5,3 L17,3 L17,20 L11,16 L5,20 Z" stroke={stroke} strokeWidth="1.6" fill={active ? 'rgba(252,211,77,0.15)' : 'none'} strokeLinejoin="round" />
        </svg>
      )
    case 'journal':
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path d="M5,3 L17,3 L17,19 L5,19 Z" stroke={stroke} strokeWidth="1.6" fill={active ? 'rgba(252,211,77,0.15)' : 'none'} strokeLinejoin="round" />
          <line x1="8" y1="8" x2="14" y2="8" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8" y1="11" x2="14" y2="11" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8" y1="14" x2="12" y2="14" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
  }
}

export default function BibleApp() {
  const bible = useBibleData()
  const entities = useBibleEntities(bible.verses, bible.books)
  const tts = useTextToSpeech({ rate: 0.85 })

  const [activeTab, setActiveTab] = useState<Tab>('search')

  const [selectedBook, setSelectedBook] = useState('Genesis')
  const [selectedChapter, setSelectedChapter] = useState(1)
  const [chapterVerses, setChapterVerses] = useState<BibleVerse[]>([])
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null)

  const [listenVerse, setListenVerse] = useState<BibleVerse | null>(null)

  // Saved-search ("Pinned") state. Tap a pinned entry to restore it in Search.
  const savedSearches = useSavedSearches()
  const [restoreSearch, setRestoreSearch] = useState<SavedSearch | null>(null)

  const [bookmarks, setBookmarks] = useState<BibleVerse[]>(loadBookmarks)

  const [dailyVerse, setDailyVerse] = useState<BibleVerse | null>(null)

  // Read-tab multi-select: when on, single-tap toggles inclusion in selectedVerses
  // and "Read selected" reads the chosen verses in canonical order.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set())

  // Reading preferences (persisted).
  const [fontScale, setFontScale] = useState<number>(loadFontScale)
  const [dailyCollapsed, setDailyCollapsed] = useState<boolean>(loadDailyCollapsed)

  const adjustFont = useCallback((delta: 1 | -1) => {
    setFontScale((current) => {
      const idx = FONT_SCALES.indexOf(current as (typeof FONT_SCALES)[number])
      const safeIdx = idx === -1 ? FONT_SCALES.indexOf(DEFAULT_FONT_SCALE) : idx
      const nextIdx = Math.max(
        0,
        Math.min(FONT_SCALES.length - 1, safeIdx + delta)
      )
      const next = FONT_SCALES[nextIdx]
      saveFontScale(next)
      return next
    })
  }, [])

  const toggleDaily = useCallback(() => {
    setDailyCollapsed((prev) => {
      const next = !prev
      saveDailyCollapsed(next)
      return next
    })
  }, [])

  // When a user taps "Reflect" on a verse anywhere in the app, we hand the
  // verse to the Journal pane and switch tabs. The Journal panel consumes
  // composeForVerse once and clears it.
  const [composeForVerse, setComposeForVerse] = useState<
    { reference: string; text: string } | null
  >(null)
  const reflectOnVerse = useCallback((verse: BibleVerse) => {
    setComposeForVerse({ reference: verse.reference, text: verse.text })
    setActiveTab('journal')
  }, [])

  useEffect(() => {
    if (!bible.loading && bible.verses.length > 0) {
      setDailyVerse(bible.getDailyVerse())
    }
  }, [bible.loading, bible.verses.length, bible.getDailyVerse])

  const { loading: bibleLoading, getChapter: bibleGetChapter } = bible

  useEffect(() => {
    if (!bibleLoading) {
      const verses = bibleGetChapter(selectedBook, selectedChapter)
      setChapterVerses(verses)
      // Reset selection whenever the chapter changes.
      setSelectedVerses(new Set())
    }
  }, [bibleLoading, bibleGetChapter, selectedBook, selectedChapter])

  /** User tapped Pin from the Search tab — capture the current search state. */
  const handlePinSearch = useCallback(
    (snapshot: {
      query: string
      filterTestament: 'old' | 'new' | null
      filterBook: string | null
      filterChapter: number | null
    }) => {
      const q = snapshot.query.trim()
      if (!q) return
      if (
        savedSearches.hasMatching(
          q,
          snapshot.filterTestament,
          snapshot.filterBook,
          snapshot.filterChapter
        )
      ) {
        return
      }
      savedSearches.add({
        query: q,
        filterTestament: snapshot.filterTestament ?? undefined,
        filterBook: snapshot.filterBook ?? undefined,
        filterChapter:
          typeof snapshot.filterChapter === 'number' ? snapshot.filterChapter : undefined,
      })
    },
    [savedSearches]
  )

  /** User tapped a pinned-search card. */
  const handleOpenPinned = useCallback((entry: SavedSearch) => {
    setRestoreSearch(entry)
    setActiveTab('search')
  }, [])


  const isBookmarked = useCallback(
    (verse: BibleVerse) => bookmarks.some((b) => b.reference === verse.reference),
    [bookmarks]
  )

  const toggleBookmark = useCallback((verse: BibleVerse) => {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.reference === verse.reference)
      const next = exists
        ? prev.filter((b) => b.reference !== verse.reference)
        : [...prev, verse]
      saveBookmarks(next)
      return next
    })
  }, [])

  // Read a single verse aloud in place. Stays on whatever tab the user is on —
  // it does NOT auto-switch to the Listen tab. The Listen tab still works as a
  // "now playing / controls" view for those who navigate to it.
  const readAloud = useCallback(
    (verse: BibleVerse) => {
      setListenVerse(verse)
      tts.speak(speakableVerse(verse.reference, verse.text))
    },
    [tts]
  )

  // Read a list of verses, in order, as a queue.
  const readVerses = useCallback(
    (vs: BibleVerse[]) => {
      if (vs.length === 0) return
      setListenVerse(vs[0])
      tts.speakQueue(vs.map((v) => speakableVerse(v.reference, v.text)))
    },
    [tts]
  )

  const navigateToRead = useCallback((verse: BibleVerse) => {
    setSelectedBook(verse.shortBook)
    setSelectedChapter(verse.chapter)
    setHighlightedVerse(verse.verse)
    setActiveTab('read')
  }, [])

  if (bible.loading) {
    return (
      <div className="church-page">
        <div className="church-loading">
          <div className="church-loading-spinner" />
          <div className="church-loading-text">Opening the scriptures…</div>
        </div>
      </div>
    )
  }

  if (bible.error) {
    return (
      <div className="church-page">
        <div className="church-loading">
          <div className="church-loading-text">
            Could not load Bible data. Please ensure the KJV CSV file is bundled.
          </div>
        </div>
      </div>
    )
  }

  const tabs: Tab[] = ['search', 'read', 'pinned', 'entities', 'bookmarks', 'journal']

  const fontIdx = FONT_SCALES.indexOf(fontScale as (typeof FONT_SCALES)[number])
  const canShrink = fontIdx > 0
  const canGrow = fontIdx >= 0 && fontIdx < FONT_SCALES.length - 1

  return (
    <div
      className="church-page bible-page"
      style={{ ['--bible-font-scale' as string]: String(fontScale) }}
    >
      <header className="church-header bible-header">
        <div className="bible-header-title">
          <h1 className="church-title">Porta Angusta</h1>
          <p className="church-subtitle">The Narrow Gate · King James Version</p>
        </div>
        <div
          className="bible-header-controls"
          role="group"
          aria-label="Text size"
        >
          <button
            type="button"
            className="font-btn"
            onClick={() => adjustFont(-1)}
            disabled={!canShrink}
            aria-label="Decrease text size"
          >
            A−
          </button>
          <button
            type="button"
            className="font-btn"
            onClick={() => adjustFont(1)}
            disabled={!canGrow}
            aria-label="Increase text size"
          >
            A+
          </button>
        </div>
      </header>

      {dailyVerse && (
        dailyCollapsed ? (
          <button
            type="button"
            className="daily-verse-banner daily-verse-banner--collapsed"
            onClick={toggleDaily}
            aria-expanded="false"
          >
            <span className="daily-verse-collapse-chevron">▾</span>
            <span className="daily-verse-label">Verse of the Day</span>
          </button>
        ) : (
          <div className="daily-verse-banner">
            <button
              type="button"
              className="daily-verse-collapse-btn"
              onClick={(e) => {
                e.stopPropagation()
                toggleDaily()
              }}
              aria-label="Hide daily verse"
              aria-expanded="true"
            >
              ▴
            </button>
            <div
              className="daily-verse-clickable"
              onClick={() => readAloud(dailyVerse)}
              onDoubleClick={() => readAloud(dailyVerse)}
              style={{ cursor: 'pointer' }}
            >
              <div className="daily-verse-label">Verse of the Day</div>
              <div className="daily-verse-text">"{dailyVerse.text}"</div>
              <div className="daily-verse-ref">— {dailyVerse.reference}</div>
            </div>
          </div>
        )
      )}

      <main className="bible-content">
        {activeTab === 'search' && (
          <div className="church-panel" key="search">
            <div className="panel-header">
              <h2 className="panel-title">Search the Scriptures</h2>
            </div>
            <BibleSearch
              searchText={bible.searchText}
              books={bible.books}
              onNavigate={navigateToRead}
              onBookmark={toggleBookmark}
              onListen={readAloud}
              onReflect={reflectOnVerse}
              isBookmarked={isBookmarked}
              onPin={handlePinSearch}
              isPinned={(q, t, b, c) => savedSearches.hasMatching(q, t, b, c)}
              restoreSearch={restoreSearch}
              onRestoreSearchConsumed={() => setRestoreSearch(null)}
            />
          </div>
        )}

        {activeTab === 'read' && (
          <div className="church-panel" key="read">
            <div className="panel-header">
              <h2 className="panel-title">Read</h2>
            </div>

            <div className="read-nav">
              <select
                className="read-select"
                value={selectedBook}
                onChange={(e) => {
                  setSelectedBook(e.target.value)
                  setSelectedChapter(1)
                  setHighlightedVerse(null)
                }}
              >
                {bible.books.map((book) => (
                  <option key={book.shortName} value={book.shortName}>
                    {book.shortName}
                  </option>
                ))}
              </select>

              <select
                className="read-select"
                value={selectedChapter}
                onChange={(e) => {
                  setSelectedChapter(parseInt(e.target.value, 10))
                  setHighlightedVerse(null)
                }}
              >
                {Array.from(
                  { length: bible.getBookChapterCount(selectedBook) },
                  (_, i) => i + 1
                ).map((ch) => (
                  <option key={ch} value={ch}>
                    Chapter {ch}
                  </option>
                ))}
              </select>
            </div>

            <div className="read-chapter-controls">
              <button
                className="verse-action-btn"
                onClick={() => readVerses(chapterVerses)}
                title="Read the whole chapter aloud, verse by verse"
              >
                ▶ Read chapter
              </button>
              <button
                className={`verse-action-btn ${selectMode ? 'verse-action-btn--active' : ''}`}
                onClick={() => {
                  setSelectMode((s) => !s)
                  if (selectMode) setSelectedVerses(new Set())
                }}
                title="Tap verses to add them to a custom reading"
              >
                {selectMode ? `Selecting (${selectedVerses.size})` : 'Select verses'}
              </button>
              {selectMode && selectedVerses.size > 0 && (
                <>
                  <button
                    className="verse-action-btn"
                    onClick={() => {
                      const chosen = chapterVerses.filter((v) =>
                        selectedVerses.has(v.verse)
                      )
                      readVerses(chosen)
                    }}
                  >
                    ▶ Read selected
                  </button>
                  <button
                    className="verse-action-btn"
                    onClick={() => setSelectedVerses(new Set())}
                  >
                    Clear
                  </button>
                </>
              )}
              {tts.isSpeaking && (
                <button className="verse-action-btn" onClick={() => tts.stop()}>
                  ■ Stop
                </button>
              )}
            </div>

            <p className="read-hint">
              {selectMode
                ? 'Tap verses to add them, then "Read selected".'
                : 'Tap to highlight • double-tap to read aloud'}
            </p>

            <div className="read-chapter-verses">
              {chapterVerses.map((verse) => {
                const isSelected = selectedVerses.has(verse.verse)
                const isHighlight = highlightedVerse === verse.verse
                const isNowPlaying = listenVerse?.reference === verse.reference && tts.isSpeaking
                return (
                  <div
                    key={verse.verse}
                    className={`read-verse-row ${
                      isSelected ? 'read-verse-row--selected' : ''
                    } ${isNowPlaying ? 'read-verse-row--playing' : ''}`}
                    onClick={() => {
                      if (selectMode) {
                        setSelectedVerses((prev) => {
                          const next = new Set(prev)
                          if (next.has(verse.verse)) next.delete(verse.verse)
                          else next.add(verse.verse)
                          return next
                        })
                      } else {
                        setHighlightedVerse(verse.verse)
                        setListenVerse(verse)
                      }
                    }}
                    onDoubleClick={() => {
                      if (!selectMode) readAloud(verse)
                    }}
                  >
                    <span className="read-verse-num">{verse.verse}</span>
                    <span
                      className={`read-verse-text ${
                        isHighlight ? 'read-verse-text--highlight' : ''
                      }`}
                    >
                      {verse.text}
                    </span>
                  </div>
                )
              })}
            </div>

            {!selectMode && highlightedVerse && listenVerse && (
              <div className="verse-actions" style={{ marginTop: 12 }}>
                <button className="verse-action-btn" onClick={() => readAloud(listenVerse)}>
                  Read Aloud
                </button>
                <button className="verse-action-btn" onClick={() => toggleBookmark(listenVerse)}>
                  {isBookmarked(listenVerse) ? 'Unsave' : 'Save'}
                </button>
                <button className="verse-action-btn" onClick={() => reflectOnVerse(listenVerse)}>
                  Reflect
                </button>
              </div>
            )}
          </div>
        )}


        {activeTab === 'pinned' && (
          <div className="church-panel" key="pinned">
            <div className="panel-header">
              <h2 className="panel-title">Pinned Searches</h2>
            </div>

            {savedSearches.entries.length === 0 ? (
              <div className="pinned-empty">
                <p className="pinned-empty-text">
                  Nothing pinned yet.<br />
                  Run a search, then tap the <strong>☆ Pin</strong> button
                  beside the result count to keep it here.
                </p>
              </div>
            ) : (
              <div className="pinned-list">
                {savedSearches.entries.map((entry) => {
                  const filterBits: string[] = []
                  if (entry.filterTestament === 'old') filterBits.push('Old Testament')
                  if (entry.filterTestament === 'new') filterBits.push('New Testament')
                  if (entry.filterBook) {
                    filterBits.push(
                      entry.filterChapter
                        ? `${entry.filterBook} ${entry.filterChapter}`
                        : entry.filterBook
                    )
                  }
                  return (
                    <div className="pinned-card" key={entry.id}>
                      <button
                        type="button"
                        className="pinned-card-body"
                        onClick={() => handleOpenPinned(entry)}
                        aria-label={`Open pinned search: ${entry.query}`}
                      >
                        <div className="pinned-card-query">{entry.name || entry.query}</div>
                        {entry.name && entry.name !== entry.query && (
                          <div className="pinned-card-subquery">"{entry.query}"</div>
                        )}
                        {filterBits.length > 0 && (
                          <div className="pinned-card-filters">
                            {filterBits.map((f) => (
                              <span key={f} className="pinned-card-filter-chip">{f}</span>
                            ))}
                          </div>
                        )}
                      </button>
                      <button
                        type="button"
                        className="pinned-card-remove"
                        onClick={() => savedSearches.remove(entry.id)}
                        aria-label={`Remove pinned search: ${entry.query}`}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'entities' && (
          <div className="church-panel" key="entities">
            <div className="panel-header">
              <h2 className="panel-title">Persons &amp; Places</h2>
            </div>

            {entities.loading ? (
              <div style={{ textAlign: 'center', color: 'var(--church-text-muted)', padding: '20px' }}>
                Loading entity data…
              </div>
            ) : entities.error ? (
              <div style={{ textAlign: 'center', color: 'var(--church-red)', padding: '20px' }}>
                {entities.error}
              </div>
            ) : (
              <BibleEntityExplorer
                bookOrder={entities.bookOrder}
                allEntities={entities.allEntities}
                persons={entities.persons}
                places={entities.places}
                getEntityVerses={entities.getEntityVerses}
                isBookmarked={isBookmarked}
                onBookmark={toggleBookmark}
                onListen={readAloud}
                onNavigate={navigateToRead}
                // Tapping a dot in the Arc Diagram no longer yanks you to
                // the Search tab. The verses for any book where the entity
                // appears are already shown by the Book Distribution bar
                // chart below, click-to-expand. Stay put.
              />
            )}
          </div>
        )}

        {activeTab === 'journal' && (
          <div className="church-panel" key="journal">
            <div className="panel-header">
              <h2 className="panel-title">Journal</h2>
            </div>
            <Journal
              composeForVerse={composeForVerse}
              onComposeForVerseConsumed={() => setComposeForVerse(null)}
              getVerseByRef={bible.getVerseByRef}
            />
          </div>
        )}

        {activeTab === 'bookmarks' && (
          <div className="church-panel" key="bookmarks">
            <div className="panel-header">
              <h2 className="panel-title">Saved Verses ({bookmarks.length})</h2>
            </div>

            {bookmarks.length === 0 ? (
              <div className="bookmarks-empty">
                <div className="bookmarks-empty-text">
                  No saved verses yet.<br />
                  Tap the save button on any verse to keep it here.
                </div>
              </div>
            ) : (
              <div className="search-results">
                {bookmarks.map((verse) => (
                  <VerseCard
                    key={verse.reference}
                    verse={verse}
                    bookmarked={true}
                    onBookmark={() => toggleBookmark(verse)}
                    onListen={() => readAloud(verse)}
                    onNavigate={() => navigateToRead(verse)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="bible-tabbar" role="tablist" aria-label="Bible features">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`bible-tab ${activeTab === tab ? 'bible-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <TabIcon tab={tab} active={activeTab === tab} />
            <span className="bible-tab-label">{TAB_LABELS[tab]}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
