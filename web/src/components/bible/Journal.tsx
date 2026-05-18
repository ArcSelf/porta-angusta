/**
 * Journal - Bible reflection pane.
 *
 * Voice-to-text (or typed) entries, optionally pinned to a verse. Lives
 * entirely in localStorage. No backend, no audio storage — just plain
 * text journal entries with timestamps and verse links.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useJournal } from '@hooks/useJournal'
import type { JournalEntry, UseJournalReturn } from '@hooks/useJournal'
import type { BibleVerse } from '@hooks/useBibleData'
import { useSpeechRecognition } from '@hooks/useSpeechRecognition'
import { shareJournalEntry } from '@/utils/share'

interface JournalProps {
  /** When set, the panel opens directly in compose mode with this verse linked. */
  composeForVerse?: { reference: string; text: string } | null
  /** Called once after composeForVerse has been consumed by the panel. */
  onComposeForVerseConsumed?: () => void
  /** Optional resolver so notes can show the actual verse text for each linked ref. */
  getVerseByRef?: (reference: string) => BibleVerse | null
}

type Mode =
  | { kind: 'list' }
  | { kind: 'view'; entry: JournalEntry }
  | { kind: 'compose'; entryId: string | null; initialVerseRef?: string; initialContext?: string }
  | { kind: 'verse-prompt'; verse: { reference: string; text: string } }

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function snippet(content: string, max = 140): string {
  const trimmed = content.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max).trim() + '…'
}

