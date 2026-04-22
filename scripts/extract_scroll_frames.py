#!/usr/bin/env python3
"""
Extract evenly spaced JPEGs from `public/new videos/scrollvideo.mp4` into `public/sharp-frames/`.

Crops pixels from the bottom (Grok / UI row) — same idea as trimming the watermark band on the prior video.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def ffprobe_duration_seconds(video: Path) -> float:
    r = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(r.stdout.strip())


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--video",
        type=Path,
        default=Path("public/new videos/scrollvideo.mp4"),
    )
    p.add_argument("--out", type=Path, default=Path("public/sharp-frames"))
    p.add_argument("--frames", type=int, default=121)
    p.add_argument(
        "--chop-bottom",
        type=int,
        default=120,
        help="Remove this many pixels from the bottom (1080p → height 1080−N).",
    )
    p.add_argument("--jpeg-q", type=int, default=3, help="ffmpeg -q:v (lower is better, 2–5 typical).")
    args = p.parse_args()

    root = Path(__file__).resolve().parents[1]
    video = (root / args.video).resolve()
    out = (root / args.out).resolve()

    if not video.is_file():
        print(f"Missing video: {video}", file=sys.stderr)
        sys.exit(1)

    dur = ffprobe_duration_seconds(video)
    fps = args.frames / dur
    vf = f"fps={fps},crop=iw:ih-{args.chop_bottom}:0:0"

    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("frame_*.jpg"):
        f.unlink()

    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(video),
        "-vf",
        vf,
        "-frames:v",
        str(args.frames),
        "-q:v",
        str(args.jpeg_q),
        str(out / "frame_%03d.jpg"),
    ]
    subprocess.run(cmd, check=True)
    print(f"Wrote {args.frames} frames → {out} (crop bottom {args.chop_bottom}px, ~{fps:.4f} fps)")


if __name__ == "__main__":
    main()
