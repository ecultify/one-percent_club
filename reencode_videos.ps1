# REENCODE_VIDEOS.PS1
# Re-encodes 31 in-use videos at CRF 20 (visually transparent — same as the
# teaser we already shipped). Adds faststart for fast playback start.
# Saves originals to .\video-encode-backup\ before overwriting.
#
# Expected runtime: 15-45 min depending on CPU.
# Expected total size after: ~150 MB (down from 341 MB).

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
Set-Location $root

# Verify ffmpeg is on PATH
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: ffmpeg not found on PATH. Install ffmpeg first." -ForegroundColor Red
    exit 1
}

$backup = Join-Path $root 'video-encode-backup'
New-Item -ItemType Directory -Force -Path $backup | Out-Null

$paths = @(
    'public\questionscreenimages\wrongrxns\1percentwrongmodified.mp4',
    'public\questionscreenimages\FullVIDF2.mp4',
    'public\teaser-video.mp4',
    'public\questionscreenimages\question10(onepercent-1)\q10intro.mp4',
    'public\questionscreenimages\endingvoifallcorrect.mp4',
    'public\questionscreenimages\endvoifevenonewrong.mp4',
    'public\homepagevideo.mp4',
    'public\new videos\scrollvideo.mp4',
    'public\questionscreenimages\question10(onepercent-1)\q10correct.mp4',
    'public\questionscreenimages\LastVid2.mp4',
    'public\questionscreenimages\question6(4transports-40)\q6intro.mp4',
    'public\questionscreenimages\question4(jessicanmandy-60)\q4_new_sequence_yes.mp4',
    'public\questionscreenimages\question9(number1to6-10)\q9_new_sequence_yes.mp4',
    'public\questionscreenimages\question3(cardsnglasses-70)\q3_new_sequence_yes.mp4',
    'public\questionscreenimages\question2(gandhijirealornot-80)\q2_new_sequence_yes.mp4',
    'public\questionscreenimages\question5(biggestsquare-50)\q5correct.mp4',
    'public\questionscreenimages\question6(4transports-40)\q6_new_sequence_yes.mp4',
    'public\questionscreenimages\question8(gymnast-20)\q8intro.mp4',
    'public\questionscreenimages\question7(earthnmars-30)\q7correct.mp4',
    'public\questionscreenimages\question1(findthemistake-90)\q1correct.mp4',
    'public\questionscreenimages\question9(number1to6-10)\q9intro.mp4',
    'public\questionscreenimages\question7(earthnmars-30)\q7intro.mp4',
    'public\questionscreenimages\wrongrxns\qwrong2.mp4',
    'public\questionscreenimages\question8(gymnast-20)\q8_new_sequence_yes.mp4',
    'public\questionscreenimages\question5(biggestsquare-50)\q5intro.mp4',
    'public\questionscreenimages\question1(findthemistake-90)\q1intro.mp4',
    'public\questionscreenimages\question4(jessicanmandy-60)\q4intro.mp4',
    'public\questionscreenimages\wrongrxns\qwrong1.mp4',
    'public\questionscreenimages\question3(cardsnglasses-70)\q3intro.mp4',
    'public\questionscreenimages\question2(gandhijirealornot-80)\q2intro.mp4',
    'public\new videos\bgvideo (1).mp4'
)


$success = 0
$failed = 0
$totalBefore = 0
$totalAfter = 0
$i = 0
foreach ($p in $paths) {
    $i++
    $full = Join-Path $root $p
    if (-not (Test-Path $full)) {
        Write-Host "[$i/$($paths.Count)] SKIP (not found): $p" -ForegroundColor Yellow
        continue
    }
    $sizeBefore = (Get-Item $full).Length
    $totalBefore += $sizeBefore
    $sizeBeforeMB = [Math]::Round($sizeBefore/1MB, 1)
    Write-Host "[$i/$($paths.Count)] $p ($sizeBeforeMB MB)" -ForegroundColor Cyan

    # Backup original (preserve folder structure)
    $relDir = Split-Path $p -Parent
    $destDir = Join-Path $backup $relDir
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    $backupFile = Join-Path $destDir (Split-Path $p -Leaf)
    if (-not (Test-Path $backupFile)) {
        Copy-Item -Path $full -Destination $backupFile
    }

    $tmp = "$full.tmp.mp4"
    & ffmpeg -y -i $full -c:v libx264 -profile:v high -level 4.0 -preset slow -crf 20 -movflags +faststart -pix_fmt yuv420p -c:a aac -b:a 128k $tmp 2>&1 | Out-Null

    if ($LASTEXITCODE -eq 0 -and (Test-Path $tmp)) {
        Remove-Item -Force $full
        Move-Item -Force $tmp $full
        $sizeAfter = (Get-Item $full).Length
        $totalAfter += $sizeAfter
        $sizeAfterMB = [Math]::Round($sizeAfter/1MB, 1)
        $pct = [Math]::Round(($sizeBefore - $sizeAfter) / $sizeBefore * 100, 0)
        Write-Host "    -> $sizeAfterMB MB (-$pct%)" -ForegroundColor Green
        $success++
    } else {
        Write-Host "    FAILED, original kept" -ForegroundColor Red
        Remove-Item -Force $tmp -ErrorAction SilentlyContinue
        $totalAfter += $sizeBefore
        $failed++
    }
}

Write-Host ""
Write-Host "===== DONE =====" -ForegroundColor Cyan
Write-Host "Re-encoded: $success files"
Write-Host "Failed:     $failed files"
Write-Host "Before: $([Math]::Round($totalBefore/1MB,1)) MB"
Write-Host "After:  $([Math]::Round($totalAfter/1MB,1)) MB"
Write-Host "Saved:  $([Math]::Round(($totalBefore - $totalAfter)/1MB,1)) MB"
Write-Host ""
Write-Host "Originals are in .\video-encode-backup\"
Write-Host "Test the videos in browser, then if happy:"
Write-Host "  Remove-Item -Recurse -Force .\video-encode-backup"
