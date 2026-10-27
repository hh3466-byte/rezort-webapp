$batPath = Join-Path $PSScriptRoot "run_kobi_debt.bat"
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batPath`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date "2026-10-25 09:30:00")
Register-ScheduledTask -TaskName "ResortKobiDebtSunday0930" -Action $action -Trigger $trigger -Force
Write-Host "Task ResortKobiDebtSunday0930 registered successfully!"
