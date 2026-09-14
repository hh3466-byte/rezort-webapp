/**
 * =========================================================================
 * מערכת ניהול מאוחדת לריזורט לכלב (מגדל דנילוב בע"מ)
 * חלק א': טיפול במיילים, מחיקת חשבוניות וסנכרון תשלומים
 * =========================================================================
 */

var SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

var GREEN_API_ID = "710722735421";
var GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

/**
 * פונקציה ראשית המופעלת על ידי הטריגר האוטומטי (כל 5 דקות)
 */
function processResortEmails() {
  Logger.log("--- תחילת ריצת בדיקת מיילים ותשלומים לריזורט ---");
  try {
    cleanYanivAndResortEmailsDirectly();
  } catch (e0) {
    Logger.log("שגיאה ב-cleanYanivAndResortEmailsDirectly: " + e0.toString());
  }
  try {
    syncGrowPaymentsAndNotify();
  } catch (e1) {
    Logger.log("שגיאה ב-syncGrowPaymentsAndNotify: " + e1.toString());
  }
  try {
    cleanupMorningResortInvoices();
  } catch (e2) {
    Logger.log("שגיאה ב-cleanupMorningResortInvoices: " + e2.toString());
  }
  try {
    checkUpcomingDeparturesWithDebtAndAlert();
  } catch (e3) {
    Logger.log("שגיאה ב-checkUpcomingDeparturesWithDebtAndAlert: " + e3.toString());
  }
  try {
    ensureTaliEmailDraftCreated();
  } catch (e5) {
    Logger.log("שגיאה ב-ensureTaliEmailDraftCreated: " + e5.toString());
  }
  Logger.log("--- סיום ריצת בדיקת מיילים ותשלומים לריזורט ---");
}

/**
 * תאימות לשם הפונקציה בטריגר ישן
 */
function syncGrowPayments() {
  processResortEmails();
}

/**
 * פונקציה להפעלה ידנית מיידית בלחיצת כפתור אחת (לניקוי מיידי של תיבת הדואר)
 */
function forceCleanResortInboxNow() {
  Logger.log(">>> מתחיל ניקוי מיידי ממוקד של מיילי הריזורט ויניב אלעד <<<");
  cleanYanivAndResortEmailsDirectly();
  syncGrowPaymentsAndNotify();
  cleanupMorningResortInvoices();
  Logger.log(">>> הניקוי המיידי הסתיים! בדוק את תיבת הדואר הנכנס ופח האשפה <<<");
}

/**
 * מחיקה ממוקדת וישירה של מיילי הריזורט לכלב ויניב אלעד (מבלי לגעת בשום מייל אחר של מגדל דנילוב)
 */
function cleanYanivAndResortEmailsDirectly() {
  var searchQueries = [
    'יניב',
    '"הריזורט לכלב"',
    'subject:"בוצע תשלום עבור בעל העסק"',
    'from:morning.co',
    'from:greeninvoice.co.il'
  ];

  var handledThreadIds = {};
  var deleted = 0;

  for (var q = 0; q < searchQueries.length; q++) {
    var query = searchQueries[q];
    var threads = [];
    try {
      threads = GmailApp.search(query, 0, 25);
    } catch (e) {
      Logger.log("שגיאה בחיפוש " + query + ": " + e.toString());
      continue;
    }
    Logger.log("שאילתה [" + query + "] מצאה " + threads.length + " שרשורים.");

    for (var i = 0; i < threads.length; i++) {
      var th = threads[i];
      var thId = th.getId();
      if (handledThreadIds[thId]) continue;
      handledThreadIds[thId] = true;

      if (th.isInTrash()) continue;

      var msgs = th.getMessages();
      for (var m = 0; m < msgs.length; m++) {
        var msg = msgs[m];
        var sub = msg.getSubject() || "";
        var sender = msg.getFrom() || "";
        var body = msg.getPlainBody() || "";
        var html = msg.getBody() || "";
        var full = (sub + " " + sender + " " + body + " " + html).toLowerCase();

        // בדיקה קפדנית: האם נוגע ישירות להריזורט לכלב או ליניב אלעד
        var isResort = full.indexOf("הריזורט לכלב") !== -1 ||
                       full.indexOf("הריזורט") !== -1 ||
                       full.indexOf("יניב אלעד") !== -1 ||
                       full.indexOf("ג'נגו") !== -1 ||
                       full.indexOf("django") !== -1 ||
                       (full.indexOf("יניב") !== -1 && (full.indexOf("morning") !== -1 || full.indexOf("חשבונית") !== -1 || full.indexOf("תשלום") !== -1));

        // סינון: רק Morning או Grow בלבד
        var isMorning = sender.indexOf("morning") !== -1 || sender.indexOf("greeninvoice") !== -1 || sub.indexOf("morning") !== -1 || sub.indexOf("חשבונית") !== -1;
        var isGrow = sender.indexOf("grow") !== -1 || sender.indexOf("meshulam") !== -1 || sub.indexOf("בוצע תשלום עבור בעל העסק") !== -1 || body.indexOf("grow.business") !== -1;

        if (isMorning && isResort) {
          th.moveToTrash();
          deleted++;
          Logger.log("🗑️ נמחקה חשבונית מורנינג של הריזורט: " + sub);
          break;
        }

        if (isGrow && isResort) {
          th.moveToTrash();
          deleted++;
          Logger.log("🗑️ נמחק מייל תשלום Grow של הריזורט: " + sub);
          break;
        }
      }
    }
  }

  Logger.log("=== סיום סריקה ישירה: נמחקו " + deleted + " מיילים של הריזורט/יניב לאשפה ===");
}

/**
 * פונקציית עזר לשליפת כל השרשורים בתיבת הדואר הנכנס בצורה אמינה
 */
function getResortInboxThreads() {
  var threadsMap = {};
  var result = [];

  try {
    var directInbox = GmailApp.getInboxThreads(0, 50);
    Logger.log("getInboxThreads החזיר: " + (directInbox ? directInbox.length : 0) + " שרשורים מה-Inbox.");
    if (directInbox) {
      for (var i = 0; i < directInbox.length; i++) {
        var id = directInbox[i].getId();
        if (!threadsMap[id]) {
          threadsMap[id] = true;
          result.push(directInbox[i]);
        }
      }
    }
  } catch (e1) {
    Logger.log("שגיאה בקריאת getInboxThreads: " + e1.toString());
  }

  return result;
}

/**
 * 1. טיפול חכם במיילי תשלום של GROW:
 *    חילוץ נתונים -> התאמה להריזורט לכלב ולחשבוניות מורנינג -> סנכרון ל-Supabase -> התראת מייל -> העברה לאשפה
 */
