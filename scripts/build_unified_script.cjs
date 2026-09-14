const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.resolve(__dirname, '..');

// 1. Read mail automation code
const mailScriptPath = path.join(__dirname, 'resort_mail_automation.js');
const mailCode = fs.readFileSync(mailScriptPath, 'utf8');

// 2. Read WhatsApp code (extract from function doPost onwards)
const waPath = path.join(projectDir, 'קוד_וואטסאפ_בלבד.txt');
const waContent = fs.readFileSync(waPath, 'utf8');

const doPostIndex = waContent.indexOf('function doPost(');
if (doPostIndex === -1) {
  console.error('Could not find function doPost in WhatsApp script!');
  process.exit(1);
}
const waCodeOnly = waContent.substring(doPostIndex);

// 3. Combine into unified script
const fullCode = mailCode.trim() + '\n\n' +
`/**
 * =========================================================================
 * חלק ב': בוט וואטסאפ חכם (Green-API), הודעות יומיות ב-20:00 ושאלון קליטה
 * =========================================================================
 */\n` + waCodeOnly.trim();

// 4. Validate JavaScript syntax
try {
  new Function(fullCode);
  console.log('✓ Syntax validation PASSED! 0 errors.');
} catch (err) {
  console.error('✗ Syntax validation FAILED:', err);
  process.exit(1);
}

// 5. Write to all target files
const unifiedPath = path.join(projectDir, 'קוד_מאוחד_וואטסאפ_ומיילים.txt');
const appsScriptPath = path.join(projectDir, 'scripts', 'gmail_apps_script.js');

fs.writeFileSync(unifiedPath, fullCode, 'utf8');
fs.writeFileSync(appsScriptPath, fullCode, 'utf8');
fs.writeFileSync(waPath, fullCode, 'utf8');

console.log('✓ Successfully written to:');
console.log('  -', unifiedPath);
console.log('  -', appsScriptPath);
console.log('  -', waPath);
console.log('Total characters:', fullCode.length);
console.log('Total lines:', fullCode.split('\n').length);

// 6. Copy to Windows clipboard via PowerShell
try {
  execSync('powershell.exe -NoProfile -Command "Get-Content -Path \'' + unifiedPath + '\' -Raw -Encoding utf8 | Set-Clipboard"');
  console.log('✓ Script successfully copied to Windows Clipboard!');
} catch (clipErr) {
  console.log('Notice: Could not auto-copy to clipboard:', clipErr.message);
}
