# Changelog

All notable changes to Porta Angusta are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned
- iCloud sync for bookmarks, pinned searches, and journal entries (opt-in).
- iPad layout polish.
- visionOS native review pass.

---

## [1.0.0] — 2026-05-18

First public release. Submitted to the App Store on this date.

### Added
- **Read tab.** Book and chapter navigation. Adjustable text size, dark
  theme, collapsible Verse of the Day. Tap a verse to highlight, double-tap
  to read it aloud.
- **Search tab.** Full-text search across all 31,102 verses with a live
  statistics panel — Old Testament vs. New Testament split, then per-book
  and per-chapter counts. Tap any stat row to filter results. Pin frequent
  searches.
- **People & Places.** Hundreds of named persons and places automatically
  discovered from the KJV text. Summary card per entity (total mentions,
  distinct books, first/last reference, peak book) plus an arc diagram
  tracing the canonical journey.
- **Journal.** Voice or type reflections. Attach one verse or many. Tap
  Reflect on any verse anywhere in the app to start or append a note.
  Search and re-read past entries. Share to Mail / Messages / etc.
- **Listen.** Whole-chapter or selected-verse text-to-speech via the
  system AVSpeechSynthesizer. Pulpit-style reference normalization
  ("John 3:16" reads as "John, chapter 3, verse 16," not "3:16 PM").
- **Saved verses tab.** Persistent bookmarks with the verse text inline
  for review.
- **OT / NT colour theming.** Old Testament verses wear a warm gold accent;
  New Testament verses wear a cool blue. Stats bars match.

### Architecture
- Native Swift WKWebView host (SwiftUI shell) wrapping a self-contained
  React + TypeScript + Vite reader.
- Custom `bibleapp://` URL scheme via `WKURLSchemeHandler` so `localStorage`
  works as a proper origin and the entire web bundle is served from inside
  the iOS binary.
- `PrivacyInfo.xcprivacy` manifest declaring the single API category used
  (UserDefaults, CA92.1).
- `ITSAppUsesNonExemptEncryption=false` in Info.plist — no export
  compliance questionnaire needed.

### Privacy
- Zero network requests at runtime. The entire KJV text, every UI image,
  and every line of JavaScript ships inside the binary.
- App Store privacy nutrition labels: **No Data Collected.**
- Microphone permission, when invoked by the Journal's voice-dictation
  feature, hands audio to Apple's on-device speech-recognition framework.
  No audio is recorded to a file, transmitted, or retained beyond the
  user's typed transcript.

### Distribution
- Free, MIT licensed.
- iOS 17.0+ universal binary (iPhone, iPad, Apple Silicon Mac, Apple Vision Pro).
- Available in 174 countries and regions.

---

[Unreleased]: https://github.com/ArcSelf/porta-angusta/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ArcSelf/porta-angusta/releases/tag/v1.0.0
