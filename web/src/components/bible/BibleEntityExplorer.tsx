/**
 * BibleEntityExplorer - Interactive entity arc visualization
 *
 * Shows persons and places extracted from the KJV Bible with a graphical
 * arc diagram tracing where each entity appears across books, chapters,
 * and verses. Powered by spaCy NER + curated biblical dictionary.
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import type { EntityEntry, EntityType } from '@hooks/useBibleEntities'
import type { BibleVerse } from '@hooks/useBibleData'
import VerseCard from '@components/bible/VerseCard'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface BibleEntityExplorerProps {
  bookOrder: string[]
  allEntities: (EntityEntry & { type: EntityType })[]
  persons: EntityEntry[]
  places: EntityEntry[]
  getEntityVerses: (name: string, book?: string) => BibleVerse[]
  isBookmarked: (verse: BibleVerse) => boolean
  onBookmark: (verse: BibleVerse) => void
  onListen: (verse: BibleVerse) => void
  onNavigate: (verse: BibleVerse) => void
  onEntityVerseClick?: (entityName: string, book: string) => void
}

type FilterType = 'all' | 'PERSON' | 'PLACE'

// Short book labels for the spine visualization
const SHORT_LABELS: Record<string, string> = {
  'Genesis': 'Gen', 'Exodus': 'Exo', 'Leviticus': 'Lev', 'Numbers': 'Num',
  'Deuteronomy': 'Deu', 'Joshua': 'Jos', 'Judges': 'Jdg', 'Ruth': 'Rut',
  '1 Samuel': '1Sa', '2 Samuel': '2Sa', '1 Kings': '1Ki', '2 Kings': '2Ki',
  '1 Chronicles': '1Ch', '2 Chronicles': '2Ch', 'Ezra': 'Ezr', 'Nehemiah': 'Neh',
  'Esther': 'Est', 'Job': 'Job', 'Psalms': 'Psa', 'Proverbs': 'Pro',
  'Ecclesiastes': 'Ecc', 'Song of Solomon': 'SoS', 'Isaiah': 'Isa',
  'Jeremiah': 'Jer', 'Lamentations': 'Lam', 'Ezekiel': 'Eze', 'Daniel': 'Dan',
  'Hosea': 'Hos', 'Joel': 'Joe', 'Amos': 'Amo', 'Obadiah': 'Oba',
  'Jonah': 'Jon', 'Micah': 'Mic', 'Nahum': 'Nah', 'Habakkuk': 'Hab',
  'Zephaniah': 'Zep', 'Haggai': 'Hag', 'Zechariah': 'Zec', 'Malachi': 'Mal',
  'Matthew': 'Mat', 'Mark': 'Mrk', 'Luke': 'Luk', 'John': 'Jhn', 'Acts': 'Act',
  'Romans': 'Rom', '1 Corinthians': '1Co', '2 Corinthians': '2Co',
  'Galatians': 'Gal', 'Ephesians': 'Eph', 'Philippians': 'Php',
  'Colossians': 'Col', '1 Thessalonians': '1Th', '2 Thessalonians': '2Th',
  '1 Timothy': '1Ti', '2 Timothy': '2Ti', 'Titus': 'Tit', 'Philemon': 'Phm',
  'Hebrews': 'Heb', 'James': 'Jas', '1 Peter': '1Pe', '2 Peter': '2Pe',
  '1 John': '1Jn', '2 John': '2Jn', '3 John': '3Jn', 'Jude': 'Jud',
  'Revelation': 'Rev',
}

// ─────────────────────────────────────────────────────────────────────────────
// ARC DIAGRAM SVG
// ─────────────────────────────────────────────────────────────────────────────

interface ArcDiagramProps {
  bookOrder: string[]
  entity: (EntityEntry & { type: EntityType }) | null
  onBookClick?: (book: string) => void
}

function ArcDiagram({ bookOrder, entity, onBookClick }: ArcDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(600)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const numBooks = bookOrder.length // 66
  const margin = {
    left: 10,
    right: 10,
    top: 120,
    bottom: 56, // enough room for the OT / NT band labels — no per-book text
  }
  const svgWidth = Math.max(containerWidth, 400)
  const innerWidth = svgWidth - margin.left - margin.right
  const bookSpacing = innerWidth / numBooks
  const svgHeight = margin.top + margin.bottom + 10

  // Determine which books have this entity
  const bookPresence = useMemo(() => {
    if (!entity) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const book of bookOrder) {
      const count = entity.bookCounts[book] ?? 0
      if (count > 0) map.set(book, count)
    }
    return map
  }, [entity, bookOrder])

  // Find the max count for scaling dot sizes
  const maxCount = useMemo(() => {
    let max = 1
    bookPresence.forEach((c: number) => { if (c > max) max = c })
    return max
  }, [bookPresence])

  // Get the indices of books where entity appears
  const presentIndices = useMemo(() => {
    return bookOrder
      .map((b, i) => bookPresence.has(b) ? i : -1)
      .filter((i) => i >= 0)
  }, [bookOrder, bookPresence])

  const bookX = (idx: number) => margin.left + idx * bookSpacing + bookSpacing / 2
  const spineY = margin.top

  // Color based on entity type
  const arcColor = entity?.type === 'PERSON' ? '#FCD34D' : '#06B6D4'
  const arcColorDim = entity?.type === 'PERSON' ? 'rgba(252,211,77,0.15)' : 'rgba(6,182,212,0.15)'
  const isOT = (idx: number) => idx < 39
  return (
    <div ref={containerRef} className="entity-arc-container">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="entity-arc-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="arc-grad-person" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#FCD34D" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="arc-grad-place" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0891B2" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Testament divider line — straight down the middle of the canon. */}
        <line
          x1={bookX(38.5)} y1={spineY - 8}
          x2={bookX(38.5)} y2={spineY + 16}
          stroke="#4B5563" strokeWidth="1" strokeDasharray="3,3"
        />

        {/* OT / NT band labels — clearly readable, centred under each half. */}
        <text x={bookX(19)} y={spineY + 32} textAnchor="middle"
          fill="#CBD5E1" fontSize="11" fontWeight="700"
          style={{ letterSpacing: 0.5 }}>OLD TESTAMENT</text>
        <text x={bookX(52)} y={spineY + 32} textAnchor="middle"
          fill="#CBD5E1" fontSize="11" fontWeight="700"
          style={{ letterSpacing: 0.5 }}>NEW TESTAMENT</text>

        {/* Section anchors — Gen at far left, Mal between testaments, Rev at far right.
            Tells the eye "this is left-to-right canonical order" without the
            confetti of per-book labels. */}
        <text x={bookX(0)} y={spineY + 50} textAnchor="middle"
          fill="#94A3B8" fontSize="9" fontWeight="600">Gen</text>
        <text x={bookX(38)} y={spineY + 50} textAnchor="middle"
          fill="#94A3B8" fontSize="9" fontWeight="600">Mal</text>
        <text x={bookX(39)} y={spineY + 50} textAnchor="middle"
          fill="#94A3B8" fontSize="9" fontWeight="600">Mat</text>
        <text x={bookX(65)} y={spineY + 50} textAnchor="middle"
          fill="#94A3B8" fontSize="9" fontWeight="600">Rev</text>

        {/* Bible spine — book columns */}
        {bookOrder.map((book, idx) => {
          const x = bookX(idx)
          const count = bookPresence.get(book) ?? 0
          const hasEntity = count > 0
          const dotR = hasEntity ? 2.5 + (count / maxCount) * 5 : 0

          return (
            <g key={book} onClick={() => hasEntity && onBookClick?.(book)} style={hasEntity ? { cursor: 'pointer' } : {}}>
              {/* Spine tick — OT tinted warm, NT tinted cool */}
              <line
                x1={x} y1={spineY - 3} x2={x} y2={spineY + 3}
                stroke={hasEntity ? arcColor : isOT(idx) ? '#92400E' : '#1E3A5F'}
                strokeWidth={hasEntity ? 1.5 : 0.5}
                opacity={hasEntity ? 1 : 0.4}
              />

              {/* Entity dot with dim halo */}
              {hasEntity && (
                <>
                  <circle
                    cx={x} cy={spineY}
                    r={dotR + 3}
                    fill={arcColorDim}
                  />
                  <circle
                    cx={x} cy={spineY}
                    r={dotR}
                    fill={arcColor}
                    opacity={0.85}
                  >
                    <title>{book}: {count} verse{count !== 1 ? 's' : ''}</title>
                  </circle>
                </>
              )}

              {/* No per-book labels in the arc — the bar chart below
                  (Book Distribution) names every book with its count. */}
            </g>
          )
        })}

        {/* Spine baseline */}
        <line
          x1={margin.left} y1={spineY}
          x2={svgWidth - margin.right} y2={spineY}
          stroke="#334155" strokeWidth="1"
        />

        {/* Arc paths connecting entity occurrences */}
        {entity && presentIndices.length > 1 && presentIndices.map((startIdx: number, i: number) => {
          if (i >= presentIndices.length - 1) return null
          const endIdx = presentIndices[i + 1]
          const x1 = bookX(startIdx)
          const x2 = bookX(endIdx)
          const span = Math.abs(x2 - x1)
          const arcHeight = Math.min(span * 0.45, margin.top - 15)
          const midX = (x1 + x2) / 2

          return (
            <path
              key={`${startIdx}-${endIdx}`}
              d={`M ${x1} ${spineY} Q ${midX} ${spineY - arcHeight} ${x2} ${spineY}`}
              fill="none"
              stroke={`url(#arc-grad-${entity.type === 'PERSON' ? 'person' : 'place'})`}
              strokeWidth={1.2}
              opacity={0.7}
            />
          )
        })}

        {/* Grand arc from first to last occurrence */}
        {entity && presentIndices.length > 2 && (() => {
          const first = presentIndices[0]
          const last = presentIndices[presentIndices.length - 1]
          const x1 = bookX(first)
          const x2 = bookX(last)
          const span = Math.abs(x2 - x1)
          const arcHeight = Math.min(span * 0.3, margin.top - 5)
          const midX = (x1 + x2) / 2

          return (
            <path
              d={`M ${x1} ${spineY} Q ${midX} ${spineY - arcHeight} ${x2} ${spineY}`}
              fill="none"
              stroke={arcColor}
              strokeWidth={1.8}
              opacity={0.25}
              strokeDasharray="4,4"
            />
          )
        })()}

        {/* No entity selected hint */}
        {!entity && (
          <text x={svgWidth / 2} y={spineY - 30} textAnchor="middle"
            fill="#64748B" fontSize="11">
            Select an entity below to see its trace through the Bible
          </text>
        )}

        {/* Entity name label — sized to read as a real chart title on phone. */}
        {entity && (
          <text x={svgWidth / 2} y={24} textAnchor="middle"
            fill={arcColor} fontSize="17" fontWeight="800">
            {entity.name}
            <tspan x={svgWidth / 2} dy="18" fill="#94A3B8" fontSize="11" fontWeight="500">
              {entity.count} verses · {presentIndices.length} book{presentIndices.length !== 1 ? 's' : ''}
            </tspan>
          </text>
        )}
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HEAT MAP — compact overview of all entities
// ─────────────────────────────────────────────────────────────────────────────

