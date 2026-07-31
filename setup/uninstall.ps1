<#
taskcycle uninstall — CLAUDE.md / AGENTS.md 에서 운영 블록을 제거한다 (멱등).
훅은 플러그인을 제거하면 함께 사라진다.

사용법: uninstall.ps1 [local|global] [-Agents]
#>
[CmdletBinding()]
param(
  [ValidateSet('local', 'global', '')]
  [string]$Scope = '',
  [switch]$Agents
)

$ErrorActionPreference = 'Stop'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not $Scope) {
  $ans = Read-Host 'taskcycle - 운영 블록을 제거할 위치: [l]ocal / [g]lobal'
  if ($ans -match '^[gG]') { $Scope = 'global' } else { $Scope = 'local' }
}

$targets = @()
switch ($Scope) {
  'global' { $targets += (Join-Path $env:USERPROFILE '.claude\CLAUDE.md') }
  'local'  { $targets += (Join-Path (Get-Location).Path 'CLAUDE.md') }
}
if ($Agents) { $targets += (Join-Path (Get-Location).Path 'AGENTS.md') }

foreach ($md in $targets) {
  if (-not (Test-Path $md)) {
    Write-Output "  = $md 없음 - 건너뜀"
    continue
  }
  $cur = [System.IO.File]::ReadAllText($md, [System.Text.Encoding]::UTF8)
  $new = [regex]::Replace($cur, '(\r?\n)*<!-- TASKCYCLE:BEGIN.*?TASKCYCLE:END -->\r?\n?', "`r`n", 'Singleline')
  [System.IO.File]::WriteAllText($md, $new, $Utf8NoBom)
  if ($new -ne $cur) { Write-Output "  [ok] $md 에서 블록 제거" }
  else { Write-Output "  = $md 에 블록 없음 (이미 제거됨)" }
}

Write-Output ""
Write-Output "taskcycle uninstall 완료 ($Scope)."
Write-Output "  백업(*.taskcycle-bak.*)은 필요 없으면 직접 삭제하세요."
