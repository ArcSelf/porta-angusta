/**
 * useBibleData - KJV Bible data hook
 *
 * Parses the KJV Bible CSV and provides book/chapter/verse navigation.
 * Loads the full Bible into memory for instant search and navigation.
 * Integrates with the backend JesusWordsService for topic search.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface BibleVerse {
  book: string
  shortBook: string
  chapter: number
  verse: number
  text: string
  reference: string // "Genesis 1:1"
}

export interface BibleChapter {
  book: string
  shortBook: string
  chapter: number
  verses: BibleVerse[]
}

export interface BibleBook {
  fullName: string
  shortName: string
  chapters: number
  testament: 'old' | 'new'
}

export interface SearchResult {
  verse: BibleVerse
  matchType: 'exact' | 'contains' | 'reference'
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOK NAME MAPPING
// ─────────────────────────────────────────────────────────────────────────────

// Map from full KJV names to short names
const BOOK_SHORT_NAMES: Record<string, string> = {
  'The First Book of Moses: Called Genesis': 'Genesis',
  'The Second Book of Moses: Called Exodus': 'Exodus',
  'The Third Book of Moses: Called Leviticus': 'Leviticus',
  'The Fourth Book of Moses: Called Numbers': 'Numbers',
  'The Fifth Book of Moses: Called Deuteronomy': 'Deuteronomy',
  'The Book of Joshua': 'Joshua',
  'The Book of Judges': 'Judges',
  'The Book of Ruth': 'Ruth',
  'The First Book of Samuel': '1 Samuel',
  'The Second Book of Samuel': '2 Samuel',
  'The First Book of the Kings': '1 Kings',
  'The Second Book of the Kings': '2 Kings',
  'The First Book of the Chronicles': '1 Chronicles',
  'The Second Book of the Chronicles': '2 Chronicles',
  'Ezra': 'Ezra',
  'The Book of Nehemiah': 'Nehemiah',
  'The Book of Esther': 'Esther',
  'The Book of Job': 'Job',
  'The Book of Psalms': 'Psalms',
  'The Proverbs': 'Proverbs',
  'Ecclesiastes': 'Ecclesiastes',
  'The Song of Solomon': 'Song of Solomon',
  'The Book of the Prophet Isaiah': 'Isaiah',
  'The Book of the Prophet Jeremiah': 'Jeremiah',
  'The Lamentations of Jeremiah': 'Lamentations',
  'The Book of the Prophet Ezekiel': 'Ezekiel',
  'The Book of Daniel': 'Daniel',
  'Hosea': 'Hosea',
  'Joel': 'Joel',
  'Amos': 'Amos',
  'Obadiah': 'Obadiah',
  'Jonah': 'Jonah',
  'Micah': 'Micah',
  'Nahum': 'Nahum',
  'Habakkuk': 'Habakkuk',
  'Zephaniah': 'Zephaniah',
  'Haggai': 'Haggai',
  'Zechariah': 'Zechariah',
  'Malachi': 'Malachi',
  'The Gospel According to Saint Matthew': 'Matthew',
  'The Gospel According to Saint Mark': 'Mark',
  'The Gospel According to Saint Luke': 'Luke',
  'The Gospel According to Saint John': 'John',
  'The Acts of the Apostles': 'Acts',
  'The Epistle of Paul the Apostle to the Romans': 'Romans',
  'The First Epistle of Paul the Apostle to the Corinthians': '1 Corinthians',
  'The Second Epistle of Paul the Apostle to the Corinthians': '2 Corinthians',
  'The Epistle of Paul the Apostle to the Galatians': 'Galatians',
  'The Epistle of Paul the Apostle to the Ephesians': 'Ephesians',
  'The Epistle of Paul the Apostle to the Philippians': 'Philippians',
  'The Epistle of Paul the Apostle to the Colossians': 'Colossians',
  'The First Epistle of Paul the Apostle to the Thessalonians': '1 Thessalonians',
  'The Second Epistle of Paul the Apostle to the Thessalonians': '2 Thessalonians',
  'The First Epistle of Paul the Apostle to Timothy': '1 Timothy',
  'The Second Epistle of Paul the Apostle to Timothy': '2 Timothy',
  'The Epistle of Paul the Apostle to Titus': 'Titus',
  'The Epistle of Paul the Apostle to Philemon': 'Philemon',
  'The Epistle of Paul the Apostle to the Hebrews': 'Hebrews',
  'The General Epistle of James': 'James',
  'The First Epistle General of Peter': '1 Peter',
  'The Second Epistle General of Peter': '2 Peter',
  'The First Epistle General of John': '1 John',
  'The Second Epistle of John': '2 John',
  'The Third Epistle of John': '3 John',
  'The General Epistle of Jude': 'Jude',
  'The Revelation of Saint John the Divine': 'Revelation',
}

/** Quick convenience: does this short book name belong to the New Testament? */
export function isNewTestament(shortBook: string): boolean {
  return NEW_TESTAMENT_BOOKS.has(shortBook)
}

