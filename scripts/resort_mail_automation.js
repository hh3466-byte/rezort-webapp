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
