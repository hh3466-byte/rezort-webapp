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
  checkUpcomingDeparturesWithDebtAndAlert();
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
    myEmail = Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || "hh3466@gmail.com";
  } catch (eUser) {
    myEmail = "hh3466@gmail.com";
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

/**
 * 3. התראה אוטומטית במייל יום לפני שחרור כלב במידה וקיים חוב פתוח (מייל בודד בלבד עם מניעת כפילות):
 *    בודק הזמנות שמסתיימות מחר שטרם שולמו במלואן, ושולח מייל מפורט לשמוליק ולמנהל.
 */
function checkUpcomingDeparturesWithDebtAndAlert() {
  try {
    var israelTz = "Asia/Jerusalem";
    var now = new Date();
    // יום לפני השחרור = מחר
    var tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    var tomorrowStr = Utilities.formatDate(tomorrow, israelTz, "yyyy-MM-dd");

    // שליפת נמענים: שמוליק ובעל התיבה
    var myEmail = "";
    try {
      myEmail = Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || "hh3466@gmail.com";
    } catch (eUser) {
      myEmail = "hh3466@gmail.com";
    }
    var shmulikEmail = "shinshin1964@gmail.com";

    var recipientsList = [];
    if (myEmail) recipientsList.push(myEmail);
    if (shmulikEmail && recipientsList.indexOf(shmulikEmail) === -1) recipientsList.push(shmulikEmail);
    var targetRecipients = recipientsList.join(", ");

    // שאילתת Supabase לשליפת כלבים שמשתחררים מחר
    var queryUrl = SUPABASE_URL + "/rest/v1/bookings?end_date=eq." + tomorrowStr + "&stay_status=neq.cancelled&stay_status=neq.checked_out&select=*";
    var response = UrlFetchApp.fetch(queryUrl, {
      method: "get",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log("שגיאה בשליפת הזמנות לשחרור מחר מ-Supabase: " + response.getContentText());
      return;
    }

    var bookings = JSON.parse(response.getContentText());
    if (!bookings || bookings.length === 0) {
      return;
    }

    var scriptProperties = PropertiesService.getScriptProperties();

    for (var i = 0; i < bookings.length; i++) {
      var b = bookings[i];
      var totalPrice = Number(b.total_price) || 0;
      var depositAmount = Number(b.deposit_amount) || 0;
      if (b.data && b.data.depositAmount !== undefined) {
        depositAmount = Math.max(depositAmount, Number(b.data.depositAmount) || 0);
      }
      var remainingDebt = Math.max(0, totalPrice - depositAmount);

      // האם יש חוב פתוח?
      if (remainingDebt <= 0 || b.payment_status === "fully_paid") {
        continue;
      }

      // מניעת כפילות - בדיקה האם כבר נשלח מייל יחיד עבור הזמנה זו לתאריך שחרור זה
      var alertKey = "debt_alert_sent_" + b.id + "_" + b.end_date;
      if (scriptProperties.getProperty(alertKey)) {
        continue;
      }

      var dogName = b.dog_name || "כלב";
      var dogBreed = b.dog_breed ? " (" + b.dog_breed + ")" : "";
      var ownerName = b.owner_name || "לקוח";
      var ownerPhone = b.owner_phone || "";
      var endDateFormatted = b.end_date || "";

      var subject = "⚠️ תזכורת: מחר שחרור כלב עם חוב פתוח - " + dogName + " (" + ownerName + ") | חוב: ₪" + remainingDebt.toLocaleString();

      var waPhone = ownerPhone.replace(/[^0-9]/g, '');
      if (waPhone.indexOf('0') === 0) waPhone = '972' + waPhone.substring(1);
      var waUrl = waPhone ? "https://wa.me/" + waPhone : "";

      var htmlBody = '<div dir="rtl" style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 25px; border-radius: 16px; border: 1px solid #e2e8f0; max-width: 600px; color: #1e293b;">'
        + '<div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center;">'
        + '<h2 style="color: #b91c1c; margin: 0 0 6px 0; font-size: 20px;">⚠️ התראת חוב פתוח יום לפני שחרור</h2>'
        + '<p style="color: #7f1d1d; margin: 0; font-size: 14px;">הכלב מתוכנן להשתחרר מחר, וקיימת יתרת חוב שטרם הוסדרה.</p>'
        + '</div>'
        + '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 15px;">'
        + '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px; font-weight: bold; color: #64748b;">שם הכלב:</td><td style="padding: 10px; font-weight: bold; color: #0f172a; font-size: 17px;">' + dogName + dogBreed + '</td></tr>'
        + '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px; font-weight: bold; color: #64748b;">שם הבעלים:</td><td style="padding: 10px; color: #0f172a;">' + ownerName + '</td></tr>'
        + '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px; font-weight: bold; color: #64748b;">טלפון:</td><td style="padding: 10px; color: #0f172a;"><a href="tel:' + ownerPhone + '" style="color: #0284c7; text-decoration: none; font-weight: bold;">' + ownerPhone + '</a></td></tr>'
        + '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px; font-weight: bold; color: #64748b;">מועד שחרור:</td><td style="padding: 10px; color: #b45309; font-weight: bold;">מחר (' + endDateFormatted + ')</td></tr>'
        + '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px; font-weight: bold; color: #64748b;">סה״כ עלות שהייה:</td><td style="padding: 10px; color: #0f172a;">₪' + totalPrice.toLocaleString() + '</td></tr>'
        + '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px; font-weight: bold; color: #64748b;">שולם עד כה:</td><td style="padding: 10px; color: #15803d; font-weight: bold;">₪' + depositAmount.toLocaleString() + '</td></tr>'
        + '<tr style="background-color: #fff1f2;"><td style="padding: 12px; font-weight: bold; color: #be123c; font-size: 16px;">יתרת חוב לגבייה:</td><td style="padding: 12px; font-weight: 900; color: #e11d48; font-size: 20px;">₪' + remainingDebt.toLocaleString() + '</td></tr>'
        + '</table>'
        + (waUrl ? '<div style="text-align: center; margin-bottom: 20px;"><a href="' + waUrl + '" style="background-color: #22c55e; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">💬 שלח הודעת וואטסאפ ללקוח</a></div>' : '')
        + '<p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 12px;">'
        + '💡 תזכורת: ניתן לסמן את החוב כשולם בלחיצה אחת במסך השחרור ביומן הריזורט.'
        + '</p>'
        + '</div>';

      var plainText = "התראת חוב פתוח יום לפני שחרור כלב\n"
        + "כלב: " + dogName + dogBreed + "\n"
        + "בעלים: " + ownerName + " (" + ownerPhone + ")\n"
        + "שחרור מתוכנן למחר: " + endDateFormatted + "\n"
        + "סה״כ לתשלום: ₪" + totalPrice + "\n"
        + "שולם: ₪" + depositAmount + "\n"
        + "יתרת חוב פתוחה: ₪" + remainingDebt + "\n"
        + "נא לוודא גבייה לפני שחרור הכלב.";

      GmailApp.sendEmail(targetRecipients, subject, plainText, { htmlBody: htmlBody });
      scriptProperties.setProperty(alertKey, new Date().toISOString());
      Logger.log("נשלח מייל התראת חוב בודד בהצלחה עבור " + dogName + " (חוב: " + remainingDebt + " ש״ח)");
    }
  } catch (e) {
    Logger.log("שגיאה בפונקציית התראת שחרור עם חוב: " + e.toString());
  }
}