function syncGrowPaymentsAndNotify() {
  var myEmail = "hh3466@gmail.com";
  var shmulikEmail = "shinshin1964@gmail.com";
  var targetRecipients = myEmail + ", " + shmulikEmail;

  var inboxThreads = getResortInboxThreads();
  if (!inboxThreads || inboxThreads.length === 0) {
    Logger.log("לא נמצאו הודעות בתיבת הדואר הנכנס.");
    return;
  }

  // 1.1 איסוף שמות לקוחות מחשבוניות Morning של הריזורט לכלב שנמצאות בתיבה
  var resortCustomerNamesInMorning = {};
  for (var i = 0; i < inboxThreads.length; i++) {
    var th = inboxThreads[i];
    var msgs = th.getMessages();
    for (var j = 0; j < msgs.length; j++) {
      var m = msgs[j];
      var sub = m.getSubject() || "";
      var from = m.getFrom() || "";
      var bText = m.getPlainBody() || "";
      var full = (sub + " " + from + " " + bText);
      if (full.indexOf("הריזורט לכלב") !== -1 || full.indexOf("הריזורט") !== -1) {
        var clientMatch = sub.match(/עבור\s+([^\n\r-]+)/) || bText.match(/עבור\s+([^\n\r-]+)/);
        if (clientMatch) {
          var fullName = clientMatch[1].replace(/<[^>]*>?/gm, '').trim();
          var fName = fullName.split(" ")[0].trim().toLowerCase();
          if (fName.length >= 2) resortCustomerNamesInMorning[fName] = true;
          if (fullName.length >= 2) resortCustomerNamesInMorning[fullName.toLowerCase()] = true;
        }
      }
    }
  }

  var handledRefsInCurrentRun = {};
  var scriptProperties = PropertiesService.getScriptProperties();

  // 1.2 עיבוד שרשורי Grow / תשלום
  for (var t = 0; t < inboxThreads.length; t++) {
    var gThread = inboxThreads[t];
    var gMessages = gThread.getMessages();
    var threadHandledSuccessfully = false;

    for (var m = 0; m < gMessages.length; m++) {
      var msg = gMessages[m];
      var subject = msg.getSubject() || "";
      var sender = msg.getFrom() || "";
      var body = msg.getPlainBody() || "";
      var htmlBody = msg.getBody() || "";
      var fullText = subject + " " + sender + " " + body + " " + htmlBody;

      // בדיקה קפדנית: אך ורק מיילים אמיתיים של Grow/Meshulam! לעולם לא לגעת במיילים של עסקים אחרים!
      var isGrowSender = sender.toLowerCase().indexOf("grow") !== -1 ||
                         sender.toLowerCase().indexOf("meshulam") !== -1 ||
                         subject.indexOf("בוצע תשלום עבור בעל העסק") !== -1 ||
                         body.indexOf("grow.business") !== -1 ||
                         body.indexOf("grow.link") !== -1;

      if (!isGrowSender) continue;

      // דילוג על חשבוניות מורנינג - הן מטופלות בנפרד
      if (sender.toLowerCase().indexOf("morning") !== -1 || sender.toLowerCase().indexOf("greeninvoice") !== -1 || subject.indexOf("חשבונית") !== -1) {
        continue;
      }

      Logger.log("נמצא מייל Grow פוטנציאלי: " + subject);

      // חילוץ נתונים אמין מכל סוגי התבניות של Grow
      var cleanText = (htmlBody + " " + body).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

      var nameMatch = cleanText.match(/(?:ממי התשלום|שם המשלם|שם הלקוח|שם)\s*[:\-]?\s*([\u0590-\u05FFa-zA-Z]{2,15}(?:\s+[\u0590-\u05FFa-zA-Z]{2,15})?)/i) ||
                      cleanText.match(/עבור\s+([\u0590-\u05FFa-zA-Z]{2,15})/i);
      var phoneMatch = cleanText.match(/(?:טלפון|נייד|סלולרי)\s*[:\-]?\s*([0-9+ -]{9,15})/i) ||
                       cleanText.match(/05[0-9][0-9 -]{7,10}/);
      var amountMatch = cleanText.match(/(?:תשלום של|שולם|סכום)\s*(?:₪)?\s*([0-9.,]+)/i) ||
                        cleanText.match(/₪\s*([0-9.,]+)/) ||
                        cleanText.match(/([0-9.,]+)\s*₪/);
      var refMatch = cleanText.match(/(?:אסמכתא|אישור|מספר אסמכתא)\s*[:\-]?\s*([0-9a-zA-Z]+)/i);
      var methodMatch = cleanText.match(/(?:אמצעי תשלום|באמצעות)\s*[:\-]?\s*([^.,<\n\r]{2,20})/i);

      var customerName = (nameMatch ? nameMatch[1].trim() : "לקוח Grow").replace(/\s+/g, ' ');
      var customerPhone = phoneMatch ? (phoneMatch[1] || phoneMatch[0]).replace(/\D/g, '') : "";
      var customerEmail = (body.match(/מייל\s*:\s*([^\s\n\r@]+@[^\s\n\r]+)/i) || ["", ""])[1];
      var amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
      var referenceId = refMatch ? refMatch[1].trim() : "ref-" + msg.getId();
      var paymentMethod = methodMatch ? methodMatch[1].trim() : "Bit";

      Logger.log("חילוץ נתוני Grow -> לקוח: " + customerName + ", סכום: " + amount + ", אסמכתא: " + referenceId);

      // בדיקה האם התשלום שייך לריזורט לכלב:
      var isResort = cleanText.indexOf("הריזורט לכלב") !== -1 ||
                     cleanText.indexOf("הריזורט") !== -1 ||
                     cleanText.indexOf("ריזורט") !== -1 ||
                     cleanText.indexOf("פנסיון") !== -1 ||
                     cleanText.indexOf("אילוף") !== -1 ||
                     cleanText.indexOf("כלב") !== -1;

      // בדיקה מול חשבוניות מורנינג של הריזורט בתיבה (למשל עבור יניב אלעד)
      if (!isResort) {
        var fName = customerName.split(" ")[0].trim().toLowerCase();
        if (fName && resortCustomerNamesInMorning[fName]) {
          isResort = true;
          Logger.log("התשלום שייך לריזורט (זוהה מול חשבונית Morning של " + customerName + ")");
        } else if (resortCustomerNamesInMorning[customerName.toLowerCase()]) {
          isResort = true;
          Logger.log("התשלום שייך לריזורט (זוהה מול חשבונית Morning של " + customerName + ")");
        }
      }

      // בדיקה מול לקוחות / הזמנות של הריזורט ב-Supabase (טלפון או שם)
      if (!isResort && customerPhone) {
        try {
          var cleanP = customerPhone.replace(/\D/g, '').slice(-7);
          var bCheck = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/bookings?owner_phone=ilike.*" + cleanP + "*&select=id,dog_name,owner_name", {
            headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
          });
          if (bCheck.getResponseCode() === 200) {
            var bRows = JSON.parse(bCheck.getContentText());
            if (bRows && bRows.length > 0) {
              isResort = true;
              Logger.log("התשלום זוהה כשייך להריזורט לכלב לפי טלפון בהזמנת " + bRows[0].dog_name + " (" + bRows[0].owner_name + ")");
            }
          }
        } catch (eB) {}
      }

      if (!isResort && customerName && customerName !== "לקוח Grow") {
        try {
          var fNameEnc = encodeURIComponent(customerName.split(" ")[0].trim());
          var bNameCheck = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/bookings?owner_name=ilike.*" + fNameEnc + "*&select=id,dog_name,owner_name", {
            headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
          });
          if (bNameCheck.getResponseCode() === 200) {
            var bNRows = JSON.parse(bNameCheck.getContentText());
            if (bNRows && bNRows.length > 0) {
              isResort = true;
              Logger.log("התשלום זוהה כשייך להריזורט לפי שם בהזמנת " + bNRows[0].dog_name + " (" + bNRows[0].owner_name + ")");
            }
          }
        } catch (eBN) {}
      }

      // בדיקה האם האסמכתא כבר מוכרת בריזורט
      if (!isResort && referenceId) {
        try {
          var refCheck = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/grow_incoming_payments?reference_id=eq." + encodeURIComponent(referenceId) + "&select=id", {
            headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
          });
          if (refCheck.getResponseCode() === 200) {
            var refRows = JSON.parse(refCheck.getContentText());
            if (refRows && refRows.length > 0) isResort = true;
          }
        } catch (eR) {}
      }

      // בדיקה מיוחדת עבור יניב אלעד
      if (!isResort && customerName.indexOf("יניב") !== -1) {
        isResort = true;
        Logger.log("התשלום שייך לריזורט (זוהה ישירות עבור יניב אלעד)");
      }

      // אם התשלום לא שייך לריזורט (למשל מגדל דנילוב נדל"ן) - לא נוגעים בו!
      if (!isResort) {
        Logger.log("מייל תשלום דולג - אינו שייך להריזורט לכלב: " + subject + " (" + customerName + ")");
        continue;
      }

      // בדיקת כפילויות מרובעת
      if (handledRefsInCurrentRun[referenceId]) {
        msg.markRead();
        threadHandledSuccessfully = true;
        continue;
      }

      var alreadyExists = false;
      if (scriptProperties.getProperty("handled_ref_" + referenceId)) {
        alreadyExists = true;
      }

      if (!alreadyExists) {
        try {
          var checkRes = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/grow_incoming_payments?reference_id=eq." + encodeURIComponent(referenceId) + "&select=id", {
            headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
          });
          if (checkRes.getResponseCode() === 200) {
            var exRows = JSON.parse(checkRes.getContentText());
            if (exRows && exRows.length > 0) alreadyExists = true;
          }
        } catch (eC) {}
      }

      if (!alreadyExists) {
        try {
          var bCheckRef = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/bookings?notes=ilike.*" + encodeURIComponent(referenceId) + "*&select=id,dog_name,owner_name", {
            headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
          });
          if (bCheckRef.getResponseCode() === 200) {
            var bRefRows = JSON.parse(bCheckRef.getContentText());
            if (bRefRows && bRefRows.length > 0) alreadyExists = true;
          }
        } catch (eBRef) {}
      }

      if (alreadyExists) {
        Logger.log("✓ התשלום עם אסמכתא " + referenceId + " עבור " + customerName + " כבר קיים - נמנעה כפילות. מועבר לאשפה.");
        scriptProperties.setProperty("handled_ref_" + referenceId, "true");
        handledRefsInCurrentRun[referenceId] = true;
        msg.markRead();
        threadHandledSuccessfully = true;
        continue;
      }

      // תשלום חדש: שמירה ב-Supabase ועדכון הזמנה
      try {
        var payload = {
          id: "grow_" + referenceId,
          reference_id: referenceId,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          amount: amount,
          payment_method: paymentMethod,
          raw_email_snippet: cleanText.substring(0, 300),
          status: "completed"
        };
        UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/grow_incoming_payments", {
          method: "post",
          contentType: "application/json",
          headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Prefer": "resolution=ignore-duplicates" },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        Logger.log("✓ תשלום נרשם ב-Supabase: " + customerName + " | סכום: " + amount);
      } catch (ePayIns) {}

      // עדכון ישיר של ההזמנה ב-Supabase ואישור קליטה
      try {
        var cleanPhoneNum = customerPhone.replace(/\D/g, '').slice(-7);
        var bSearchRes = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/bookings?owner_phone=ilike.*" + cleanPhoneNum + "*&select=*&order=created_at.desc&limit=1", {
          headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
        });
        if (bSearchRes.getResponseCode() === 200) {
          var foundBookings = JSON.parse(bSearchRes.getContentText());
          if (foundBookings && foundBookings.length > 0) {
            var bk = foundBookings[0];
            var currentDeposit = Number(bk.deposit_amount) || 0;
            var newDeposit = currentDeposit + amount;
            var totalPrice = Number(bk.total_price) || 0;
            var newPaymentStatus = (newDeposit >= totalPrice && totalPrice > 0) ? "fully_paid" : "deposit_paid";

            var bkData = bk.data || {};
            bkData.depositAmount = newDeposit;
            bkData.paymentStatus = newPaymentStatus;
            bkData.stayStatus = "confirmed";
            bkData.notes = (bk.notes || "") + " | שולם ₪" + amount + " (" + paymentMethod + " אסמכתא " + referenceId + ")";

            UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/bookings?id=eq." + bk.id, {
              method: "patch",
              contentType: "application/json",
              headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY },
              payload: JSON.stringify({
                deposit_amount: newDeposit,
                payment_status: newPaymentStatus,
                stay_status: "confirmed",
                notes: bkData.notes,
                data: bkData,
                updated_at: new Date().toISOString()
              }),
              muteHttpExceptions: true
            });
            Logger.log("הזמנת " + bk.dog_name + " של " + customerName + " עודכנה בהצלחה כ- " + newPaymentStatus + " (מאושרת לקליטה)");
          }
        }
      } catch (errBookingUpdate) {
        Logger.log("שגיאה בעדכון הזמנה: " + errBookingUpdate.toString());
      }

      // שליחת מייל התראה למנהל ולשמוליק
      try {
        var emailSubject = customerName + " שילם " + amount + " ₪";
        GmailApp.sendEmail(targetRecipients, emailSubject, "");
        Logger.log("נשלח מייל התראה: " + emailSubject);
      } catch (errEmail) {
        Logger.log("שגיאה במשלוח מייל התראה: " + errEmail.toString());
      }

      scriptProperties.setProperty("handled_ref_" + referenceId, "true");
      handledRefsInCurrentRun[referenceId] = true;
      msg.markRead();
      threadHandledSuccessfully = true;
    }

    if (threadHandledSuccessfully) {
      gThread.moveToTrash();
      Logger.log("✓ מייל Grow הועבר לפח האשפה בהצלחה.");
    }
  }
}

/**
 * 2. מחיקת מייל הקבלה/חשבונית ממורנינג (morning / greeninvoice) של הריזורט לכלב:
 *    מעביר לאשפה רק מיילים ששייכים ל"הריזורט לכלב" ולא פוגע בעסקים אחרים של מגדל דנילוב בע"מ.
 */
function cleanupMorningResortInvoices() {
  var inboxThreads = getResortInboxThreads();
  if (!inboxThreads || inboxThreads.length === 0) return;

  var deletedCount = 0;
  for (var i = 0; i < inboxThreads.length; i++) {
    var mThread = inboxThreads[i];
    var mMessages = mThread.getMessages();
    var shouldDelete = false;

    for (var j = 0; j < mMessages.length; j++) {
      var mMsg = mMessages[j];
      var subject = mMsg.getSubject() || "";
      var sender = mMsg.getFrom() || "";
      var plainBody = mMsg.getPlainBody() || "";
      var htmlBody = mMsg.getBody() || "";
      var fullText = subject + " " + sender + " " + plainBody + " " + htmlBody;

      // בדיקה האם המייל הוא אכן מחשבוניות Morning
      var isMorning = sender.toLowerCase().indexOf("morning") !== -1 ||
                      sender.toLowerCase().indexOf("greeninvoice") !== -1 ||
                      subject.indexOf("morning") !== -1 ||
                      subject.indexOf("חשבונית ירוקה") !== -1 ||
                      subject.indexOf("חשבונית מס") !== -1 ||
                      subject.indexOf("קבלה") !== -1;

      if (!isMorning) continue;

      // בדיקה קפדנית: אך ורק מיילים ששייכים ל"הריזורט לכלב"
      if (fullText.indexOf("הריזורט לכלב") !== -1 || fullText.indexOf("הריזורט") !== -1 || fullText.indexOf("יניב אלעד") !== -1) {
        shouldDelete = true;
        Logger.log("✓ זוהתה חשבונית מורנינג של הריזורט למחיקה: " + subject);
        break;
      }
    }

    if (shouldDelete) {
      mThread.moveToTrash();
      deletedCount++;
      Logger.log("✓ מייל מורנינג של הריזורט הועבר לאשפה בהצלחה.");
    }
  }
  Logger.log("סיום ניקוי מורנינג: הועברו " + deletedCount + " חשבוניות לאשפה.");
}

/**
 * 3. התראה אוטומטית במייל יום לפני שחרור כלב במידה וקיים חוב פתוח
 */
function checkUpcomingDeparturesWithDebtAndAlert() {
  try {
    var israelTz = "Asia/Jerusalem";
    var now = new Date();
    var tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    var tomorrowStr = Utilities.formatDate(tomorrow, israelTz, "yyyy-MM-dd");

    var myEmail = "hh3466@gmail.com";
    var shmulikEmail = "shinshin1964@gmail.com";
    var targetRecipients = myEmail + ", " + shmulikEmail;

    var queryUrl = SUPABASE_URL + "/rest/v1/bookings?end_date=eq." + tomorrowStr + "&stay_status=neq.cancelled&stay_status=neq.checked_out&select=*";
    var response = UrlFetchApp.fetch(queryUrl, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    });

    if (response.getResponseCode() !== 200) return;

    var bookings = JSON.parse(response.getContentText());
    if (!bookings || bookings.length === 0) return;

    var scriptProperties = PropertiesService.getScriptProperties();

    for (var i = 0; i < bookings.length; i++) {
      var b = bookings[i];
      var totalPrice = Number(b.total_price) || 0;
      var depositAmount = Number(b.deposit_amount) || 0;
      if (b.data && b.data.depositAmount !== undefined) {
        depositAmount = Math.max(depositAmount, Number(b.data.depositAmount) || 0);
      }
      var remainingDebt = Math.max(0, totalPrice - depositAmount);

      if (remainingDebt <= 0 || b.payment_status === "fully_paid") continue;

      var alertKey = "debt_alert_sent_" + b.id + "_" + b.end_date;
      if (scriptProperties.getProperty(alertKey)) continue;

      var dogName = b.dog_name || "כלב";
      var ownerName = b.owner_name || "לקוח";
      var ownerPhone = b.owner_phone || "";
      var endDateFormatted = b.end_date || "";

      var subject = "⚠️ תזכורת: מחר שחרור כלב עם חוב פתוח - " + dogName + " (" + ownerName + ") | חוב: ₪" + remainingDebt.toLocaleString();

      var plainText = "התראת חוב פתוח יום לפני שחרור כלב\n"
        + "כלב: " + dogName + "\n"
        + "בעלים: " + ownerName + " (" + ownerPhone + ")\n"
        + "מועד שחרור: " + endDateFormatted + "\n"
        + "סה״כ לתשלום: ₪" + totalPrice + "\n"
        + "שולם: ₪" + depositAmount + "\n"
        + "יתרת חוב פתוחה: ₪" + remainingDebt + "\n"
        + "נא לוודא גבייה לפני שחרור הכלב.";

      GmailApp.sendEmail(targetRecipients, subject, plainText);
      scriptProperties.setProperty(alertKey, new Date().toISOString());
      Logger.log("נשלח מייל התראת חוב בודד בהצלחה עבור " + dogName + " (חוב: " + remainingDebt + " ש״ח)");
    }
  } catch (e) {
    Logger.log("שגיאה בפונקציית התראת שחרור עם חוב: " + e.toString());
  }
}



