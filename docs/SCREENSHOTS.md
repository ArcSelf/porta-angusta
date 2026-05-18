# Screenshots

The files in `docs/screenshots/` are the same 1290 × 2796 PNGs uploaded to
App Store Connect for the v1.0 submission, normalized from raw iPhone
captures using `scripts/resize_screenshots.py`.

| File | Shows |
|---|---|
| `01-search-stats.png` | Search for "love" with the full statistics panel — 645 occurrences, 56 / 66 books, 52 % OT / 48 % NT, per-book breakdown |
| `02-people-heatmap.png` | Persons & Places heat-map view — every named entity rendered as a colored cell across the canon |
| `03-journal-verse.png` | Journal entry "Hello, World!" with John 3:16 attached and its full verse text inline |
| `04-read-book-picker.png` | Read tab on Genesis 1 with the book picker dropdown open |
| `05-people-arc-trace.png` | Persons & Places arc-trace view for *Israel* — 2,564 verses across 47 books, peak in Numbers |
| `06-saved-verses.png` | Saved Verses tab — three "camel through the eye of a needle" parallels (Mark 10:25, Luke 18:25, Matthew 19:24) |
| `07-journal-lords-prayer.png` | Journal entry containing the Lord's Prayer with John 3:16 and Psalms 4:5 attached as linked verses |

The hero trio (01, 02, 03) is embedded at the top of `README.md`; the
remaining four live behind a `<details>` disclosure further down.

## Updating

To regenerate from new iPhone captures:

```
python3 scripts/resize_screenshots.py <SOURCE_DIR> docs/screenshots --size 1290x2796
```

Then commit and push — the README links by relative path.
