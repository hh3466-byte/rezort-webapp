Add-Type -AssemblyName System.Windows.Forms
$scriptPath = Join-Path $PSScriptRoot "gmail_apps_script.js"
$content = [System.IO.File]::ReadAllText($scriptPath, [System.Text.Encoding]::UTF8)
[System.Windows.Forms.Clipboard]::SetText($content)
Write-Host "COPIED_OK"
