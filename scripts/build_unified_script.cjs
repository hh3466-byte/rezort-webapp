const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.resolve(__dirname, '..');

// 1. Read the complete, canonical automation code
const canonicalPath = path.join(__dirname, 'resort_mail_automation.js');
const fullCode = fs.readFileSync(canonicalPath, 'utf8').trim();

// 2. Validate JavaScript syntax
try {
  new Function(fullCode);
  console.log('✓ Syntax validation PASSED! 0 errors.');
} catch (err) {
  console.error('✗ Syntax validation FAILED:', err);
  process.exit(1);
}

// 3. Extract WhatsApp-only code (from doPost onwards)
const doPostIndex = fullCode.indexOf('function doPost(');
const waCodeOnly = doPostIndex !== -1 ? fullCode.substring(doPostIndex) : fullCode;

// 4. Write to all target files
const unifiedPath = path.join(projectDir, 'קוד_מאוחד_וואטסאפ_ומיילים.txt');
const appsScriptPath = path.join(projectDir, 'scripts', 'gmail_apps_script.js');
const waPath = path.join(projectDir, 'קוד_וואטסאפ_בלבד.txt');

fs.writeFileSync(unifiedPath, fullCode, 'utf8');
fs.writeFileSync(appsScriptPath, fullCode, 'utf8');
fs.writeFileSync(waPath, waCodeOnly, 'utf8');

console.log('✓ Successfully written clean scripts to:');
console.log('  -', unifiedPath);
console.log('  -', appsScriptPath);
console.log('  -', waPath);
console.log('Total characters:', fullCode.length);
console.log('Total lines:', fullCode.split('\n').length);

// 5. Copy unified script to Windows clipboard
try {
  execSync('powershell.exe -NoProfile -Command "Get-Content -Path \'' + unifiedPath + '\' -Raw -Encoding utf8 | Set-Clipboard"');
  console.log('✓ Script successfully copied to Windows Clipboard!');
} catch (clipErr) {
  console.log('Notice: Could not auto-copy to clipboard:', clipErr.message);
}
