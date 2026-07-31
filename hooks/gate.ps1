<#
taskcycle UserPromptSubmit 훅 — 매 턴 core 요약을 다시 넣고, 사이클 진행 중이면 활성 계획서를 올린다.

SessionStart(core.ps1)가 넣은 전문은 대화가 길어지면 압축으로 밀려날 수 있으므로
여기서 핵심만 압축해 매 턴 되살린다.

계획서가 없는 리포에서는 사이클을 언급하지 않는다 — 계획서 작성은 core가 아니라
/plan 커맨드나 taskcycle 스킬이 호출될 때만 요구된다.
#>
$ErrorActionPreference = 'SilentlyContinue'
# stdout 은 콘솔 코드페이지(한국어 Windows 는 CP949)로 나가는데 훅 출력은 UTF-8 로 읽힌다. 맞춰 준다.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$raw = [Console]::In.ReadToEnd()
$cwd = $null
try { $cwd = (ConvertFrom-Json $raw).cwd } catch { }
if (-not $cwd) { $cwd = (Get-Location).Path }

$lines = @('taskcycle: 완료·통과 주장은 이번 세션의 실행 결과를 근거로만 한다 · 요청 범위 밖은 건드리지 않는다 · 2회 막히거나 파괴적 작업이 필요하면 멈추고 묻는다.')

$plansDir = Join-Path $cwd 'docs\plans'
if (Test-Path $plansDir) {
  $active = Get-ChildItem -Path $plansDir -Filter 'task_*.md' -File |
            Where-Object { $_.DirectoryName -notmatch '\\archives$' } |
            Select-Object -ExpandProperty Name
  if ($active.Count -gt 0) {
    $lines += "활성 계획서: $($active -join ', ') (docs/plans/) — 승인되었다면 남은 단계를 중단 조건에 걸리지 않는 한 끝까지 진행한다. 단계 사이에서 승인을 다시 받지 않는다."
  }
}

Write-Output ($lines -join "`n")
exit 0
