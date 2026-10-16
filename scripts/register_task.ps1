$batPath = Join-Path $PSScriptRoot "run_niva_reassurance.bat"
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batPath`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date "2026-10-18 11:00:00")
Register-ScheduledTask -TaskName "ResortNivaSunday1100" -Action $action -Trigger $trigger -Force