export const NEW_TESTAMENT_BOOKS = new Set([
  'Matthew', 'Mark', 'Luke', 'John', 'Acts',
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation',
])

function getShortName(fullName: string): string {
  return BOOK_SHORT_NAMES[fullName] || fullName
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV PARSER
// ─────────────────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(field)
        field = ''
      } else {
        field += ch
      }
    }
  }
  fields.push(field)
  return fields
}

function parseBibleCSV(csv: string): BibleVerse[] {
  const lines = csv.split('\n')
  const verses: BibleVerse[] = []

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields = parseCSVLine(line)
    if (fields.length < 4) continue

    const [bookFull, chapterStr, verseStr, ...textParts] = fields
    const text = textParts.join(',') // Rejoin text that might have had commas
    const shortBook = getShortName(bookFull)

    verses.push({
      book: bookFull,
      shortBook,
      chapter: parseInt(chapterStr, 10),
      verse: parseInt(verseStr, 10),
      text: text.replace(/^"|"$/g, ''),
      reference: `${shortBook} ${chapterStr}:${verseStr}`,
    })
  }

  return verses
}

// ─────────────────────────────────────────────────────────────────────────────
// BIBLE TOPICS (matching backend JesusWordsService.TOPIC_KEYWORDS)
// ─────────────────────────────────────────────────────────────────────────────

