#!/usr/bin/env python3
"""
Batch-resize iPhone screenshots to one of Apple's App Store Connect
accepted dimensions.

All current iPhone models capture at very close to a 19.5:9 aspect ratio,
so this script center-crops to the *exact* target aspect ratio (avoids
distortion or letterboxing) and then resizes to the requested pixel
dimensions. Output is solid-RGB PNG (no alpha — Apple rejects alpha on
screenshots).

Usage:
    python3 resize_screenshots.py SOURCE [OUTPUT] [--size WxH]

    SOURCE   File or folder containing PNG/JPG iPhone screenshots.
    OUTPUT   Folder to write resized PNGs to. Defaults to SOURCE/_appstore.
    --size   Target dimensions. Defaults to 1290x2796 (iPhone 6.7" Display,
             accepted by App Store Connect's 6.5" / 6.7" / 6.9" slots).

Accepted Apple sizes for iPhone screenshots:
    1242x2688  — iPhone 6.5" Display slot (XS Max class)
    1284x2778  — iPhone 6.5" / 6.7" slot (12-13 Pro Max class)
    1290x2796  — iPhone 6.7" / 6.9" slot (14/15/16 Plus / Pro Max class)  ← default
    1320x2868  — iPhone 6.9" slot (16 Pro Max class)

Examples:
    python3 resize_screenshots.py ~/Desktop/Screenshots
    python3 resize_screenshots.py ~/Desktop/shot.png ~/Desktop/out --size 1242x2688
"""

import argparse
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.stderr.write(
        "ERROR: Pillow not installed. Run:\n"
        "    python3 -m pip install --user Pillow\n"
        "then re-run this script.\n"
    )
    sys.exit(1)


def parse_size(spec: str) -> tuple[int, int]:
    try:
        w, h = spec.lower().split("x")
        return int(w), int(h)
    except Exception:
        raise argparse.ArgumentTypeError(
            f"Invalid --size {spec!r}; expected like 1290x2796"
        )


def crop_to_aspect(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Center-crop the image to exactly target's aspect ratio."""
    src_w, src_h = img.size
    src_ratio = src_w / src_h
    tgt_ratio = target_w / target_h
    if abs(src_ratio - tgt_ratio) < 1e-4:
        return img  # already the right aspect, just resize later
    if src_ratio > tgt_ratio:
        # Source is too wide — crop sides
        new_w = int(round(src_h * tgt_ratio))
        left = (src_w - new_w) // 2
        return img.crop((left, 0, left + new_w, src_h))
    else:
        # Source is too tall — crop top/bottom
        new_h = int(round(src_w / tgt_ratio))
        top = (src_h - new_h) // 2
        return img.crop((0, top, src_w, top + new_h))


def process_file(src: Path, dst_dir: Path, target_w: int, target_h: int) -> None:
    try:
        img = Image.open(src)
    except Exception as e:
        print(f"  SKIP  {src.name}: not a readable image ({e})")
        return

    src_w, src_h = img.size
    cropped = crop_to_aspect(img, target_w, target_h)
    resized = cropped.resize((target_w, target_h), Image.LANCZOS)

    # Flatten to opaque RGB (Apple rejects alpha on screenshots)
    if resized.mode != "RGB":
        bg = Image.new("RGB", resized.size, (0, 0, 0))
        if resized.mode == "RGBA":
            bg.paste(resized, mask=resized.split()[3])
        else:
            bg.paste(resized.convert("RGB"))
        resized = bg

    out = dst_dir / (src.stem + ".png")
    resized.save(out, format="PNG", optimize=True)
    print(f"  OK    {src.name}  ({src_w}x{src_h})  ->  {out.name}  ({target_w}x{target_h})")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("source", help="File or folder of iPhone screenshots")
    p.add_argument("output", nargs="?", help="Output folder (defaults to SOURCE/_appstore)")
    p.add_argument("--size", type=parse_size, default=(1290, 2796),
                   help="Target WxH (default 1290x2796)")
    args = p.parse_args()

    src = Path(args.source).expanduser().resolve()
    if not src.exists():
        print(f"ERROR: {src} does not exist")
        return 1

    if args.output:
        dst_dir = Path(args.output).expanduser().resolve()
    else:
        parent = src if src.is_dir() else src.parent
        dst_dir = parent / "_appstore"
    dst_dir.mkdir(parents=True, exist_ok=True)

    target_w, target_h = args.size
    print(f"→ resizing to {target_w}x{target_h}")
    print(f"→ writing to {dst_dir}")
    print()

    if src.is_file():
        process_file(src, dst_dir, target_w, target_h)
    else:
        files = sorted(
            f for f in src.iterdir()
            if f.is_file() and f.suffix.lower() in {".png", ".jpg", ".jpeg", ".heic"}
        )
        if not files:
            print(f"  (no PNG/JPG/HEIC files in {src})")
            return 1
        for f in files:
            process_file(f, dst_dir, target_w, target_h)

    print()
    print(f"✓ Done. Drag the {target_w}x{target_h} PNGs from {dst_dir} into App Store Connect.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
