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
  ensureTaliEmailDraftCreated();
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

/**
 * בדיקה ויצירה חד-פעמית של טיוטת המייל לטלינקה (דיגיטלינקה)
 */
function ensureTaliEmailDraftCreated() {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty("tali_draft_created_v3") === "true") {
      return;
    }
    createTaliEmailDraft();
    props.setProperty("tali_draft_created_v3", "true");
  } catch (e) {
    Logger.log("שגיאה ב-ensureTaliEmailDraftCreated: " + e.toString());
  }
}

/**
 * יצירת טיוטת מייל (Draft) לטלינקה (דיגיטלינקה) בתיבת הדואר של Gmail
 * כולל עותק (CC) לשמוליק ולכותב, תיאום ציפיות מדויק, מערך הטבות וגישה לאפליקציה.
 */
function createTaliEmailDraft() {
  var recipient = "tali@digitalinka.co.il";
  var ccRecipients = "hh3466@gmail.com, shinshin1964@gmail.com";
  var subject = "שיתוף פעולה אסטרטגי, שדרוגי מערכת הריזורט, קהילת לקוחות ומערך הטבות דיגיטלי / עדכון מחמ״ל הריזורט לכלב 🐾";

  var plainText = "היי טלינקה יקרה, מה שלומך?\n\n"
    + "אני פונה אלייך ולצוות המהמם של דיגיטלינקה מתוך הערכה גדולה לעבודה ולקידום שאתם עושים עבורנו בדיגיטל.\n\n"
    + "כפי שאת יודעת, אני כרגע בשירות מילואים פעיל ומגן על המולדת, ולכן הזמינות השוטפת שלי נמוכה ואני נמצא לעיתים קרובות בפעילות. בדיוק מהסיבה הזו – אני לא יכול לדאוג לזה כפי שאת והצוות המהמם שלך יכולים. אתם הכוח המניע שמוביל את השיווק, התוכן והקהילה של הריזורט.\n\n"
    + "מהצד שלי, אני מפתח ומנהל את כל התשתית הטכנולוגית ואפליקציית הניהול של הריזורט. סיימתי לפתח ולהטמיע במערכת מנגנונים מתקדמים שנועדו לתמוך ישירות בקמפיינים ובמשפכים שלכם.\n\n"
    + "1. סוגיית עדכונים בשבתות ובחגים (חשוב להבהיר מול הלקוחות):\n"
    + "לאחרונה נתקלנו בתסכול של בעל כלב שלא ידע מה קורה עם הכלב שלו בשבת, פירש שקט תקשורתי כמצוקה והוציא פוסט הכפשה בפייסבוק.\n"
    + "חשוב להבהיר באופן חד-משמעי: אין לנו שום התחייבות לספק עדכונים שוטפים או סרטונים בשבת ובחג! שום דבר לא מובטח או מוגדר כחובה. זה תלוי אך ורק ברצון הטוב של שמוליק. ובכל מקרה, אם נשלח משהו – זה אך ורק פעם אחת בשבת בבוקר, וללא סרטון (אלא אם שמוליק מחליט בעצמו לצלם).\n"
    + "בנוסף, הצוות שלכם ממילא מזרים תוכן שוטף לרשתות החברתיות – לכן חשוב מאוד שתזרימו את התוכן המעולה הזה גם ישירות לערוץ הוואטסאפ של הלקוחות והקהילה!\n\n"
    + "2. בניית מועדון הלקוחות והקהילה (VIP Retention):\n"
    + "אנחנו צריכים שתבנו ותיישמו אצלנו קהילת הורים לכלבים של הריזורט (ערוץ וואטסאפ / קהילת סושיאל). תזרימו לשם תכנים, סרטונים, טיפים משמוליק ופעילויות שמייצרות גאוות יחידה ונאמנות.\n\n"
    + "3. מערך שוברים דיגיטליים מתקדם שהוטמע באפליקציה (קודים חד-חד-ערכיים ללא שימוש לרעה):\n"
    + "א. תפריט 7 פינוקי VIP לבחירת הלקוח (בשהות של 3 ימים ומעלה, ללא כפל מבצעים):\n"
    + "• 100 ₪ הנחה ישירה על החופשה\n"
    + "• צ'ק-אאוט VIP רגוע במוצאי שבת או חג (19:00-21:00) ללא עלות\n"
    + "• שיחת ייעוץ והדרכת התנהגות 1-על-1 עם שמוליק (שווי ₪250)\n"
    + "• יום כיף ושהות יומית VIP במתחם הדשא (09:00-19:00) מתנה לכלב\n"
    + "• מארז שף גורמה: עצם לעיסה טבעית מעושנת + מעדני בריאות מובחרים\n"
    + "• בוק צילומי VIP מקצועי מהחופשה לשיתוף בסטורי\n"
    + "• סשן משחקי חשיבה, רחרוח והעשרה מנטלית (Brain Games) ע״י צוות הריזורט\n\n"
    + "ב. לקוחות VIP ותיקים (4 אירוחים ומעלה):\n"
    + "מקבלים הטבה ישירה מיוחדת במתנה: יום כיף ושהות יומית במתחם הדשא (09:00-19:00) ללא תשלום! ובנוסף זכאות לתוכנית חבר מביא חבר.\n\n"
    + "ג. תוכנית חבר מביא חבר:\n"
    + "הלקוח שולח שובר לחבר עם כלב. החבר נהנה מפינוק VIP בשהות ראשונה (3 ימים ומעלה), וברגע שהחבר משלים שהות ראשונה – הלקוח המפנה זוכה ב-100 ₪ זיכוי לחופשה הבאה שלו!\n\n"
    + "4. גישה לבדיקת האפליקציה:\n"
    + "קישור ישיר למערכת: https://rezort-webapp.vercel.app\n"
    + "קישור לטופס הקליטה המקוון: https://rezort-webapp.vercel.app/?intake=true\n"
    + "כמובן שאני פה על מנת לעדכן את אפליקציית הניהול שלנו לפי ההנחיות והצרכים שלך. כל הערה או שיפור שיש לך – תכתבי לי, ואני איישם בכל פעם שאני לא בפעילות מבצעית במילואים.\n\n"
    + "(ובמאמר מוסגר: אם אהבת את האפליקציה, תמורת סכום צנוע של 5 ספרות אשמח לבנות מערכות ניהול דומות גם ללקוחות האחרים שלכם בדיגיטלינקה – כמובן בנישות אחרות, לא לכלביות).\n\n"
    + "שלחתי העתק גם אלי ולשמוליק.\n"
    + "מחכים לפידבק שלך,\nשמוליק וצוות הריזורט לכלב 🐾";

  var htmlBody = '<div dir="rtl" style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #1e293b; max-width: 680px; margin: 0 auto; background-color: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">'
    + '<div style="background: linear-gradient(135deg, #0f4c3a 0%, #15803d 100%); color: #ffffff; padding: 20px; border-radius: 12px; margin-bottom: 24px; text-align: center;">'
    + '<h1 style="margin: 0; font-size: 22px; font-weight: 900;">הריזורט לכלב 🐾 | עדכון שיווקי ומערכתי לטלינקה</h1>'
    + '<p style="margin: 6px 0 0 0; font-size: 14px; color: #dcfce7;">שיתוף פעולה אסטרטגי, שדרוגי מערכת, קהילת לקוחות ומערך הטבות דיגיטלי</p>'
    + '</div>'
    + '<p style="font-size: 15px;">היי <strong>טלינקה</strong> יקרה, מה שלומך? 🌸</p>'
    + '<p style="font-size: 15px;">אני פונה אלייך ולצוות המהמם של <strong>דיגיטלינקה</strong> מתוך הערכה גדולה לעבודה ולקידום שאתם עושים עבורנו בדיגיטל.</p>'
    + '<div style="background-color: #f0fdf4; border-right: 4px solid #16a34a; padding: 14px; border-radius: 8px; margin: 18px 0; font-size: 14px; color: #166534;">'
    + '🎖️ <strong>חשוב לי לשתף:</strong> אני כרגע בשירות מילואים פעיל ומגן על המולדת 🇮🇱. הזמינות השוטפת שלי נמוכה ואני נמצא לעיתים קרובות בפעילות, ולכן אני לא יכול לדאוג לתקשורת, לקמפיינים ולתוכן כפי שאת והצוות המהמם שלך יכולים. אתם הכוח המניע שמוביל את זה קדימה!'
    + '</div>'
    + '<p style="font-size: 15px;">מהצד שלי, אני מפתח ומנהל את כל התשתית הטכנולוגית ואפליקציית הניהול של הריזורט. סיימתי לפתח ולהטמיע במערכת מנגנונים מתקדמים שנועדו לתמוך ישירות בקמפיינים ובמשפכים שלכם. להלן הנקודות המרכזיות והתהליכים:</p>'
    + '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />'
    + '<h2 style="color: #0f4c3a; font-size: 18px; margin-bottom: 10px;">1. סוגיית עדכונים בשבתות ובחגים (תיאום ציפיות חד-משמעי)</h2>'
    + '<p style="font-size: 14px;">לאחרונה נתקלנו בתסכול של בעל כלב שלא ידע מה קורה עם הכלב בשבת, פירש שקט תקשורתי כמצוקה והכפיש אותנו בפייסבוק. כדי למנוע הישנות של מקרים כאלו, חשוב להבהיר:</p>'
    + '<ul style="font-size: 14px; color: #334155; padding-right: 20px;">'
    + '<li style="margin-bottom: 8px;"><strong>אין לנו שום התחייבות לעדכונים שוטפים בשבת/חג:</strong> בשום מקום אין התחייבות לשעות עדכון ספציפיות, והדבר תלוי אך ורק ברצון הטוב של שמוליק.</li>'
    + '<li style="margin-bottom: 8px;"><strong>בכל מקרה – עדכון אחד בלבד בשבת בבוקר:</strong> אם נשלח משהו, זה אך ורק פעם אחת בשבת בבוקר.</li>'
    + '<li style="margin-bottom: 8px;"><strong>ללא סרטון:</strong> אין התחייבות לסרטונים, אלא רק אם שמוליק יחליט על דעת עצמו לצלם. חיוני שהשיווק והתכנים לא ייצרו ציפייה בלתי ריאלית אצל לקוחות לשידורים חיים בשבתות.</li>'
    + '<li style="margin-bottom: 8px;"><strong>הזרמת תוכן לערוץ הוואטסאפ:</strong> הצוות המהמם שלכם ממילא מזרים תוכן שוטף ואיכותי לרשתות החברתיות – לכן נשמח מאוד שתזרימו את התוכן הזה גם ישירות לערוץ הוואטסאפ של הלקוחות והקהילה! (אין לזה קשר למילואים שלי – אני בכל מקרה לא מזרים תוכן, אלא אתם מומחי התוכן).</li>'
    + '</ul>'
    + '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />'
    + '<h2 style="color: #0f4c3a; font-size: 18px; margin-bottom: 10px;">2. בניית מועדון הלקוחות והקהילה של הריזורט (VIP Retention)</h2>'
    + '<p style="font-size: 14px;">אנחנו צריכים שאת והצוות של דיגיטלינקה תבנו ותיישמו אצלנו את מועדון הלקוחות וקהילת הריזורט. המטרה היא להפוך לקוחות מזדמנים לקהילה גאה ומחוברת שנשארת איתנו לאורך שנים, משתפת תכנים ומביאה חברים.</p>'
    + '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />'
    + '<h2 style="color: #0f4c3a; font-size: 18px; margin-bottom: 10px;">3. מערך השוברים הדיגיטליים המשודרג שהוטמע באפליקציה</h2>'
    + '<p style="font-size: 14px;">הקמתי במערכת מחולל שוברים אישיים עם <strong>קודים חד-חד-ערכיים</strong> (למניעת שימוש לרעה ומעקב פעיל/נוצל):</p>'
    + '<div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 16px; margin: 14px 0;">'
    + '<h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 15px;">🌟 תפריט 7 פינוקי VIP לבחירת הלקוח (בשהות של 3 ימים ומעלה / סופ״ש ארוך, ללא כפל הטבות):</h3>'
    + '<ol style="font-size: 13px; color: #78350f; margin: 0; padding-right: 20px;">'
    + '<li style="margin-bottom: 6px;"><strong>💰 100 ₪ הנחה ישירה על החופשה</strong> – חיסכון ישיר במזומן בשהות של 3 ימים ומעלה.</li>'
    + '<li style="margin-bottom: 6px;"><strong>🌙 צ\'ק-אאוט VIP רגוע במוצאי שבת או חג (19:00–21:00)</strong> – איסוף גמיש בערב ללא עלות נוספת (שווי ₪100).</li>'
    + '<li style="margin-bottom: 6px;"><strong>🐾 שיחת ייעוץ והדרכת התנהגות 1-על-1 עם שמוליק</strong> – שיחה אישית ומעמיקה עם מומחה ההתנהגות בריזורט (שווי ₪250).</li>'
    + '<li style="margin-bottom: 6px;"><strong>☀️ יום כיף ושהות יומית VIP במתחם הדשא (09:00–19:00) מתנה</strong> – 10 שעות של דשא, מים וחברים במתנה.</li>'
    + '<li style="margin-bottom: 6px;"><strong>🦴 מארז שף גורמה לכלב</strong> – עצם לעיסה טבעית מעושנת + מעדני בריאות מובחרים שמחכים לו בסוויטה.</li>'
    + '<li style="margin-bottom: 6px;"><strong>📸 בוק צילומי VIP מקצועי מהחופשה</strong> – תמונות אקשן ודיוקן מרהיבות לשיתוף בסטורי ולמזכרת לתמיד.</li>'
    + '<li style="margin-bottom: 6px;"><strong>🧠 סשן משחקי חשיבה, רחרוח והעשרה מנטלית (Brain Games)</strong> – מוענק ע״י צוות הריזורט.</li>'
    + '</ol>'
    + '</div>'
    + '<div style="background-color: #fdf4ff; border: 1px solid #fae8ff; border-radius: 10px; padding: 14px; margin: 14px 0; font-size: 13.5px; color: #86198f;">'
    + '👑 <strong>הטבה ייעודית ללקוחות 4 פעמים ומעלה:</strong> זכאים להטבת VIP ישירה של <strong>יום כיף שלם ומשחקים בריזורט במתנה (09:00–19:00)</strong>! בנוסף, זכאים להעביר שובר חבר מביא חבר.'
    + '</div>'
    + '<div style="background-color: #ecfdf5; border: 1px solid #d1fae5; border-radius: 10px; padding: 14px; margin: 14px 0; font-size: 13.5px; color: #065f46;">'
    + '🤝 <strong>תוכנית "חבר מביא חבר":</strong> הלקוח מעביר שובר לחבר עם כלב. החבר מקבל הטבת הצטרפות בשהות ראשונה (3 ימים ומעלה), וברגע שהוא מבצע שהות ראשונה – הלקוח המפנה מקבל אוטומטית <strong>100 ₪ זיכוי לשהות הבאה</strong> שלו בריזורט!'
    + '</div>'
    + '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />'
    + '<h2 style="color: #0f4c3a; font-size: 18px; margin-bottom: 10px;">4. גישה לבדיקת האפליקציה ושיתוף פעולה</h2>'
    + '<p style="font-size: 14px;">מוזמנת להיכנס ולבדוק ישירות את האפליקציה:</p>'
    + '<div style="text-align: center; margin: 18px 0;">'
    + '<a href="https://rezort-webapp.vercel.app" style="background-color: #0f4c3a; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; margin: 4px;">🚀 כניסה לאפליקציית הניהול</a>'
    + '<a href="https://rezort-webapp.vercel.app/?intake=true" style="background-color: #d97706; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; margin: 4px;">📝 צפייה בטופס הקליטה הציבורי</a>'
    + '</div>'
    + '<p style="font-size: 14px;"><strong>אני כאן כדי לעדכן את האפליקציה לפי ההנחיות שלך:</strong> כל הערה, שינוי או צורך שיווקי שעולה – תכתבי לי, ואני איישם במערכת בכל זמן שאני לא בפעילות מבצעית במילואים.</p>'
    + '<p style="font-size: 13px; color: #64748b; font-style: italic; background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px dashed #cbd5e1;">'
    + '(ובמאמר מוסגר: אם אהבת את האפליקציה, תמורת סכום צנוע של 5 ספרות אשמח לבנות מערכות ניהול ופורטלים דומים בהתאמה אישית גם ללקוחות האחרים שלכם בדיגיטלינקה – כמובן בנישות אחרות, לא לכלביות 😉).'
    + '</p>'
    + '<p style="font-size: 14px; margin-top: 20px;">'
    + 'נשלח העתק גם אלי ולשמוליק.<br />'
    + 'מחכים לפידבק שלך,<br />'
    + '<strong>שמוליק וצוות הריזורט לכלב 🐾</strong>'
    + '</p>'
    + '</div>';

  var draft = GmailApp.createDraft(recipient, subject, plainText, {
    cc: ccRecipients,
    htmlBody: htmlBody
  });

  Logger.log("טיוטת מייל לטלינקה נוצרה בהצלחה ב-Gmail! מזהה: " + draft.getId());
  return draft;
}
