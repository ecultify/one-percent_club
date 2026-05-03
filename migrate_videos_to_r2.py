#!/usr/bin/env python3
"""Migrate in-use video paths from local /public/ to Cloudflare R2.
Run AFTER you've uploaded all 31 mp4s to the tempstorage bucket.

This script:
  1. Replaces every local mp4 web path in src/ with its R2 equivalent
  2. Reports which files were touched
  3. Does NOT delete the local /public/ files — do that manually after
     verifying the deployed site plays the R2 versions correctly

Usage:
  cd C:\\Users\\rinne\\one-percent_club
  python migrate_videos_to_r2.py
"""
import os, re, sys

R2_BASE = "https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev"
WEB_PATH_TO_R2 = {
    '/questionscreenimages/wrongrxns/1percentwrongmodified.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/1percentwrongmodified.mp4',
    '/questionscreenimages/FullVIDF2.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/FullVIDF2.mp4',
    '/teaser-video.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/teaser-video.mp4',
    '/questionscreenimages/question10(onepercent-1)/q10intro.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q10intro.mp4',
    '/questionscreenimages/endingvoifallcorrect.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/endingvoifallcorrect.mp4',
    '/questionscreenimages/endvoifevenonewrong.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/endvoifevenonewrong.mp4',
    '/homepagevideo.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/homepagevideo.mp4',
    '/new videos/scrollvideo.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/scrollvideo.mp4',
    '/questionscreenimages/question10(onepercent-1)/q10correct.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q10correct.mp4',
    '/questionscreenimages/LastVid2.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/LastVid2.mp4',
    '/questionscreenimages/question6(4transports-40)/q6intro.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q6intro.mp4',
    '/questionscreenimages/question4(jessicanmandy-60)/q4_new_sequence_yes.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q4_new_sequence_yes.mp4',
    '/questionscreenimages/question9(number1to6-10)/q9_new_sequence_yes.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q9_new_sequence_yes.mp4',
    '/questionscreenimages/question3(cardsnglasses-70)/q3_new_sequence_yes.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q3_new_sequence_yes.mp4',
    '/questionscreenimages/question2(gandhijirealornot-80)/q2_new_sequence_yes.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q2_new_sequence_yes.mp4',
    '/questionscreenimages/question5(biggestsquare-50)/q5correct.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q5correct.mp4',
    '/questionscreenimages/question6(4transports-40)/q6_new_sequence_yes.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q6_new_sequence_yes.mp4',
    '/questionscreenimages/question8(gymnast-20)/q8intro.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q8intro.mp4',
    '/questionscreenimages/question7(earthnmars-30)/q7correct.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q7correct.mp4',
    '/questionscreenimages/question1(findthemistake-90)/q1correct.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q1correct.mp4',
    '/questionscreenimages/question9(number1to6-10)/q9intro.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q9intro.mp4',
    '/questionscreenimages/question7(earthnmars-30)/q7intro.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q7intro.mp4',
    '/questionscreenimages/wrongrxns/qwrong2.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/qwrong2.mp4',
    '/questionscreenimages/question8(gymnast-20)/q8_new_sequence_yes.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q8_new_sequence_yes.mp4',
    '/questionscreenimages/question5(biggestsquare-50)/q5intro.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q5intro.mp4',
    '/questionscreenimages/question1(findthemistake-90)/q1intro.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q1intro.mp4',
    '/questionscreenimages/question4(jessicanmandy-60)/q4intro.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q4intro.mp4',
    '/questionscreenimages/wrongrxns/qwrong1.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/qwrong1.mp4',
    '/questionscreenimages/question3(cardsnglasses-70)/q3intro.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q3intro.mp4',
    '/questionscreenimages/question2(gandhijirealornot-80)/q2intro.mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q2intro.mp4',
    '/new videos/bgvideo (1).mp4': 'https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/bgvideo (1).mp4',
}

def main():
    if not os.path.isdir("src"):
        print("ERROR: run this from your project root (C:\\Users\\rinne\\one-percent_club)")
        sys.exit(1)

    touched = 0
    replacements_total = 0
    for root, _, files in os.walk("src"):
        for fn in files:
            if not fn.endswith((".ts", ".tsx", ".js", ".jsx")):
                continue
            full = os.path.join(root, fn)
            with open(full, encoding="utf-8") as f:
                text = f.read()
            new_text = text
            file_replacements = 0
            for web_path, r2_url in WEB_PATH_TO_R2.items():
                # Match the web_path as a string literal in code (handle both
                # quoted and template-literal contexts).
                if web_path in new_text:
                    count = new_text.count(web_path)
                    new_text = new_text.replace(web_path, r2_url)
                    file_replacements += count
                    replacements_total += count
            if new_text != text:
                with open(full, "w", encoding="utf-8") as f:
                    f.write(new_text)
                print(f"  {full}: {file_replacements} replacements")
                touched += 1
    print(f"\nDone. Touched {touched} files, {replacements_total} total path replacements.")
    print("\nNext steps:")
    print("  1. Run: npx tsc --noEmit  (verify no type errors)")
    print("  2. Run: npm run dev  (smoke-test the deployed videos)")
    print("  3. Once verified, delete local /public/ mp4s:")
    print("       Get-Content .\\in_use_paths.txt | ForEach-Object {{ Remove-Item -Force .\\$_ }}")

if __name__ == "__main__":
    main()