/**
 * 5. בדיקה ויצירה חד-פעמית של טיוטת המייל לטלינקה (דיגיטלינקה)
 */
function ensureTaliEmailDraftCreated() {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty("tali_draft_created_v3") === "true") return;
    props.setProperty("tali_draft_created_v3", "true");
  } catch (e) {
    Logger.log("שגיאה ב-ensureTaliEmailDraftCreated: " + e.toString());
  }
}

/**
 * =========================================================================
 * חלק ב': בוט וואטסאפ חכם (Green-API), הודעות יומיות ב-20:00 ושאלון קליטה
 * =========================================================================
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(e.postData.contents);
    if (!payload || payload.typeWebhook !== "incomingMessageReceived") {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, ignored: true })).setMimeType(ContentService.MimeType.JSON);
    }

    var senderData = payload.senderData || {};
    var chatId = senderData.chatId || "";
    var sender = senderData.sender || "";

    // סינון קבוצות וסטטוסים
    if (!chatId || chatId.indexOf("@c.us") === -1 || chatId.indexOf("status@broadcast") !== -1) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, reason: "group or broadcast ignored" })).setMimeType(ContentService.MimeType.JSON);
    }

    // סינון הודעות עצמיות
    var wid = (payload.instanceData && payload.instanceData.wid) ? payload.instanceData.wid : "972548765888@c.us";
    if (sender === wid || chatId === wid) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, reason: "self message ignored" })).setMimeType(ContentService.MimeType.JSON);
    }

    var cleanPhone = chatId.replace("@c.us", "").replace(/[^0-9]/g, "");
    var phoneSuffix = cleanPhone.slice(-7);

    // מניעת ספאם (Cooldown של 6 שעות ללקוחות רגילים, מאפשר בדיקות חוזרות לטלפון מנהל)
    var cache = CacheService.getScriptCache();
    var cacheKey = "wa_reply_" + cleanPhone;
    var isTestPhone = (cleanPhone.indexOf("3200007") !== -1);
    if (!isTestPhone && cache.get(cacheKey)) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, reason: "cooldown active" })).setMimeType(ContentService.MimeType.JSON);
    }

    // בדיקת זמנים ושבתות/חגים
    var israelTz = "Asia/Jerusalem";
    var now = new Date();
    var dayOfWeek = parseInt(Utilities.formatDate(now, israelTz, "u"), 10);
    var hour = parseInt(Utilities.formatDate(now, israelTz, "H"), 10);
    var minute = parseInt(Utilities.formatDate(now, israelTz, "m"), 10);
    var timeInMinutes = hour * 60 + minute;
    var senderName = (senderData.senderName || "").trim();

    // =========================================================================
    // בדיקת יום כיפור (קודש קודשים - שקט מוחלט! תור פניות למענה בצאת החג)
    // =========================================================================
    if (isYomKippurNow(now, israelTz)) {
      Logger.log("התקבלה הודעה במהלך יום כיפור מ: " + chatId + " (" + senderName + ") - נרשמת בתור צאת כיפור ללא שליחה מיידית");
      queueYomKippurContact(chatId, senderName);
      scheduleYomKippurFollowupTrigger(now, israelTz);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, reason: "yom_kippur_silent_queued" })).setMimeType(ContentService.MimeType.JSON);
    }

    // בדיקת חגים וערבי חג מול Hebcal API
    var isHoliday = false;
    var holidayTitle = "";
    var isErevHoliday = false;

    try {
      var todayStr = Utilities.formatDate(now, israelTz, "yyyy-MM-dd");
      var year = Utilities.formatDate(now, israelTz, "yyyy");
      var month = Utilities.formatDate(now, israelTz, "M");
      var hebcalUrl = "https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&nx=off&year=" + year + "&month=" + month + "&ss=off&mf=off&c=off&geo=none&i=on";
      var hRes = UrlFetchApp.fetch(hebcalUrl, { muteHttpExceptions: true });
      if (hRes.getResponseCode() === 200) {
        var hData = JSON.parse(hRes.getContentText());
        var items = (hData && hData.items) ? hData.items : [];
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (item.date === todayStr) {
            var title = item.title || "";
            var heb = item.hebrew || "";
            if (title.indexOf("Erev ") !== -1 || heb.indexOf("ערב ") !== -1) {
              isErevHoliday = true;
              holidayTitle = heb || title;
            } else {
              isHoliday = true;
              holidayTitle = heb || title;
            }
          }
        }
      }
    } catch (eH) {}

    // הגדרת זמני סגירה:
    var isClosedWeekend = false;
    var closedReason = "";

    if (dayOfWeek === 5 && timeInMinutes >= (14 * 60)) {
      isClosedWeekend = true;
      closedReason = "סוף השבוע (שישי אחה\"צ)";
    } else if (dayOfWeek === 6) {
      isClosedWeekend = true;
      closedReason = "שבת קודש";
    } else if (dayOfWeek === 7 && timeInMinutes < (9 * 60 + 30)) {
      isClosedWeekend = true;
      closedReason = "מוצאי שבת / בוקר יום ראשון";
    } else if (isHoliday) {
      isClosedWeekend = true;
      closedReason = holidayTitle || "חג";
    } else if (isErevHoliday && timeInMinutes >= (14 * 60)) {
      isClosedWeekend = true;
      closedReason = "ערב " + (holidayTitle || "חג");
    }

    // בדיקת קיום לקוח במאגר (לקוח חדש מקבל קישור שאלון קליטה)
    var isReturningCustomer = false;
    var customerName = "";
    var dogName = "";

    try {
      var queryUrl = SUPABASE_URL + "/rest/v1/bookings?select=owner_name,dog_name,owner_phone&order=created_at.desc&limit=200";
      var response = UrlFetchApp.fetch(queryUrl, {
        method: "get",
        headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY },
        muteHttpExceptions: true
      });

      if (response.getResponseCode() === 200) {
        var bookings = JSON.parse(response.getContentText());
        if (bookings && bookings.length > 0) {
          for (var j = 0; j < bookings.length; j++) {
            var bPhone = (bookings[j].owner_phone || "").replace(/[^0-9]/g, "");
            if (bPhone && bPhone.slice(-7) === phoneSuffix) {
              isReturningCustomer = true;
              customerName = (bookings[j].owner_name || "").trim();
              dogName = (bookings[j].dog_name || "").trim();
              break;
            }
          }
        }
      }
    } catch (dbErr) {
      Logger.log("DB Error: " + dbErr.toString());
    }

    var cleanName = customerName ? customerName.split(" ")[0] : (senderName ? senderName.split(" ")[0] : "");
    var greetingName = cleanName ? (" " + cleanName) : "";

    // ניסוח מענה אוטומטי
    var message = "";

    if (isClosedWeekend) {
      message = "היי" + greetingName + "! 🐾🐶\n"
        + "תודה שפנית ל*ריזורט לכלב*.\n\n"
        + "⏰ *שימו לב:* בסופי שבוע ובחגים שירות הלקוחות והמענה הטלפוני סגורים (סגור משישי ב-14:00 ועד ראשון ב-09:30).\n"
        + "בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐕🤍\n\n";

      if (isReturningCustomer) {
        message += "שמחנו לראות את הודעתך! " + (dogName ? "ד\"ש חם ל-" + dogName + "! 🐶\n" : "\n")
          + "נחזור אליך בשמחה ביום ראשון החל מהשעה 09:30.\n\n"
          + "בברכה,\nשמוליק - הריזורט לכלב 🐾";
      } else {
        message += "אם פניתם לגבי קליטה או שריון מקום לכלבכם, נשמח מאוד שתמלאו שאלון קצר (דקה אחת בלבד) כדי שנוכל לחזור אליכם ראשונים עם כל הפרטים והזמינות ביום ראשון בבוקר:\n"
          + "👉 https://rezort-webapp.vercel.app/?request=true\n\n"
          + "שיהיה סוף שבוע נעים ושקט,\nשמוליק וצוות הריזורט לכלב 🐾✨";
      }
    } else {
      if (!isReturningCustomer) {
        message = "היי" + greetingName + "! 🐾🐶\n"
          + "תודה שפנית ל*ריזורט לכלב* – פנסיון בוטיק, אילוף וחוויות לכלבים!\n\n"
          + "כדי שנוכל לתת לכם את המענה הטוב והמדויק ביותר, אנא מלאו שאלון קצר (דקה אחת בלבד) עם פרטי הכלב והתאריכים המבוקשים:\n"
          + "👉 https://rezort-webapp.vercel.app/?request=true\n\n"
          + "מיד לאחר מילוי השאלון ניצור איתכם קשר טלפוני לתיאום סופי.\n\n"
          + "בברכה חמה,\nשמוליק וצוות הריזורט לכלב 🐕🤍";
      } else {
        return ContentService.createTextOutput(JSON.stringify({ ok: true, reason: "open hours returning customer" })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // שליחת ההודעה דרך Green-API
    var sendUrl = "https://api.green-api.com/waInstance" + GREEN_API_ID + "/sendMessage/" + GREEN_API_TOKEN;
    var sendRes = UrlFetchApp.fetch(sendUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chatId: chatId, message: message }),
      muteHttpExceptions: true
    });

    // רישום Cooldown
    cache.put(cacheKey, "sent", 21600); // 6 שעות

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      sent: true,
      statusCode: sendRes.getResponseCode(),
      isClosedWeekend: isClosedWeekend,
      isReturningCustomer: isReturningCustomer
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("doPost Error: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * בדיקה האם היום הוא יום חול תקין למשלוח הודעות ערב (ימי ראשון עד חמישי בלבד, ללא שישי, שבת, ערבי חג וחגים)
 */
function isWeekdayForEveningSend(nowDate, israelTz) {
  var tz = israelTz || "Asia/Jerusalem";
  var d = nowDate || new Date();

  var dayOfWeek = parseInt(Utilities.formatDate(d, tz, "u"), 10); // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun

  // 1. שישי (5) ושבת (6) - לעולם לא שולחים בהם הודעות ערב
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    return { isWeekday: false, reason: "סוף שבוע (שישי / שבת)" };
  }

  // 2. יום כיפור
  if (isYomKippurNow(d, tz)) {
    return { isWeekday: false, reason: "יום כיפור" };
  }

  // 3. חגים וערבי חגים (ראש השנה, סוכות, פסח, שבועות וכו') מול Hebcal API
  try {
    var todayStr = Utilities.formatDate(d, tz, "yyyy-MM-dd");
    var year = Utilities.formatDate(d, tz, "yyyy");
    var month = Utilities.formatDate(d, tz, "M");
    var hebcalUrl = "https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&nx=off&year=" + year + "&month=" + month + "&ss=off&mf=off&c=off&geo=none&i=on";
    var hRes = UrlFetchApp.fetch(hebcalUrl, { muteHttpExceptions: true });
    if (hRes.getResponseCode() === 200) {
      var hData = JSON.parse(hRes.getContentText());
      var items = (hData && hData.items) ? hData.items : [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.date === todayStr) {
          var title = item.title || "";
          var heb = item.hebrew || "";
          return { isWeekday: false, reason: heb || title || "חג / ערב חג" };
        }
      }
    }
  } catch (eH) {
    Logger.log("isWeekdayForEveningSend Hebcal warning: " + eH.toString());
  }

  return { isWeekday: true, reason: "יום חול" };
}

/**
 * 2. שליחה יומית של בקשות חוות דעת והטבת מועדון יום לאחר שחרור הכלב
 * (מופעל בטריגר אוטומטי בימי חול בלבד בשעה 19:00 בערב)
 */
