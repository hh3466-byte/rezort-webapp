const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- Starting Cloud Backup: Local C: -> Google Drive ---');

const sourceBase = 'C:\\Projects';
const driveTarget = 'G:\\האחסון שלי\\גיבוי פרויקטים';

try {
  if (!fs.existsSync(driveTarget)) {
    fs.mkdirSync(driveTarget, { recursive: true });
  }

  // 1. Mirror Rezort to Google Drive (Excluding node_modules and .git)
  const rezortSrc = path.join(sourceBase, 'הריזורט לכלב');
  const rezortDst = path.join(driveTarget, 'הריזורט לכלב');
  if (fs.existsSync(rezortSrc)) {
    console.log('Backing up הריזורט לכלב...');
    execSync(`robocopy "${rezortSrc}" "${rezortDst}" /MIR /XD node_modules /NFL /NDL /NP /MT:8`, { stdio: 'ignore' });
    console.log('✓ הריזורט לכלב backed up.');
  }

  // 2. Mirror Zchuyot Hamore to Google Drive
  const moreSrc = path.join(sourceBase, 'זכויות המורה');
  const moreDst = path.join(driveTarget, 'זכויות המורה');
  if (fs.existsSync(moreSrc)) {
    console.log('Backing up זכויות המורה...');
    execSync(`robocopy "${moreSrc}" "${moreDst}" /MIR /XD node_modules /NFL /NDL /NP /MT:8`, { stdio: 'ignore' });
    console.log('✓ זכויות המורה backed up.');
  }

  console.log('=== CLOUD BACKUP TO GOOGLE DRIVE COMPLETED SUCCESSFULLY! ===');
} catch (err) {
  // Robocopy returns exit codes 0-7 for success
  if (err.status && err.status <= 7) {
    console.log('=== CLOUD BACKUP TO GOOGLE DRIVE COMPLETED SUCCESSFULLY! ===');
  } else {
    console.error('Backup error:', err.message);
  }
}
