const fs = require('fs');
const path = require('path');

function updateScript(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  if (!fs.existsSync(filePath)) {
    console.log('Not found:', filePath);
    return;
  }
  let code = fs.readFileSync(filePath, 'utf8');

  // 1. Replace Green API URLs
  const beforeCount = (code.match(/api\.green-api\.com/g) || []).length;
  code = code.replace(/api\.green-api\.com/g, '7107.api.greenapi.com');
  const afterCount = (code.match(/7107\.api\.greenapi\.com/g) || []).length;
  console.log(fileName, 'Replaced Green API URLs:', beforeCount, '->', afterCount);

  // 2. Safe processResortEmails query with is:unread and max 5
  code = code.replace(
    /var query = ['"].*?(from:grow.*?)['"];\s*var foundThreads = GmailApp\.search\(query, 0, \d+\);/g,
    'var query = \'is:unread in:inbox (from:grow OR from:meshulam OR from:morning OR from:greeninvoice OR "הריזורט לכלב" OR "יניב אלעד")\';\n    var foundThreads = GmailApp.search(query, 0, 5);'
  );

  // 3. Remove checkAndTriggerMotzeiShabbatDogUpdates from processResortEmails
  code = code.replace(/try\s*\{\s*checkAndTriggerMotzeiShabbatDogUpdates\(\);\s*\}\s*catch\s*\(eM\)\s*\{\}/g, '// Motzei Shabbat handled independently');

  // 4. Update setupDailyDogEveningTrigger to include safe hourly trigger for processResortEmails
  if (!code.includes('setupAllTriggersSafely')) {
    const triggerHelper = `
/**
 * הגדרת כל הטריגרים האוטומטיים בצורה בטוחה והרמטית (בלחיצה אחת):
 * 1. בדיקת מיילים ומחיקה בלבד - פעם בשעה בלבד (24 פעמים ביום בסך הכל - 0% סיכוי לחריגת מכסות)
 * 2. 19:00 - סקירת מחר (גיבוי) + בקשת חוות דעת
 * 3. 20:00 - עדכון ערב יומי לכלבי הריזורט (גיבוי)
 */
function setupAllTriggersSafely() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  ScriptApp.newTrigger("processResortEmails")
    .timeBased()
    .everyHours(1)
    .create();

  ScriptApp.newTrigger("sendTomorrowOverviewToShmulikFromCloud")
    .timeBased()
    .everyDays(1)
    .atHour(19)
    .inTimezone("Asia/Jerusalem")
    .create();

  ScriptApp.newTrigger("sendDayAfterDepartureReviewRequests")
    .timeBased()
    .everyDays(1)
    .atHour(19)
    .inTimezone("Asia/Jerusalem")
    .create();

  ScriptApp.newTrigger("sendDailyDogEveningUpdates")
    .timeBased()
    .everyDays(1)
    .atHour(20)
    .inTimezone("Asia/Jerusalem")
    .create();

  Logger.log("כל הטריגרים הוגדרו בצורה נעולה ומאובטחת ללא עומס על Gmail וללא חריגת מכסות!");
}
`;
    code += '\n' + triggerHelper;
  }

  fs.writeFileSync(filePath, code, 'utf8');
}

updateScript('scripts/resort_mail_automation.js');
updateScript('קוד_מאוחד_וואטסאפ_ומיילים.txt');
updateScript('scripts/gmail_apps_script.js');
console.log('Update finished.');
