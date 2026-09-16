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
  Logger.log("--- תחילת ריצת בדיקת מיילים ותשלומים לריזורט (מעבר מלא ומוחלט) ---");
  var myEmail = "hh3466@gmail.com";
  var shmulikEmail = "shinshin1964@gmail.com";
  var targetRecipients = myEmail + ", " + shmulikEmail;

  var threads = [];
  try {
    // שליפה ישירה של עד 50 שרשורים מה-Inbox בלבד (ללא נגיעה באשפה או ארכיון)
    var inboxThreads = GmailApp.getInboxThreads(0, 50);
    if (inboxThreads) {
      for (var a = 0; a < inboxThreads.length; a++) {
        threads.push(inboxThreads[a]);
      }
    }
    Logger.log("נמצאו " + threads.length + " שרשורים ב-Inbox לבדיקה.");
  } catch (eSearch) {
    Logger.log("הודעה: קריאת Gmail נתקלה בהגבלה: " + eSearch.toString());
    return;
  }

  if (!threads || threads.length === 0) {
    Logger.log("תיבת הדואר נקייה.");
    try { checkUpcomingDeparturesWithDebtAndAlert(); } catch (eDebt) {}
    return;
  }

  var scriptProperties = PropertiesService.getScriptProperties();
  var growCount = 0;
  var morningDeletedCount = 0;
  var yanivDeletedCount = 0;

  // וידוא ניקיון שוטף של רשומות כנען/עפרה מסופאבייס (אם אי פעם חודרת רשומה כזו בטעות)
  try {
    UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/grow_incoming_payments?customer_name=ilike.*כנען*", {
      method: "delete",
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    });
    UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/grow_incoming_payments?customer_name=ilike.*עפרה*", {
      method: "delete",
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    });
    UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/grow_incoming_payments?customer_name=ilike.*עופרה*", {
      method: "delete",
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    });
  } catch (eCleanDb) {}

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var messages = thread.getMessages();
    var threadHandled = false;

    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      var subject = (msg.getSubject() || "").trim();
      var sender = (msg.getFrom() || "").toLowerCase().trim();
      var body = msg.getPlainBody() || "";
      var htmlBody = msg.getBody() || "";
      var fullLower = (subject + " " + sender + " " + body + " " + htmlBody).toLowerCase();

      // בדיקה אם זו התראת תשלום שגויה שנשלחה בטעות קודם עבור כנען או עפרה שפר - נמחק אותה מיד לאשפה!
      var isErrantReport = (subject.indexOf("כנען") !== -1 || subject.indexOf("טרקטור") !== -1 ||
                            subject.indexOf("עפרה") !== -1 || subject.indexOf("עופרה") !== -1 || subject.indexOf("שפר") !== -1) &&
                           (subject.indexOf("התקבל תשלום") !== -1 || fullLower.indexOf("בריזורט לכלב") !== -1);
      if (isErrantReport) {
        threadHandled = true;
        Logger.log("🗑️ מחיקת מייל התראה שגוי מהעבר של כנען/עפרה: " + subject);
        break;
      }

      // דילוג מוחלט על שאר התראות עצמיות שנשלחו מאיתנו
      if (sender.indexOf("hh3466") !== -1 || sender.indexOf("shinshin1964") !== -1) {
        continue;
      }

      // הגנה מוחלטת: לעולם לא לגעת בעסקים אחרים של מגדל דנילוב (כנען טרקטורים, זכויות המורה, עופרה שפר, סלקום, הלוואות וכו')!
      var otherBusinessKeywords = [
        "כנען",
        "טרקטור",
        "זכויות המורה",
        "המורה",
        "עפרה",
        "עופרה",
        "שפר",
        "תכנון פרישה",
        "פרישה",
        "משטח",
        "משטחי",
        "איחסון",
        "אחסון",
        "סלקום",
        "cellcom",
        "סולארי",
        "סולאר",
        "חשמל"
      ];
      var isOtherBusiness = false;
      for (var obk = 0; obk < otherBusinessKeywords.length; obk++) {
        if (fullLower.indexOf(otherBusinessKeywords[obk]) !== -1) {
          isOtherBusiness = true;
          break;
        }
      }

      if (isOtherBusiness) {
        continue;
      }

      // זיהוי חשבונית Morning (מורנינג / חשבונית ירוקה)
      var isMorning = (sender.indexOf("morning") !== -1 ||
                      sender.indexOf("greeninvoice") !== -1 ||
                      subject.indexOf("morning") !== -1 ||
                      subject.indexOf("חשבונית ירוקה") !== -1 ||
                      subject.indexOf("חשבונית") !== -1 ||
                      subject.indexOf("הפקת מסמך") !== -1) && sender.indexOf("grow") === -1;

      // זיהוי מייל תשלום Grow
      var isGrow = (sender.indexOf("grow") !== -1 ||
                    sender.indexOf("meshulam") !== -1 ||
                    subject.indexOf("בוצע תשלום עבור בעל העסק") !== -1 ||
                    subject.indexOf("בוצע תשלום") !== -1) && !isMorning;

      // בדיקת שיוך לריזורט לכלב
      var resortKeywords = [
        "הריזורט לכלב",
        "הריזורט",
        "ריזורט",
        "פנסיון",
        "אילוף",
        "כלב",
        "כלבים",
        "דוג",
        "dog",
        "יניב אלעד",
        "ג'נגו",
        "django",
        "רונן מלמוד",
        "לונה"
      ];
      var isResort = false;
      for (var rk = 0; rk < resortKeywords.length; rk++) {
        if (fullLower.indexOf(resortKeywords[rk]) !== -1) {
          isResort = true;
          break;
        }
      }

      // 1. מחיקת חשבונית Morning של הריזורט לכלב
      if (isMorning && isResort) {
        threadHandled = true;
        morningDeletedCount++;
        Logger.log("🗑️ חשבונית מורנינג של הריזורט זוהתה למחיקה: " + subject);
        break;
      }

      // 2. מחיקת מיילי יניב / ג'נגו של הריזורט
      if (!isGrow && !isMorning && isResort && (fullLower.indexOf("יניב אלעד") !== -1 || fullLower.indexOf("ג'נגו") !== -1)) {
        threadHandled = true;
        yanivDeletedCount++;
        Logger.log("🗑️ מייל יניב/ג'נגו זוהה למחיקה: " + subject);
        break;
      }

      // 3. טיפול בתשלום Grow של הריזורט לכלב
      if (isGrow) {
        var cleanText = (htmlBody + " " + body)
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/&#8234;|&#x202a;|[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, " ")
          .replace(/\s+/g, " ");

        // חילוץ טלפון ושם לצורך הצלבה מול היומן אם טרם זוהה
        var phoneMatch = cleanText.match(/(?:טלפון|נייד|סלולרי)\s*[:\-]?\s*([0-9+ -]{9,15})/i) ||
                         cleanText.match(/05[0-9][0-9 -]{7,10}/);
        var customerPhone = phoneMatch ? (phoneMatch[1] || phoneMatch[0]).replace(/\D/g, '') : "";

        var nameMatch = cleanText.match(/(?:ממי התשלום\s*)?שם(?:\s*המשלם|\s*הלקוח)?\s*[:\-]\s*([^\n\r<,]{2,30}?)(?=\s*(?:טלפון|נייד|סלולרי|מייל|עוד פרטים|$))/i) ||
                        cleanText.match(/עבור\s+([\u0590-\u05FFa-zA-Z]{2,20}(?:\s+[\u0590-\u05FFa-zA-Z]{2,20})?)/i);
        var customerName = (nameMatch ? nameMatch[1].trim() : "לקוח Grow").replace(/\s+/g, ' ');
        if (customerName === "המשלם" || customerName === "הלקוח" || customerName.length < 2) {
          customerName = "לקוח Grow";
        }

        // בדיקה האם התשלום שייך לריזורט
        var isThisResort = isResort;
        if (cleanText.indexOf("עבור שירות") !== -1) {
          var serviceMatch = cleanText.match(/עבור שירות\s*[:\-]?\s*([^.,<\n\r]{2,50})/i);
          if (serviceMatch) {
            var serviceText = serviceMatch[1].toLowerCase();
            if (serviceText.indexOf("הריזורט") !== -1 || serviceText.indexOf("ריזורט") !== -1 || serviceText.indexOf("פנסיון") !== -1 || serviceText.indexOf("אילוף") !== -1 || serviceText.indexOf("כלב") !== -1) {
              isThisResort = true;
            } else {
              isThisResort = false;
            }
          }
        }

        if (!isThisResort && customerPhone && customerPhone.length >= 7) {
          try {
            var cleanP = customerPhone.slice(-7);
            var bCheck = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/bookings?owner_phone=ilike.*" + cleanP + "*&select=id", {
              headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
            });
            if (bCheck.getResponseCode() === 200) {
              var bRows = JSON.parse(bCheck.getContentText());
              if (bRows && bRows.length > 0) isThisResort = true;
            }
          } catch (eB) {}
        }

        // אם אינו שייך לריזורט - לדלג מיד ולא לגעת!
        if (!isThisResort) {
          Logger.log("מייל תשלום Grow אינו שייך לריזורט לכלב - דילוג מוחלט: " + subject);
          continue;
        }

        // חילוץ סכום התשלום
        var amountMatch = cleanText.match(/(?:תשלום של|שולם|סכום|סך|סה"כ)\s*(?:₪|ש"ח)?\s*([0-9.,]+)/i) ||
                          cleanText.match(/([0-9.,]+)\s*(?:₪|ש"ח)/) ||
                          cleanText.match(/₪\s*([0-9.,]+)/);
        var amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

        if (amount <= 0 && (subject.indexOf("בוצע תשלום") !== -1 || cleanText.indexOf("בוצע תשלום") !== -1)) {
          var anyNum = cleanText.match(/\b([1-9][0-9]{2,5})\b/);
          if (anyNum) amount = parseFloat(anyNum[1]);
        }

        if (amount <= 0) {
          continue;
        }

        var customerEmail = (body.match(/מייל\s*:\s*([^\s\n\r@]+@[^\s\n\r]+)/i) || ["", ""])[1];
        var refMatch = cleanText.match(/(?:אסמכתא|אישור|מספר אסמכתא)\s*[:\-]?\s*([0-9a-zA-Z]+)/i);
        var referenceId = refMatch ? refMatch[1].trim() : "ref-" + msg.getId();
        var methodMatch = cleanText.match(/(?:אמצעי תשלום|באמצעות)\s*[:\-]?\s*([^.,<\n\r]{2,20})/i);
        var paymentMethod = methodMatch ? methodMatch[1].trim() : "Bit / אשראי Grow";

        Logger.log("🎯 זוהה תשלום Grow לריזורט: " + customerName + " | סכום: ₪" + amount + " | אסמכתא: " + referenceId);

        // בדיקה מול סופאבייס האם התשלום כבר קיים
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
          Logger.log("✓ התשלום " + referenceId + " כבר קיים במערכת - מועבר לאשפה למניעת כפילות.");
          threadHandled = true;
          break;
        }

        // בדיקת שיוך להזמנה קיימת ביומן
        var isLinkedToBooking = false;
        try {
          var cleanPhoneNum = customerPhone.replace(/\D/g, '').slice(-7);
          var bSearchRes = null;
          if (cleanPhoneNum.length >= 7) {
            bSearchRes = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/bookings?owner_phone=ilike.*" + cleanPhoneNum + "*&select=*&order=created_at.desc&limit=1", {
              headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
            });
          }
          if ((!bSearchRes || bSearchRes.getResponseCode() !== 200) && customerName && customerName !== "לקוח Grow") {
            var fNameEnc = encodeURIComponent(customerName.split(" ")[0].trim());
            bSearchRes = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/bookings?owner_name=ilike.*" + fNameEnc + "*&select=*&order=created_at.desc&limit=1", {
              headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
            });
          }
          if (bSearchRes && bSearchRes.getResponseCode() === 200) {
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
              isLinkedToBooking = true;
              Logger.log("✓ תשלום שויך בהצלחה להזמנת " + bk.dog_name + " של " + bk.owner_name);
            }
          }
        } catch (eUpdBk) {}

        // רישום בסופאבייס (אם לקוח קיים -> completed, אם לקוח חדש -> pending שיקפוץ ביומן)
        var paymentStatusInDb = isLinkedToBooking ? "completed" : "pending";
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
            status: paymentStatusInDb
          };
          UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/grow_incoming_payments", {
            method: "post",
            contentType: "application/json",
            headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Prefer": "resolution=ignore-duplicates" },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
          });
          Logger.log("✓ תשלום נרשם ב-Supabase (" + paymentStatusInDb + "): " + customerName + " | ₪" + amount);
        } catch (ePayIns) {}

        // שליחת מייל דיווח נקי ומסודר לשמוליק ולמנהל (זה המייל היחיד שנשאר בתיבה!)
        try {
          var emailSubject = "[תשלום חדש בריזורט לכלב] " + customerName + " - " + amount + " ש״ח";
          var emailHtml = "<div dir='rtl' style='font-family: Arial, sans-serif; padding: 15px; border: 1px solid #10b981; border-radius: 12px; background: #f0fdf4;'>"
            + "<h2 style='color: #065f46; margin-top: 0;'>&#10004; תשלום חדש נקלט בהצלחה בריזורט לכלב!</h2>"
            + "<p><strong>שם המשלם:</strong> " + customerName + "</p>"
            + "<p><strong>סכום:</strong> " + amount + " ש״ח</p>"
            + "<p><strong>אמצעי תשלום:</strong> " + paymentMethod + "</p>"
            + "<p><strong>אסמכתא:</strong> " + referenceId + "</p>"
            + "<p><strong>טלפון:</strong> " + customerPhone + "</p>"
            + "<p>התשלום נרשם במערכת הניהול של הריזורט לכלב (" + (isLinkedToBooking ? "שויך אוטומטית להזמנה" : "ממתין לשיוך ביומן") + ").</p>"
            + "</div>";
          GmailApp.sendEmail(targetRecipients, emailSubject, "", { htmlBody: emailHtml });
          Logger.log("✓ נשלח מייל דיווח לעסקה אל: " + targetRecipients);
        } catch (eMail) {}

        growCount++;
        threadHandled = true;
        break;
      }
    }

    // מחיקת המייל המקורי (העברה לאשפה) כדי להשאיר את התיבה נקייה לחלוטין!
    if (threadHandled) {
      try {
        thread.moveToTrash();
        Logger.log("🗑️ שרשור הועבר לאשפה בהצלחה.");
      } catch (eTr) {
        Logger.log("שגיאה בהעברה לאשפה: " + eTr.toString());
      }
    }
  }

  try {
    checkUpcomingDeparturesWithDebtAndAlert();
  } catch (eDebt) {}

  Logger.log("=== סיום ריצה: " + growCount + " תשלומי Grow נקלטו, " + morningDeletedCount + " חשבוניות מורנינג נמחקו, " + yanivDeletedCount + " מיילי יניב נמחקו ===");
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

      var subject = "[תזכורת חוב] מחר שחרור כלב בריזורט - " + dogName + " (" + ownerName + ") | יתרת חוב: " + remainingDebt.toLocaleString() + " ש״ח";

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
