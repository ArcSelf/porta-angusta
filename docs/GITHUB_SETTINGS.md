# GitHub Repository Settings Checklist

These are the manual point-and-click steps in GitHub's web UI that
complete the repo's polish. Files we add to the repo (LICENSE,
README, CODE_OF_CONDUCT, SECURITY, NOTICE, social-preview.png) take
care of most things automatically. A few settings still have to be
toggled in the web UI.

Walk through this checklist once after a fresh polish push.

---

## 1. About panel — Description, Website, Topics

**Where:** Repo home page → right sidebar → click the ⚙️ icon next to
the word **About**.

### Description
Paste:
```
Porta Angusta — The Narrow Gate. An open-source King James Bible iOS app. Fully offline reader with live search statistics (OT/NT split, per-book and per-chapter counts), a journaling layer with voice dictation and multi-verse linking, and an automatic named-entity explorer. SwiftUI + WKWebView. MIT licensed.
```
*(Already set — verify it's still there.)*

### Website
Paste the App Store URL:
```
https://apps.apple.com/app/id6770117302
```
This makes the App Store link appear prominently at the top of the
About panel as a clickable destination.

### Topics
Add these tags (just type them and press Enter for each):
```
ios
bible
kjv
swiftui
wkwebview
react
typescript
offline-first
open-source
bible-app
christian
privacy-focused
mit-license
```
Each topic becomes a clickable link to a GitHub topic page (e.g.
`github.com/topics/bible`) where this repo will appear in search
results. Free organic discovery.

### Other toggles in the same panel
- ☑ **Use your GitHub Pages website** — only if Pages becomes the
  primary website (we use the App Store URL as primary instead, so
  leave unchecked).
- ☑ **Releases** — show the Releases box in the sidebar (default on).
- ☑ **Packages** — leave on, harmless (we have no packages).
- ☑ **Deployments** — leave on, shows the GitHub Pages deploys.

Click **Save changes**.

---

## 2. Social preview image

**Where:** Repo home page → top nav → **Settings** → **General**
→ scroll down to **Social preview**.

1. Click **Edit** next to the placeholder image.
2. Upload `docs/social-preview.png` from the repo (or download a
   local copy first).
3. Save.

This is the image that appears as a card when anyone shares the
repo URL on Twitter, Slack, Discord, iMessage, LinkedIn, etc.
Without this set, GitHub generates a default tile (just text on
a white background).

---

## 3. Enable Discussions

**Where:** Settings → **General** → **Features** section.

- ☑ **Discussions**

Click it on. A new **Discussions** tab appears in the top nav next
to Issues. The difference in use:

- **Issues** = structured bug reports and feature requests (your
  templates handle these)
- **Discussions** = open-ended Q&A, "how do I…", "what about…",
  general conversation, announcements

Otherwise every "thanks for making this" message clutters your
Issues backlog.

---

## 4. Enable Sponsorships (optional)

**Where:** Settings → **General** → **Features** section.

- ☐ **Sponsorships** — leave OFF unless you want a Sponsor button.

If you ever flip it on, edit `.github/FUNDING.yml` (already in the
repo, currently fully commented out) and uncomment one or more
platforms. The Sponsor button appears at the top of the repo home.

---

## 5. Verify license detection

**Where:** Repo home page → right sidebar → **About** panel.

Should show:
- 📖 Readme
- ⚖️ **MIT license** ← (not "View license")
- 👥 Contributing
- 📜 **Code of conduct** ← (new after this polish push)
- 🛡 Security policy

If "MIT license" shows correctly, the License is properly detected.
If it shows "View license" or "Other," check that `LICENSE` is pure
canonical MIT text without trailing addenda — see commit
`Fix license auto-detection` for the canonical form.

---

## 6. Releases — draft v1.0.0 release (after Apple approves)

**Where:** Repo home page → **Releases** in right sidebar →
**Create a new release** (or **Draft a new release**).

When Apple approves the App Store submission:

1. Click **Choose a tag** → select `v1.0.0` from the dropdown.
2. **Release title:** `v1.0.0 — App Store launch`
3. **Description:** the annotated tag message is auto-populated. Edit
   it if you want to add the App Store link and a screenshot.
4. ☑ **Set as the latest release**
5. ☐ Pre-release
6. Click **Publish release**.

This converts the tag into a permanent Release page with a stable
URL (`github.com/ArcSelf/porta-angusta/releases/tag/v1.0.0`) and
pins it in the sidebar as a milestone.

---

## 7. Branch protection (optional, recommended once you have one PR)

**Where:** Settings → **Branches** → **Add branch ruleset**.

For `main`:
- ☑ Require pull request before merging (skip for solo work)
- ☑ Require status checks to pass — select **Web CI**
- ☑ Block force pushes
- ☑ Block deletions

You can leave PR requirement off while you're solo-developing,
but the **status checks** rule means a future regression in
TypeScript can never accidentally land on `main`. Worth turning on
once Apple has approved v1.0 and you don't want to break the
shipping branch.

---

## Done

Repo is in its final polish state once all of the above are checked.
The remaining work — tests, ADRs, Android port — is content work,
not configuration.
