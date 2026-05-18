# Security Policy

Porta Angusta makes zero network requests at runtime and stores all user
data exclusively on-device in iOS's local application storage. The attack
surface is small but not zero — the React reader runs JavaScript inside a
WKWebView, and the SwiftUI shell routes a custom URL scheme.

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x: (no public releases before this) |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email <onetracksystem@outlook.com> with:

- A description of the vulnerability and its impact.
- Steps to reproduce, ideally with a small proof-of-concept.
- Your iOS version and device model, if relevant.

You'll receive an acknowledgement within 5 business days. If the report is
confirmed, a fix will land in a minor or patch release within 30 days, with
public disclosure coordinated for the same day as the App Store update.

You will be credited in the [CHANGELOG](CHANGELOG.md) for the release that
contains the fix, unless you prefer to remain anonymous.

## Out of scope

The following are by design and not security issues:

- The bundled KJV text. The Authorized Version is public domain in the
  United States and is included as a CSV file; this is intentional.
- The `DEVELOPMENT_TEAM` ID and bundle identifier in `project.pbxproj`.
  Apple Developer Team IDs are not secret and appear in every public
  iOS repository.
- `localStorage` data being deleted when the user uninstalls the app.
  This is iOS behaviour by design.

## Out of scope for this project specifically

The app makes no network requests at runtime, so server-side
vulnerabilities, supply-chain attacks on a backend, third-party SDK
issues, analytics-pipeline issues, and the like do not apply. If a
future version introduces network calls, this section will be revised
in the same release.