export const BIBLE_TOPICS: Record<string, string[]> = {
  love: ['love', 'loved', 'loveth', 'charity', 'compassion', 'merciful'],
  faith: ['faith', 'believe', 'believeth', 'trust', 'doubt'],
  prayer: ['pray', 'prayer', 'ask', 'seek', 'knock', 'father'],
  forgiveness: ['forgive', 'forgiven', 'forgiveness', 'sin', 'sins'],
  salvation: ['save', 'saved', 'salvation', 'eternal', 'life', 'kingdom'],
  peace: ['peace', 'peaceable', 'rest', 'comfort', 'troubled'],
  truth: ['truth', 'true', 'verily', 'witness', 'testify'],
  light: ['light', 'darkness', 'lamp', 'shine', 'blind', 'see'],
  wisdom: ['wisdom', 'wise', 'fool', 'understand', 'knowledge'],
  hope: ['hope', 'promise', 'wait', 'patience', 'endure'],
  joy: ['joy', 'rejoice', 'glad', 'happy', 'blessed'],
  strength: ['strength', 'strong', 'mighty', 'power', 'courage'],
  mercy: ['mercy', 'merciful', 'compassion', 'pity', 'grace'],
  creation: ['heaven', 'earth', 'created', 'beginning', 'world'],
  shepherd: ['shepherd', 'sheep', 'flock', 'fold', 'pasture'],
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

interface UseBibleDataReturn {
  loading: boolean
  error: string | null
  verses: BibleVerse[]
  books: BibleBook[]
  // Navigation
  getChapter: (bookShort: string, chapter: number) => BibleVerse[]
  getVerse: (bookShort: string, chapter: number, verse: number) => BibleVerse | null
  getVerseByRef: (reference: string) => BibleVerse | null
  getBookChapterCount: (bookShort: string) => number
  getChapterVerseCount: (bookShort: string, chapter: number) => number
  // Search
  searchText: (query: string, limit?: number) => SearchResult[]
  searchByTopic: (topic: string, limit?: number) => BibleVerse[]
  // Random
  getRandomVerse: (testament?: 'old' | 'new') => BibleVerse | null
  getDailyVerse: () => BibleVerse | null
}

export function useBibleData(): UseBibleDataReturn {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verses, setVerses] = useState<BibleVerse[]>([])

  // Load CSV on mount
  useEffect(() => {
    let cancelled = false

    async function loadBible() {
      try {
        // Try multiple paths: Vite base path, root path, static mount
        const base = import.meta.env.BASE_URL || '/'
        const paths = [
          `${base}data/kjv_bible.csv`,
          '/data/kjv_bible.csv',
          '/static/data/kjv_bible.csv',
        ]

        let csv = ''
        let loaded = false
        for (const csvUrl of paths) {
          try {
            const response = await fetch(csvUrl)
            if (response.ok) {
              const text = await response.text()
              // Verify it's actually CSV, not HTML error page
              if (text.startsWith('book,') || text.startsWith('"book,')) {
                csv = text
                loaded = true
                break
              }
            }
          } catch {
            // Try next path
          }
        }

        if (!loaded) {
          throw new Error('Failed to load Bible data from any path')
        }

        const parsed = parseBibleCSV(csv)

        if (!cancelled) {
          setVerses(parsed)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message)
          setLoading(false)
        }
      }
    }

    loadBible()
    return () => { cancelled = true }
  }, [])

  // Build book index
  const books = useMemo<BibleBook[]>(() => {
    const bookMap = new Map<string, { fullName: string; chapters: Set<number> }>()

    for (const v of verses) {
      let entry = bookMap.get(v.shortBook)
      if (!entry) {
        entry = { fullName: v.book, chapters: new Set() }
        bookMap.set(v.shortBook, entry)
      }
      entry.chapters.add(v.chapter)
    }

    return Array.from(bookMap.entries()).map(([shortName, data]) => ({
      fullName: data.fullName,
      shortName,
      chapters: data.chapters.size,
      testament: NEW_TESTAMENT_BOOKS.has(shortName) ? 'new' as const : 'old' as const,
    }))
  }, [verses])

  // Build chapter index for fast lookups
  const chapterIndex = useMemo(() => {
    const idx = new Map<string, BibleVerse[]>()
    for (const v of verses) {
      const key = `${v.shortBook}:${v.chapter}`
      let arr = idx.get(key)
      if (!arr) {
        arr = []
        idx.set(key, arr)
      }
      arr.push(v)
    }
    return idx
  }, [verses])

  const getChapter = useCallback(
    (bookShort: string, chapter: number): BibleVerse[] => {
      return chapterIndex.get(`${bookShort}:${chapter}`) || []
    },
    [chapterIndex]
  )

  const getVerse = useCallback(
    (bookShort: string, chapter: number, verse: number): BibleVerse | null => {
      const ch = getChapter(bookShort, chapter)
      return ch.find((v) => v.verse === verse) || null
    },
    [getChapter]
  )

  /**
   * Resolve a free-text reference like "John 3:16" or "1 John 4:8" to a verse.
   * Returns null if the format isn't a strict ref or the book/chapter/verse
   * doesn't exist. Whitespace-tolerant. Case-insensitive on the book name.
   */
  const getVerseByRef = useCallback(
    (reference: string): BibleVerse | null => {
      if (!reference) return null
      // Accept "Book N:M" with the book name being one or more words
      // (e.g. "Song of Solomon"), optionally prefixed by a digit ("1 John").
      const m = reference.trim().match(/^(.+?)\s+(\d+):(\d+)\s*$/)
      if (!m) return null
      const [, bookPart, chStr, vStr] = m
      const ch = parseInt(chStr, 10)
      const v = parseInt(vStr, 10)
      const want = bookPart.trim().toLowerCase()
      const book = books.find(
        (b) =>
          b.shortName.toLowerCase() === want ||
          b.fullName.toLowerCase() === want
      )
      if (!book) return null
      return getVerse(book.shortName, ch, v)
    },
    [books, getVerse]
  )

  const getBookChapterCount = useCallback(
    (bookShort: string): number => {
      const book = books.find((b) => b.shortName === bookShort)
      return book?.chapters || 0
    },
    [books]
  )

  const getChapterVerseCount = useCallback(
    (bookShort: string, chapter: number): number => {
      return getChapter(bookShort, chapter).length
    },
    [getChapter]
  )

  const searchText = useCallback(
    // Unlimited by default — callers may still cap if they want pagination.
    (query: string, limit = Number.POSITIVE_INFINITY): SearchResult[] => {
      if (!query.trim()) return []

      const results: SearchResult[] = []
      const q = query.toLowerCase()

      // Check for reference-style search (e.g. "John 3:16")
      const refMatch = q.match(/^(\d?\s*\w+)\s+(\d+):(\d+)$/i)
      if (refMatch) {
        const [, bookPart, chStr, vStr] = refMatch
        const ch = parseInt(chStr, 10)
        const v = parseInt(vStr, 10)

        for (const verse of verses) {
          if (
            verse.shortBook.toLowerCase().includes(bookPart.trim().toLowerCase()) &&
            verse.chapter === ch &&
            verse.verse === v
          ) {
            results.push({ verse, matchType: 'reference' })
          }
        }
        if (results.length > 0) return results.slice(0, limit)
      }

      // Full-text search
      for (const verse of verses) {
        if (results.length >= limit) break
        if (verse.text.toLowerCase().includes(q)) {
          results.push({ verse, matchType: 'contains' })
        }
      }

      return results
    },
    [verses]
  )

  const searchByTopic = useCallback(
    // Unlimited by default — return every verse matching any topic keyword.
    (topic: string, limit = Number.POSITIVE_INFINITY): BibleVerse[] => {
      const keywords = BIBLE_TOPICS[topic.toLowerCase()]
      if (!keywords) return []

      const results: BibleVerse[] = []
      for (const verse of verses) {
        if (results.length >= limit) break
        const lower = verse.text.toLowerCase()
        if (keywords.some((kw) => lower.includes(kw))) {
          results.push(verse)
        }
      }
      return results
    },
    [verses]
  )

  const getRandomVerse = useCallback(
    (testament?: 'old' | 'new'): BibleVerse | null => {
      let pool = verses
      if (testament) {
        pool = verses.filter((v) => {
          const isNT = NEW_TESTAMENT_BOOKS.has(v.shortBook)
          return testament === 'new' ? isNT : !isNT
        })
      }
      if (pool.length === 0) return null
      return pool[Math.floor(Math.random() * pool.length)]
    },
    [verses]
  )

  const getDailyVerse = useCallback((): BibleVerse | null => {
    if (verses.length === 0) return null
    // Deterministic "random" based on date
    const today = new Date()
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
    )
    return verses[dayOfYear % verses.length]
  }, [verses])

  return {
    loading,
    error,
    verses,
    books,
    getChapter,
    getVerse,
    getVerseByRef,
    getBookChapterCount,
    getChapterVerseCount,
    searchText,
    searchByTopic,
    getRandomVerse,
    getDailyVerse,
  }
}

export default useBibleData