interface HeatMapProps {
  bookOrder: string[]
  entities: (EntityEntry & { type: EntityType })[]
  selectedEntity: string | null
  onSelect: (name: string) => void
}

function EntityHeatMap({ bookOrder, entities, selectedEntity, onSelect }: HeatMapProps) {
  // The heat map's 66-book × N-entity grid becomes a strip of 2px-tall rows
  // when N goes into the hundreds. Cap to top-30 by frequency so the
  // visualization stays legible on a phone; users can switch to the Arc
  // Trace view and use the entity list below to reach anyone outside that.
  const displayed = entities.slice(0, 30)

  return (
    <div className="entity-heatmap">
      <div className="heatmap-grid" style={{
        gridTemplateColumns: `120px repeat(${bookOrder.length}, 1fr)`,
      }}>
        {/* Header row — book labels */}
        <div className="heatmap-corner" />
        {bookOrder.map((book, i) => (
          <div key={book} className="heatmap-book-label" title={book}>
            {i % 5 === 0 ? (SHORT_LABELS[book] || book.slice(0, 3)) : ''}
          </div>
        ))}

        {/* Entity rows */}
        {displayed.map((entity) => {
          const isSelected = selectedEntity === entity.name
          const maxInRow = Math.max(1, ...Object.values(entity.bookCounts))

          return [
            <div
              key={`label-${entity.name}`}
              className={`heatmap-entity-label ${isSelected ? 'heatmap-entity-label--active' : ''}`}
              onClick={() => onSelect(entity.name)}
              title={`${entity.name} (${entity.count} verses)`}
              style={isSelected ? {
                color: entity.type === 'PERSON' ? '#FCD34D' : '#06B6D4',
              } : {}}
            >
              <span className={`heatmap-type-dot heatmap-type-dot--${entity.type.toLowerCase()}`} />
              {entity.name}
            </div>,
            ...bookOrder.map((book) => {
              const count = entity.bookCounts[book] ?? 0
              const intensity = count > 0 ? 0.2 + (count / maxInRow) * 0.8 : 0
              const color = entity.type === 'PERSON' ? '#FCD34D' : '#06B6D4'

              return (
                <div
                  key={`${entity.name}-${book}`}
                  className="heatmap-cell"
                  onClick={() => { if (count > 0) onSelect(entity.name) }}
                  style={count > 0 ? {
                    background: color,
                    opacity: intensity,
                    cursor: 'pointer',
                  } : {}}
                  title={count > 0 ? `${entity.name} in ${book}: ${count}` : ''}
                />
              )
            }),
          ]
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOK BREAKDOWN — detail view for selected entity in a book
// ─────────────────────────────────────────────────────────────────────────────

interface BookBreakdownProps {
  entity: (EntityEntry & { type: EntityType }) | null
  bookOrder: string[]
  getEntityVerses: (name: string, book?: string) => BibleVerse[]
  isBookmarked: (verse: BibleVerse) => boolean
  onBookmark: (verse: BibleVerse) => void
  onListen: (verse: BibleVerse) => void
  onNavigate: (verse: BibleVerse) => void
}

function BookBreakdown({ entity, bookOrder, getEntityVerses, isBookmarked, onBookmark, onListen, onNavigate }: BookBreakdownProps) {
  const [expandedBook, setExpandedBook] = useState<string | null>(null)

  if (!entity) return null

  const booksWithCounts = bookOrder
    .filter((b) => (entity.bookCounts[b] ?? 0) > 0)
    .map((b) => ({ book: b, count: entity.bookCounts[b] }))

  const maxCount = Math.max(1, ...booksWithCounts.map((b) => b.count))
  const color = entity.type === 'PERSON' ? '#FCD34D' : '#06B6D4'

  // Get verses for expanded book
  const expandedVerses = expandedBook
    ? getEntityVerses(entity.name, expandedBook)
    : []

  // Group verses by chapter
  const versesByChapter = useMemo(() => {
    const map = new Map<number, BibleVerse[]>()
    for (const v of expandedVerses) {
      if (!map.has(v.chapter)) map.set(v.chapter, [])
      map.get(v.chapter)!.push(v)
    }
    return map
  }, [expandedVerses])

  return (
    <div className="entity-book-breakdown">
      <div className="breakdown-title">
        Book Distribution for <span style={{ color, fontWeight: 700 }}>{entity.name}</span>
      </div>
      <div className="breakdown-bars">
        {booksWithCounts.map(({ book, count }) => {
          const pct = (count / maxCount) * 100
          const isExpanded = expandedBook === book

          return (
            <div key={book}>
              <div
                className="breakdown-row"
                onClick={() => setExpandedBook(isExpanded ? null : book)}
                style={{ cursor: 'pointer' }}
              >
                <div className="breakdown-book">
                  <span className="breakdown-expand-icon">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                  {SHORT_LABELS[book] || book}
                </div>
                <div className="breakdown-bar-track">
                  <div
                    className="breakdown-bar-fill"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <div className="breakdown-count">{count}</div>
              </div>

              {/* Expanded verse list — same VerseCard as search results */}
              {isExpanded && (
                <div className="breakdown-verses">
                  {Array.from(versesByChapter.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([chapter, verses]) => (
                      <div key={chapter} className="breakdown-chapter-group">
                        <div className="breakdown-chapter-label">Chapter {chapter}</div>
                        {verses.map((v) => (
                          <VerseCard
                            key={v.reference}
                            verse={v}
                            query={entity.name}
                            bookmarked={isBookmarked(v)}
                            onBookmark={() => onBookmark(v)}
                            onListen={() => onListen(v)}
                            onNavigate={() => onNavigate(v)}
                          />
                        ))}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function BibleEntityExplorer({
  bookOrder,
  allEntities,
  persons,
  places,
  getEntityVerses,
  isBookmarked,
  onBookmark,
  onListen,
  onNavigate,
  onEntityVerseClick,
}: BibleEntityExplorerProps) {
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null)
  const [view, setView] = useState<'arcs' | 'heatmap'>('arcs')

  const filteredEntities = useMemo(() => {
    let list = allEntities
    if (filterType === 'PERSON') list = persons.map((e) => ({ ...e, type: 'PERSON' as EntityType }))
    if (filterType === 'PLACE') list = places.map((e) => ({ ...e, type: 'PLACE' as EntityType }))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((e) => e.name.toLowerCase().includes(q))
    }
    return list
  }, [allEntities, persons, places, filterType, searchQuery])

  const selectedEntity = useMemo(() => {
    if (!selectedEntityName) return null
    return allEntities.find((e) => e.name === selectedEntityName) ?? null
  }, [selectedEntityName, allEntities])

  // Compute the summary stats line for the selected entity — total count,
  // book count, first / last mention (canonical order), peak book.
  const summary = useMemo(() => {
    if (!selectedEntity) return null
    const verses = getEntityVerses(selectedEntity.name)
    if (verses.length === 0) return null
    const bookIndex = new Map(bookOrder.map((b, i) => [b, i] as const))
    const sorted = [...verses].sort((a, b) => {
      const ai = bookIndex.get(a.shortBook) ?? 999
      const bi = bookIndex.get(b.shortBook) ?? 999
      if (ai !== bi) return ai - bi
      if (a.chapter !== b.chapter) return a.chapter - b.chapter
      return a.verse - b.verse
    })
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    // Peak book = the book with the most entries.
    const counts = selectedEntity.bookCounts
    let peakBook = ''
    let peakCount = 0
    for (const [b, c] of Object.entries(counts)) {
      if (c > peakCount) {
        peakBook = b
        peakCount = c
      }
    }
    const bookCount = Object.keys(counts).filter((b) => (counts[b] ?? 0) > 0).length
    return {
      total: selectedEntity.count,
      bookCount,
      firstRef: first.reference,
      lastRef: last.reference,
      peakBook,
      peakCount,
    }
  }, [selectedEntity, getEntityVerses, bookOrder])

  return (
    <div className="entity-explorer">
      {/* Summary line — appears once an entity is selected. The "tells me
          something" the user asked for: total, books, first / last / peak. */}
      {selectedEntity && summary && (
        <div
          className="entity-summary"
          data-type={selectedEntity.type.toLowerCase()}
        >
          <div className="entity-summary-name">
            <span
              className="entity-summary-type-badge"
              data-type={selectedEntity.type.toLowerCase()}
            >
              {selectedEntity.type === 'PERSON' ? 'Person' : 'Place'}
            </span>
            {selectedEntity.name}
          </div>
          <div className="entity-summary-stats">
            <div className="entity-summary-stat">
              <span className="entity-summary-stat-val">{summary.total}</span>
              <span className="entity-summary-stat-label">verses</span>
            </div>
            <div className="entity-summary-stat">
              <span className="entity-summary-stat-val">{summary.bookCount}</span>
              <span className="entity-summary-stat-label">books</span>
            </div>
            <div className="entity-summary-stat entity-summary-stat--wide">
              <span className="entity-summary-stat-label">First</span>
              <span className="entity-summary-stat-val entity-summary-stat-val--ref">
                {summary.firstRef}
              </span>
            </div>
            <div className="entity-summary-stat entity-summary-stat--wide">
              <span className="entity-summary-stat-label">Last</span>
              <span className="entity-summary-stat-val entity-summary-stat-val--ref">
                {summary.lastRef}
              </span>
            </div>
            <div className="entity-summary-stat entity-summary-stat--wide">
              <span className="entity-summary-stat-label">Peak</span>
              <span className="entity-summary-stat-val entity-summary-stat-val--ref">
                {summary.peakBook} ({summary.peakCount})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Arc / heatmap visualization */}
      <div className="entity-viz-section">
        <div className="entity-viz-tabs">
          <button
            className={`entity-viz-tab ${view === 'arcs' ? 'entity-viz-tab--active' : ''}`}
            onClick={() => setView('arcs')}
          >
            Arc Trace
          </button>
          <button
            className={`entity-viz-tab ${view === 'heatmap' ? 'entity-viz-tab--active' : ''}`}
            onClick={() => setView('heatmap')}
          >
            Heat Map
          </button>
        </div>

        {view === 'arcs' && (
          <ArcDiagram
            bookOrder={bookOrder}
            entity={selectedEntity}
            onBookClick={(book) => {
              if (selectedEntityName) onEntityVerseClick?.(selectedEntityName, book)
            }}
          />
        )}

        {view === 'heatmap' && (
          <EntityHeatMap
            bookOrder={bookOrder}
            entities={filteredEntities}
            selectedEntity={selectedEntityName}
            onSelect={setSelectedEntityName}
          />
        )}
      </div>

      {/* Book breakdown for selected entity */}
      {selectedEntity && view === 'arcs' && (
        <BookBreakdown
          entity={selectedEntity}
          bookOrder={bookOrder}
          getEntityVerses={getEntityVerses}
          isBookmarked={isBookmarked}
          onBookmark={onBookmark}
          onListen={onListen}
          onNavigate={onNavigate}
        />
      )}

      {/* Controls & entity list */}
      <div className="entity-controls">
        {/* Filter chips */}
        <div className="entity-filter-row">
          {(['all', 'PERSON', 'PLACE'] as FilterType[]).map((t) => (
            <button
              key={t}
              className={`entity-filter-chip ${filterType === t ? 'entity-filter-chip--active' : ''} entity-filter-chip--${t.toLowerCase()}`}
              onClick={() => setFilterType(t)}
            >
              {t === 'all' ? 'All' : t === 'PERSON' ? 'Persons' : 'Places'}
              <span className="entity-filter-count">
                {t === 'all' ? allEntities.length : t === 'PERSON' ? persons.length : places.length}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          className="entity-search-input"
          type="text"
          placeholder="Search entities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Entity list */}
      <div className="entity-list">
        {filteredEntities.map((entity) => {
          const isSelected = selectedEntityName === entity.name
          const bookCount = Object.keys(entity.bookCounts).length
          const color = entity.type === 'PERSON' ? '#FCD34D' : '#06B6D4'

          return (
            <div
              key={entity.name}
              className={`entity-list-item ${isSelected ? 'entity-list-item--active' : ''}`}
              onClick={() => setSelectedEntityName(isSelected ? null : entity.name)}
            >
              <span
                className="entity-type-badge"
                style={{ background: `${color}20`, color }}
              >
                {entity.type === 'PERSON' ? 'P' : 'L'}
              </span>
              <span className="entity-name">{entity.name}</span>
              <span className="entity-stats">
                {entity.count} verse{entity.count !== 1 ? 's' : ''} &middot; {bookCount} book{bookCount !== 1 ? 's' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