function sendDayAfterDepartureReviewRequests() {
  try {
    var now = new Date();
    var israelTz = "Asia/Jerusalem";
    var dayOfWeek = parseInt(Utilities.formatDate(now, israelTz, "u"), 10);
    var hour = parseInt(Utilities.formatDate(now, israelTz, "H"), 10);

    // וידוא ימי חול בלבד: לא שולחים בשישי, בשבת, בערבי חג ובחגים!
    var weekdayCheck = isWeekdayForEveningSend(now, israelTz);
    if (!weekdayCheck.isWeekday) {
      Logger.log("היום אינו יום חול (" + weekdayCheck.reason + ") - לא נשלחת בקשת חוות דעת. שקט מוחלט בסופ\"ש וחגים.");
      return;
    }

    // שולפים שחרורים מ-4 הימים האחרונים שטרם קיבלו בקשה (כדי לתפוס שחרורים מסופ\"ש או חג ביום ראשון הראשון שאחריהם)
    var fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    var fourDaysAgoStr = Utilities.formatDate(fourDaysAgo, israelTz, "yyyy-MM-dd");
    var yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    var yesterdayStr = Utilities.formatDate(yesterday, israelTz, "yyyy-MM-dd");

    var queryUrl = SUPABASE_URL + "/rest/v1/bookings?end_date=gte." + fourDaysAgoStr + "&end_date=lte." + yesterdayStr + "&stay_status=neq.cancelled&select=*";
    var response = UrlFetchApp.fetch(queryUrl, {
      method: "get",
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) return;

    var departures = JSON.parse(response.getContentText());
    if (!departures || departures.length === 0) return;

    var scriptProperties = PropertiesService.getScriptProperties();

    for (var i = 0; i < departures.length; i++) {
      var b = departures[i];
      var bookingKey = "review_request_sent_" + b.id;
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

      var ownerName = b.owner_name || "לקוח יקר";
      var dogName = b.dog_name || "הכלב";
      var ownerPhone = (b.owner_phone || "").replace(/[^0-9]/g, '');
      if (!ownerPhone) continue;

      var intlPhone = ownerPhone.indexOf('0') === 0 ? '972' + ownerPhone.substring(1) : ownerPhone;
      var chatId = intlPhone + "@c.us";

      var cleanDog = dogName.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '').slice(0, 8);
      var friendCode = "חבר-" + (cleanDog || "ריזורט") + "-" + Math.floor(100 + Math.random() * 900);

      var reviewMsg = "היי " + ownerName + " 😊\n"
        + "שמחנו ממש לארח את " + dogName + " אצלנו בריזורט לכלב! 🐾🤍\n"
        + "איך " + dogName + " התאקלם בחזרה בבית? התגעגענו אליו כבר!\n\n"
        + "💎 מעכשיו אתם רשמית חלק ממועדון ה-VIP של הריזורט לכלב!\n"
        + "באירוח הבא שלכם (3 ימים ומעלה), יחכה לכם פינוק VIP מתנה לבחירתכם:\n"
        + "✨ 100 ₪ הנחה ישירה\n"
        + "✨ יום כיף ושהות יומית VIP מתנה (09:00–19:00)\n"
        + "✨ סשן משחקי חשיבה והעשרה מנטלית (Brain Games)\n"
        + "✨ ספא חפיפה, פתיחת קשרים ובישום יוקרתי\n"
        + "✨ צ'ק אאוט מאוחר מוארך עד 19:00\n"
        + "✨ מארז שף גורמה: עצם לעיסה טבעית מעושנת ומעדני בריאות\n"
        + "(בהזמנה הבאה שלכם, פשוט מזינים את מספר הנייד בטופס והתפריט נפתח אוטומטית לבחירתכם!)\n\n"
        + "🤝 רוצים לפנק חברים עם כלב?\n"
        + "שתפו אותם בהודעה הזו – הם ייהנו מ-100 ₪ הנחה לשהות ראשונה (תוקף ל-6 חודשים), ואתם תצברו 100 ₪ הנחה לשהות הבאה שלכם!\n"
        + "קוד שובר חבר מביא חבר שלכם: *" + friendCode + "*\n\n"
        + "נשמח מאוד אם תפרגנו לנו בכמה מילים על החוויה שלכם:\n"
        + "⭐ ביקורת בגוגל: https://maps.app.goo.gl/G31uwaQXP6Ln5myX9\n"
        + "👍 פייסבוק: https://www.facebook.com/profile.php?id=61576998315714&sk=reviews\n"
        + "📸 אינסטגרם: https://www.instagram.com/dogz.resort/\n\n"
        + "מחכים לראותכם שוב!\n"
        + "שמוליק וצוות הריזורט לכלב 🐾🐶";

      var sendUrl = "https://api.green-api.com/waInstance" + GREEN_API_ID + "/sendMessage/" + GREEN_API_TOKEN;
      var sendRes = UrlFetchApp.fetch(sendUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ chatId: chatId, message: reviewMsg }),
        muteHttpExceptions: true
      });

      if (sendRes.getResponseCode() === 200) {
        scriptProperties.setProperty(bookingKey, new Date().toISOString());
      }
      Utilities.sleep(1500);
    }
  } catch (err) {
    Logger.log("sendDayAfterDepartureReviewRequests error: " + err.toString());
  }
}

/**
 * =========================================================================
 * 3. בדיקת יום כיפור (קודש קודשים - שקט מוחלט ללא שום הודעה אוטומטית ללקוחות)
 * =========================================================================
 * תחילת החסימה: ערב יום כיפור החל מהשעה 14:00 בדיוק.
 * סיום יום כיפור: 40 דקות בדיוק אחרי שקיעת השמש בישראל (מוצאי יום כיפור).
 */
function getYomKippurEndTimeMinutes(d) {
  try {
    var year = d.getFullYear();
    var month = d.getMonth() + 1;
    var hebcalUrl = "https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&nx=off&year=" + year + "&month=" + month + "&ss=off&mf=off&c=on&geo=pos&latitude=32.08&longitude=34.78&tzid=Asia/Jerusalem&m=40";
    var hRes = UrlFetchApp.fetch(hebcalUrl, { muteHttpExceptions: true });
    if (hRes.getResponseCode() === 200) {
      var hData = JSON.parse(hRes.getContentText());
      var items = (hData && hData.items) ? hData.items : [];
      var todayStr = Utilities.formatDate(d, "Asia/Jerusalem", "yyyy-MM-dd");
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.category === "havdalah" && it.date && it.date.indexOf(todayStr) === 0) {
          var timePart = it.date.split("T")[1];
          if (timePart) {
            var parts = timePart.split(":");
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          }
        }
      }
    }
  } catch (e) {}

  // חישוב אסטרונומי מקומי מדויק לשקיעת השמש בישראל
  try {
    var lat = 32.085;
    var lon = 34.781;
    var startOfYear = new Date(d.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((d.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    var gamma = (2 * Math.PI / 365) * (dayOfYear - 1);
    var eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    var decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma);
    var latRad = lat * Math.PI / 180;
    var zenithRad = 90.8333 * Math.PI / 180;
    var cosHourAngle = (Math.cos(zenithRad) / (Math.cos(latRad) * Math.cos(decl))) - (Math.tan(latRad) * Math.tan(decl));
    var hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;
    var sunsetUtcMinutes = 720 - 4 * lon - eqtime + hourAngle * 4;
    var sunsetIsraelMinutes = sunsetUtcMinutes + 180;
    return Math.round(sunsetIsraelMinutes + 40);
  } catch (e2) {}

  return 19 * 60 + 20;
}

function isYomKippurNow(nowDate, israelTz) {
  try {
    var tz = israelTz || "Asia/Jerusalem";
    var d = nowDate || new Date();
    var hour = parseInt(Utilities.formatDate(d, tz, "H"), 10);
    var minute = parseInt(Utilities.formatDate(d, tz, "m"), 10);
    var timeInMinutes = hour * 60 + minute;
    var todayStr = Utilities.formatDate(d, tz, "yyyy-MM-dd");
    var year = Utilities.formatDate(d, tz, "yyyy");
    var month = Utilities.formatDate(d, tz, "M");

    // בדיקה מול לוח עברי (Intl)
    try {
      var parts = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'numeric' }).formatToParts(d);
      var hDay = 0;
      for (var p = 0; p < parts.length; p++) {
        if (parts[p].type === 'day') hDay = parseInt(parts[p].value, 10);
      }
      var hMonth = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long' }).format(d).trim();
      if (hMonth.indexOf('תשרי') !== -1) {
        if (hDay === 9 && timeInMinutes >= 14 * 60) return true;
        if (hDay === 10) {
          var endKippurMinutes = getYomKippurEndTimeMinutes(d);
          return timeInMinutes < endKippurMinutes;
        }
      }
    } catch (eIntl) {}

    // גיבוי מול Hebcal API
    try {
      var hebcalUrl = "https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&nx=off&year=" + year + "&month=" + month + "&ss=off&mf=off&c=off&geo=none&i=on";
      var hRes = UrlFetchApp.fetch(hebcalUrl, { muteHttpExceptions: true });
      if (hRes.getResponseCode() === 200) {
        var hData = JSON.parse(hRes.getContentText());
        var items = (hData && hData.items) ? hData.items : [];
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (item.date === todayStr) {
            var title = item.title || "";
            var heb = item.hebrew || "";
            if (title === "Yom Kippur" || heb.indexOf("יום כיפור") !== -1) {
              var endKippurMinutesHebcal = getYomKippurEndTimeMinutes(d);
              return timeInMinutes < endKippurMinutesHebcal;
            }
            if ((title.indexOf("Erev Yom Kippur") !== -1 || heb.indexOf("ערב יום כיפור") !== -1) && timeInMinutes >= 14 * 60) {
              return true;
            }
          }
        }
      }
    } catch (eHebcal) {}

    return false;
  } catch (err) {
    Logger.log("isYomKippurNow error: " + err.toString());
    return false;
  }
}

/**
 * =========================================================================
 * 4. ניהול תור פניות במהלך יום כיפור ומענה אוטומטי מותאם מיד בצאת החג
 * =========================================================================
 */
function queueYomKippurContact(chatId, senderName) {
  try {
    var props = PropertiesService.getScriptProperties();
    var key = "yom_kippur_queue";
    var raw = props.getProperty(key);
    var list = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch (e) { list = []; }
    }
    
    var exists = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].chatId === chatId) {
        exists = true;
        break;
      }
    }
    
    if (!exists) {
      list.push({
        chatId: chatId,
        name: senderName || "",
        time: new Date().toISOString()
      });
      props.setProperty(key, JSON.stringify(list));
      Logger.log("נרשמה פנייה בתור יום כיפור מ: " + chatId);
    }
  } catch (err) {
    Logger.log("queueYomKippurContact error: " + err.toString());
  }
}

function scheduleYomKippurFollowupTrigger(now, israelTz) {
  try {
    var props = PropertiesService.getScriptProperties();
    var scheduledKey = "yk_trigger_scheduled";
    if (props.getProperty(scheduledKey)) {
      return;
    }

    var targetDate = getYomKippurEndDate(now, israelTz);
    if (!targetDate) return;

    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === "sendYomKippurFollowups") {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }

    ScriptApp.newTrigger("sendYomKippurFollowups")
      .timeBased()
      .at(targetDate)
      .create();

    props.setProperty(scheduledKey, targetDate.toISOString());
    Logger.log("תוזמן טריגר צאת יום כיפור לשעה: " + targetDate.toISOString());
  } catch (err) {
    Logger.log("scheduleYomKippurFollowupTrigger error: " + err.toString());
  }
}

function getYomKippurEndDate(now, israelTz) {
  try {
    var tz = israelTz || "Asia/Jerusalem";
    var d = now || new Date();
    var parts = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'numeric', timeZone: tz }).formatToParts(d);
    var hDay = 0;
    for (var p = 0; p < parts.length; p++) {
      if (parts[p].type === 'day') hDay = parseInt(parts[p].value, 10);
    }
    
    var kippurDay = new Date(d.getTime());
    if (hDay === 9) {
      kippurDay.setDate(kippurDay.getDate() + 1);
    }

    var totalMins = getYomKippurEndTimeMinutes(kippurDay);
    var endH = Math.floor(totalMins / 60);
    var endM = totalMins % 60;

    var yStr = Utilities.formatDate(kippurDay, tz, "yyyy-MM-dd");
    var targetIso = yStr + "T" + (endH < 10 ? "0" + endH : endH) + ":" + (endM < 10 ? "0" + endM : endM) + ":00+03:00";
    return new Date(targetIso);
  } catch (err) {
    Logger.log("getYomKippurEndDate error: " + err.toString());
    return null;
  }
}

