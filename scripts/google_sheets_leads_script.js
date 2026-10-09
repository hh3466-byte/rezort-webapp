/**
 * =========================================================================
 * סקריפט סנכרון לידים אוטומטי מגוגל שיטס למערכת הריזורט לכלב
 * Google Apps Script - Resort Lead Auto-Sync
 * 
 * הוראות התקנה פשוטות ומהירות (2 דקות):
 * --------------------------------------------------
 * 1. פתחו את קובץ ה-Google Sheets שאליו נכנסים הלידים מהקמפיין הממומן במטא.
 * 2. בתפריט העליון לחצו על: "הרחבות" (Extensions) -> "Apps Script".
 * 3. מחקו את מה שכתוב שם והדביקו את כל הקוד שלהלן.
 * 4. לחצו על כפתור השמירה (💾 סמל הדיסקט).
 * 5. חזרו לגיליון ורעננו אותו (F5) - יופיע תפריט חדש: "🐾 ריזורט לכלב".
 * 6. לחצו בתפריט על "⏱️ הפעל סנכרון אוטומטי (כל דקה)" ואשרו הרשאות בפעם הראשונה.
 * 
 * זהו! מעכשיו, כל ליד חדש שנכנס מקבל מיידית וואטסאפ עם שאלון קליטה אישי.
 * =========================================================================
 */

// כתובת ה-API של מערכת הריזורט
var RESORT_WEBHOOK_URL = "https://rezort-webapp.vercel.app/api/lead-webhook";

/**
 * יצירת תפריט מותאם אישית ב-Google Sheets
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("🐾 ריזורט לכלב")
    .addItem("▶️ סנכרן לידים חדשים עכשיו", "syncNewLeadsNow")
    .addItem("⏱️ הפעל סנכרון אוטומטי (כל דקה)", "installAutoTrigger")
    .addItem("⏸️ בטל סנכרון אוטומטי", "removeAutoTrigger")
    .addSeparator()
    .addItem("ℹ️ בדיקת חיבור למערכת", "testSystemConnection")
    .addToUi();
}

/**
 * סנכרון ידני / בדיקה דרך התפריט
 */
function syncNewLeadsNow() {
  var result = processLeadsInSheet();
  var ui = SpreadsheetApp.getUi();
  if (result.processed > 0) {
    ui.alert("🐾 סנכרון הושלם בהצלחה!", "נשלחו הודעות וואטסאפ ל-" + result.processed + " לידים חדשים.", ui.ButtonSet.OK);
  } else {
    ui.alert("🐾 סנכרון הושלם", "לא נמצאו לידים חדשים שממתינים לשליחה (כולם כבר טופלו).", ui.ButtonSet.OK);
  }
}

/**
 * בדיקת חיבור מהיר ל-API
 */
function testSystemConnection() {
  var ui = SpreadsheetApp.getUi();
  try {
    var response = UrlFetchApp.fetch(RESORT_WEBHOOK_URL, {
      method: "get",
      muteHttpExceptions: true
    });
    if (response.getResponseCode() === 200) {
      ui.alert("✅ חיבור תקין!", "המערכת מחוברת בהצלחה לשרת הריזורט: " + response.getContentText(), ui.ButtonSet.OK);
    } else {
      ui.alert("⚠️ התראה", "השרת החזיר קוד: " + response.getResponseCode() + "\n" + response.getContentText(), ui.ButtonSet.OK);
    }
  } catch (err) {
    ui.alert("❌ שגיאת חיבור", "לא ניתן לגשת לשרת: " + err.toString(), ui.ButtonSet.OK);
  }
}

/**
 * התקנת טריגר אוטומטי שירוץ כל דקה
 */
function installAutoTrigger() {
  removeAutoTrigger(); // מחיקת טריגרים ישנים למניעת כפילויות
  ScriptApp.newTrigger("processLeadsInSheet")
    .timeBased()
    .everyMinutes(1)
    .create();

  var ui = SpreadsheetApp.getUi();
  ui.alert("✅ סנכרון אוטומטי הופעל!", "המערכת תבדוק לידים חדשים ותשלח שאלון קליטה בוואטסאפ באופן אוטומטי לחלוטין כל דקה.", ui.ButtonSet.OK);
}

/**
 * הסרת הטריגר האוטומטי
 */
function removeAutoTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processLeadsInSheet") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * טריגר בעת קבלת טופס או עריכה (אופציונלי)
 */
function onFormSubmit(e) {
  processLeadsInSheet();
}

/**
 * פונקציית העיבוד הראשית - סריקת הגיליון ושליחת וואטסאפ ללידים חדשים
 */
function processLeadsInSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { processed: 0 }; // רק שורת כותרת או גיליון ריק

  var headers = data[0];
  var colMap = findColumnIndices(headers);

  // אם אין עמודת סטטוס, נוסיף אותה בכותרת
  if (colMap.status === -1) {
    var nextCol = headers.length + 1;
    sheet.getRange(1, nextCol).setValue("סטטוס שליחה וואטסאפ");
    colMap.status = nextCol - 1;
  }

  var processedCount = 0;
  var now = new Date();
  var timeStr = Utilities.formatDate(now, "Asia/Jerusalem", "dd/MM/yyyy HH:mm");

  for (var rowIdx = 1; rowIdx < data.length; rowIdx++) {
    var row = data[rowIdx];
    
    var rawPhone = colMap.phone !== -1 ? String(row[colMap.phone] || "").trim() : "";
    var currentStatus = colMap.status !== -1 ? String(row[colMap.status] || "").trim() : "";

    // אם אין טלפון, או שהשורה כבר סומנה כנשלחה - דלג
    if (!rawPhone || currentStatus.indexOf("נשלח") !== -1 || currentStatus.indexOf("כבר נשלח") !== -1) {
      continue;
    }

    var fullName = "";
    if (colMap.fullName !== -1) {
      fullName = String(row[colMap.fullName] || "").trim();
    }

    var firstName = "";
    var lastName = "";
    if (colMap.firstName !== -1) {
      firstName = String(row[colMap.firstName] || "").trim();
    }
    if (colMap.lastName !== -1) {
      lastName = String(row[colMap.lastName] || "").trim();
    }

    if (!fullName && (firstName || lastName)) {
      fullName = (firstName + " " + lastName).trim();
    }

    // הכנת גוף הבקשה ל-API
    var payload = {
      fullName: fullName,
      name: fullName,
      phone: rawPhone,
      source: "Google Sheets / Meta Lead Campaign",
      notes: "שורה " + (rowIdx + 1) + " בגיליון"
    };

    try {
      var options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      var response = UrlFetchApp.fetch(RESORT_WEBHOOK_URL, options);
      var resCode = response.getResponseCode();
      var resText = response.getContentText();
      var resJson = {};
      try { resJson = JSON.parse(resText); } catch (eJson) {}

      var cellRange = sheet.getRange(rowIdx + 1, colMap.status + 1);

      if (resCode === 200 && (resJson.ok || resJson.success)) {
        if (resJson.skipped) {
          cellRange.setValue("כבר נשלח בעבר ℹ️ (" + timeStr + ")");
        } else {
          cellRange.setValue("נשלח בהצלחה 🟢 (" + timeStr + ")");
          processedCount++;
        }
      } else {
        var errDesc = resJson.error || resJson.reason || ("שגיאה " + resCode);
        cellRange.setValue("שגיאה 🔴: " + errDesc + " (" + timeStr + ")");
      }
    } catch (sendErr) {
      Logger.log("שגיאה בשליחת ליד לשורה " + (rowIdx + 1) + ": " + sendErr.toString());
      sheet.getRange(rowIdx + 1, colMap.status + 1).setValue("שגיאת תקשורת 🔴 (" + timeStr + ")");
    }

    // השהיה קלה של חצי שנייה בין לידים
    Utilities.sleep(500);
  }

  Logger.log("סיום סנכרון. טופלו " + processedCount + " לידים חדשים.");
  return { processed: processedCount };
}

/**
 * איתור אוטומטי של אינדקסי העמודות לפי שמות הכותרות
 */
function findColumnIndices(headers) {
  var map = {
    fullName: -1,
    firstName: -1,
    lastName: -1,
    phone: -1,
    status: -1
  };

  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").trim().toLowerCase();

    // טלפון
    if (h.indexOf("טלפון") !== -1 || h.indexOf("נייד") !== -1 || h.indexOf("phone") !== -1 || h.indexOf("mobile") !== -1 || h.indexOf("tel") !== -1) {
      if (map.phone === -1) map.phone = i;
    }
    // שם מלא / שם (עדיפות עליונה)
    else if (h.indexOf("שם מלא") !== -1 || h.indexOf("שם הלקוח") !== -1 || h.indexOf("שם הבעלים") !== -1 || h === "שם" || h.indexOf("full name") !== -1 || h.indexOf("full_name") !== -1 || h.indexOf("fullname") !== -1 || h === "name" || h.indexOf("lead_name") !== -1 || h.indexOf("owner_name") !== -1) {
      if (map.fullName === -1) map.fullName = i;
    }
    // שם פרטי (גיבוי)
    else if (h.indexOf("שם פרטי") !== -1 || h.indexOf("first name") !== -1 || h.indexOf("first_name") !== -1 || h.indexOf("fname") !== -1) {
      map.firstName = i;
    }
    // שם משפחה (גיבוי)
    else if (h.indexOf("שם משפחה") !== -1 || h.indexOf("last name") !== -1 || h.indexOf("last_name") !== -1 || h.indexOf("lname") !== -1) {
      map.lastName = i;
    }
    // סטטוס
    else if (h.indexOf("סטטוס") !== -1 || h.indexOf("status") !== -1) {
      map.status = i;
    }
  }

  // ברירות מחדל אם הכותרות לא זוהו במדויק:
  if (map.phone === -1) {
    if (headers.length >= 4) map.phone = 3; // עמודה D
    else if (headers.length >= 3) map.phone = 2; // עמודה C
    else if (headers.length >= 1) map.phone = 0; // עמודה A
  }

  if (map.fullName === -1 && map.firstName === -1) {
    if (headers.length >= 2) {
      map.fullName = 1; // עמודה B
    } else {
      map.fullName = 0;
    }
  }

  return map;
}
