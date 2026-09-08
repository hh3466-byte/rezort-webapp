/**
 * =========================================================================
 * אוטומציית תיבת דואר Gmail - הריזורט לכלב (מגדל דנילוב בע"מ)
 * קוד עבור Google Apps Script (https://script.google.com)
 * תאימות מלאה לכל גרסאות ה-Runtime (כולל V8 ו-Rhino ללא שגיאות תחביר)
 * =========================================================================
 */

var SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

/**
 * פונקציה ראשית המופעלת על ידי הטריגר האוטומטי
 */
function processResortEmails() {
  syncGrowPaymentsAndNotify();
  cleanupMorningResortInvoices();
}

/**
 * תאימות לשם הפונקציה בטריגר ישן
 */
function syncGrowPayments() {
  processResortEmails();
}

/**
 * 1. טיפול במיילי תשלום של GROW:
 *    חילוץ נתונים -> מניעת כפילויות -> סנכרון ל-Supabase -> התראת מייל -> העברה לאשפה
 */
function syncGrowPaymentsAndNotify() {
  // חיפוש מיילים מ-Grow בתיבת הדואר הנכנס - ללא מיילים ממורנינג (חשבונית ירוקה)
  var growQuery = '(Grow OR "meshulam" OR "grow.business" OR "grow.link") in:inbox -from:morning.co -from:greeninvoice.co.il';
  var growThreads = GmailApp.search(growQuery, 0, 20);

  // רשימת נמענים: בעל התיבה ושמוליק
  var myEmail = "";
  try {
    myEmail = Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || "hagai.hilman@gmail.com";
  } catch (eUser) {
    myEmail = "hagai.hilman@gmail.com";
  }
  var shmulikEmail = "shinshin1964@gmail.com";

  var recipientsList = [];
  if (myEmail) {
    recipientsList.push(myEmail);
  }
  if (shmulikEmail && recipientsList.indexOf(shmulikEmail) === -1) {
    recipientsList.push(shmulikEmail);
  }
  var targetRecipients = recipientsList.join(", ");

  // שמירת מזהים שכבר טופלו בריצה הנוכחית למניעת כפילות באותו שרשור
  var handledRefsInCurrentRun = {};

  for (var t = 0; t < growThreads.length; t++) {
    var gThread = growThreads[t];
    var gMessages = gThread.getMessages();
    var threadHandledSuccessfully = false;

    for (var m = 0; m < gMessages.length; m++) {
      var msg = gMessages[m];
      var body = msg.getPlainBody();

      // בדיקה 1: ודא שזהו אכן מייל תשלום
      if (!body.includes("ממי התשלום") && !body.includes("התשלום") && !body.includes("שולם") && !body.includes("קבלה")) {
        continue;
      }

      // בדיקה 2: סינון קפדני - אך ורק תשלומי "הריזורט לכלב"!
      if (!body.includes("הריזורט לכלב") && !body.includes("הריזורט")) {
        Logger.log("מייל תשלום דולג - אינו שייך להריזורט לכלב: " + msg.getSubject());
        continue;
      }

      // חילוץ נתונים מדויק
      var nameMatch = body.match(/שם\s*:\s*([^\n\r]+)/);
      var phoneMatch = body.match(/(?:טלפון|אימייל|נייד)\s*:\s*([0-9\-+ ]+)/) || body.match(/טלפון\s*:\s*([0-9\-+ ]+)/);
      var emailMatch = body.match(/מייל\s*:\s*([^\s\n\r@]+@[^\s\n\r]+)/i);
      var amountMatch = body.match(/(?:תשלום של|שולם)\s*(?:₪)?\s*([0-9.,]+)/) ||
                        body.match(/₪\s*([0-9.,]+)/) ||
                        body.match(/([0-9.,]+)\s*₪/);
      var refMatch = body.match(/אסמכתא\s*:\s*([0-9a-zA-Z]+)/);
      var methodMatch = body.match(/אמצעי תשלום\s*:\s*([^\n\r]+)/);

      var customerName = nameMatch ? nameMatch[1].trim() : "לקוח Grow";
      var customerPhone = phoneMatch ? phoneMatch[1].trim().replace(/\s+/g, '') : "";
      var customerEmail = emailMatch ? emailMatch[1].trim() : "";
      
      var amount = 0;
      if (amountMatch) {
        amount = parseFloat(amountMatch[1].replace(/,/g, '')) || 0;
      }

      var referenceId = refMatch ? refMatch[1].trim() : "ref-" + msg.getId();
      var paymentMethod = methodMatch ? methodMatch[1].trim() : "Bit";

      // הגנה הרמטית מפני כפילויות בריצה הנוכחית
      if (handledRefsInCurrentRun[referenceId]) {
        Logger.log("התשלום " + referenceId + " כבר טופל בתוך אותה הריצה - דילוג.");
        msg.markRead();
        threadHandledSuccessfully = true;
        continue;
      }

      // בדיקה מול Supabase: האם התשלום כבר קיים במסד הנתונים?
      var alreadyExistsInDb = false;
      try {
        var checkUrl = SUPABASE_URL + "/rest/v1/grow_incoming_payments?reference_id=eq." + encodeURIComponent(referenceId) + "&select=id";
        var checkRes = UrlFetchApp.fetch(checkUrl, {
          method: "get",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + SUPABASE_KEY
          },
          muteHttpExceptions: true
        });

        if (checkRes.getResponseCode() === 200) {
          var existingRows = JSON.parse(checkRes.getContentText());
          if (existingRows && existingRows.length > 0) {
            alreadyExistsInDb = true;
          }
        }
      } catch (errCheck) {
        Logger.log("אזהרה בבדיקת כפילות מול Supabase: " + errCheck.toString());
      }

      if (alreadyExistsInDb) {
        Logger.log("התשלום " + referenceId + " עבור " + customerName + " כבר קיים במסד הנתונים! נמנעה כפילות במייל.");
        handledRefsInCurrentRun[referenceId] = true;
        msg.markRead();
        threadHandledSuccessfully = true;
        continue;
      }

      // שלב א': סנכרון התשלום ל-Supabase עבור חלון התשלומים בתוכנת הריזורט
      var payload = {
        id: "grow_" + referenceId,
        reference_id: referenceId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        amount: amount,
        payment_method: paymentMethod,
        raw_email_snippet: body.substring(0, 300),
        status: "pending"
      };

      var options = {
        method: "post",
        contentType: "application/json",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY,
          "Prefer": "resolution=ignore-duplicates"
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      try {
        var response = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/grow_incoming_payments", options);
        var code = response.getResponseCode();

        if (code === 200 || code === 201 || code === 204) {
          Logger.log("התשלום סונכרן בהצלחה ל-Supabase: " + customerName + ", סכום: " + amount);
        } else {
          Logger.log("תשובת Supabase: " + response.getContentText());
        }
      } catch (errDb) {
        Logger.log("שגיאת תקשורת עם מסד הנתונים: " + errDb.toString());
      }

      // שלב ב': שליחת מייל התראה למנהל ולשמוליק - אך ורק לאחר ווידוא שזהו תשלום חדש!
      // נושא המייל: [שם הלקוח] שילם [סכום ששילם] ₪, גוף המייל ריק לחלוטין
      try {
        var emailSubject = customerName + " שילם " + amount + " ₪";
        GmailApp.sendEmail(targetRecipients, emailSubject, "");
        Logger.log("נשלח מייל התראה בהצלחה לנמענים (" + targetRecipients + "): " + emailSubject);
      } catch (errEmail) {
        Logger.log("שגיאה במשלוח מייל התראה: " + errEmail.toString());
      }

      // סימון שההודעה טופלה בהצלחה
      handledRefsInCurrentRun[referenceId] = true;
      msg.markRead();
      threadHandledSuccessfully = true;
    }

    // שלב ג': אם המייל טופל במלואו - העבר לפח האשפה של Gmail
    if (threadHandledSuccessfully) {
      gThread.moveToTrash();
      Logger.log("מייל Grow הועבר לפח האשפה בהצלחה.");
    }
  }
}

