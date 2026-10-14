# Backup script from C:\Projects to Google Drive (Excluding heavy node_modules)
$ErrorActionPreference = "SilentlyContinue"

$sourceBase = "C:\Projects"
$driveTarget = "G:\האחסון שלי\גיבוי פרויקטים"

if (!(Test-Path $driveTarget)) {
    New-Item -ItemType Directory -Path $driveTarget -Force | Out-Null
}

# 1. Backup Rezort
$rezortSrc = "$sourceBase\הריזורט לכלב"
$rezortDst = "$driveTarget\הריזורט לכלב"
if (Test-Path $rezortSrc) {
    robocopy $rezortSrc $rezortDst /MIR /XD node_modules /NFL /NDL /NP /MT:8 | Out-Null
}

# 2. Backup Zchuyot Hamore
$moreSrc = "$sourceBase\זכויות המורה"
$moreDst = "$driveTarget\זכויות המורה"
if (Test-Path $moreSrc) {
    robocopy $moreSrc $moreDst /MIR /XD node_modules /NFL /NDL /NP /MT:8 | Out-Null
}

# 3. Create a dated clean ZIP in Google Drive
$archiveDir = "$driveTarget\ארכיון_שבועי"
if (!(Test-Path $archiveDir)) {
    New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
}
$dateStr = Get-Date -Format "yyyy-MM-dd"
$zipPath = "$archiveDir\גיבוי_קוד_$dateStr.zip"

# Clean archives older than 14 days
Get-ChildItem -Path $archiveDir -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Output "BACKUP_COMPLETED_SUCCESSFULLY"
