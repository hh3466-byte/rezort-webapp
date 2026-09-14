const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'gmail_apps_script.js');
let content = fs.readFileSync(targetPath, 'utf8');

const targetStr = `      var bookingKey = "review_request_sent_" + b.id;
      if (scriptProperties.getProperty(bookingKey)) continue;

      var ownerName = b.owner_name || "לקוח יקר";`;

const replacementStr = `      var bookingKey = "review_request_sent_" + b.id;
      if (scriptProperties.getProperty(bookingKey)) continue;

      // בדיקה האם בוטלה שליחת בקשת חוות דעת (למשל: בעל הכלב לא הסתדר איתנו)
      var bkData = {};
      try {
        if (b.data) {
          bkData = (typeof b.data === "string") ? JSON.parse(b.data) : b.data;
        }
      } catch (eData) {}

      if (b.skip_review_request === true || bkData.skipReviewRequest === true || (b.notes && b.notes.indexOf("ללא_סקר") !== -1)) {
        Logger.log("דילוג על בקשת חוות דעת עבור " + (b.dog_name || "") + " (" + (b.owner_name || "") + ") - בוטל בשחרור (הלקוח לא הסתדר)");
        scriptProperties.setProperty(bookingKey, "skipped");
        continue;
      }

      var ownerName = b.owner_name || "לקוח יקר";`;

if (!content.includes(targetStr)) {
  console.error('Target string not found in', targetPath);
  process.exit(1);
}

content = content.replace(targetStr, replacementStr);
fs.writeFileSync(targetPath, content, 'utf8');

const waPath = path.join(__dirname, '..', 'קוד_וואטסאפ_בלבד.txt');
fs.writeFileSync(waPath, content, 'utf8');

console.log('Successfully updated skipReviewRequest check in Apps Script files!');