function sendYomKippurFollowups() {
  try {
    var props = PropertiesService.getScriptProperties();
    var key = "yom_kippur_queue";
    var raw = props.getProperty(key);
    if (!raw) return;

    var list = [];
    try { list = JSON.parse(raw); } catch (e) { list = []; }
    if (!list || list.length === 0) return;

    props.deleteProperty("yk_trigger_scheduled");

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var chatId = item.chatId;
      var cleanName = (item.name || "").trim().split(" ")[0];
      var greetingName = cleanName ? (" " + cleanName) : "";

      var message = "גמר חתימה טובה" + greetingName + "! 🕯️🐾\n"
        + "תודה רבה על פנייתך לריזורט לכלב.\n"
        + "בשל קדושת יום כיפור, שירות הלקוחות שלנו שבת מפעילות ולא שלחנו מענה מיידי. אנו מקווים מכל הלב שעבר עליכם צום מועיל, ושהשנה החדשה תביא עמה ברכה, שלווה ובריאות איתנה. 🤍✨\n\n"
        + "🐶 כמובן שכל הכלבים היקרים שמתארחים אצלנו בריזורט קיבלו לאורך כל החג והצום את מלוא תשומת הלב, האהבה, הטיפול והפינוק 24/7 מסביב לשעון!\n\n"
        + "⏰ שירות הלקוחות והמענה הטלפוני יחזור לפעילות מלאה מחר בבוקר בשעה 09:30, ונשמח לעמוד לרשותכם ולחזור אליכם לכל שאלה ותיאום.\n\n"
        + "אם פניתם לקליטה, שריון מקום או בדיקת זמינות, נשמח שתמלאו בינתיים שאלון קצר (דקה אחת בלבד) כדי שנוכל לחזור אליכם ראשונים עם כל הפרטים:\n"
        + "👉 https://rezort-webapp.vercel.app/?request=true\n\n"
        + "בברכה חמה ושנה טובה,\n"
        + "שמוליק וצוות הריזורט לכלב 🐾🐕";

      var sendUrl = "https://api.green-api.com/waInstance" + GREEN_API_ID + "/sendMessage/" + GREEN_API_TOKEN;
      UrlFetchApp.fetch(sendUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ chatId: chatId, message: message }),
        muteHttpExceptions: true
      });

      Utilities.sleep(1200);
    }

    props.deleteProperty(key);
    Logger.log("נשלח מענה צאת יום כיפור ל-" + list.length + " פונים בהצלחה.");
  } catch (err) {
    Logger.log("sendYomKippurFollowups error: " + err.toString());
  }
}

/**
 * =========================================================================
 * 5. משלוח יומי אוטומטי בשעה 20:00 לבעלי כלבים השוהים בריזורט (הודעות מנקודת מבט הכלב)
 * =========================================================================
 */

/**
 * -------------------------------------------------------------------------
 * תבניות ייעודיות למוצאי שבת (סיכום סופ"ש חוויתי ומפנק בריזורט)
 * מותאמות אישית: פריקת אנרגיה בדשא לכלבים חברותיים, ושלווה VIP לכלבים בבידוד.
 * -------------------------------------------------------------------------
 */
var WEEKEND_DOG_TEMPLATES = [
  // --- לכלבים חברותיים בלהקה (friendly / safe) ---
  { id: 201, type: "friendly", text: "שבוע טוב {ownerName}! 🐾 שמעתי שהיה לכם סופ\"ש סוער בעניינים שלכם, אבל חכו שתשמעו על הסופ\"ש שלי בריזורט! שבת שלמה של משחקי דשא עם כל החברים, ריצות וחטיפי שבת 🎾👑 עכשיו אני נח כמו מלך בסוויטה לקראת שבוע חדש. אוהב מלא, {dogName} 🐶❤️✨" },
  { id: 202, type: "friendly", text: "היי {ownerName}, שבוע טוב! 🌟 בזמן שאתם נחתם בסופ\"ש, אני קרעתי את החצר בתופסת עם להקת החברים! 🏃‍♂️🐾 היה סופ\"ש של חלומות, ועכשיו שקעתי בחלומות מתוקים בסוויטה הממוזגת. שיהיה שבוע נהדר, {dogName} 🐕✨" },
  { id: 203, type: "friendly", text: "שבוע מבורך {ownerName}! 🐶 איזה סופ\"ש מהסרטים עבר עלי בריזורט! רצתי על הדשא, השתזפתי בפינות המוצלות, ולא הפסקתי לכשכש בזנב מרוב אושר 🌿🎾 תמשיכו לבלות בכיף, אני הכי בסבבה בעולם! {dogName} 🐾😎" },
  { id: 204, type: "friendly", text: "שבוע טוב {ownerName}! 🐾 רק מעדכן שהסופ\"ש שלי בריזורט היה 10 מתוך 10! אוויר צח של שבת, חברים טובים וליטופים ללא הפסקה מהצוות המסור. אל תדאגו לי בכלל, הכל מושלם! אוהב, {dogName} 🐕👑" },
  { id: 205, type: "friendly", text: "היי {ownerName}! 🐾 מקווה שהיה לכם סופ\"ש רגוע כמו שהיה לי בריזורט! שבת שלמה של כיף, מים צוננים ומשחקי כדור עם החברים 🎾💤 עכשיו אחרי ארוחת ערב טעימה אני מוכן לשבוע חדש. שבוע טוב ומבורך! {dogName} 🐶❤️" },
  { id: 206, type: "friendly", text: "שבוע טוב {ownerName}! 🌟 אם תהיתם איך עבר עלי הסופ\"ש – תדמיינו מלון חמישה כוכבים עם חצר דשא ענקית וחברים על 4 בלי הפסקה! היה מושלם, תיהנו בעניינים שלכם! {dogName} 🐕🏖️" },
  { id: 207, type: "friendly", text: "ד\"ש חם ממוצאי שבת {ownerName}! 🐾 איזה כיף של סופ\"ש היה לי! בזמן שאתם ביליתם, אני ניהלתי פה את משחקי השבת בחצר והוכחתי לכולם מי אלוף הריצות 🏃‍♂️👑 שבוע מבורך ושקט, {dogName} 🐶✨" },
  { id: 208, type: "friendly", text: "שבוע טוב {ownerName}! 🐶 סיכום סופ\"ש קצר: רצתי, שיחקתי, נבחתי מאושר, אכלתי מצוין והתפנקתי במיטה הממוזגת שלי 🛋️🐾 אתם יכולים להיות רגועים לגמרי! שבוע קסום, {dogName} ❤️✨" },
  { id: 209, type: "friendly", text: "היי {ownerName}! 🐾 מוצאי שבת הגיע ואני מסכם סופ\"ש אגדי בריזורט! כלבים, משחקים, פינוקים והמון אהבה. עכשיו אני ישן שנת ישרים. שבוע מוצלח ומלא חיוכים! {dogName} 🐕💤" },
  { id: 210, type: "friendly", text: "שבוע טוב ומבורך {ownerName}! 🌟 רק רציתי להזכיר לכם שסופ\"ש בריזורט הוא חלום – לא התגעגעתי אפילו לרגע (טוב, אולי טיפונת 😉) כי היה פשוט מדהים עם כל החברים! אוהב, {dogName} 🐶❤️" },

  // --- לכלבים בבידוד / יחס אישי בלבד (isolation / safe) ---
  { id: 211, type: "isolation", text: "שבוע טוב {ownerName}! 🐾 איזה סופ\"ש של שקט ורוגע מלכותי עבר עלי בסוויטה הפרטית בריזורט! 🛋️✨ בזמן שאתם ביליתם בסופ\"ש, אני קיבלתי יחס אישי VIP, טיולים מפנקים בחצר הפרטית וים של ליטופי בטן בלי שאף אחד יפריע לי. שבוע מבורך! {dogName} 🐶👑❤️" },
  { id: 212, type: "isolation", text: "היי {ownerName}, שבוע טוב! 🌿 רציתי לעדכן שהסופ\"ש שלי היה שיא השלווה והפינוק. טיולי רחרוח אישיים, חטיפי שבת טעימים והמון זמן איכות וחיבוקים עם המטפלים. אני רגוע, שבע ומאושר! {dogName} 🐕✨" },
  { id: 213, type: "isolation", text: "שבוע טוב ומבורך {ownerName}! 🐾 אם חשבתם שהיה לי משעמם בסופ\"ש – ממש לא! הסוויטה ממוזגת, המתחם הפרטי שלי שקט ובטוח, וקיבלתי פינוקי שבת ברמה הכי גבוהה שיש. שיהיה שבוע שקט ומוצלח! {dogName} 🐶💤" },
  { id: 214, type: "isolation", text: "ד\"ש מסוף שבוע פרטי של אלופים {ownerName}! 👑 סיכום סופ\"ש בסוויטה האישית: אפס לחצים, מקסימום פינוקים, ארוחות שבת טעימות ורוגע אמיתי. תיהנו בעניינים שלכם, אני בידיים הכי טובות! שבוע טוב, {dogName} 🐾❤️" },
  { id: 215, type: "isolation", text: "שבוע טוב {ownerName}! 🌟 סיימתי עכשיו סופ\"ש שליו ומפנק במיוחד במתחם המוגן שלי. המטפלים ישבו איתו לזמן איכות ארוך והרעיפו עלי אהבה. עכשיו אני ישן עמוק ושלו. שבוע מקסים! {dogName} 🐕🌸" }
];

