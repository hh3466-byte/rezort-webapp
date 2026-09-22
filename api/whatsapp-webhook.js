/**
 * =========================================================================
 * WhatsApp Webhook Handler for Green-API - הריזורט לכלב
 * Vercel Serverless Function: /api/whatsapp-webhook
 * 
 * Logic:
 * 1. Filters out group messages, outgoing messages, broadcasts, and spam.
 * 2. Identifies existing clients vs new clients from Supabase bookings & customers.
 * 3. Identifies closed hours (Fridays from 14:00, Shabbat, Sunday mornings to 09:30, Jewish Holidays, and weeknights).
 * 4. Sends:
 *    - Closed hours to existing clients: Weekend/Holiday closed message.
 *    - Closed hours to new clients: Weekend/Holiday closed message + Intake Questionnaire link.
 *    - Open hours to new clients: Intake Questionnaire link only.
 *    - Open hours to existing clients: No auto-reply (human team handles).
 * =========================================================================
 */

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

const CLOSED_WEEKEND_HOLIDAY_MSG = `תודה על פנייתך, בחגים וסופי שבוע שירות הלקוחות שלנו סגור משעה 14:00 בשישי/ערב החג ועד למחרת השבת/או החג בשעה 09:30. כמובן שהמקום מאוייש והכלבים מקבלים טיפול מלא ומפנק. רק הבעלים שלהם צריכים להתגבר ולהתאפק עד ששרות הלקוחות יחזור לפעילות.תודה על ההבנה.`;

function getIntakeFormMessage(phone, senderName) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const nameParam = senderName ? `&name=${encodeURIComponent(senderName.trim())}` : '';
  const phoneParam = cleanPhone ? `&phone=${encodeURIComponent(cleanPhone)}` : '';
  const link = `https://rezort-webapp.vercel.app/?request=true${phoneParam}${nameParam}`;

  return `שלום ותודה שפניתם לריזורט לכלב! 🐾🐶
כדי שנוכל לבדוק זמינות, להתאים את השירות המדויק לכלבכם ולחסוך לכם זמן יקר, אנא מלאו שאלון קליטה קצר (דקה אחת בלבד):
👉 \u200E${link}

⏰ *שימו לב:* אנחנו נמצאים כרגע במתחם ומטפלים במסירות בכלבים, ולא נשכח אתכם! 🐾
מיד שנתפנה נעבור על פרטי השאלון ונחזור אליכם לשיחה בנוגע לתשובות לתיאום סופי. 🐕🤍`;
}

// Anti-spam cooldown memory (6 hours per phone)
const cooldownMap = global._resortWaCooldown || (global._resortWaCooldown = new Map());

async function sendWhatsAppMessage(chatId, message) {
  try {
    const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message })
    });
    return res.ok;
  } catch (err) {
    console.error('Error sending WhatsApp message via Green-API:', err);
    return false;
  }
}

async function isExistingClient(phoneSuffix) {
  if (!phoneSuffix || phoneSuffix.length < 6) return false;
  try {
    // Check bookings table
    const bRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?owner_phone=ilike.*${phoneSuffix}*&select=id&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (bRes.ok) {
      const bData = await bRes.json();
      if (Array.isArray(bData) && bData.length > 0) return true;
    }

    // Check customers table
    const cRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?phone=ilike.*${phoneSuffix}*&select=id&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (cRes.ok) {
      const cData = await cRes.json();
      if (Array.isArray(cData) && cData.length > 0) return true;
    }
  } catch (e) {
    console.warn('Supabase client check warning:', e);
  }
  return false;
}

async function checkIsShabbatOrHoliday(israelDateStr) {
  try {
    const hebcalUrl = `https://www.hebcal.com/converter?cfg=json&date=${israelDateStr}&g2h=1`;
    const res = await fetch(hebcalUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.events) && data.events.length > 0) {
        const eventsStr = data.events.join(' ').toLowerCase();
        // Major holidays where customer service is closed
        const isHoliday = eventsStr.includes('rosh hashana') || 
                          eventsStr.includes('yom kippur') || 
                          eventsStr.includes('sukkot') || 
                          eventsStr.includes('shmini atzeret') || 
                          eventsStr.includes('simchat torah') || 
                          eventsStr.includes('pesach') || 
                          eventsStr.includes('shavuot') || 
                          eventsStr.includes('erev');
        return isHoliday;
      }
    }
  } catch (e) {
    console.warn('Hebcal check error:', e);
  }
  return false;
}

