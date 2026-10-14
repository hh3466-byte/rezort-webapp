const fs = require('fs');
const path = require('path');

function cleanMailProcessor(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return;
  }
  let code = fs.readFileSync(filePath, 'utf8');

  const growRegex = /\/\/\s*3\.\s*טיפול בתשלום Grow[\s\S]*?growCount\+\+;\s*threadHandled = true;\s*break;\s*\}/;

  const replacement = `// 3. טיפול בתשלום Grow / קבלה של הריזורט לכלב - מחיקה לאשפה בלבד!
      // כל נתוני התשלום מנוהלים ומדווחים ישירות מ-Grow Webhook בענן. הבדיקה במייל היא אך ורק לטובת מחיקה לאשפה!
      if (isGrow) {
        if (!isOtherBusiness) {
          threadHandled = true;
          growCount++;
          Logger.log("🗑️ מייל קבלת Grow של הריזורט זוהה ומועבר לאשפה: " + subject);
          break;
        }
      }`;

  if (growRegex.test(code)) {
    code = code.replace(growRegex, replacement);
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('Successfully simplified isGrow in:', fileName);
  } else {
    console.log('growRegex did not match in:', fileName);
  }
}

cleanMailProcessor('scripts/resort_mail_automation.js');
cleanMailProcessor('קוד_מאוחד_וואטסאפ_ומיילים.txt');
cleanMailProcessor('scripts/gmail_apps_script.js');
