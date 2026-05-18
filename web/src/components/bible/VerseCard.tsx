/**
 * VerseCard - Shared Bible verse display card
 *
 * Used by both Search results and Entity Explorer drill-down to display
 * individual verses with highlighted text, reference, and action buttons.
 */

import type { BibleVerse } from '@hooks/useBibleData'
import { isNewTestament } from '@hooks/useBibleData'
import { shareVerse } from '@/utils/share'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface VerseCardProps {
  verse: BibleVerse
  query?: string
  bookmarked: boolean
  onBookmark: () => void
  onListen: () => void
  onNavigate: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function VerseCard({ verse, query, bookmarked, onBookmark, onListen, onNavigate }: VerseCardProps) {
  // Highlight matching text (supports single-char punctuation queries like "?")
  const renderText = () => {
    if (!query || query.length < 1) return verse.text

    const lower = verse.text.toLowerCase()
    const qLower = query.toLowerCase()
    const idx = lower.indexOf(qLower)

    if (idx === -1) return verse.text

    return (
      <>
        {verse.text.slice(0, idx)}
        <mark>{verse.text.slice(idx, idx + query.length)}</mark>
        {verse.text.slice(idx + query.length)}
      </>
    )
  }

  return (
    <div
      className="verse-card"
      data-testament={isNewTestament(verse.shortBook) ? 'new' : 'old'}
      onDoubleClick={onListen}
      title="Double-tap to read aloud"
    >
      <div className="verse-ref">{verse.reference}</div>
      <div className="verse-text">{renderText()}</div>
      <div className="verse-actions">
        <button className="verse-action-btn" onClick={onListen}>
          Listen
        </button>
        <button className="verse-action-btn" onClick={onNavigate}>
          Read in context
        </button>
        <button
          className="verse-action-btn"
          onClick={onBookmark}
          style={bookmarked ? { background: 'rgba(239,68,68,0.2)', color: '#EF4444' } : {}}
        >
          {bookmarked ? 'Saved' : 'Save'}
        </button>
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
      </div>
    </div>
  )
}
