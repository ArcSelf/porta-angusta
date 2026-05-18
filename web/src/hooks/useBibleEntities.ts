/**
 * useBibleEntities - Dynamic Bible named entity extraction
 *
 * Scans the already-loaded verse text for proper nouns (capitalized words)
 * and builds a person/place entity index at runtime. No pre-generated JSON
 * or hard-coded dictionaries needed — entities are discovered directly from
 * the scripture text.
 *
 * For richer NER with word vectors and relationship extraction, run the
 * companion spaCy script: scripts/extract_bible_entities_spacy.py
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { BibleVerse, BibleBook } from '@hooks/useBibleData'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface EntityEntry {
  name: string
  count: number
  bookCounts: Record<string, number>
}

export type EntityType = 'PERSON' | 'PLACE'

// ─────────────────────────────────────────────────────────────────────────────
// COMMON ENGLISH WORDS TO SKIP (not proper nouns)
// ─────────────────────────────────────────────────────────────────────────────

// These appear capitalized at sentence starts but aren't entities.
// Kept minimal — the frequency threshold handles most noise.
const STOP_WORDS = new Set([
  'The', 'And', 'But', 'For', 'Now', 'Then', 'When', 'Who', 'What',
  'How', 'Why', 'Where', 'Which', 'There', 'These', 'Those', 'This',
  'That', 'His', 'Her', 'Him', 'She', 'They', 'Them', 'Their',
  'Our', 'Your', 'Not', 'Nor', 'Yet', 'Let', 'May', 'Can', 'All',
  'Are', 'Was', 'Were', 'Has', 'Had', 'Have', 'Did', 'Shall',
  'Will', 'Unto', 'Upon', 'Into', 'From', 'With', 'Also', 'Even',
  'Thus', 'So', 'If', 'Or', 'As', 'He', 'In', 'It', 'Be', 'By',
  'To', 'Of', 'My', 'Do', 'No', 'Is', 'At', 'An', 'We', 'Me',
  'Ye', 'Lo', 'Oh', 'Woe', 'Yea', 'Nay', 'O',
  'Behold', 'Blessed', 'Verily', 'Therefore', 'Moreover', 'Nevertheless',
  'Wherefore', 'Because', 'Before', 'After', 'Again', 'Every',
  'Neither', 'Either', 'Though', 'Although', 'Except', 'Against',
  'Among', 'Between', 'Through', 'Above', 'Below', 'Without', 'Within',
  'Herein', 'Thereof', 'Hereby', 'Surely', 'Truly', 'Praise',
  'Give', 'Come', 'Say', 'Said', 'Take', 'Made', 'Make', 'Know',
  'See', 'Hear', 'Fear', 'Thou', 'Thee', 'Thy', 'Thine',
  'I', 'A',
])

// ─────────────────────────────────────────────────────────────────────────────
// PLACE HINTS — contextual patterns that signal a word is a place
// These are NOT hard-coded entity names, just classification hints
// for distinguishing person from place among discovered proper nouns.
// ─────────────────────────────────────────────────────────────────────────────

const PLACE_CONTEXT_PATTERNS = [
  /\bland of (\w+)/gi,
  /\bcity of (\w+)/gi,
  /\bcountry of (\w+)/gi,
  /\bwilderness of (\w+)/gi,
  /\bplain[s]? of (\w+)/gi,
  /\bvalley of (\w+)/gi,
  /\bhill[s]? of (\w+)/gi,
  /\bmount(?:ain)? (\w+)/gi,
  /\briver (\w+)/gi,
  /\bsea of (\w+)/gi,
  /\bbrook (\w+)/gi,
  /\bwaters of (\w+)/gi,
  // NB: removed the generic /in|from|to|of (\w+)/ patterns — they over-tagged
  // many persons as places ("given to Moses" → Moses scored as place).
]

const PERSON_CONTEXT_PATTERNS = [
  /(\w+) said/gi,
  /(\w+) begat/gi,
  /(\w+) begot/gi,
  /(\w+) spake/gi,
  /(\w+) answered/gi,
  /(\w+) went/gi,
  /(\w+) came/gi,
  /(\w+) took/gi,
  /(\w+) called/gi,
  /(\w+) son of/gi,
  /(\w+) daughter of/gi,
  /son of (\w+)/gi,
  /daughter of (\w+)/gi,
  /(\w+) the son/gi,
  /(\w+) the king/gi,
  /(\w+) the priest/gi,
  /(\w+) the prophet/gi,
  /king (\w+)/gi,
]

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTION ENGINE — runs on the loaded verse array
// ─────────────────────────────────────────────────────────────────────────────

/** Extract capitalized proper nouns from a verse, skipping sentence starters */
function extractProperNouns(text: string): string[] {
  const nouns: string[] = []
  // Split on sentence boundaries (., !, ?, ;, :) to identify sentence starters
  const sentences = text.split(/[.!?;:]\s*/)

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/)
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^A-Za-z'-]/g, '')
      if (!word || word.length < 2) continue

      // Check if capitalized
      if (word[0] >= 'A' && word[0] <= 'Z') {
        // Skip if it's the first word of the sentence (likely just capitalized)
        // UNLESS it's also capitalized elsewhere (handled by frequency)
        if (i === 0 && STOP_WORDS.has(word)) continue
        if (STOP_WORDS.has(word)) continue

        // Skip ALL-CAPS words like "LORD", "GOD" — these are titles in KJV
        if (word === word.toUpperCase() && word.length > 1) continue

        nouns.push(word)
      }
    }
  }
  return nouns
}

