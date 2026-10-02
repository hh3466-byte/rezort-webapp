const fs = require('fs');

const eveningReport = fs.readFileSync('api/cron-evening-report.js', 'utf8');
const sanityCheck = fs.readFileSync('api/cron-sanity-check.js', 'utf8');

console.log('--- Evening Report lines mentioning room/kennel/red lights ---');
eveningReport.split('\n').forEach((line, idx) => {
  if (line.includes('kennel') || line.includes('חדר') || line.includes('סוויטה') || line.includes('אורות אדומים') || line.includes('תפוסה') || line.includes('ללא שיבוץ') || line.includes('0/16')) {
    console.log(`[L${idx+1}] ${line.trim()}`);
  }
});

console.log('\n--- Sanity Check lines mentioning room/kennel/red lights ---');
sanityCheck.split('\n').forEach((line, idx) => {
  if (line.includes('kennel') || line.includes('חדר') || line.includes('סוויטה') || line.includes('אורות אדומים') || line.includes('תפוסה') || line.includes('ללא שיבוץ') || line.includes('0/16')) {
    console.log(`[L${idx+1}] ${line.trim()}`);
  }
});
