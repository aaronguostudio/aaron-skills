# GitHub Windows runner setup only. A successful Chocolatey exit can mean 0/0
# packages after a feed error, so require both media tools to launch as well.
param(
    [ValidateRange(1, 3)][int]$Attempts = 3,
    [ValidateRange(0, 30)][int]$RetrySeconds = 5
)
$ErrorActionPreference = 'Stop'
for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    & choco install ffmpeg -y --no-progress
    $installExit = $LASTEXITCODE
    $ready = $installExit -in @(0, 1641, 3010)
    foreach ($tool in @('ffmpeg', 'ffprobe')) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            $ready = $false
            continue
        }
        & $tool -version
        if ($LASTEXITCODE -ne 0) { $ready = $false }
    }
    if ($ready) {
        Write-Output 'FFmpeg and ffprobe are ready.'
        exit 0
    }
    if ($attempt -lt $Attempts) {
        Write-Warning "Media setup attempt $attempt did not provide working ffmpeg and ffprobe; retrying."
        Start-Sleep -Seconds $RetrySeconds
    }
}
throw 'Windows media setup failed: both ffmpeg and ffprobe must run. No recording or sync tests were started.'
