# Contributing to Porta Angusta

Thanks for taking the time to look. This is a small, intentionally focused
project — a King James Bible reader for iOS that ships zero telemetry, zero
network traffic, and zero accounts. Contributions are welcome, especially
the kinds listed below. The kinds *not* listed below are also welcome, but
will be evaluated against whether they help or hurt the project's core
posture (offline, private, simple to read the Word in).

## Things that are very welcome

- **Bug reports.** If something is broken or misleading, file an issue.
  Steps to reproduce, the iOS version you're on, and a screenshot help
  enormously.
- **Typo fixes** in UI text, README, CHANGELOG, or privacy policy.
- **Accessibility improvements** — VoiceOver labels, dynamic type, better
  contrast in dark mode, larger hit targets.
- **Performance tweaks** in the React reader — search latency, scroll
  smoothness on older iPhones, memory use during long sessions.
- **New language localizations** of the UI chrome (not the KJV text
  itself, which is fixed). The strings file lives in `web/src/`.
- **Tests** — there are none yet. The project would benefit from unit
  coverage on the search statistics layer and the journal verse-attachment
  flow.

## Things that need discussion before a PR

- New top-level tabs or major feature additions. The home screen is full;
  changes there should come with a design rationale.
- Anything that adds a network dependency, a third-party SDK, an analytics
  hook, or anything that would alter the "No Data Collected" privacy
  nutrition label. These will not be merged.
- Different Bible translations. The project name is "Porta Angusta —
  KJV Bible" and the App Store listing locks the translation. A
  multi-translation fork is welcome, but probably belongs in a separate
  repo with a separate listing.

## How to build

See the [Build & run](README.md#build--run) section of the README. Short
version:

```bash
cd web && npm install && npm run build && cp -R dist/. ../ios/KJVBible/WebApp/
cd ../ios && open KJVBible.xcodeproj
```

Then run on any iPhone simulator (16 / 17 / Pro Max).

## How to submit a change

1. Fork the repo and create a feature branch off `main`.
2. Make your change. Keep commits focused — one logical change per commit.
3. If you touched anything under `web/src/`, run `npm run build` and
   commit the regenerated `ios/KJVBible/WebApp/` bundle alongside your
   source change so the iOS app picks it up.
4. Open a Pull Request describing what changed and why. Screenshots
   help for any UI work.

## Code style

- TypeScript: strict mode, no `any` without a comment justifying it.
- Swift: standard SwiftLint defaults, no force-unwraps in production paths.
- React: function components only, hooks for state. No class components.
- CSS: utility classes plus a few hand-written rules in `styles.css` and
  `pages/bible.css`. No CSS-in-JS, no Tailwind.

## Reporting security issues

See [SECURITY.md](SECURITY.md). Do not file public issues for vulnerabilities.

## License

By contributing, you agree your contribution is licensed under the MIT
License (see [LICENSE](LICENSE)).
