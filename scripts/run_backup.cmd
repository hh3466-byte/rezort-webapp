@echo off
chcp 65001 >nul
echo ==============================================
echo   מגבה פרויקטים מ-C ל-Google Drive (ענן)...
echo ==============================================
"C:\Program Files\nodejs\node.exe" "%~dp0backup_to_drive.cjs"
echo.
echo הגיבוי הושלם בהצלחה!
timeout /t 3
