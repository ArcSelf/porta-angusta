# Screenshots

Drop App Store screenshots in this folder as PNG files and reference them
from the main `README.md`.

Recommended filenames (lets `README.md` pick them up without edits):

- `01-search-stats.png` — Search tab with statistics panel
- `02-people-places.png` — Persons & Places summary card
- `03-heat-map.png` — Heat Map drilldown
- `04-read.png` — Read tab on a chapter
- `05-journal.png` — Journal entry with attached verses
- `06-saved.png` — Saved verses tab

The same 1290 × 2796 PNGs used for the App Store submission work fine for
the README — GitHub auto-scales them to the viewport.

Existing helper script:
```
python3 scripts/resize_screenshots.py <SOURCE> <OUTPUT> --size 1290x2796
```