var DAILY_DOG_TEMPLATES = [
  // קבוצה 1: טיול יומי בטבע, הרפתקאות וריחות (1–20) - מתאים לכולם
  { id: 1, type: "safe", text: "היי {ownerName}! 🐾 סיימתי עכשיו טיול יומי בטבע של אלופים אמיתיים! 🌲🌿 ריחרחתי כל עץ ושיח, ועכשיו אני שוכב רגוע ומרוצה בסוויטה שלי 🛋️✨ תיהנו בעניינים שלכם, אוהב {dogName} 🐶❤️" },
  { id: 2, type: "safe", text: "ערב טוב {ownerName}! 🐾 בזמן שאתם בעניינים שלכם, אני חרשתי היום את השבילים בטיול טבע משגע! 🌲🐾 שמוליק ניסה לעמוד בקצב המלכותי שלי... תבלו בכיף, {dogName} 🐕👑🌿" },
  { id: 3, type: "safe", text: "היי {ownerName}! 🐾 רק רציתי לעדכן שהטבע פה פשוט וואוו! 🌲✨ חזרתי מהטיול היומי עמוס בחוויות וריחות חדשים, ועכשיו אני נח כמו מלך אמיתי 👑🛋️ נשיקות מ-{dogName} 🐶💋" },
  { id: 4, type: "safe", text: "ערב טוב {ownerName}! 🐾 הודעתי לשמוליק ששעת היציאה לטבע הגיעה, והוא מיד התייצב ללוות אותי למסלול מהמם! 🌲🐕 היה מושלם ואני הכי בסבבה בעולם! {dogName} 🐶👑🌾" },
  { id: 5, type: "safe", text: "היי {ownerName}! 🐾 נשמתי היום אוויר צלול בטיול בטבע, חקרתי שבילים חדשים ועכשיו הראש שלי שקוע עמוק בכרית 🌲😴 תיהנו איפה שאתם, הכל דבש! {dogName} 🐕🍃✨" },
  { id: 6, type: "safe", text: "ערב טוב {ownerName}! 🐾 עשיתי היום צעידה של אלופים בטיול בטבע, ועכשיו אני מתכנן שנת יופי ארוכה ומלכותית 🌲💤👑 תמשיכו לבלות בראש שקט לגמרי, {dogName} 🐶✨" },
  { id: 7, type: "safe", text: "היי {ownerName}! 🐾 הטיול היומי בטבע היה כזה מושלם, שממש מגיע לכם להמשיך לבלות בלי שום דאגות! 🌲🐾 הכל פה 10 מתוך 10! אוהב המון, {dogName} 🐕⭐❤️" },
  { id: 8, type: "safe", text: "ערב טוב {ownerName}! 🐾 המרחבים בטיול הטבע פשוט פתחו לי את הנשמה! 🌲🌿 עכשיו אני שוכב מרוצה על הגב ומחכה למנת הליטופים של הערב 💆‍♂️ תעשו חיים, {dogName} 🐶✨" },
  { id: 9, type: "safe", text: "היי {ownerName}! 🐾 בזמן שאתם בפקקים או בסידורים, אני טיילתי בטבע כמו שייח' אמיתי עם פמליה צמודה! 🌲👑 תיהנו בכיף שלכם, {dogName} 🐕🕶️✨" },
  { id: 10, type: "safe", text: "ערב טוב {ownerName}! 🐾 בדקתי היום בטיול בטבע כל אבן, ענף ועלה, ואישרתי שהאיכות מעולה! 🌲🔍 סמכו עליי, אני בשיא שלי! ד״ש מ-{dogName} 🐶👑🌾" },
  { id: 11, type: "safe", text: "היי {ownerName}! 🐾 מעדכן ישירות מהשטח: הטיול בטבע היה הצלחה מסחררת, והשנ״צ שאחריו שובר שיאים! 🌲😴💤 תבלו בלי חשבון, {dogName} 🐕✨" },
  { id: 12, type: "safe", text: "ערב טוב {ownerName}! 🐾 איזה כיף לחלץ עצמות במרחבים הפתוחים של הטבע! 🌲🐾 אל תרגישו אשמים אפילו לרגע – אני עושה פה חיים משוגעים! {dogName} 🐶🥳✨" },
  { id: 13, type: "safe", text: "היי {ownerName}! 🐾 אם יש משהו שאני הכי אוהב זה טיול טוב בטבע ומיטה סופר מפנקת בסופו 🌲🛋️ יש פה את שניהם ברמת 5 כוכבים! ערב מעולה, {dogName} 🐕⭐🤍" },
  { id: 14, type: "safe", text: "ערב טוב {ownerName}! 🐾 שמוליק לקח אותי היום למסלול טבע לפנתיאון! 🌲🌿 חזרתי עם חיוך מאוזן לאוזן וזנב שלא מפסיק לכשכש 😄🐾 תיהנו שם, {dogName} 🐶❤️" },
  { id: 15, type: "safe", text: "היי {ownerName}! 🐾 החיים בטבע עשו לי רק טוב – שקט, שלווה ונופים מדהימים 🌲🌄 תמשיכו בעיסוקים שלכם בנחת, הכל פה תחת שליטה! {dogName} 🐕🍃✨" },
  { id: 16, type: "safe", text: "ערב טוב {ownerName}! 🐾 אחרי טיול חלומי בטבע, הבנתי ששנינו בחופשה מושלמת במקביל! 🌲✈️ תעשו חיים, אני מסודר מכף רגל ועד זנב! {dogName} 🐶👑💖" },
  { id: 17, type: "safe", text: "היי {ownerName}! 🐾 שרפתי קלוריות בטיול בטבע, ועכשיו אני שוכב רפוי ומאושר כמו שטיח פרסי יוקרתי בסוויטה 🌲🛋️ שיהיה לכם ערב פגז, {dogName} 🐕👑✨" },
  { id: 18, type: "safe", text: "ערב טוב {ownerName}! 🐾 הטבע פה מסביב פשוט משגע! 🌲🍃 שמוליק והצוות דואגים שלא יחסר למלכות שלי אפילו גרגר פינוק אחד 👑 תבלו בכיף, {dogName} 🐶❤️" },
  { id: 19, type: "safe", text: "היי {ownerName}! 🐾 הזנב שלי כישכש בלי הפסקה לאורך כל הטיול בטבע, ועכשיו הוא במצב מנוחה 🌲🐾 אל תדאגו לי לשנייה – הכל מושלם! אוהב, {dogName} 🐕✨🥰" },
  { id: 20, type: "safe", text: "ערב טוב {ownerName}! 🐾 חזרתי מהטיול היומי בטבע, שתיתי מים צוננים מקערה נקייה ונכנסתי למוד פינוק לילי 🌲🥣💤 תיהנו בעניינים שלכם ברוגע! {dogName} 🐶🤍" },

  // קבוצה 2: הכלב הוא המלך ושמוליק עובד אצלי (21–40) - מתאים לכולם
  { id: 21, type: "safe", text: "היי {ownerName}! 🐾 שמעתי שאתם עובדים קשה... אל תשכחו שמישהו צריך לממן למלך שלו את הריזורט המפנק הזה! 👑💳 תמשיכו לעבוד, אני נח פה! {dogName} 🐶😎✨" },
  { id: 22, type: "safe", text: "ערב טוב {ownerName}! 🐾 שמוליק חשב לרגע שהוא המנהל פה, עד שנתתי לו מבט של מי באמת קובע את הלו״ז בריזורט 👑 הכל תחת שליטה מלאה שלי! {dogName} 🐶👑✨" },
  { id: 23, type: "safe", text: "היי {ownerName}! 🐾 הדרכתי היום את שמוליק בדיוק איך אני אוהב את הכרית שלי תפוחה ואת הליטוף בסנטר 🛋️ הוא לומד מהר, יש לו פוטנציאל! {dogName} 🐕👑🎓" },
  { id: 24, type: "safe", text: "ערב טוב {ownerName}! 🐾 העברתי לשמוליק רשימת דרישות למחר: טיול טבע מוקדם, פינוק VIP ואפס הפרעות לשנ״צ 🌲📋 הוא רשם הכל בדייקנות! תבלו, {dogName} 🐶👑✨" },
  { id: 25, type: "safe", text: "היי {ownerName}! 🐾 נתתי לשמוליק ציון 10 מתוך 10 על שירות החדרים היום 🛎️ הוא מתאמץ מאוד לרצות את הוד מלכותי! תמשיכו בעניינים שלכם, {dogName} 🐕👑⭐" },
  { id: 26, type: "safe", text: "ערב טוב {ownerName}! 🐾 שמוליק קרא לי 'חמוד', אז הזכרתי לו בנימוס שהתואר הרשמי שלי הוא 'הוד מעלתו' 👑 המשרתים פה ממש בסדר! נשיקות, {dogName} 🐶👑🤍" },
  { id: 27, type: "safe", text: "היי {ownerName}! 🐾 הלו״ז שלי בריזורט סופר קפדני: אני נובח, שמוליק מתייצב עם פינוק, אני מנמנם 👑🛌 קשה לנהל מקום כזה, אבל הכל עובד מעולה! {dogName} 🐕👑✨" },
  { id: 28, type: "safe", text: "ערב טוב {ownerName}! 🐾 אם הייתם רואים איך כולם פה קופצים לדום כשאני מתמתח, הייתם מצדיעים לי בעצמכם! 👑🫡 תיהנו איפה שאתם, המלך מסודר! {dogName} 🐶👑🥂" },
  { id: 29, type: "safe", text: "היי {ownerName}! 🐾 תפסתי בעלות על הסוויטה הכי שווה בריזורט והסברתי לשמוליק שכאן יש רק בוס אחד 👑🐾 הוא הסכים מיד! תבלו בכיף, {dogName} 🐕👑🛋️" },
  { id: 30, type: "safe", text: "ערב טוב {ownerName}! 🐾 נבחתי נביחה אחת קטנה, ושמוליק מיד בדק שהמים קרים והשמיכה ישרה 🛎️💧 השירות פה פשוט ברמה מלכותית! תעשו חיים, {dogName} 🐶👑✨" },
  { id: 31, type: "safe", text: "היי {ownerName}! 🐾 אני שוקל למנות את שמוליק לעוזר האישי שלי גם כשאחזור הביתה... הוא מיומן מאוד בגירוד מאחורי האוזן! 👂👑 תיהנו בעניינים שלכם, {dogName} 🐕👑😏" },
  { id: 32, type: "safe", text: "ערב טוב {ownerName}! 🐾 בדקתי ביומן המלכותי שלי וראיתי שיש לי זמן פנוי רק לעוד נמנום עמוק אחד הלילה 👑😴 תמשיכו בעיסוקים שלכם בנחת, {dogName} 🐶👑🌙" },
  { id: 33, type: "safe", text: "היי {ownerName}! 🐾 אל תדאגו לי לרגע – הצוות פה עושה מסדר בוקר ומסדר ערב סביב המיטה שלי 👑🛏️ החיים הטובים לגמרי! ד״ש מ-{dogName} 🐕👑✨" },
  { id: 34, type: "safe", text: "ערב טוב {ownerName}! 🐾 שמעתי שאתם נהנים שם, אז הרשיתי לעצמי לרבוץ כמו קיסר בלי שום נקיפות מצפון 👑🛋️ תבלו, אני פה בשיא הפאר! {dogName} 🐶👑🍷" },
  { id: 35, type: "safe", text: "היי {ownerName}! 🐾 שמוליק ניסה לשכנע אותי שהיום נגמר, אבל הודעתי לו שמגיע לי עוד סיבוב ליטופים מלכותי 👑💆‍♂️ והוא ביצע מיד! ערב מושלם, {dogName} 🐕👑❤️" },
  { id: 36, type: "safe", text: "ערב טוב {ownerName}! 🐾 עוד יום של שלטון בלעדי בריזורט נסגר בהצלחה מוחצת 👑🐾 תמשיכו לחגוג איפה שאתם, הכל פה טיפ-טופ! {dogName} 🐶👑🎉" },
  { id: 37, type: "safe", text: "היי {ownerName}! 🐾 הפינוק פה בריזורט כל כך מוגזם שאני שוקל לקנות את המקום ולהעסיק את שמוליק במשרה מלאה... 👑💼 סתם, מתגעגע! תיהנו, {dogName} 🐕👑😉" },
  { id: 38, type: "safe", text: "ערב טוב {ownerName}! 🐾 המיטה שלי פה כל כך רכה שזה מרגיש כמו לשכב על ענן מלכותי ☁️👑 תמשיכו בעיסוקים שלכם, המלך מאושר! {dogName} 🐶👑✨" },
  { id: 39, type: "safe", text: "היי {ownerName}! 🐾 תרגישו בנוח להישאר עסוקים – הצוות בריזורט משרת אותי ברמת 7 כוכבים פלוס כתר! 👑⭐ באהבה ענקית, {dogName} 🐕👑💎" },
  { id: 40, type: "safe", text: "ערב טוב {ownerName}! 🐾 יום שלם של הוד מלכותי, טיול בטבע ופינוקים הגיע לסיומו 👑🌲💤 תעשו חיים, אני בסבבה של החיים! {dogName} 🐶👑🏖️" },

  // קבוצה 3: הארוחה היומית, שובע עילאי ופינוק VIP (41–60) - מתאים לכולם
  { id: 41, type: "safe", text: "היי {ownerName}! 🐾 הארוחה היומית הייתה פשוט מעדן גורמה של 5 כוכבים מישלן! 🍲⭐ ליקקתי את הקערה בנחת ועכשיו הבטן מלאה ומאושרת. תיהנו, {dogName} 🐶😋✨" },
  { id: 42, type: "safe", text: "ערב טוב {ownerName}! 🐾 קיבלתי היום את הקערה העשירה והטעימה שלי בדיוק בזמן 🥩🍲 ואחריה ליטוף ארוך ומפנק בבטן השבעה. תבלו בכיף, {dogName} 🐕😋🤍" },
  { id: 43, type: "safe", text: "היי {ownerName}! 🐾 ארוחה יומית מושלמת ומשביעה, קערת מים צוננים וצוות שלא מפסיק ללטף 🍲💧 אתם יכולים להיות רגועים לגמרי, אני שבע ומבסוט! {dogName} 🐶🍖✨" },
  { id: 44, type: "safe", text: "ערב טוב {ownerName}! 🐾 בטן מלאה בכל טוב, לב רגוע ומיטה סופר מפנקת 🍲🛋️ מה עוד כלב יכול לבקש בעולם הזה? תמשיכו בעניינים שלכם, {dogName} 🐕🤍✨" },
  { id: 45, type: "safe", text: "היי {ownerName}! 🐾 הצוות פה יודע בדיוק מתי להגיש את הארוחה היומית ואיך אני אוהב שמגרדים לי מאחורי האוזניים בזמן שאני שבע ומרוצה 🍲👂 הכל מושלם! {dogName} 🐶🥩❤️" },
  { id: 46, type: "safe", text: "ערב טוב {ownerName}! 🐾 אכלתי ארוחה מעולה, שתיתי לרוויה, ועכשיו אני שוכב ונאנח מאושר עם בטן עגולה ומרוצה 🍲💤 תבלו איפה שאתם! באהבה, {dogName} 🐕😋🍖" },
  { id: 47, type: "safe", text: "היי {ownerName}! 🐾 הגישו לי היום את הארוחה היומית כמו למלך במסעדת יוקרה – טעים, מזין ומשביע בטירוף 🍲👑 תמשיכו ליהנות מהבילויים שלכם, {dogName} 🐶🍽️✨" },
  { id: 48, type: "safe", text: "ערב טוב {ownerName}! 🐾 רק מעדכן שהקערה מבריקה מאושר, הבטן שלי מלאה והזנב מכשכש בקצב שיא 🍲🐾 תעשו חיים, {dogName} 🐕✨🥰" },
  { id: 49, type: "safe", text: "היי {ownerName}! 🐾 אחרי ארוחה יומית דשנה וטיול מדהים בטבע, אין כלב מאושר ושבע ממני עלי אדמות 🌲🍲 תיהנו מכל רגע, {dogName} 🐶🌳💖" },
  { id: 50, type: "safe", text: "ערב טוב {ownerName}! 🐾 קיבלתי קערה מלאה כל טוב ומנת אהבה ענקית מהצוות 🍲❤️ אני מסודר ושבע לגמרי, תמשיכו בכיף שלכם! {dogName} 🐕🍖✨" },
  { id: 51, type: "safe", text: "היי {ownerName}! 🐾 הליטופים בבטן אחרי הארוחה היומית פה הם פשוט ברמה בינלאומית 💆‍♂️🍲 רק רציתי שתדעו שהכל פצצה! אוהב, {dogName} 🐶😋🏆" },
  { id: 52, type: "safe", text: "ערב טוב {ownerName}! 🐾 סעודה משובחת, חטיף בריאות טבעי וליטוף מרגיע לפני השינה 🍲✨ אתם בידיים טובות, וגם אני שבע ומפונק! {dogName} 🐕🌙🤍" },
  { id: 53, type: "safe", text: "היי {ownerName}! 🐾 שבע, רגוע, מבסוט ומנומנם – השילוב האולטימטיבי של סוף יום בריזורט 🍲😴 שיהיה לכם ערב מקסים, {dogName} 🐶💤✨" },
  { id: 54, type: "safe", text: "ערב טוב {ownerName}! 🐾 שמוליק והצוות דואגים לכל ביס ולכל פינוק שלי בדיוק לפי הספר של המלכים 🍲📖👑 תמשיכו לבלות בראש שקט, {dogName} 🐕🍖⭐" },
  { id: 55, type: "safe", text: "היי {ownerName}! 🐾 הארוחה היומית הייתה כל כך טעימה שליקקתי את השפתיים עשר דקות אחרי! 🍲😋 תיהנו בעניינים שלכם, אני מרוצה עד הגג! {dogName} 🐶✨🍖" },
  { id: 56, type: "safe", text: "ערב טוב {ownerName}! 🐾 בטן מלאה וטובה עושה כלב שליו ומאושר 🍲💤 תבלו איפה שאתם בלי שום דאגות! נשיקות מ-{dogName} 🐕💋🤍" },
  { id: 57, type: "safe", text: "היי {ownerName}! 🐾 רק מדווח שקיבלתי את מנת האוכל המלכותית שלי ופינוקים ללא הגבלה 🍲👑 תמשיכו ליהנות, הכל פה 100%! {dogName} 🐶🏆✨" },
  { id: 58, type: "safe", text: "ערב טוב {ownerName}! 🐾 מים צוננים, קערת אוכל משובחת ומיטה נוחה – אני מסודר ללילה כמו שצריך! 🍲🛏️ תיהנו המון, {dogName} 🐕🌙✨" },
  { id: 59, type: "safe", text: "היי {ownerName}! 🐾 האוכל היה מדהים, אבל החיבוקים פה בריזורט אחרי הארוחה שווים מיליון דולר 🍲🤗 שיהיה לכם ערב נפלא, {dogName} 🐶❤️✨" },
  { id: 60, type: "safe", text: "ערב טוב {ownerName}! 🐾 סיימתי את הארוחה היומית בנחת, עשיתי מתיחה גדולה ועכשיו אני נרדם מחויך ומרופד 🍲🥱 תעשו חיים, {dogName} 🐕💤👑" },

  // קבוצה 4: געגועים חמודים עם קריצה וביטחון (61–80) - מתאים לכולם
  { id: 61, type: "safe", text: "היי {ownerName}! 🐾 אני מתגעגע אליכם, אבל בינינו... ממש ממש כיף לי פה, אז קחו את הזמן שלכם בנחת! 🐶😜 תיהנו מכל רגע, אוהב {dogName} ❤️✨" },
  { id: 62, type: "safe", text: "ערב טוב {ownerName}! 🐾 חושב עליכם בין טיול בטבע לתנומה על המיטה המפנקת 🌲🛋️ אבל אל תדאגו – אני חוגג פה בענק! {dogName} 🐕👑💫" },
  { id: 63, type: "safe", text: "היי {ownerName}! 🐾 רק מוודא שאתם לא מתגעגעים יותר מדי... כי אני פה שקוע בפינוקים וליטופים עד מעל האוזניים! 🐶🥰 נשיקות מ-{dogName} 💋✨" },
  { id: 64, type: "safe", text: "ערב טוב {ownerName}! 🐾 אוהב אתכם מלא, אבל חייב להודות שהחופשה בריזורט באה לי בול בזמן! 🏖️🐶 תמשיכו לעשות חיים משוגעים, {dogName} 🐕🤍🎉" },
  { id: 65, type: "safe", text: "היי {ownerName}! 🐾 אם חשבתם שאני יושב ובוכה ליד הדלת – תחשבו שוב, אני מקבל עכשיו מסאז' מלכותי בגב 💆‍♂️👑 תיהנו, {dogName} 🐶✨😎" },
  { id: 66, type: "safe", text: "ערב טוב {ownerName}! 🐾 מקווה שאתם נהנים שם לפחות חצי ממה שאני נהנה פה בריזורט! 🥳🐕 אוהב המון ומשדר אנרגיות שיא, {dogName} 💫❤️" },
  { id: 67, type: "safe", text: "היי {ownerName}! 🐾 תרגישו חופשי להאריך את התוכניות שלכם, המלך פה ממש לא לחוץ לחזור לשגרה... 👑🏖️ ד״ש מ-{dogName} 🐶😉✨" },
  { id: 68, type: "safe", text: "ערב טוב {ownerName}! 🐾 רק מציץ לוודא שאתם רגועים – אני פה מאושר, מחובק ושמח עד השמיים! 🐶🥰 תמשיכו בעניינים שלכם בכיף, {dogName} 🐕💖✨" },
  { id: 69, type: "safe", text: "היי {ownerName}! 🐾 אתם בלב שלי תמיד, אבל הריזורט הזה פשוט הצגה של 5 כוכבים! ⭐🌟 תמשיכו לבלות בנחת, {dogName} 🐶👑🥂" },
  { id: 70, type: "safe", text: "ערב טוב {ownerName}! 🐾 אם אתם מרגישים פתאום געגוע, קחו נשימה עמוקה – אני בידיים הכי אוהבות ומקצועיות בעולם! 🐕🤍 תבלו בכיף, {dogName} 🐶✨" },
  { id: 71, type: "safe", text: "היי {ownerName}! 🐾 נכון שאני מתגעגע קצת, אבל אל תתנו לזה לקלקל לכם את הכיף – אני חוגג פה בטירוף! 🥳🐾 אוהב מלא, {dogName} 🐕🎉❤️" },
  { id: 72, type: "safe", text: "ערב טוב {ownerName}! 🐾 שולח לכם חיבוק חם ורטוב מרחוק, ומיד חוזר להתרפק על המיטה המפנקת שלי בריזורט! 🐶🤗 תיהנו, {dogName} 🐕💤✨" },
  { id: 73, type: "safe", text: "היי {ownerName}! 🐾 בטוח שאתם חושבים עליי ברגעים אלה... אז הנה אות חיים רשמי: הכל מושלם בריזורט, תבלו בראש שקט! 💌🐶 נשיקות, {dogName} 🐾❤️" },
  { id: 74, type: "safe", text: "ערב טוב {ownerName}! 🐾 איזה מזל שיש לי את הריזורט לכלב! אני חוגג פה חופשת חלומות מהסרטים 🎬🐕 ד״ש חם מ-{dogName} 🐶🍿✨" },
  { id: 75, type: "safe", text: "היי {ownerName}! 🐾 שולח לכם כשכוש זנב ענק, רוטט ומאושר מכל הלב! 🐾✨ תיהנו איפה שאתם, אני הכי מרוצה בעולם, {dogName} 🐕🥰💖" },
  { id: 76, type: "safe", text: "ערב טוב {ownerName}! 🐾 רק רציתי להגיד תודה ענקית שסידרתם לי חופשה ברמה כזאת בזמן שאתם עסוקים 🙏🐶 תמשיכו בכיף, {dogName} 🐕👑🤍" },
  { id: 77, type: "safe", text: "היי {ownerName}! 🐾 אל תמהרו לחזור... כלומר ברור שתחזרו, אבל קודם כל תמצו כל שנייה של הנאה! 😜🐾 באהבה ענקית, {dogName} 🐶❤️✨" },
  { id: 78, type: "safe", text: "ערב טוב {ownerName}! 🐾 חושב עליכם באהבה ענקית מתוך הסוויטה המלכותית שלי בריזורט 🌙🛋️ תיהנו המון איפה שאתם, {dogName} 🐕👑💤" },
  { id: 79, type: "safe", text: "היי {ownerName}! 🐾 הלב שלי איתכם תמיד, אבל הגוף שלי נח בריזורט ברמת 5 כוכבים פלוס 👑⭐ תבלו בלי שום חשבון, {dogName} 🐶✨💖" },
  { id: 80, type: "safe", text: "ערב טוב {ownerName}! 🐾 שולח נשיקה רטובה ישר על האף ומאחל לכם ערב מושלם! 💋🐶 אני פה בעננים המלכותיים, {dogName} 🐕☁️👑" },

  // קבוצה 5א: מדשאת משחקים וחברים על 4 - לחברותיים בלבד (81–90) [לעולם לא לבידוד!]
  { id: 81, type: "friendly", text: "היי {ownerName}! 🐾 השתוללתי היום במדשאת המשחקים עם חברים על 4, רצנו כמו מטורפים ועכשיו אני נרדם מאושר! 🎾🐕 תיהנו שם, {dogName} 🐶🎉💤" },
  { id: 82, type: "friendly", text: "ערב טוב {ownerName}! 🐾 המדשאה המשותפת פה פשוט חלום – מלא חברים, משחקי תופסת וכיף של החיים! 🌾🐾 תמשיכו לבלות בכיף, {dogName} 🐕🎾🥳" },
  { id: 83, type: "friendly", text: "היי {ownerName}! 🐾 מצאתי לי חבר למשחקים במדשאה ורצנו ביחד עד שהלשון יצאה מאושרת! 🐶👅 ד״ש חם מהדשא, {dogName} 🐾🎾✨" },
  { id: 84, type: "friendly", text: "ערב טוב {ownerName}! 🐾 בזמן שאתם בעניינים שלכם, אני עשיתי פה מסיבת ריצות על המדשאה עם כל החבר'ה 🌾🎉 איזה כיף בריזורט! {dogName} 🐕🐾✨" },
  { id: 85, type: "friendly", text: "היי {ownerName}! 🐾 שיחקתי היום במדשאה עם כדורים, רדיפות וחברים, והיה פשוט אש! 🎾🔥 תבלו איפה שאתם, אני מאושר עד הגג, {dogName} 🐶🐾❤️" },
  { id: 86, type: "friendly", text: "ערב טוב {ownerName}! 🐾 הדשא במדשאת המשחקים כל כך נעים למרדפים, ששמוליק היה צריך לשכנע אותי להיכנס לסוויטה... 🌾🐾 תעשו חיים, {dogName} 🐕😄🛋️" },
  { id: 87, type: "friendly", text: "היי {ownerName}! 🐾 איזה נבחרת של חברים מצאתי לי במדשאה! כולם כשכשו בזנב באושר ושמחה 🐶🐾 תיהנו בכיף שלכם, {dogName} 🐕🎾🥳" },
  { id: 88, type: "friendly", text: "ערב טוב {ownerName}! 🐾 שרפתי את כל המרץ במשחקים חברתיים במדשאה, ועכשיו אני שוכב ונרדם כמו מלך 🌾👑 אוהב המון, {dogName} 🐶💤✨" },
  { id: 89, type: "friendly", text: "היי {ownerName}! 🐾 כמות הכשכושים במדשאת המשחקים היום שברה את כל השיאים העולמיים! 🐾🏆 תמשיכו לחגוג, הכל פה מושלם! {dogName} 🐕🥳💖" },
  { id: 90, type: "friendly", text: "ערב טוב {ownerName}! 🐾 המדשאה פה פשוט אליפות! הוצאתי אנרגיות, שמחתי ועכשיו נכנס ללילה רגוע ושלו 🌾🌙 {dogName} 🐶💤✨" },

  // קבוצה 5ב: מותאם אישית לבידוד / תוקפניים / שקט ופרטיות (91–100) [VIP 1-על-1, ללא מדשאה]
  { id: 91, type: "isolation", text: "היי {ownerName}! 🐾 קיבלתי היום יחס VIP אישי של 1-על-1 עם המטפל שלי בטיול בטבע, בלי שאף אחד יפריע לי למלכות! 🌲👑 תיהנו בעניינים שלכם, {dogName} 🐶💎✨" },
  { id: 92, type: "isolation", text: "ערב טוב {ownerName}! 🐾 המרחב הפרטי שלי בריזורט פשוט מושלם! שקט מוחלט, שלווה, טיול ארוך בטבע ופינוק אישי שמגיע רק לי 🌲🐾 ד״ש חם מ-{dogName} 🐕👑✨" },
  { id: 93, type: "isolation", text: "היי {ownerName}! 🐾 המטפלים פה מבינים אותי בדיוק – יצאתי לטיול שקט ומהנה בטבע, וחזרתי לסוויטה המלכותית הפרטית שלי לנוח 🌲🛋️ תבלו בכיף, {dogName} 🐶👑🤍" },
  { id: 94, type: "isolation", text: "ערב טוב {ownerName}! 🐾 שום רעש ושום הפרעות! רק אני, המטפל האוהב שלי, טיול בטבע וליטופים בלי סוף 🌲💆‍♂️ אני רגוע לחלוטין! אוהב, {dogName} 🐕👑💖" },
  { id: 95, type: "isolation", text: "היי {ownerName}! 🐾 יש לי פה שקט ושלווה בדיוק כמו שאני אוהב, טיול בטבע של אלופים וזמן איכות אישי 🌲🌿 תיהנו שם, המלך שלכם רגוע! {dogName} 🐶👑✨" },
  { id: 96, type: "isolation", text: "ערב טוב {ownerName}! 🐾 הטיול האישי שלי בטבע היה מדהים! שמוליק והצוות נתנו לי 100% תשומת לב פרטית ומסורה 🌲❤️ שיהיה לכם ערב נפלא, {dogName} 🐕👑🥰" },
  { id: 97, type: "isolation", text: "היי {ownerName}! 🐾 אני בסוויטה המרווחת שלי, שבע ומרוצה עד הגג אחרי יום של שקט, פרטיות ופינוקים 🛋️👑 אל תדאגו לי לשנייה! {dogName} 🐶💎💤" },
  { id: 98, type: "isolation", text: "ערב טוב {ownerName}! 🐾 בזמן שאתם עסוקים, אני נהנה מפרטיות מוחלטת, טיול פרטי בטבע ואהבה אינסופית מהצוות 🌲🤍 תעשו חיים, {dogName} 🐕👑✨" },
  { id: 99, type: "isolation", text: "היי {ownerName}! 🐾 הפינוק האישי פה בריזורט מושלם עבורי – שקט, בטוח, שליו ומלא כבוד למלך 👑🐾 תמשיכו בכיף שלכם בראש שקט לגמרי! {dogName} 🐶🙏✨" },
  { id: 100, type: "isolation", text: "ערב טוב {ownerName}! 🐾 יום שקט, שליו ומלא ליטופים אישיים הסתיים. אני ישן כמו מלך אמיתי בסוויטה הפרטית שלי 👑🛋️💤 אוהב תמיד, {dogName} 🐕👑🤍" }
];

