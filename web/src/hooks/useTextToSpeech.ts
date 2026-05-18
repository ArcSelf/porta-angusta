/**
 * useTextToSpeech - Web Speech API hook for reading aloud
 *
 * Provides text-to-speech functionality optimized for children's reading.
 * Uses slower rate and clear pronunciation.
 */

import { useState, useCallback, useEffect, useRef } from 'react'

interface TextToSpeechOptions {
  rate?: number // 0.1 to 10, default 0.8 for children
  pitch?: number // 0 to 2, default 1
  volume?: number // 0 to 1, default 1
  voice?: string // Voice name preference
}

interface UseTextToSpeechReturn {
  speak: (text: string) => void
  /** Queue an ordered list of utterances; each plays after the previous ends. */
  speakQueue: (texts: string[]) => void
  stop: () => void
  pause: () => void
  resume: () => void
  isSpeaking: boolean
  isPaused: boolean
  isSupported: boolean
  voices: SpeechSynthesisVoice[]
  setVoice: (voiceName: string) => void
  setRate: (rate: number) => void
}

const DEFAULT_OPTIONS: TextToSpeechOptions = {
  rate: 0.8, // Slower for children
  pitch: 1,
  volume: 1,
}

export function useTextToSpeech(options: TextToSpeechOptions = {}): UseTextToSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [rate, setRateState] = useState(options.rate ?? DEFAULT_OPTIONS.rate!)

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  // Queue state for speakQueue() — kept in a ref so we don't churn renders.
  const queueRef = useRef<string[]>([])
  const queueIndexRef = useRef<number>(0)

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Load available voices
  useEffect(() => {
    if (!isSupported) return

    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices()
      setVoices(availableVoices)

      // Try to find a good English voice for children
      const preferred = availableVoices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Samantha') || // macOS
            v.name.includes('Google US English') || // Chrome
            v.name.includes('Microsoft Zira') || // Windows
            v.name.includes('Female'))
      )
      if (preferred) {
        setSelectedVoice(preferred)
      } else {
        // Fall back to first English voice
        const english = availableVoices.find((v) => v.lang.startsWith('en'))
        if (english) setSelectedVoice(english)
      }
    }

    // Voices may load async
    loadVoices()
    speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      speechSynthesis.onvoiceschanged = null
    }
  }, [isSupported])

  // Internal: build and speak a single utterance with the configured voice/rate.
  // `onComplete` fires only on natural end (not on cancel/stop) so a queue can chain.
  const speakOne = useCallback(
    (text: string, onComplete?: () => void) => {
      if (!isSupported) return
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = rate
      utterance.pitch = options.pitch ?? DEFAULT_OPTIONS.pitch!
      utterance.volume = options.volume ?? DEFAULT_OPTIONS.volume!
      if (selectedVoice) utterance.voice = selectedVoice

      utterance.onstart = () => {
        setIsSpeaking(true)
        setIsPaused(false)
      }
      utterance.onend = () => {
        setIsSpeaking(false)
        setIsPaused(false)
        // Only chain forward if THIS utterance is still the active one
        // (a stop() or another speak() will have replaced utteranceRef).
        if (utteranceRef.current === utterance) {
          onComplete?.()
        }
      }
      utterance.onerror = () => {
        setIsSpeaking(false)
        setIsPaused(false)
      }
      utteranceRef.current = utterance
      speechSynthesis.speak(utterance)
    },
    [isSupported, selectedVoice, rate, options.pitch, options.volume]
  )

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return
      // Cancel any ongoing speech and clear any queue.
      speechSynthesis.cancel()
      queueRef.current = []
      queueIndexRef.current = 0
      speakOne(text)
    },
    [isSupported, speakOne]
  )

  const speakQueue = useCallback(
    (texts: string[]) => {
      if (!isSupported || texts.length === 0) return
      speechSynthesis.cancel()
      queueRef.current = texts
      queueIndexRef.current = 0
      const advance = () => {
        const next = queueIndexRef.current + 1
        if (next < queueRef.current.length) {
          queueIndexRef.current = next
          speakOne(queueRef.current[next], advance)
        } else {
          queueRef.current = []
          queueIndexRef.current = 0
        }
      }
      speakOne(texts[0], advance)
    },
    [isSupported, speakOne]
  )

  const stop = useCallback(() => {
    if (!isSupported) return
    queueRef.current = []
    queueIndexRef.current = 0
    utteranceRef.current = null
    speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
  }, [isSupported])

  const pause = useCallback(() => {
    if (!isSupported) return
    speechSynthesis.pause()
    setIsPaused(true)
  }, [isSupported])

  const resume = useCallback(() => {
    if (!isSupported) return
    speechSynthesis.resume()
    setIsPaused(false)
  }, [isSupported])

  const setVoice = useCallback(
    (voiceName: string) => {
      const voice = voices.find((v) => v.name === voiceName)
      if (voice) setSelectedVoice(voice)
    },
    [voices]
  )

  const setRate = useCallback((newRate: number) => {
    setRateState(Math.max(0.1, Math.min(2, newRate)))
  }, [])

  return {
    speak,
    speakQueue,
    stop,
    pause,
    resume,
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    setVoice,
    setRate,
  }
}

export default useTextToSpeech