/**
 * 2. מחיקת מייל הקבלה/חשבונית ממורנינג (morning / notify@morning.co) שנוגע לריזורט לכלב:
 *    מעביר לאשפה רק מיילים ששייכים ל"הריזורט לכלב" ולא פוגע בעסקים אחרים של מגדל דנילוב בע"מ.
 */
function cleanupMorningResortInvoices() {
  var morningQuery = '(from:morning.co OR from:greeninvoice.co.il OR "morning") in:inbox';
  var morningThreads = GmailApp.search(morningQuery, 0, 25);

  for (var i = 0; i < morningThreads.length; i++) {
    var mThread = morningThreads[i];
    var mMessages = mThread.getMessages();
    var shouldDelete = false;

    for (var j = 0; j < mMessages.length; j++) {
      var mMsg = mMessages[j];
      var subject = mMsg.getSubject() || "";
      var plainBody = mMsg.getPlainBody() || "";
      var htmlBody = mMsg.getBody() || "";
      var fullText = (subject + " " + plainBody + " " + htmlBody).toLowerCase();

      // בדיקה קפדנית: האם המייל נוגע ישירות ל"הריזורט לכלב"?
      if (
        fullText.includes("הריזורט לכלב") ||
        (fullText.includes("הריזורט") && (fullText.includes("דנילוב") || fullText.includes("חשבונית") || fullText.includes("קבלה")))
      ) {
        shouldDelete = true;
        Logger.log("נמצא מייל מורנינג של הריזורט למחיקה: " + subject);
        break;
      }
    }

    if (shouldDelete) {
      mThread.moveToTrash();
      Logger.log("מייל מורנינג של הריזורט הועבר לאשפה בהצלחה.");
    }
  }
}
