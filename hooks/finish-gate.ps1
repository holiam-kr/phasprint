<#
taskcycle Stop hook -- asks back once when a turn ends while an approved plan is still open.

Design intent: push toward completion without becoming a trap.
  - Blocks at most once per session. It passes through every time after that.
  - Passes through when stop_hook_active is set (the turn already resumed because of this hook).
  - Does nothing at all when there is no active plan.
If the model stopped because of a stop condition, it states which one and ends the turn.
#>
$ErrorActionPreference = 'SilentlyContinue'
# stdout goes out in the console code page, but hook output is read as UTF-8. Line them up.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

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

# Once per session -- keep the marker in TEMP so the repository stays clean.
$sid = $in.session_id
if (-not $sid) { $sid = 'nosession' }
$markerDir = Join-Path $env:TEMP 'taskcycle'
if (-not (Test-Path $markerDir)) { New-Item -ItemType Directory -Path $markerDir -Force | Out-Null }
$marker = Join-Path $markerDir "$sid.stop"
if (Test-Path $marker) { exit 0 }
New-Item -ItemType File -Path $marker -Force | Out-Null

$names = ($active | Select-Object -ExpandProperty Name) -join ', '
$reason = @"
An active plan is still open: $names

If the plan has steps left, continue without seeking approval again.
If it is finished, give the final report: present verification evidence for each step ->
update HANDOFF.md -> move the plan to docs/plans/archives/ -> commit. The user decides completion.

If you stopped because of a stop condition (scope departure / adversarial-review finding /
quality gate failing twice / blocker / destructive action), say which one and end the turn.
(This check appears only once per session.)
"@

$out = @{ decision = 'block'; reason = $reason } | ConvertTo-Json -Compress
[Console]::Out.Write($out)
exit 0