export default async function handler(req, res) {
  // Always return 200 to Webhook provider quickly
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Resort WhatsApp Webhook is active' });
  }

  const payload = req.body;
  if (!payload || payload.typeWebhook !== 'incomingMessageReceived') {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const senderData = payload.senderData || {};
  const chatId = senderData.chatId || '';
  const sender = senderData.sender || '';

  // 1. Ignore groups, broadcasts, empty chats
  if (!chatId || !chatId.endsWith('@c.us') || chatId.includes('status@broadcast')) {
    return res.status(200).json({ ok: true, reason: 'group or broadcast ignored' });
  }

  // 2. Ignore messages from the resort bot itself
  const instanceWid = payload.instanceData?.wid || '972548765888@c.us';
  if (sender === instanceWid || chatId === instanceWid) {
    return res.status(200).json({ ok: true, reason: 'self message ignored' });
  }

  // Clean phone number
  const cleanPhone = chatId.replace('@c.us', '').replace(/[^0-9]/g, '');
  const phoneSuffix = cleanPhone.slice(-7); // Last 7 digits
  const senderName = senderData.senderName || senderData.senderContactName || '';

  // 3. Special handling for Hila the Trainer (0526908943) and Manager (0543200007)
  const isHila = cleanPhone.includes('526908943');
  const isManager = cleanPhone.includes('543200007');

  if (isHila) {
    const msgData = payload.messageData || {};
    const text = msgData.textMessageData?.textMessage || 
                 msgData.extendedTextMessageData?.text || 
                 msgData.fileMessageData?.caption || '';
    const fileUrl = msgData.fileMessageData?.downloadUrl || '';

    console.log('--- Incoming message from Hila the Trainer ---', { text, fileUrl });

    // Send immediate query to Manager (054-3200007)
    const managerChatId = '972543200007@c.us';
    let alertMsg = `🐾 *התקבלה קבלה/הודעה מהילה המאלפת (Halodog)*\n`;
    if (text) alertMsg += `\n📄 *פרטי הודעה/קבלה:* "${text}"`;
    if (fileUrl) alertMsg += `\n📷 *צורפה תמונת קבלה לתיוק*`;
    alertMsg += `\n\n❓ *האם שולם בפועל וכמה?*\nנא להשיב כאן (לדוגמה: "שולם 1000 בביט") או להעביר אישור תשלום ביט כדי שאתייק אותו בריזורט ואסגור את החשבון.`;

    await sendWhatsAppMessage(managerChatId, alertMsg);

    // Save pending receipt to Supabase settings
    try {
      const sRes = await fetch(`${SUPABASE_URL}/rest/v1/resort_settings?id=eq.default&select=data`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (sRes.ok) {
        const sData = await sRes.json();
        const curData = sData?.[0]?.data || {};
        const curReceipts = Array.isArray(curData.trainerReceipts) ? curData.trainerReceipts : [];
        const newReceipt = {
          id: `rcpt-${Date.now()}`,
          receiptNumber: (text.match(/(?:קבלה|מס'|מספר)\s*[:#]?\s*(\d+)/i) || [])[1] || 'חדשה',
          receiptDate: new Date().toISOString().substring(0, 10),
          totalAmount: 1000,
          paymentMethod: 'ביט',
          rawLineText: text || 'תמונת קבלה מוואטסאפ',
          receiptImageUrl: fileUrl,
          allocations: [],
          isPaidActually: false,
          managerQuerySent: true,
          managerQuerySentAt: new Date().toISOString(),
          status: 'pending_payment',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        curReceipts.unshift(newReceipt);
        await fetch(`${SUPABASE_URL}/rest/v1/resort_settings?id=eq.default`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ data: { ...curData, trainerReceipts: curReceipts } })
        });
      }
    } catch (dbErr) {
      console.warn('Error saving Hila receipt to Supabase:', dbErr);
    }

    return res.status(200).json({ ok: true, handled: 'hila_notified_manager' });
  }

  if (isManager) {
    const msgData = payload.messageData || {};
    const text = (msgData.textMessageData?.textMessage || 
                  msgData.extendedTextMessageData?.text || 
                  msgData.fileMessageData?.caption || '').trim();
    const fileUrl = msgData.fileMessageData?.downloadUrl || '';

    console.log('--- Incoming message from Manager (0543200007) ---', { text, fileUrl });

    const isPaymentConfirm = text.includes('שולם') || text.includes('ביט') || text.includes('העברתי') || fileUrl.length > 0;
    if (isPaymentConfirm) {
      // Update latest pending receipt in Supabase settings
      try {
        const sRes = await fetch(`${SUPABASE_URL}/rest/v1/resort_settings?id=eq.default&select=data`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          const curData = sData?.[0]?.data || {};
          const curReceipts = Array.isArray(curData.trainerReceipts) ? curData.trainerReceipts : [];
          let updated = false;
          for (const r of curReceipts) {
            if (!r.isPaidActually) {
              r.isPaidActually = true;
              r.paidDate = new Date().toISOString().substring(0, 10);
              r.paymentConfirmationNotes = text || 'אושר ע"י מנהל בוואטסאפ';
              if (fileUrl) r.paymentConfirmationUrl = fileUrl;
              r.status = 'paid';
              r.updatedAt = new Date().toISOString();
              updated = true;
              break;
            }
          }
          if (updated) {
            await fetch(`${SUPABASE_URL}/rest/v1/resort_settings?id=eq.default`, {
              method: 'PATCH',
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ data: { ...curData, trainerReceipts: curReceipts } })
            });
          }
        }
      } catch (dbErr) {
        console.warn('Error updating manager confirmation:', dbErr);
      }

      await sendWhatsAppMessage(chatId, `✅ *אישור התשלום תויק בהצלחה בריזורט!*\nהקבלה של הילה עודכנה כשולמה בביט והחשבון סגור.`);
      return res.status(200).json({ ok: true, handled: 'manager_payment_filed' });
    }
  }

  // 4. Anti-spam / Cooldown check (don't reply more than once every 6 hours)
  const nowMs = Date.now();
  const lastSent = cooldownMap.get(cleanPhone);
  if (lastSent && (nowMs - lastSent) < 6 * 60 * 60 * 1000) {
    return res.status(200).json({ ok: true, reason: 'cooldown active' });
  }

  // 4. Determine Israel Time & Status
  const now = new Date();
  const israelDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }); // YYYY-MM-DD
  const israelTimeStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Jerusalem", hour: '2-digit', minute: '2-digit' });
  const [hour, minute] = israelTimeStr.split(':').map(Number);
  const timeInMinutes = hour * 60 + minute;

  // Day of week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const israelDay = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).getDay();

  // Weekend closure: Friday from 14:00, all Saturday, Sunday until 09:30
  const isFridayAfternoon = (israelDay === 5 && timeInMinutes >= 14 * 60);
  const isSaturday = (israelDay === 6);
  const isSundayMorning = (israelDay === 0 && timeInMinutes < 9 * 60 + 30);
  const isWeekendClosed = isFridayAfternoon || isSaturday || isSundayMorning;

  // Jewish Holiday check
  const isHolidayClosed = await checkIsShabbatOrHoliday(israelDateStr);

  const isClosedHours = isWeekendClosed || isHolidayClosed;

  // 5. Check client status (Existing vs New)
  const isExisting = await isExistingClient(phoneSuffix);

  // Set cooldown mark
  cooldownMap.set(cleanPhone, nowMs);

  // 6. Action decision
  if (isClosedHours) {
    if (isExisting) {
      // Existing client in closed hours: send closed message
      await sendWhatsAppMessage(chatId, CLOSED_WEEKEND_HOLIDAY_MSG);
    } else {
      // New client in closed hours: send closed message + intake form message
      await sendWhatsAppMessage(chatId, CLOSED_WEEKEND_HOLIDAY_MSG);
      // Small pause of 1.2s before second message
      await new Promise(r => setTimeout(r, 1200));
      await sendWhatsAppMessage(chatId, getIntakeFormMessage(cleanPhone, senderName));
    }
  } else {
    // Normal Business Hours
    if (!isExisting) {
      // New client in open hours: send ONLY intake form message
      await sendWhatsAppMessage(chatId, getIntakeFormMessage(cleanPhone, senderName));
    }
    // Existing client in open hours: no auto-reply (human answers)
  }

  return res.status(200).json({
    ok: true,
    sent: true,
    isClosedHours,
    isExisting,
    phoneSuffix
  });
}
