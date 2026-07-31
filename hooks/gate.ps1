<#
taskcycle UserPromptSubmit hook -- restates the core essentials each turn, and surfaces the
active plan when the cycle is under way.

The full text injected by SessionStart (core.ps1) can be pushed out once a conversation grows
long, so this compresses the essentials and revives them every turn.

Repos without plans never hear about the cycle -- writing a plan is not a core requirement,
it is asked for only when the /plan command or the taskcycle skill is invoked.
#>
$ErrorActionPreference = 'SilentlyContinue'
# stdout goes out in the console code page, but hook output is read as UTF-8. Line them up.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$raw = [Console]::In.ReadToEnd()
$cwd = $null
try { $cwd = (ConvertFrom-Json $raw).cwd } catch { }
if (-not $cwd) { $cwd = (Get-Location).Path }

$lines = @('taskcycle: claims of done or passing rest on command output from this session only - stay inside the requested scope - stop and ask when blocked twice or when a destructive action is needed.')

$plansDir = Join-Path $cwd 'docs\plans'
if (Test-Path $plansDir) {
  $active = Get-ChildItem -Path $plansDir -Filter 'task_*.md' -File |
            Where-Object { $_.DirectoryName -notmatch '\\archives$' } |
            Select-Object -ExpandProperty Name
  if ($active.Count -gt 0) {
    $lines += "Active plan: $($active -join ', ') (docs/plans/) - if it is approved, carry the remaining steps through to completion unless a stop condition is hit. Do not seek approval again between steps."
  }
}

Write-Output ($lines -join "`n")
exit 0
