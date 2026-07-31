<#
taskcycle UserPromptSubmit 훅 — 활성 계획서를 컨텍스트에 다시 올리고 불변 규칙을 상기시킨다.
stdout으로 출력한 텍스트가 모델의 컨텍스트에 추가된다.
운영 블록 전문은 CLAUDE.md에 있으므로 여기서는 짧게만 유지한다.
#>
$ErrorActionPreference = 'SilentlyContinue'

$raw = [Console]::In.ReadToEnd()
$cwd = $null
try { $cwd = (ConvertFrom-Json $raw).cwd } catch { }
if (-not $cwd) { $cwd = (Get-Location).Path }

$plansDir = Join-Path $cwd 'docs\plans'
$active = @()
if (Test-Path $plansDir) {
  $active = Get-ChildItem -Path $plansDir -Filter 'task_*.md' -File |
            Where-Object { $_.DirectoryName -notmatch '\\archives$' } |
            Select-Object -ExpandProperty Name
}

$lines = @('taskcycle: 승인 대기 지점은 계획서 승인과 중단 조건 두 곳뿐이다. 완료·통과 주장은 이번 세션의 실행 결과를 근거로만 한다.')

if ($active.Count -gt 0) {
  $lines += "활성 계획서: $($active -join ', ') (docs/plans/) — 승인되었다면 남은 단계를 중단 조건에 걸리지 않는 한 끝까지 진행한다."
} else {
  $lines += '활성 계획서 없음 — 유의미한 작업이면 docs/plans/task_NNN.md 를 먼저 쓰고 승인을 받는다. 오타·한 줄 변경 수준은 예외.'
}

Write-Output ($lines -join "`n")
exit 0
