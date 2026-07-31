<#
taskcycle Stop 훅 — 승인된 계획서가 아직 살아 있는데 턴을 끝내려 하면 한 번만 되묻는다.

설계 의도: "완주"를 강제하되 함정이 되지 않게 한다.
  - 세션당 최대 1회만 block. 그 뒤로는 항상 통과시킨다.
  - stop_hook_active(이미 이 훅 때문에 재개된 상태)면 통과시킨다.
  - 활성 계획서가 없으면 아무 것도 하지 않는다.
중단 조건에 해당해서 멈춘 것이라면 모델이 그 사유를 대고 그대로 끝내면 된다.
#>
$ErrorActionPreference = 'SilentlyContinue'

$raw = [Console]::In.ReadToEnd()
$in = $null
try { $in = ConvertFrom-Json $raw } catch { }

if ($in.stop_hook_active -eq $true) { exit 0 }

$cwd = $in.cwd
if (-not $cwd) { $cwd = (Get-Location).Path }

$plansDir = Join-Path $cwd 'docs\plans'
if (-not (Test-Path $plansDir)) { exit 0 }

$active = Get-ChildItem -Path $plansDir -Filter 'task_*.md' -File |
          Where-Object { $_.DirectoryName -notmatch '\\archives$' }
if ($active.Count -eq 0) { exit 0 }

# 세션당 1회 제한 — 리포지토리를 더럽히지 않도록 TEMP에 마커를 둔다.
$sid = $in.session_id
if (-not $sid) { $sid = 'nosession' }
$markerDir = Join-Path $env:TEMP 'taskcycle'
if (-not (Test-Path $markerDir)) { New-Item -ItemType Directory -Path $markerDir -Force | Out-Null }
$marker = Join-Path $markerDir "$sid.stop"
if (Test-Path $marker) { exit 0 }
New-Item -ItemType File -Path $marker -Force | Out-Null

$names = ($active | Select-Object -ExpandProperty Name) -join ', '
$reason = @"
활성 계획서가 남아 있습니다: $names

계획서의 남은 단계가 끝나지 않았다면 승인을 다시 받지 말고 이어서 진행하세요.
이미 끝났다면 최종 보고를 하세요: 각 단계의 검증 근거 제시 → HANDOFF.md 갱신 →
계획서를 docs/plans/archives/ 로 이동 → 커밋. 완료 판정은 사용자가 합니다.

중단 조건(범위 이탈 / 적대 리뷰 지적 / 품질 관문 2회 실패 / 블로커 / 파괴적 작업)에
해당해서 멈춘 것이라면, 어느 조건인지 밝히고 그대로 종료하세요.
(이 확인은 세션당 한 번만 나옵니다.)
"@

$out = @{ decision = 'block'; reason = $reason } | ConvertTo-Json -Compress
[Console]::Out.Write($out)
exit 0
