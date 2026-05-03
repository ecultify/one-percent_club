# CLEANUP_ORPHANS.PS1
# Deletes 48 video files that are NOT referenced anywhere in src/.
# Frees ~252 MB. Run from the project root.
#
# Originals are MOVED to .\video-orphans-backup\ so you can restore if you
# realise something is needed. Once you're sure, delete that folder too.

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
Set-Location $root

$backup = Join-Path $root 'video-orphans-backup'
New-Item -ItemType Directory -Force -Path $backup | Out-Null

$paths = @(
    'public\questionscreenimages\_audio_backup_pre_boost\1percentwrongmodified.mp4',
    'public\questionscreenimages\1percentfinalcorrect.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q8correct.mp4',
    'public\questionscreenimages\Website1Fa.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q8intro.mp4',
    'public\questionscreenimages\1F.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q7correct.mp4',
    'public\questionscreenimages\wrongrxns\1percent.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q2correct.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q4correct.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q3correct.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q1correct.mp4',
    'public\questionrxns\question1\q1introvid.mp4',
    'public\sound\q1introvid.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q7intro.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q6correct.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q6intro.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\qwrong2.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q5intro.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q1intro.mp4',
    'public\questionscreenimages\endingvo.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q5correct.mp4',
    'public\grok-video-bd299fdb-fbac-4b70-8311-aec74bdb45b1 (1).mp4',
    'public\welcome-video.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q4intro.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\qwrong1.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q3intro.mp4',
    'public\questionscreenimages\_audio_backup_pre_boost\q2intro.mp4',
    'public\questionrxns\question1\q1correctvid.mp4',
    'public\sound\q1correctvid.mp4',
    'public\hero-video.mp4',
    'public\new videos\grok-video-2db75c4a-3595-4624-807a-17386bd46541.mp4',
    'public\questionvideos\7thquestion.mp4',
    'public\questionvideos\8thquestion.mp4',
    'public\questionrxns\question1\q1wrongvid.mp4',
    'public\sound\q1wrongvid.mp4',
    'public\questionvideos\4thquestion.mp4',
    'public\questionvideos\3rdquestion.mp4',
    'public\questionvideos\1stquestion.mp4',
    'public\reaction-correct.mp4',
    'public\reactionanimations\grok-video-15e82535-30a8-435a-a691-a2c3beeeb735.mp4',
    'public\reaction-winner.mp4',
    'public\reactionanimations\grok-video-15e82535-30a8-435a-a691-a2c3beeeb735 (2).mp4',
    'public\reaction-wrong.mp4',
    'public\reactionanimations\grok-video-15e82535-30a8-435a-a691-a2c3beeeb735 (1).mp4',
    'public\questionvideos\5thquestion.mp4',
    'public\questionvideos\2ndquestion.mp4',
    'public\questionvideos\6thquestion.mp4'
)


$moved = 0
$skipped = 0
foreach ($p in $paths) {
    $full = Join-Path $root $p
    if (Test-Path $full) {
        # Preserve folder structure inside backup
        $relDir = Split-Path $p -Parent
        $destDir = Join-Path $backup $relDir
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        Move-Item -Force -Path $full -Destination (Join-Path $destDir (Split-Path $p -Leaf))
        Write-Host "  moved: $p"
        $moved++
    } else {
        Write-Host "  skipped (not found): $p"
        $skipped++
    }
}
Write-Host ""
Write-Host "Done. Moved $moved files to .\video-orphans-backup\ ($skipped skipped)."
Write-Host "If everything still works after testing, run:"
Write-Host "  Remove-Item -Recurse -Force .\video-orphans-backup"
