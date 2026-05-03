#!/usr/bin/env python3
"""
r2_replace_videos.py
─────────────────────────────────────────────────────────────────────
Replaces every R2 object listed in `in_use_paths.txt` with the local
compressed version. Workflow per file:
  1. DELETE the existing R2 object (basename key, flat layout)
  2. UPLOAD the local compressed mp4 to that same key
  3. Set Cache-Control: public, max-age=31536000, immutable (1y edge cache)
  4. Set Content-Type: video/mp4

Idempotent. Safe to re-run on partial failures (it just re-deletes and
re-uploads, which is what we want).

USAGE:
  1. Open this file in your editor.
  2. Paste your R2 credentials in the FILL-IN section below (you can
     copy them from the existing upload_to_r2.py you used for the
     original migration).
  3. Run from PowerShell:
       cd C:\\Users\\rinne\\one-percent_club
       python r2_replace_videos.py

After it finishes, spot-check any one file in your browser:
  https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q1intro.mp4
File size shown in DevTools Network tab should match the COMPRESSED
local size (e.g. ~4 MB for q1intro.mp4, not the original ~10 MB).
"""

import sys
from pathlib import Path

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("ERROR: boto3 not installed.")
    print("Run: pip install boto3")
    sys.exit(1)

# ════════════════════════════════════════════════════════════════════
# Credentials baked in from the new R2 token (rotated May 2026).
# Bucket name unchanged. Rotate this token AGAIN after the upload
# completes since it's been pasted into chat history.
# ════════════════════════════════════════════════════════════════════
ACCESS_KEY_ID     = "84e068a90dd608583ba835caf1d2ae3c"
SECRET_ACCESS_KEY = "ce9095dec96738783ada5b29ef35fb072c90fe443a45d9abf30704e164ca43fd"
ENDPOINT_URL      = "https://6ccfcd06480cfaa300ccd5c002db1fa7.r2.cloudflarestorage.com"
BUCKET            = "tempstorage"
# ════════════════════════════════════════════════════════════════════

PUBLIC_BASE = "https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev"
PATHS_FILE  = Path("in_use_paths.txt")


def main() -> int:
    # Sanity: did the user actually fill in creds?
    if "PASTE_FROM" in (ACCESS_KEY_ID + SECRET_ACCESS_KEY + ENDPOINT_URL):
        print("ERROR: You haven't filled in the credentials at the top of this file.")
        print("Open r2_replace_videos.py in your editor, paste the creds from")
        print("upload_to_r2.py, save, and re-run.")
        return 1

    # Load the in-use file list
    if not PATHS_FILE.exists():
        print(f"ERROR: {PATHS_FILE} not found in current directory.")
        return 1

    raw_lines = [line.strip() for line in PATHS_FILE.read_text(encoding="utf-8").splitlines()]
    paths = [Path(line) for line in raw_lines if line]
    paths = [p for p in paths if p.exists()]

    if not paths:
        print("ERROR: no in_use_paths entries found that exist on disk.")
        print("Did you compress the videos first? Run reencode_videos.ps1 if not.")
        return 1

    # Open R2 client
    s3 = boto3.client(
        "s3",
        endpoint_url=ENDPOINT_URL,
        aws_access_key_id=ACCESS_KEY_ID,
        aws_secret_access_key=SECRET_ACCESS_KEY,
        region_name="auto",
    )

    # Quick auth sanity check: list bucket head
    try:
        s3.head_bucket(Bucket=BUCKET)
    except ClientError as e:
        print(f"ERROR: cannot reach bucket '{BUCKET}': {e}")
        print("Check your credentials, endpoint, and bucket name.")
        return 1

    print(f"Replacing {len(paths)} videos in R2 bucket '{BUCKET}'...")
    print(f"(delete old object, then upload local compressed version)")
    print()

    failures = []
    total_before = 0
    total_after = 0

    for i, local in enumerate(paths, 1):
        key = local.name  # flat layout — basename only
        size_mb = local.stat().st_size / (1024 * 1024)
        total_after += local.stat().st_size

        # 1. DELETE
        try:
            s3.delete_object(Bucket=BUCKET, Key=key)
            del_ok = True
        except ClientError as e:
            del_ok = False
            print(f"[{i:2d}/{len(paths)}] DELETE FAILED  {key}  ({e})")

        # 2. UPLOAD with cache headers
        try:
            s3.upload_file(
                Filename=str(local),
                Bucket=BUCKET,
                Key=key,
                ExtraArgs={
                    "ContentType": "video/mp4",
                    "CacheControl": "public, max-age=31536000, immutable",
                },
            )
            del_marker = "DELETED+" if del_ok else "        "
            print(f"[{i:2d}/{len(paths)}] {del_marker}UPLOADED  {key}  ({size_mb:.1f} MB)")
        except ClientError as e:
            failures.append((key, str(e)))
            print(f"[{i:2d}/{len(paths)}] UPLOAD FAILED  {key}  ({e})")

    print()
    print("══════════════════════════════════════")
    print(f"Files processed:    {len(paths)}")
    print(f"Failures:           {len(failures)}")
    print(f"Total size:         {total_after / 1024 / 1024:.1f} MB")
    print("══════════════════════════════════════")

    if failures:
        print()
        print("FAILED FILES:")
        for key, err in failures:
            print(f"  {key} — {err}")
        return 2

    print()
    print("Spot-check by opening one URL in your browser:")
    print(f"  {PUBLIC_BASE}/q1intro.mp4")
    print(f"  {PUBLIC_BASE}/bgvideo (1).mp4")
    print()
    print("File size in DevTools Network tab should match the local compressed size.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
