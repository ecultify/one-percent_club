#!/usr/bin/env python3
"""
Batch AI-upscale frames using Vertex AI Imagen 4.0 Upscale.
Reads from public/sharp-frames/, writes to public/ai-frames/.
Billed against your Vertex AI project's free GenAI credits.

Usage:
    cd 1_percent_animation
    python3 upscale_frames.py
"""

import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Config ──────────────────────────────────────────────────────────
PROJECT_ID = "varvadhu-e6f71"
REGION = "us-central1"
MODEL = "imagen-4.0-upscale-preview"
UPSCALE_FACTOR = "x2"        # x2 or x4 (x2 keeps us well under 17MP limit)
INPUT_DIR = Path("public/sharp-frames")
OUTPUT_DIR = Path("public/ai-frames")
MAX_WORKERS = 4               # parallel API calls (be gentle on quota)
TEST_MODE = True              # Set to True to process only 1 frame first
# ────────────────────────────────────────────────────────────────────

def get_access_token():
    """Get a fresh access token from gcloud CLI."""
    result = subprocess.run(
        ["gcloud", "auth", "application-default", "print-access-token"],
        capture_output=True, text=True
    )
    token = result.stdout.strip()
    if not token:
        print("ERROR: Could not get access token. Run: gcloud auth application-default login")
        sys.exit(1)
    return token


def upscale_image(frame_path: Path, output_path: Path, token: str) -> tuple[str, bool, str]:
    """Send one frame to Imagen upscale API and save the result."""
    name = frame_path.name

    if output_path.exists():
        return (name, True, "already exists, skipped")

    # Read and encode
    with open(frame_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")

    url = (
        f"https://aiplatform.googleapis.com/v1/projects/{PROJECT_ID}"
        f"/locations/{REGION}/publishers/google/models/{MODEL}:predict"
    )

    payload = {
        "instances": [
            {
                "prompt": "",
                "image": {
                    "bytesBase64Encoded": img_b64
                }
            }
        ],
        "parameters": {
            "mode": "upscale",
            "upscaleConfig": {
                "upscaleFactor": UPSCALE_FACTOR
            }
        }
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")

    retries = 3
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                result = json.loads(resp.read().decode("utf-8"))

            predictions = result.get("predictions", [])
            if not predictions:
                return (name, False, f"no predictions in response: {json.dumps(result)[:200]}")

            out_b64 = predictions[0].get("bytesBase64Encoded", "")
            if not out_b64:
                return (name, False, "empty bytesBase64Encoded in response")

            out_bytes = base64.b64decode(out_b64)
            with open(output_path, "wb") as out_f:
                out_f.write(out_bytes)

            size_kb = len(out_bytes) / 1024
            return (name, True, f"{size_kb:.0f}KB")

        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            if e.code == 429 and attempt < retries - 1:
                wait = (attempt + 1) * 5
                print(f"  Rate limited on {name}, waiting {wait}s...")
                time.sleep(wait)
                continue
            return (name, False, f"HTTP {e.code}: {body[:300]}")

        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2)
                continue
            return (name, False, str(e))

    return (name, False, "max retries exceeded")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Gather input frames
    frames = sorted(INPUT_DIR.glob("frame_*.jpg"))
    if not frames:
        print(f"No frames found in {INPUT_DIR}")
        sys.exit(1)

    if TEST_MODE:
        frames = frames[:1]
        print("=" * 50)
        print("TEST MODE: Processing only 1 frame")
        print("Check your billing dashboard after this.")
        print("If credits were used (not real $), set TEST_MODE = False")
        print("and run again to process all frames.")
        print("=" * 50)

    print(f"Processing {len(frames)} frame(s) from {INPUT_DIR}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Model: {MODEL} ({UPSCALE_FACTOR})")
    print(f"Cost estimate: ~${len(frames) * 0.003:.2f}")
    print()

    # Get token
    token = get_access_token()

    # Process frames
    done = 0
    failed = 0
    skipped = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {}
        for frame_path in frames:
            output_path = OUTPUT_DIR / frame_path.name
            future = pool.submit(upscale_image, frame_path, output_path, token)
            futures[future] = frame_path.name

        for future in as_completed(futures):
            name, success, msg = future.result()
            if success:
                if "skipped" in msg:
                    skipped += 1
                    print(f"  [{done+skipped+failed}/{len(frames)}] {name}: {msg}")
                else:
                    done += 1
                    print(f"  [{done+skipped+failed}/{len(frames)}] {name}: OK ({msg})")
            else:
                failed += 1
                print(f"  [{done+skipped+failed}/{len(frames)}] {name}: FAILED - {msg}")

    print()
    print(f"Done! {done} upscaled, {skipped} skipped, {failed} failed")
    if failed == 0:
        print(f"\nAll frames ready in {OUTPUT_DIR}/")
        print("Go back to Claude and say: 'done, frames are in ai-frames'")


if __name__ == "__main__":
    main()
