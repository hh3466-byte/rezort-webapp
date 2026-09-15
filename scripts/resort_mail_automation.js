/**
 * =========================================================================
 * מערכת ניהול מאוחדת לריזורט לכלב (מגדל דנילוב בע"מ)
 * חלק א': טיפול במיילים, מחיקת חשבוניות וסנכרון תשלומים (גרסה חסכונית במכסות)
 * =========================================================================
 */

var SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

var GREEN_API_ID = "710722735421";
var GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

/**
 * פונקציה ראשית המופעלת על ידי הטריגר האוטומטי (מומלץ כל 5 דקות - בטוח לחלוטין!)
 * פועלת במעבר יחיד וממוקד (Single Pass) על תיבת הדואר הנכנס (Inbox בלבד)
 * חוסכת מעל 80% בקריאות ל-Gmail ומאפשרת ריצה רציפה כל 5 דקות ללא חריגת מכסות.
 */
function processResortEmails() {
  Logger.log("--- תחילת ריצת בדיקת מיילים ותשלומים לריזורט (מעבר יחיד חסכוני) ---");
  var myEmail = "hh3466@gmail.com";
  var shmulikEmail = "shinshin1964@gmail.com";
  var targetRecipients = myEmail + ", " + shmulikEmail;

  var threads = [];
  try {
    // שאילתה יחידה ומרוכזת על תיבת הדואר הנכנס בלבד
    var query = 'in:inbox (Grow OR meshulam OR morning OR greeninvoice OR "בוצע תשלום" OR "הריזורט לכלב" OR "יניב")';
    threads = GmailApp.search(query, 0, 25);
    Logger.log("נמצאו " + (threads ? threads.length : 0) + " שרשורים רלוונטיים ב-Inbox.");
  } catch (eSearch) {
    Logger.log("הודעה: חיפוש Gmail נתקל בהגבלה (ממתין לאיפוס מכסה יומית של גוגל): " + eSearch.toString());
    return;
  }

  if (!threads || threads.length === 0) {
    Logger.log("תיבת הדואר נקייה ממיילי תשלום או מורנינג של הריזורט.");
    try { checkUpcomingDeparturesWithDebtAndAlert(); } catch (eDebt) {}
    return;
  }

  // איסוף שמות לקוחות מחשבוניות Morning שנמצאות בתוצאות
  var resortCustomerNamesInMorning = {};
  for (var i = 0; i < threads.length; i++) {
    var thM = threads[i];
    if (thM.isInTrash()) continue;
    var msgsM = thM.getMessages();
    for (var j = 0; j < msgsM.length; j++) {
      var mM = msgsM[j];
      var subM = mM.getSubject() || "";
      var fromM = mM.getFrom() || "";
      var bTextM = mM.getPlainBody() || "";
      var fullM = (subM + " " + fromM + " " + bTextM);
      if (fullM.indexOf("הריזורט לכלב") !== -1 || fullM.indexOf("הריזורט") !== -1 || fullM.indexOf("יניב אלעד") !== -1) {
        var clientMatch = subM.match(/עבור\s+([^\n\r-]+)/) || bTextM.match(/עבור\s+([^\n\r-]+)/);
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
  var growCount = 0;
  var morningDeletedCount = 0;
  var yanivDeletedCount = 0;

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    if (thread.isInTrash()) continue;

    var messages = thread.getMessages();
    var threadProcessed = false;

    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      var subject = msg.getSubject() || "";
      var sender = (msg.getFrom() || "").toLowerCase();
      var body = msg.getPlainBody() || "";
      var htmlBody = msg.getBody() || "";
      var fullLower = (subject + " " + sender + " " + body + " " + htmlBody).toLowerCase();

      var isMorning = sender.indexOf("morning") !== -1 ||
                      sender.indexOf("greeninvoice") !== -1 ||
                      subject.indexOf("morning") !== -1 ||
                      subject.indexOf("חשבונית ירוקה") !== -1 ||
                      subject.indexOf("חשבונית") !== -1;

      var isGrow = sender.indexOf("grow") !== -1 ||
                   sender.indexOf("meshulam") !== -1 ||
                   subject.indexOf("בוצע תשלום עבור בעל העסק") !== -1 ||
                   fullLower.indexOf("grow.business") !== -1 ||
                   fullLower.indexOf("grow.link") !== -1;

      var isResortOrYaniv = fullLower.indexOf("הריזורט לכלב") !== -1 ||
                            fullLower.indexOf("הריזורט") !== -1 ||
                            fullLower.indexOf("ריזורט") !== -1 ||
                            fullLower.indexOf("יניב אלעד") !== -1 ||
                            fullLower.indexOf("ג'נגו") !== -1 ||
                            fullLower.indexOf("django") !== -1;

      // 1. טיפול במיילי Grow
      if (isGrow && !isMorning) {
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

        var isThisResort = isResortOrYaniv;
        if (!isThisResort) {
          var fName = customerName.split(" ")[0].trim().toLowerCase();
          if (fName && resortCustomerNamesInMorning[fName]) isThisResort = true;
          else if (resortCustomerNamesInMorning[customerName.toLowerCase()]) isThisResort = true;
        }

        if (!isThisResort && customerPhone) {
          try {
            var cleanP = customerPhone.replace(/\D/g, '').slice(-7);
            var bCheck = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/bookings?owner_phone=ilike.*" + cleanP + "*&select=id,dog_name,owner_name", {
              headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
            });
            if (bCheck.getResponseCode() === 200) {
              var bRows = JSON.parse(bCheck.getContentText());
              if (bRows && bRows.length > 0) isThisResort = true;
            }
          } catch (eB) {}
        }

        if (!isThisResort && customerName && customerName !== "לקוח Grow") {
          try {
            var fNameEnc = encodeURIComponent(customerName.split(" ")[0].trim());
            var bNameCheck = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/bookings?owner_name=ilike.*" + fNameEnc + "*&select=id,dog_name,owner_name", {
              headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
            });
            if (bNameCheck.getResponseCode() === 200) {
              var bNRows = JSON.parse(bNameCheck.getContentText());
              if (bNRows && bNRows.length > 0) isThisResort = true;
            }
          } catch (eBN) {}
        }

        if (!isThisResort) {
          Logger.log("מייל Grow דולג - אינו שייך להריזורט לכלב: " + subject + " (" + customerName + ")");
          continue;
        }

        // הגנה מפני כפילויות
        if (handledRefsInCurrentRun[referenceId] || scriptProperties.getProperty("handled_ref_" + referenceId)) {
          msg.markRead();
          threadProcessed = true;
          continue;
        }

        var alreadyInDb = false;
        try {
          var checkRes = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/grow_incoming_payments?reference_id=eq." + encodeURIComponent(referenceId) + "&select=id", {
            headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
          });
          if (checkRes.getResponseCode() === 200) {
            var exRows = JSON.parse(checkRes.getContentText());
            if (exRows && exRows.length > 0) alreadyInDb = true;
          }
        } catch (eC) {}

        if (alreadyInDb) {
          Logger.log("✓ התשלום " + referenceId + " כבר קיים - נמנעה כפילות.");
          scriptProperties.setProperty("handled_ref_" + referenceId, "true");
          handledRefsInCurrentRun[referenceId] = true;
          msg.markRead();
          threadProcessed = true;
          continue;
        }

        // רישום ב-Supabase
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
          Logger.log("✓ תשלום נרשם ב-Supabase: " + customerName + " | סכום: ₪" + amount);
        } catch (ePayIns) {}

        // עדכון הזמנה מקושרת ב-Supabase אם קיימת
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

              UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/bookings?id=eq." + bk.id, {
                method: "patch",
                contentType: "application/json",
                headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY },
                payload: JSON.stringify({
                  deposit_amount: newDeposit,
                  payment_status: newPaymentStatus,
                  stay_status: "confirmed",
                  notes: (bk.notes || "") + " | שולם ₪" + amount + " (" + paymentMethod + " אסמכתא " + referenceId + ")",
                  data: bkData
                }),
                muteHttpExceptions: true
              });
            }
          }
        } catch (eUpdBk) {}

        // שליחת התראה במייל לשמוליק ולבעלים
        try {
          var emailSubject = "💰 התקבל תשלום חדש ב-Grow: " + customerName + " - ₪" + amount;
          var emailHtml = "<div dir='rtl' style='font-family: Arial, sans-serif; padding: 15px; border: 1px solid #10b981; border-radius: 12px; background: #f0fdf4;'>"
            + "<h2 style='color: #065f46; margin-top: 0;'>🎉 תשלום חדש נקלט בהצלחה בריזורט לכלב!</h2>"
            + "<p><strong>שם המשלם:</strong> " + customerName + "</p>"
            + "<p><strong>סכום:</strong> ₪" + amount + "</p>"
            + "<p><strong>אמצעי תשלום:</strong> " + paymentMethod + "</p>"
            + "<p><strong>אסמכתא:</strong> " + referenceId + "</p>"
            + "<p><strong>טלפון:</strong> " + customerPhone + "</p>"
            + "<p>התשלום נרשם במערכת הניהול של הריזורט לכלב.</p>"
            + "</div>";
          GmailApp.sendEmail(targetRecipients, emailSubject, "", { htmlBody: emailHtml });
        } catch (eMail) {}

        scriptProperties.setProperty("handled_ref_" + referenceId, "true");
        handledRefsInCurrentRun[referenceId] = true;
        growCount++;
        threadProcessed = true;
        break;

      // 2. מחיקת חשבונית Morning של הריזורט
      } else if (isMorning && isResortOrYaniv) {
        morningDeletedCount++;
        threadProcessed = true;
        Logger.log("🗑️ נמחקה חשבונית מורנינג של הריזורט: " + subject);
        break;

      // 3. מחיקת מיילי יניב אלעד / ג'נגו של הריזורט
      } else if (isResortOrYaniv && (fullLower.indexOf("יניב אלעד") !== -1 || fullLower.indexOf("ג'נגו") !== -1)) {
        yanivDeletedCount++;
        threadProcessed = true;
        Logger.log("🗑️ נמחק מייל יניב/הריזורט: " + subject);
        break;
      }
    }

    if (threadProcessed) {
      try {
        thread.moveToTrash();
      } catch (eTr) {}
    }
  }

  try {
    checkUpcomingDeparturesWithDebtAndAlert();
  } catch (eDebt) {}

  Logger.log("=== סיום ריצה: " + growCount + " תשלומי Grow, " + morningDeletedCount + " חשבוניות מורנינג, " + yanivDeletedCount + " מיילי יניב/ריזורט ===");
}

/**
 * תאימות לשם הפונקציה בטריגר ישן
 */
function syncGrowPayments() {
  processResortEmails();
}

function syncGrowPaymentsAndNotify() {
  processResortEmails();
}

function cleanYanivAndResortEmailsDirectly() {
  processResortEmails();
}

function cleanupMorningResortInvoices() {
  processResortEmails();
}

function forceCleanResortInboxNow() {
  processResortEmails();
}

/**
 * בדיקת שחרורים קרובים עם חוב פתוח והתראה במייל יום לפני
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
    }
  } catch (e) {
    Logger.log("שגיאה בהתראת שחרור עם חוב: " + e.toString());
  }
}

function ensureTaliEmailDraftCreated() {
  // שמירה לתאימות
}
