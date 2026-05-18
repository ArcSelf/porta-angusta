/**
 * Share helpers — wrap navigator.share so the iOS share sheet (Messages,
 * Mail, Notes, Twitter, AirDrop, etc.) opens with one tap. If the platform
 * doesn't expose the Web Share API for some reason, we fall back to copying
 * the payload to the clipboard so the user has *something* usable.
 */

import type { BibleVerse } from '@hooks/useBibleData'
import type { JournalEntry } from '@hooks/useJournal'

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unavailable'

/** Core share — opens iOS share sheet, with clipboard fallback. */
export async function shareText(payload: {
  title?: string
  text: string
  url?: string
}): Promise<ShareResult> {
  const nav = typeof navigator !== 'undefined' ? navigator : null
  // Web Share API path — what triggers the native iOS share sheet in WKWebView.
  if (nav && 'share' in nav) {
    try {
      await (nav as Navigator & { share: (data: ShareData) => Promise<void> }).share(payload)
      return 'shared'
    } catch (e) {
      // User tapping Cancel raises AbortError — that's a normal, non-error outcome.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Anything else, drop to clipboard fallback below.
    }
  }
  // Clipboard fallback so the user still gets *something* if share fails.
  const combined = [payload.title, payload.text, payload.url].filter(Boolean).join('\n')
  try {
    if (nav && 'clipboard' in nav && nav.clipboard?.writeText) {
      await nav.clipboard.writeText(combined)
      return 'copied'
    }
  } catch {
    /* ignore */
  }
  return 'unavailable'
}

/** Format a single verse for sharing in the iOS share sheet. */
export function shareVerse(verse: BibleVerse): Promise<ShareResult> {
  return shareText({
    title: verse.reference,
    text: `"${verse.text}"\n— ${verse.reference} (KJV)`,
  })
}

/**
 * Format a journal entry for sharing. Title (if any) on top, then the
 * reflection, then a tidy list of any linked verse references.
 */
export function shareJournalEntry(
  entry: JournalEntry,
  resolveVerse?: (reference: string) => BibleVerse | null
): Promise<ShareResult> {
  const lines: string[] = []
  if (entry.title) lines.push(entry.title)
  if (entry.content) lines.push(entry.content)

  const refs = entry.verseRefs ?? []
  if (refs.length > 0) {
    lines.push('')
    lines.push('Reflecting on:')
    for (const r of refs) {
      const v = resolveVerse?.(r)
      lines.push(v ? `• ${r} — "${v.text}"` : `• ${r}`)
    }
  }

  return shareText({
    title: entry.title || 'A reflection from Porta Angusta',
    text: lines.join('\n'),
  })
}
