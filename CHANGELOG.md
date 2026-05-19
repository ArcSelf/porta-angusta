# Changelog

All notable changes to Porta Angusta are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added (toward v1.1)
- **iCloud sync for journal entries.** New `CloudStore.swift` wraps
  `NSUbiquitousKeyValueStore` and exposes it to the React layer via a
  `WKScriptMessageHandler` bridge (`window.webkit.messageHandlers.cloudStore`).
  The `useJournal` hook now mirrors entries to iCloud whenever they
  change, and reconciles with iCloud on mount. Result: journal entries
  survive a fresh app install on the same iCloud account and sync
  across iPhone + iPad seamlessly. Falls back to localStorage-only
  when iCloud is signed out or the user is on the web dev build.
- `KJVBible.entitlements` declaring the iCloud key-value store
  capability. Activation in Xcode is a one-time + Capability click —
  see `docs/iCLOUD_SETUP.md`.

### Changed
- Journal `localStorage` key migrated from `church_journal` to
  `kjv_journal` for consistency with the rest of the app's namespace.
  Existing v1.0.0 user data is migrated automatically on first load
  and the legacy key is removed. Idempotent — safe across reloads.

### Added (continued)
- **Export / Import full backup** as a JSON file from the Journal toolbar.
  Backs up *everything* the user owns inside the app, not just journal
  entries:
  - **Journal entries** — including a `verseTexts` map per entry that
    inlines the full text of every linked verse, so the file is
    self-contained even if read on a platform without the bundled KJV.
  - **Saved verses (bookmarks)** with full text and reference.
  - **Pinned searches** with their captured filter state (testament,
    book, chapter).
  - **Reading preferences** (font scale, daily-verse collapsed state).

  **Export** hands a `porta-angusta-backup-YYYY-MM-DD.json` file to
  the iOS share sheet (Files, AirDrop, Mail, iCloud Drive, etc.).

  **Import** opens the system file picker, validates, merges into the
  current state, and reloads. Conflict-free: journal entries dedupe
  by id (newer updatedAt wins); bookmarks dedupe by reference;
  pinned searches dedupe by query + filter combination.

  Works regardless of iCloud state. The schema is versioned (v2),
  backward-compatible with v1 journal-only exports, and cross-platform
  safe — readable by the future Android port.

### Planned
- Mirror `kjv_bookmarks` and `kjv_pinned_searches` to iCloud (v1.1.1).
- Visible iCloud sync status indicator on the Journal screen.
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