/** Classify a proper noun as PERSON or PLACE using contextual patterns */
function classifyEntity(
  name: string,
  placeScore: Map<string, number>,
  personScore: Map<string, number>,
): EntityType {
  const pScore = personScore.get(name) ?? 0
  const lScore = placeScore.get(name) ?? 0

  if (pScore > lScore) return 'PERSON'
  if (lScore > pScore) return 'PLACE'
  // Default: most biblical proper nouns are persons
  return 'PERSON'
}

interface ExtractedEntities {
  persons: EntityEntry[]
  places: EntityEntry[]
  bookOrder: string[]
}

function extractEntitiesFromVerses(
  verses: BibleVerse[],
  books: BibleBook[],
): ExtractedEntities {
  const bookOrder = books.map((b) => b.shortName)

  // Pass 1: Count every proper noun occurrence per book
  const nounBookCounts = new Map<string, Map<string, number>>()
  const nounTotal = new Map<string, number>()

  for (const verse of verses) {
    const nouns = extractProperNouns(verse.text)
    for (const noun of nouns) {
      // Increment total
      nounTotal.set(noun, (nounTotal.get(noun) ?? 0) + 1)
      // Increment per-book
      if (!nounBookCounts.has(noun)) nounBookCounts.set(noun, new Map())
      const bookMap = nounBookCounts.get(noun)!
      bookMap.set(verse.shortBook, (bookMap.get(verse.shortBook) ?? 0) + 1)
    }
  }

  // Pass 2: Build context scores for person/place classification
  const placeScore = new Map<string, number>()
  const personScore = new Map<string, number>()

  for (const verse of verses) {
    const text = verse.text
    for (const pattern of PLACE_CONTEXT_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(text)) !== null) {
        const word = match[1]
        if (word && word[0] >= 'A' && word[0] <= 'Z' && !STOP_WORDS.has(word)) {
          placeScore.set(word, (placeScore.get(word) ?? 0) + 1)
        }
      }
    }
    for (const pattern of PERSON_CONTEXT_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(text)) !== null) {
        const word = match[1]
        if (word && word[0] >= 'A' && word[0] <= 'Z' && !STOP_WORDS.has(word)) {
          personScore.set(word, (personScore.get(word) ?? 0) + 1)
        }
      }
    }
  }

  // Pass 3: Filter to meaningful entities (appear in 2+ verses)
  // and classify as person or place. Lowered from 3 so single-major-event
  // figures and one-off place names show up in the index too.
  const MIN_OCCURRENCES = 2
  const persons: EntityEntry[] = []
  const places: EntityEntry[] = []

  for (const [name, total] of nounTotal) {
    if (total < MIN_OCCURRENCES) continue

    const bookMap = nounBookCounts.get(name)!
    const bookCounts: Record<string, number> = {}
    bookMap.forEach((count: number, book: string) => {
      bookCounts[book] = count
    })

    const entry: EntityEntry = { name, count: total, bookCounts }
    const type = classifyEntity(name, placeScore, personScore)

    if (type === 'PLACE') {
      places.push(entry)
    } else {
      persons.push(entry)
    }
  }

  // Sort by frequency descending
  persons.sort((a, b) => b.count - a.count)
  places.sort((a, b) => b.count - a.count)

  return { persons, places, bookOrder }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useBibleEntities(verses: BibleVerse[], books: BibleBook[]) {
  const [loading, setLoading] = useState(true)
  const [extracted, setExtracted] = useState<ExtractedEntities | null>(null)

  // Run extraction when verses are available
  useEffect(() => {
    if (verses.length === 0) return

    // Run in a microtask to avoid blocking the UI on first render
    const timer = setTimeout(() => {
      const result = extractEntitiesFromVerses(verses, books)
      setExtracted(result)
      setLoading(false)
    }, 0)

    return () => clearTimeout(timer)
  }, [verses, books])

  const bookOrder = useMemo(() => extracted?.bookOrder ?? [], [extracted])

  const allEntities = useMemo(() => {
    if (!extracted) return []
    return [
      ...extracted.persons.map((e: EntityEntry) => ({ ...e, type: 'PERSON' as EntityType })),
      ...extracted.places.map((e: EntityEntry) => ({ ...e, type: 'PLACE' as EntityType })),
    ].sort((a, b) => b.count - a.count)
  }, [extracted])

  const persons = useMemo(() => extracted?.persons ?? [], [extracted])
  const places = useMemo(() => extracted?.places ?? [], [extracted])

  const searchEntities = useCallback(
    (query: string, type?: EntityType): (EntityEntry & { type: EntityType })[] => {
      if (!query.trim()) return []
      const q = query.toLowerCase()
      return allEntities.filter((e) => {
        if (type && e.type !== type) return false
        return e.name.toLowerCase().includes(q)
      })
    },
    [allEntities]
  )

  const getEntity = useCallback(
    (name: string): (EntityEntry & { type: EntityType }) | null => {
      return allEntities.find((e) => e.name === name) ?? null
    },
    [allEntities]
  )

  /** Find actual verses containing an entity, optionally filtered by book */
  const getEntityVerses = useCallback(
    (name: string, book?: string): BibleVerse[] => {
      if (!name) return []
      const pattern = new RegExp(`\\b${name}\\b`)
      return verses.filter((v) => {
        if (book && v.shortBook !== book) return false
        return pattern.test(v.text)
      })
    },
    [verses]
  )

  return {
    loading,
    error: null as string | null,
    bookOrder,
    allEntities,
    persons,
    places,
    searchEntities,
    getEntity,
    getEntityVerses,
  }
}