export default function Journal({
  composeForVerse,
  onComposeForVerseConsumed,
  getVerseByRef,
}: JournalProps) {
  const { entries, addEntry, updateEntry, deleteEntry } = useJournal()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })

  // When a verse is passed in via "Reflect", route through a chooser so the
  // user can decide whether to start a new reflection or add this verse to
  // an existing one. If there are no entries yet, skip the chooser.
  const consumedVerseRef = useRef<string | null>(null)
  useEffect(() => {
    if (!composeForVerse) return
    if (consumedVerseRef.current === composeForVerse.reference) return
    consumedVerseRef.current = composeForVerse.reference
    if (entries.length === 0) {
      setMode({
        kind: 'compose',
        entryId: null,
        initialVerseRef: composeForVerse.reference,
        initialContext: composeForVerse.text,
      })
    } else {
      setMode({ kind: 'verse-prompt', verse: composeForVerse })
    }
    onComposeForVerseConsumed?.()
  }, [composeForVerse, entries.length, onComposeForVerseConsumed])

  // ── List view ──────────────────────────────────────────────────────────────
  if (mode.kind === 'list') {
    return (
      <div className="journal">
        <div className="journal-toolbar">
          <button
            className="journal-new-btn"
            onClick={() => setMode({ kind: 'compose', entryId: null })}
          >
            + New Reflection
          </button>
          <span className="journal-count">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="journal-empty">
            <div className="journal-empty-text">
              No reflections yet.
              <br />
              Speak or type your thoughts on a verse to keep them here.
            </div>
          </div>
        ) : (
          <div className="journal-list">
            {entries.map((entry) => (
              <button
                key={entry.id}
                className="journal-card"
                onClick={() => setMode({ kind: 'view', entry })}
              >
                <div className="journal-card-head">
                  <span className="journal-card-date">{formatDate(entry.updatedAt)}</span>
                  {entry.verseRefs && entry.verseRefs.length > 0 && (
                    <span className="journal-card-verses">
                      {entry.verseRefs.slice(0, 2).map((r) => (
                        <span key={r} className="journal-card-verse">{r}</span>
                      ))}
                      {entry.verseRefs.length > 2 && (
                        <span className="journal-card-verse journal-card-verse--more">
                          +{entry.verseRefs.length - 2}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {entry.title && <div className="journal-card-title">{entry.title}</div>}
                <div className="journal-card-snippet">{snippet(entry.content) || 'Empty entry'}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Verse prompt: new reflection or add to existing? ──────────────────────
  if (mode.kind === 'verse-prompt') {
    const { verse } = mode
    return (
      <div className="journal">
        <div className="journal-toolbar">
          <button
            className="journal-back-btn"
            onClick={() => setMode({ kind: 'list' })}
          >
            ← Cancel
          </button>
          <span className="journal-count">Reflect on {verse.reference}</span>
        </div>

        <blockquote className="journal-verse-context">"{verse.text}"</blockquote>

        <button
          className="journal-new-btn journal-prompt-primary"
          onClick={() =>
            setMode({
              kind: 'compose',
              entryId: null,
              initialVerseRef: verse.reference,
              initialContext: verse.text,
            })
          }
        >
          + New Reflection
        </button>

        <div className="journal-prompt-or">— or add to an existing reflection —</div>

        <div className="journal-list">
          {entries.map((entry) => (
            <button
              key={entry.id}
              className="journal-card"
              onClick={() =>
                setMode({
                  kind: 'compose',
                  entryId: entry.id,
                  initialVerseRef: verse.reference,
                  initialContext: verse.text,
                })
              }
            >
              <div className="journal-card-head">
                <span className="journal-card-date">{formatDate(entry.updatedAt)}</span>
                {entry.verseRefs && entry.verseRefs.length > 0 && (
                  <span className="journal-card-verses">
                    {entry.verseRefs.slice(0, 2).map((r) => (
                      <span key={r} className="journal-card-verse">{r}</span>
                    ))}
                    {entry.verseRefs.length > 2 && (
                      <span className="journal-card-verse journal-card-verse--more">
                        +{entry.verseRefs.length - 2}
                      </span>
                    )}
                  </span>
                )}
              </div>
              {entry.title && <div className="journal-card-title">{entry.title}</div>}
              <div className="journal-card-snippet">{snippet(entry.content) || 'Empty entry'}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── View one entry ─────────────────────────────────────────────────────────
  if (mode.kind === 'view') {
    const { entry } = mode
    return (
      <div className="journal">
        <div className="journal-toolbar">
          <button className="journal-back-btn" onClick={() => setMode({ kind: 'list' })}>
            ← Back
          </button>
          <div className="journal-view-actions">
            <button
              className="journal-edit-btn"
              onClick={() => shareJournalEntry(entry, getVerseByRef)}
              aria-label="Share reflection"
            >
              Share
            </button>
            <button
              className="journal-edit-btn"
              onClick={() => setMode({ kind: 'compose', entryId: entry.id })}
            >
              Edit
            </button>
            <button
              className="journal-delete-btn"
              onClick={() => {
                if (confirm('Delete this entry?')) {
                  deleteEntry(entry.id)
                  setMode({ kind: 'list' })
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>

        <div className="journal-view">
          {entry.verseRefs && entry.verseRefs.length > 0 && (
            <div className="journal-view-verses">
              {entry.verseRefs.map((r) => (
                <span key={r} className="journal-view-verse">{r}</span>
              ))}
            </div>
          )}

          {/* Full verse text for each linked reference, when we can resolve it. */}
          {entry.verseRefs && entry.verseRefs.length > 0 && getVerseByRef && (
            <div className="journal-attached-verses">
              {entry.verseRefs.map((r) => {
                const verse = getVerseByRef(r)
                return (
                  <div className="journal-attached-verse" key={r}>
                    <div className="journal-attached-verse-ref">{r}</div>
                    <div className="journal-attached-verse-text">
                      {verse ? verse.text : <em>verse text unavailable</em>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {entry.title && <div className="journal-view-title">{entry.title}</div>}
          <div className="journal-view-meta">
            {formatDate(entry.createdAt)}
            {entry.updatedAt !== entry.createdAt && ` · edited ${formatDate(entry.updatedAt)}`}
          </div>
          <div className="journal-view-content">{entry.content || <em>Empty entry</em>}</div>
        </div>
      </div>
    )
  }

  // ── Compose / edit ─────────────────────────────────────────────────────────
  return (
    <Compose
      mode={mode}
      entries={entries}
      addEntry={addEntry}
      updateEntry={updateEntry}
      onDone={() => setMode({ kind: 'list' })}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Compose subcomponent — kept inside the same file because it's only used here.
// ─────────────────────────────────────────────────────────────────────────────

interface ComposeProps {
  mode: Extract<Mode, { kind: 'compose' }>
  entries: JournalEntry[]
  addEntry: UseJournalReturn['addEntry']
  updateEntry: UseJournalReturn['updateEntry']
  onDone: () => void
}

function Compose({ mode, entries, addEntry, updateEntry, onDone }: ComposeProps) {
  const existing = mode.entryId ? entries.find((e) => e.id === mode.entryId) : null

  const [title, setTitle] = useState(existing?.title ?? '')
  const [content, setContent] = useState(existing?.content ?? '')
  // Multi-verse: seed with whatever the entry already had (or the verse
  // passed in via Reflect-on-verse), then let the user add/remove freely.
  const [verseRefs, setVerseRefs] = useState<string[]>(() => {
    const fromExisting = existing?.verseRefs ?? []
    const fromInitial = mode.initialVerseRef ? [mode.initialVerseRef] : []
    // Union, preserving order — initial verse first if not already present.
    const merged = [...fromExisting]
    for (const r of fromInitial) {
      if (!merged.includes(r)) merged.push(r)
    }
    return merged
  })
  const [addVerseDraft, setAddVerseDraft] = useState('')

  const speech = useSpeechRecognition({ continuous: true, interimResults: true })

  // When speech finalizes a phrase, append it to the textarea.
  const lastAppendedRef = useRef('')
  useEffect(() => {
    const finalText = speech.transcript.trim()
    if (!finalText) return
    if (finalText === lastAppendedRef.current) return
    const newText = finalText.slice(lastAppendedRef.current.length).trim()
    if (newText) {
      setContent((prev) => (prev ? `${prev} ${newText}` : newText))
    }
    lastAppendedRef.current = finalText
  }, [speech.transcript])

  const toggleMic = useCallback(() => {
    if (speech.isListening) {
      speech.stopListening()
    } else {
      lastAppendedRef.current = ''
      speech.resetTranscript()
      speech.startListening()
    }
  }, [speech])

  const handleAddVerse = useCallback(() => {
    const t = addVerseDraft.trim()
    if (!t) return
    setVerseRefs((prev) => (prev.includes(t) ? prev : [...prev, t]))
    setAddVerseDraft('')
  }, [addVerseDraft])

  const handleRemoveVerse = useCallback((ref: string) => {
    setVerseRefs((prev) => prev.filter((r) => r !== ref))
  }, [])

  const handleSave = useCallback(() => {
    speech.stopListening()
    const trimmed = content.trim()
    if (!trimmed) return
    if (existing) {
      updateEntry(existing.id, { title, content: trimmed, verseRefs })
    } else {
      addEntry({ title, content: trimmed, verseRefs })
    }
    onDone()
  }, [content, title, verseRefs, existing, addEntry, updateEntry, speech, onDone])

  const handleCancel = useCallback(() => {
    speech.stopListening()
    onDone()
  }, [speech, onDone])

  return (
    <div className="journal">
      <div className="journal-toolbar">
        <button className="journal-back-btn" onClick={handleCancel}>
          Cancel
        </button>
        <button
          className="journal-save-btn"
          disabled={!content.trim()}
          onClick={handleSave}
        >
          {existing ? 'Save' : 'Save Reflection'}
        </button>
      </div>

      <div className="journal-verse-chips">
        {verseRefs.map((ref) => (
          <div className="journal-verse-chip" key={ref}>
            <span className="journal-verse-chip-label">On</span>
            <span className="journal-verse-chip-ref">{ref}</span>
            <button
              type="button"
              className="journal-verse-chip-remove"
              onClick={() => handleRemoveVerse(ref)}
              aria-label={`Remove ${ref}`}
            >
              ×
            </button>
          </div>
        ))}

        <form
          className="journal-verse-add"
          onSubmit={(e) => {
            e.preventDefault()
            handleAddVerse()
          }}
        >
          <input
            className="journal-verse-add-input"
            type="text"
            placeholder="+ Add verse (e.g. John 3:16)"
            value={addVerseDraft}
            onChange={(e) => setAddVerseDraft(e.target.value)}
            autoCorrect="off"
            autoCapitalize="words"
            enterKeyHint="done"
          />
          {addVerseDraft.trim().length > 0 && (
            <button type="submit" className="journal-verse-add-btn">
              Add
            </button>
          )}
        </form>
      </div>

      {mode.initialContext && verseRefs.includes(mode.initialVerseRef ?? '') && (
        <blockquote className="journal-verse-context">"{mode.initialContext}"</blockquote>
      )}

      <input
        className="journal-title-input"
        type="text"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoCorrect="on"
        autoCapitalize="sentences"
      />

      <div className="journal-content-wrap">
        <textarea
          className="journal-content-input"
          placeholder={
            verseRefs.length === 1
              ? `What does ${verseRefs[0]} mean to you?`
              : verseRefs.length > 1
                ? `Reflect on these ${verseRefs.length} verses…`
                : 'Type or speak your reflection...'
          }
          value={
            speech.isListening && speech.interimTranscript
              ? `${content}${content ? ' ' : ''}${speech.interimTranscript}`
              : content
          }
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          autoCorrect="on"
          autoCapitalize="sentences"
        />

        {speech.isSupported && (
          <button
            className={`journal-mic-btn ${speech.isListening ? 'listening' : ''}`}
            onClick={toggleMic}
            aria-label={speech.isListening ? 'Stop dictating' : 'Start dictating'}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <rect x="7" y="2" width="4" height="9" rx="2" />
              <path d="M4,9 Q4,14 9,14 Q14,14 14,9" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <line x1="9" y1="14" x2="9" y2="16" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        )}
      </div>

      {speech.error && <div className="journal-error">{speech.error}</div>}
    </div>
  )
}
