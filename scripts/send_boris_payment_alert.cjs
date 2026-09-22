const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

async function notifyPayment() {
  const msg = `🟢 *התקבל תשלום חדש ב-Grow לריזורט לכלב!*

👤 *שם הלקוח:* בוריס ברנר
🐕 *שם הכלב:* מייק (מלמוט)
💰 *סכום ששולם:* ₪2,220 (שולם מלא)
💳 *אמצעי תשלום:* Bit (Mastercard...5407)
🔢 *אסמכתא Grow:* 175551443
📞 *טלפון:* 054-5970156
📧 *מייל:* brener1985@gmail.com
📅 *תקופת שהות:* 22/09/2026 עד 08/10/2026 (הגעה היום שלישי בבוקר 09:00-11:00)
✅ *סטטוס:* שויך ונרשם בהצלחה ביומן ההזמנות ובמערכת הריזורט לכלב!`;

  const recipients = ['972506336896@c.us', '972543200007@c.us'];

  for (const r of recipients) {
    try {
      const res = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: r, message: msg })
      });
      console.log(`Sent to ${r}:`, res.status);
    } catch (e) {
      console.error(`Failed to send to ${r}:`, e);
    }
  }
}

notifyPayment();
