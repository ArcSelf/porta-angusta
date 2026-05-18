/**
 * useSpeechRecognition - Web Speech API hook for voice input
 *
 * Listens for spoken words and provides transcripts.
 * Optimized for single-word recognition in children's reading context.
 */

import { useState, useCallback, useEffect, useRef } from 'react'

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition
}

interface UseSpeechRecognitionOptions {
  continuous?: boolean
  interimResults?: boolean
  language?: string
}

interface UseSpeechRecognitionReturn {
  isListening: boolean
  transcript: string
  interimTranscript: string
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
  error: string | null
}

// Extend window for SpeechRecognition
interface WindowWithSpeech extends Window {
  SpeechRecognition?: ISpeechRecognitionConstructor
  webkitSpeechRecognition?: ISpeechRecognitionConstructor
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const shouldListenRef = useRef(false)
  const restartTimeoutRef = useRef<number | null>(null)

  // Check browser support
  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  // Initialize recognition
  useEffect(() => {
    if (!isSupported) return

    const windowWithSpeech = window as WindowWithSpeech
    const SpeechRecognitionClass =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition

    if (!SpeechRecognitionClass) return

    const recognition = new SpeechRecognitionClass()

    // Configuration for word-by-word reading
    recognition.continuous = options.continuous ?? false
    recognition.interimResults = options.interimResults ?? true
    recognition.lang = options.language ?? 'en-US'
    recognition.maxAlternatives = 3

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
    }

    recognition.onend = () => {
      setIsListening(false)
      if (shouldListenRef.current) {
        if (restartTimeoutRef.current) {
          window.clearTimeout(restartTimeoutRef.current)
        }
        restartTimeoutRef.current = window.setTimeout(() => {
          if (!shouldListenRef.current) return
          try {
            recognition.start()
          } catch (err) {
            console.warn('Recognition restart failed')
          }
        }, 250)
      }
    }

    recognition.onerror = (event) => {
      setIsListening(false)

      // User-friendly error messages
      switch (event.error) {
        case 'no-speech':
          setError("I didn't hear anything. Try again!")
          break
        case 'audio-capture':
          setError('No microphone found. Please connect one.')
          break
        case 'not-allowed':
          setError('Microphone permission denied. Please allow access.')
          break
        case 'network':
          setError('Network error. Please check your connection.')
          break
        case 'aborted':
          // User cancelled, no error needed
          setError(null)
          break
        default:
          setError('Something went wrong. Please try again.')
      }
    }

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let interim = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript

        if (result.isFinal) {
          finalTranscript += text
        } else {
          interim += text
        }
      }

      if (finalTranscript) {
        setTranscript((prev) => (prev + ' ' + finalTranscript).trim())
      }
      setInterimTranscript(interim)
    }

    recognitionRef.current = recognition

    return () => {
      shouldListenRef.current = false
      if (restartTimeoutRef.current) {
        window.clearTimeout(restartTimeoutRef.current)
      }
      recognition.abort()
    }
  }, [isSupported, options.continuous, options.interimResults, options.language])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return

    setError(null)
    setInterimTranscript('')
    shouldListenRef.current = true

    try {
      recognitionRef.current.start()
    } catch (err) {
      // Already started
      console.warn('Recognition already started')
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return

    shouldListenRef.current = false
    try {
      recognitionRef.current.stop()
    } catch (err) {
      // Not started
    }
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setError(null)
  }, [])

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    error,
  }
}

/**
 * Normalize text for comparison (lowercase, remove punctuation)
 */
export function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

/**
 * Check if spoken word matches target word
 * Uses fuzzy matching for children's pronunciation variations
 */
export function wordMatches(spoken: string, target: string, threshold = 0.8): boolean {
  const normalizedSpoken = normalizeForComparison(spoken)
  const normalizedTarget = normalizeForComparison(target)

  // Exact match
  if (normalizedSpoken === normalizedTarget) return true

  // Check if target word is contained in spoken phrase
  if (normalizedSpoken.includes(normalizedTarget)) return true

  // Simple Levenshtein distance for fuzzy matching
  const distance = levenshteinDistance(normalizedSpoken, normalizedTarget)
  const maxLen = Math.max(normalizedSpoken.length, normalizedTarget.length)
  const similarity = maxLen > 0 ? 1 - distance / maxLen : 1

  return similarity >= threshold
}

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Result of validating a spoken sentence against expected tokens
 */
export interface SentenceValidationResult {
  allCorrect: boolean
  correctCount: number
  totalCount: number
  wordResults: Array<{
    tokenId: string
    expected: string
    spoken: string | null
    correct: boolean
  }>
}

/**
 * Validate a spoken sentence against expected tokens
 * Compares each spoken word against the corresponding expected word
 */
export function validateSentence(
  transcript: string,
  tokens: Array<{ id: string; text: string }>,
  threshold = 0.8
): SentenceValidationResult {
  const spokenWords = normalizeForComparison(transcript).split(/\s+/).filter(Boolean)

  const wordResults = tokens.map((token, index) => {
    const spoken = spokenWords[index] || null
    const correct = spoken ? wordMatches(spoken, token.text, threshold) : false
    return {
      tokenId: token.id,
      expected: token.text,
      spoken,
      correct
    }
  })

  const correctCount = wordResults.filter(r => r.correct).length
  return {
    allCorrect: correctCount === tokens.length,
    correctCount,
    totalCount: tokens.length,
    wordResults
  }
}

export default useSpeechRecognition
