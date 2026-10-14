const fs = require('fs');
const path = require('path');

function addHourlyPing(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  if (!fs.existsSync(filePath)) return;
  let code = fs.readFileSync(filePath, 'utf8');

  const target = '// Motzei Shabbat handled independently';
  const addition = `// Motzei Shabbat handled independently

  // בדיקה יזומה וסנכרון תשלומים מול Grow בענן (בכל שעה - ללא עומס על Gmail)
  try {
    UrlFetchApp.fetch("https://rezort-webapp.vercel.app/api/cron-hourly-sync", {
      method: "get",
      muteHttpExceptions: true
    });
    Logger.log("✓ בדיקה יזומה מול Grow בענן הופעלה בהצלחה.");
  } catch (eSync) {
    Logger.log("הערה בסנכרון Grow בענן: " + eSync.toString());
  }`;

  if (code.includes(target) && !code.includes('cron-hourly-sync')) {
    code = code.replace(target, addition);
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('Added hourly cloud ping to:', fileName);
  } else {
    console.log('Already has ping or target not found in:', fileName);
  }
}

addHourlyPing('scripts/resort_mail_automation.js');
addHourlyPing('קוד_מאוחד_וואטסאפ_ומיילים.txt');
addHourlyPing('scripts/gmail_apps_script.js');
