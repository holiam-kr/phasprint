<#
taskcycle setup — 계획서 사이클 블록을 CLAUDE.md에 주입한다 (멱등, 백업 생성).

**대부분의 경우 이 스크립트는 필요 없다.**
  - core 규칙(증거·범위·판정·멈춤·디버깅·격리)은 플러그인 설치만으로 SessionStart 훅이 주입한다.
  - 계획서 사이클은 /plan 커맨드나 taskcycle 스킬을 부를 때 로드된다.

이 스크립트가 필요한 경우는 하나뿐이다: **팀 공유.**
프로젝트 CLAUDE.md에 사이클 블록을 커밋해 두면, 플러그인을 설치하지 않은 팀원의
세션에도 사이클 규칙이 적용된다.

사용법:
  setup.ps1 [local|global]   local  = ./CLAUDE.md (기본, 권장 — 리포에 커밋)
                             global = ~/.claude/CLAUDE.md (모든 프로젝트에 사이클 강제. 비권장)
  setup.ps1 -Agents          위와 함께 ./AGENTS.md 에도 주입
#>
[CmdletBinding()]
param(
  [ValidateSet('local', 'global', '')]
  [string]$Scope = '',
  [switch]$Agents
)

$ErrorActionPreference = 'Stop'

$Root = $env:CLAUDE_PLUGIN_ROOT
if (-not $Root) { $Root = Split-Path -Parent $PSScriptRoot }
$BlockTpl = Join-Path $Root 'setup\taskcycle-block.md'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path $BlockTpl)) {
  Write-Output "taskcycle: 블록 템플릿을 찾을 수 없습니다 ($BlockTpl)"
  exit 1
}

if (-not $Scope) {
  $ans = Read-Host 'taskcycle - 운영 블록을 주입할 위치: [l]ocal (이 프로젝트, 권장) / [g]lobal (모든 프로젝트)'
  if ($ans -match '^[gG]') { $Scope = 'global' } else { $Scope = 'local' }
}

$targets = @()
switch ($Scope) {
  'global' { $targets += (Join-Path $env:USERPROFILE '.claude\CLAUDE.md') }
  'local'  { $targets += (Join-Path (Get-Location).Path 'CLAUDE.md') }
}
if ($Agents) { $targets += (Join-Path (Get-Location).Path 'AGENTS.md') }

$block = [System.IO.File]::ReadAllText($BlockTpl, [System.Text.Encoding]::UTF8).Trim().Replace('__PLUGIN_ROOT__', $Root)

foreach ($md in $targets) {
  $dir = Split-Path -Parent $md
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if (-not (Test-Path $md)) { New-Item -ItemType File -Path $md | Out-Null }

  $ts = [int][double]::Parse((Get-Date -UFormat %s))
  $bak = "$md.taskcycle-bak.$ts"
  Copy-Item $md $bak -Force

  # 기존 마커를 제거한 뒤 다시 넣는다 (멱등).
  $cur = [System.IO.File]::ReadAllText($md, [System.Text.Encoding]::UTF8)
  $cur = [regex]::Replace($cur, '<!-- TASKCYCLE:BEGIN.*?TASKCYCLE:END -->\r?\n?', '', 'Singleline').TrimEnd()
  if ($cur) { $out = $cur + "`r`n`r`n" + $block + "`r`n" } else { $out = $block + "`r`n" }
  [System.IO.File]::WriteAllText($md, $out, $Utf8NoBom)

  Write-Output "  [ok] $md  (백업: $bak)"
}

Write-Output ""
Write-Output "taskcycle 사이클 블록 주입 완료 ($Scope) - 다음 세션부터 적용됩니다."
Write-Output "  제거: powershell -ExecutionPolicy Bypass -File `"$Root\setup\uninstall.ps1`" $Scope"
Write-Output ""
Write-Output "  참고: core 규칙은 이 블록에 없습니다. 플러그인 설치 시 SessionStart 훅이 자동 주입합니다."
Write-Output "        이 블록은 플러그인을 설치하지 않은 팀원과 사이클 규칙을 공유하기 위한 것입니다."
Write-Output ""
Write-Output "  주의: taskcycle은 fablize / superpowers를 대체하도록 설계되었습니다."
Write-Output "        두 플러그인이 켜져 있으면 /plugin 에서 비활성화하고, CLAUDE.md에 남아 있는"
Write-Output "        FABLIZE 블록은 fablize의 uninstall 스크립트로 제거하세요."