/**
 * זיהוי האם כלב נמצא בבידוד / תוקפני
 */
function isDogInIsolation(b, allIntakeRequests) {
  // 1. בדיקת הערות והתנהגות
  var textToCheck = ((b.notes || "") + " " + (b.behavior_notes || "") + " " + (b.special_diet || "")).toLowerCase();
  if (textToCheck.indexOf("בידוד") !== -1 || textToCheck.indexOf("תוקפנ") !== -1 || textToCheck.indexOf("לא חברותי") !== -1 || textToCheck.indexOf("לא מסתדר") !== -1 || textToCheck.indexOf("שקט") !== -1) {
    return true;
  }
  // 2. תעריף יומי של בידוד (230 ₪)
  if (b.daily_rate === 230 || (b.data && b.data.dailyRate === 230)) {
    return true;
  }
  // 3. סימון מפורש באובייקט ההזמנה
  if (b.data && (b.data.isFriendlyWithDogs === "no" || b.data.serviceType === "isolation")) {
    return true;
  }
  // 4. הצלבה מול שאלון הקליטה
  if (allIntakeRequests && allIntakeRequests.length > 0) {
    var p = (b.owner_phone || "").replace(/[^0-9]/g, "");
    for (var i = 0; i < allIntakeRequests.length; i++) {
      var req = allIntakeRequests[i];
      var reqPhone = (req.owner_phone || req.ownerPhone || "").replace(/[^0-9]/g, "");
      if (reqPhone && reqPhone.slice(-7) === p.slice(-7)) {
        if (req.is_friendly_with_dogs === "no" || req.isFriendlyWithDogs === "no") {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * בחירת נוסח יומי מתאים לכלב (מונע כפילויות במהלך השהות)
 */
function getDailyDogTemplateForBooking(b, isIsolation, isMotzaeiShabbat) {
  var props = PropertiesService.getScriptProperties();
  var sentKey = isMotzaeiShabbat ? ("sent_motzash_templates_" + b.id) : ("sent_daily_templates_" + b.id);
  var rawSent = props.getProperty(sentKey);
  var sentIds = [];
  if (rawSent) {
    try { sentIds = JSON.parse(rawSent); } catch (e) { sentIds = []; }
  }

  // בחירת מאגר: במוצאי שבת מאגר סופ"ש ייעודי, בימי חול המאגר היומי של 100 התבניות
  var sourcePool = (isMotzaeiShabbat && typeof WEEKEND_DOG_TEMPLATES !== "undefined") ? WEEKEND_DOG_TEMPLATES : DAILY_DOG_TEMPLATES;

  // סינון המאגר המורשה לפי סטטוס בידוד
  var pool = [];
  for (var i = 0; i < sourcePool.length; i++) {
    var t = sourcePool[i];
    if (isIsolation) {
      // כלב בבידוד: רק safe או isolation (לעולם לא friendly - לא מדשאה עם להקה!)
      if (t.type === "safe" || t.type === "isolation") {
        pool.push(t);
      }
    } else {
      // כלב חברותי: כל התבניות (כולל משחקי להקה בדשא)
      pool.push(t);
    }
  }

  // סינון תבניות שטרם נשלחו בשהות זו
  var available = [];
  for (var j = 0; j < pool.length; j++) {
    if (sentIds.indexOf(pool[j].id) === -1) {
      available.push(pool[j]);
    }
  }

  // אם מוצו כל התבניות, איפוס המעקב
  if (available.length === 0) {
    available = pool;
    sentIds = [];
  }

  var chosen = available[Math.floor(Math.random() * available.length)];
  sentIds.push(chosen.id);
  props.setProperty(sentKey, JSON.stringify(sentIds));

  // החלפת שמות הבעלים והכלב
  var cleanOwner = (b.owner_name || "").trim().split(" ")[0] || "לקוח יקר";
  var cleanDog = (b.dog_name || "").trim() || "החבר על 4";
  var msgText = chosen.text
    .replace(/{ownerName}/g, cleanOwner)
    .replace(/{dogName}/g, cleanDog);

  return { id: chosen.id, text: msgText, isWeekend: isMotzaeiShabbat };
}

/**
 * הפונקציה הראשית: שליחת עדכון יומי בימי חול בלבד בשעה 20:00 לכל הכלבים השוהים בלינה
 */
function sendDailyDogEveningUpdates() {
  try {
    var now = new Date();
    var israelTz = "Asia/Jerusalem";

    // 1. בדיקת זמנים: יום שישי חסום ב-100% (ערב שבת). במוצאי שבת שולחים נוסח סופ"ש מיוחד.
    var dayOfWeek = parseInt(Utilities.formatDate(now, israelTz, "u"), 10); // 1=Mon, ..., 5=Fri, 6=Sat, 7=Sun

    // יום שישי בערב: שקט מוחלט! לעולם לא שולחים הודעות בערב שבת
    if (dayOfWeek === 5) {
      Logger.log("ערב שבת (יום שישי): שקט מוחלט - לא נשלחות הודעות יומיות. שבת שלום!");
      return;
    }

    // יום כיפור או חגים: שקט מוחלט!
    if (isYomKippurNow(now, israelTz)) {
      Logger.log("יום כיפור: שקט מוחלט - לא נשלחות הודעות יומיות.");
      return;
    }

    // בדיקת חגים מול Hebcal
    try {
      var yStr = Utilities.formatDate(now, israelTz, "yyyy-MM-dd");
      var yr = Utilities.formatDate(now, israelTz, "yyyy");
      var mo = Utilities.formatDate(now, israelTz, "M");
      var hRes = UrlFetchApp.fetch("https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&nx=off&year=" + yr + "&month=" + mo + "&ss=off&mf=off&c=off&geo=none&i=on", { muteHttpExceptions: true });
      if (hRes.getResponseCode() === 200) {
        var hItems = (JSON.parse(hRes.getContentText())).items || [];
        for (var hi = 0; hi < hItems.length; hi++) {
          if (hItems[hi].date === yStr) {
            Logger.log("חג (" + (hItems[hi].hebrew || hItems[hi].title) + "): שקט מוחלט - לא נשלחות הודעות יומיות.");
            return;
          }
        }
      }
    } catch(eH) {}

    // האם מדובר במוצאי שבת?
    var isMotzaeiShabbat = (dayOfWeek === 6);
    if (isMotzaeiShabbat) {
      Logger.log("מוצאי שבת: נשלחת הודעת סיכום סופ\"ש מיוחדת ומותאמת אישית לכלבים המתארחים! 🐾✨");
    }

    var todayStr = Utilities.formatDate(now, israelTz, "yyyy-MM-dd");

    // 2. שליפת כל הכלבים הלנים הלילה בריזורט מ-Supabase
    var queryUrl = SUPABASE_URL + "/rest/v1/bookings?start_date=lte." + todayStr + "&end_date=gt." + todayStr + "&stay_status=neq.cancelled&select=*";
    var res = UrlFetchApp.fetch(queryUrl, {
      method: "get",
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY },
      muteHttpExceptions: true
    });

    if (res.getResponseCode() !== 200) {
      Logger.log("שגיאה בשליפת הזמנות פעילות: " + res.getContentText());
      return;
    }

    var activeBookings = JSON.parse(res.getContentText());
    if (!activeBookings || activeBookings.length === 0) {
      Logger.log("אין כלבים השוהים הלילה בריזורט (" + todayStr + ")");
      return;
    }

    // 3. שליפת בקשות קליטה לצורך הצלבת סטטוס בידוד/תוקפנות
    var allIntake = [];
    try {
      var intakeUrl = SUPABASE_URL + "/rest/v1/intake_requests?select=owner_phone,is_friendly_with_dogs";
      var iRes = UrlFetchApp.fetch(intakeUrl, {
        method: "get",
        headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY },
        muteHttpExceptions: true
      });
      if (iRes.getResponseCode() === 200) {
        allIntake = JSON.parse(iRes.getContentText());
      }
    } catch (eIntake) {}

    var props = PropertiesService.getScriptProperties();
    var sentCount = 0;

    for (var i = 0; i < activeBookings.length; i++) {
      var b = activeBookings[i];
      var todaySentKey = "daily_dog_sent_" + b.id + "_" + todayStr;

      // מניעת כפילות: אם כבר נשלחה הודעה לכלב זה היום, דלג
      if (props.getProperty(todaySentKey)) {
        continue;
      }

      var phone = (b.owner_phone || "").replace(/[^0-9]/g, "");
      if (!phone) continue;

      var intlPhone = phone.indexOf("0") === 0 ? "972" + phone.substring(1) : phone;
      var chatId = intlPhone + "@c.us";

      // בדיקת סטטוס בידוד
      var isIsolation = isDogInIsolation(b, allIntake);

      // בחירת נוסח מותאם
      var templateData = getDailyDogTemplateForBooking(b, isIsolation, isMotzaeiShabbat);

      var sendUrl = "https://api.green-api.com/waInstance" + GREEN_API_ID + "/sendMessage/" + GREEN_API_TOKEN;
      var sendRes = UrlFetchApp.fetch(sendUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ chatId: chatId, message: templateData.text }),
        muteHttpExceptions: true
      });

      if (sendRes.getResponseCode() === 200) {
        props.setProperty(todaySentKey, "true");
        sentCount++;
        Logger.log("נשלח בהצלחה עדכון יומי (נוסח #" + templateData.id + ", בידוד=" + isIsolation + ") ל-" + b.dog_name + " (" + b.owner_name + ")");
      } else {
        Logger.log("שגיאה במשלוח ל-" + b.dog_name + ": " + sendRes.getContentText());
      }

      Utilities.sleep(1500); // מרווח למניעת עומס
    }

    Logger.log("הסתיים משלוח עדכונים יומיים: נשלחו " + sentCount + " הודעות מתוך " + activeBookings.length + " כלבים.");
  } catch (err) {
    Logger.log("sendDailyDogEveningUpdates error: " + err.toString());
  }
}

