# iCloud Sync Setup — v1.1

The v1.1 codebase contains the iCloud sync implementation but ships with
the iCloud entitlement **disabled** by default. To activate it on your
local builds (and eventually in the production v1.1 binary), you need
to perform two one-time steps that have to happen in Apple's tooling,
not in this repo:

1. Enable the iCloud capability in **Xcode** for the KJVBible target.
2. Enable iCloud on the App ID in **Apple Developer Portal**.

Both take less than a minute.

---

## Step 1 — Xcode: enable iCloud capability

1. Open `ios/KJVBible.xcodeproj` in Xcode.
2. Select the **KJVBible** target in the project navigator (top of the
   left sidebar).
3. Click the **Signing & Capabilities** tab.
4. Click the **+ Capability** button (top-left of the tab body).
5. Search for **iCloud** and double-click it. A new "iCloud" section
   appears below.
6. Inside the iCloud section:
   - ☑ **Key-value storage** ← check this box
   - ☐ CloudKit ← leave unchecked (we don't need a full CloudKit
     container for v1.1)
   - ☐ iCloud Documents ← leave unchecked
7. Xcode will offer to fix any signing issues that pop up. Accept any
   "Automatically manage signing" prompts.

Xcode will:
- Add `com.apple.developer.icloud-services` and
  `com.apple.developer.ubiquity-kvstore-identifier` to the
  `KJVBible.entitlements` file (already created in this repo —
  Xcode will merge cleanly).
- Update `project.pbxproj` to reference the entitlements file via
  `CODE_SIGN_ENTITLEMENTS = KJVBible/KJVBible.entitlements;`.
- Talk to the developer portal to enable iCloud on the App ID.

After this, the **Signing & Capabilities** tab should show no warnings
or red indicators in the iCloud row.

---

## Step 2 — Verify in the Apple Developer Portal

This usually happens automatically as part of Step 1, but it's worth
confirming:

1. Go to <https://developer.apple.com/account/resources/identifiers/list>
2. Find the App ID `us.tracksystem.PortaAngusta`.
3. Click it. Scroll to the **Capabilities** section.
4. **iCloud** should be ✅ enabled. If it isn't, click ☑ to enable it
   and click **Save**.

For Key-Value storage (which is what we use), no further sub-config is
needed. CloudKit containers would require explicit configuration here;
key-value storage is implicit per (Team ID, Bundle ID).

---

## Testing locally

Once the capability is enabled in Xcode:

1. Build and run on the simulator OR a real iPhone signed into your
   iCloud account.
2. Sign into iCloud in **Settings → Apple ID → iCloud** if you haven't
   already.
3. Make sure **Settings → Apple ID → iCloud → Porta Angusta** is
   toggled on (it appears in the apps list once you've launched the app
   at least once with iCloud capability enabled).
4. Open the app, create a journal entry.
5. Verify the round-trip by either:
   - **Deleting the app**, reinstalling from Xcode, and confirming the
     journal entry comes back automatically within ~30 seconds of first
     launch.
   - Or installing on a second device (iPad, second iPhone) signed
     into the same iCloud account, and seeing the entry appear there
     within ~30 seconds.

If entries don't reappear:
- Check the Xcode console for `CloudStore` log lines (none expected
  in the current implementation, but errors would appear here).
- Verify the app's **Settings → Apple ID → iCloud → Porta Angusta**
  toggle is on.
- iCloud sync isn't instant — it can take 10–30 seconds the first
  time. Tap into the Journal tab to force the React app to
  re-read on visibility change.

---

## What gets synced (v1.1)

The hooks that use `cloudBridge` mirror their data into iCloud:

| Hook | Key | Synced via iCloud |
|---|---|---|
| `useJournal` | `kjv_journal` | ✅ yes |
| `useSavedSearches` | `kjv_pinned_searches` | ⏳ planned for v1.1.1 |
| BibleApp bookmarks | `kjv_bookmarks` | ⏳ planned for v1.1.1 |
| BibleApp font scale | `kjv_font_scale` | ❌ no (per-device preference) |
| BibleApp daily collapsed | `kjv_daily_collapsed` | ❌ no (session state) |

v1.1 ships with journal sync only — the highest-value data. The other
hooks will be migrated to use `cloudBridge` in v1.1.1 once we've
shaken out any edge cases with the journal sync in real-world use.

---

## What stays the same on the user's privacy posture

- Still **no third-party servers** — iCloud sync goes from the user's
  device to Apple's iCloud (between the user and Apple, not us).
- Still **no telemetry, no analytics, no account on our side**.
- Privacy nutrition labels stay **"Data Not Collected"** — Apple
  explicitly excludes their own platform services (iCloud, Sign in
  with Apple, Push Notifications) from the "data collection" question.
- iCloud Advanced Data Protection (ADP) users get end-to-end
  encryption of NSUbiquitousKeyValueStore data. Non-ADP users get
  Apple-managed encryption at rest. Either way, the data never touches
  any server we control.

The privacy policy and the App Store description don't need updating
for v1.1 — they were already accurate ("no network requests once
installed, except for iCloud sync if the user has it enabled").

Actually, the privacy policy *could* be tightened to mention iCloud
explicitly. See `privacy.html` and update the "What stays on your
device" section to add an "iCloud sync (optional)" paragraph when
v1.1 ships.

---

## Failure modes and graceful degradation

- **User not signed into iCloud:** `cloudBridge.set()` quietly no-ops.
  Journal entries live in localStorage only, same as v1.0 behavior.
- **iCloud disabled for the app specifically (Settings toggle off):**
  Same as above — localStorage-only.
- **iCloud quota exceeded** (very rare for kvstore — limit is 1 MB):
  Set operations fail; reads still return the last-synced version.
- **App running in a non-iOS context** (browser dev mode):
  `isCloudBridgeAvailable()` returns false, every hook falls back to
  localStorage. Same code path as v1.0.

The app should always function in localStorage-only mode. iCloud is
purely additive durability.
