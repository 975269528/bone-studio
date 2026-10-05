<#
.SYNOPSIS
Publishes the validated Windows executable from a trusted GitHub Actions run.
.DESCRIPTION
Requires GitHub run metadata and GH_TOKEN. Creates a unique draft, verifies the
uploaded asset, then publishes it as latest. Failures leave the draft for review.
#>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-GitHubCli {
    <#
    .SYNOPSIS
    Runs GitHub CLI arguments and returns stdout; a nonzero exit fails the run.
    #>
    param([string[]] $CliArguments)
    $commandOutput = & gh @CliArguments
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub CLI $($CliArguments[0]) $($CliArguments[1]) failed (exit $LASTEXITCODE)."
    }
    return $commandOutput
}

foreach ($variableName in @('GH_TOKEN', 'GH_REPO', 'GITHUB_SHA', 'GITHUB_RUN_NUMBER', 'GITHUB_RUN_ATTEMPT', 'GITHUB_RUN_ID', 'RUNNER_TEMP')) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($variableName))) {
        throw "Required release environment variable is missing: $variableName."
    }
}
if ($env:GITHUB_EVENT_NAME -notin @('push', 'workflow_dispatch') -or $env:GITHUB_REF -notin @('refs/heads/main', 'refs/heads/master')) {
    throw 'Releases require a main/master push or manual workflow run.'
}
if ($env:GH_REPO -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' -or $env:GITHUB_SHA -notmatch '^[0-9a-f]{40}$') {
    throw 'Release repository or commit metadata is invalid.'
}
foreach ($runValue in @($env:GITHUB_RUN_NUMBER, $env:GITHUB_RUN_ATTEMPT, $env:GITHUB_RUN_ID)) {
    if ($runValue -notmatch '^[1-9][0-9]*$') { throw 'Release run metadata must be positive integers.' }
}
$packageVersion = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
if ($packageVersion -notmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') {
    throw 'package.json version must be a valid release version.'
}
$executable = Get-Item -LiteralPath 'release/BoneStudio.exe'
if ($executable.PSIsContainer -or $executable.Length -eq 0) {
    throw 'Release executable must be a nonempty file: release/BoneStudio.exe.'
}
$releaseTag = "v$packageVersion-build.$($env:GITHUB_RUN_NUMBER).$($env:GITHUB_RUN_ATTEMPT)"
$releaseTitle = "BoneStudio $packageVersion · Windows 便携版（构建 $($env:GITHUB_RUN_NUMBER).$($env:GITHUB_RUN_ATTEMPT)）"
$checksum = (Get-FileHash -LiteralPath $executable.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$repositoryUrl = "https://github.com/$($env:GH_REPO)"
$runUrl = "$repositoryUrl/actions/runs/$($env:GITHUB_RUN_ID)"
$notesPath = Join-Path $env:RUNNER_TEMP "bone-studio-release-$($env:GITHUB_RUN_ID)-$($env:GITHUB_RUN_ATTEMPT).md"
$releaseNotes = @"
Windows x64 便携版：下载附件 BoneStudio.exe 后直接双击启动，无需安装 Node.js。

- 应用版本：$packageVersion
- 源码提交：[$($env:GITHUB_SHA)]($repositoryUrl/commit/$($env:GITHUB_SHA))
- 构建记录：[$($env:GITHUB_RUN_NUMBER).$($env:GITHUB_RUN_ATTEMPT)]($runUrl)
- 本次构建已通过 lint、单元测试、MCP 桥接校验及真实 EXE 打包验收。
- 仅外部 AI / MCP 接入需要 Node.js 22.12 或更高版本；当前 EXE 未签名。
- SHA-256：$checksum

[下载最新 Windows 便携版]($repositoryUrl/releases/latest/download/BoneStudio.exe)
"@
Set-Content -LiteralPath $notesPath -Value $releaseNotes -Encoding utf8

Invoke-GitHubCli @('release', 'create', $releaseTag, '--target', $env:GITHUB_SHA, '--draft', '--title', $releaseTitle, '--notes-file', $notesPath)
Invoke-GitHubCli @('release', 'upload', $releaseTag, $executable.FullName)
$draft = (Invoke-GitHubCli @('release', 'view', $releaseTag, '--json', 'isDraft,assets') | Out-String | ConvertFrom-Json)
$uploadedAssets = @($draft.assets | Where-Object { $_.name -eq 'BoneStudio.exe' })
if (-not $draft.isDraft -or $uploadedAssets.Count -ne 1 -or $uploadedAssets[0].size -ne $executable.Length) {
    throw 'Draft release asset verification failed; the release was not published.'
}
Invoke-GitHubCli @('release', 'edit', $releaseTag, '--draft=false', '--latest')
$published = (Invoke-GitHubCli @('release', 'view', $releaseTag, '--json', 'isDraft,url') | Out-String | ConvertFrom-Json)
if ($published.isDraft) { throw 'The release is still a draft after publishing.' }
Write-Output "Published release: $($published.url)"
if ($env:GITHUB_STEP_SUMMARY) {
    Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value "已发布 [$releaseTitle]($($published.url))。`n`n[下载 BoneStudio.exe]($repositoryUrl/releases/latest/download/BoneStudio.exe)" -Encoding utf8
}