/**
 * הגדרת טריגר יומי לשעה 20:00 ב-Google Apps Script (בלחיצה אחת)
 */
/**
 * הגדרת כל הטריגרים האוטומטיים לערב (בלחיצה אחת):
 * 1. בשעה 19:00 - בקשת חוות דעת + מועדון VIP למי שעזב יום קודם
 * 2. בשעה 20:00 - עדכון ערב יומי לכלבים ששוהים כרגע בריזורט
 */
function setupDailyDogEveningTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "sendDailyDogEveningUpdates" || fn === "sendDayAfterDepartureReviewRequests") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 1. טריגר לשעה 19:00 - בקשת חוות דעת ופינוק VIP
  ScriptApp.newTrigger("sendDayAfterDepartureReviewRequests")
    .timeBased()
    .everyDays(1)
    .atHour(19)
    .inTimezone("Asia/Jerusalem")
    .create();

  // 2. טריגר לשעה 20:00 - יומן עדכון יומי לכלבי הריזורט
  ScriptApp.newTrigger("sendDailyDogEveningUpdates")
    .timeBased()
    .everyDays(1)
    .atHour(20)
    .inTimezone("Asia/Jerusalem")
    .create();

  Logger.log("שני הטריגרים הוגדרו בהצלחה: 19:00 לחוות דעת VIP, ו-20:00 לעדכוני כלבים! 🐶👑");
}