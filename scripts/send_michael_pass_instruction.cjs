const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const greenApiId = '710722735421';
  const greenApiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const targetChatId = '972586275554@c.us';

  const messageText = `היי מיכאל! 🐾
שמחנו מאוד לקלוט את חיימי המתוקה ליום כיף בריזורט! 🐶❤️

הנפקנו עבורך כרטיסיית 10 יומיות (מעון יום) מוזלת:
🎟️ מספר כרטיסייה: 1302
📅 יתרה נוכחית: 9 ימים נותרו (היום הראשון נוצל בהצלחה היום)
💰 סכום הכרטיסייה: ₪720 בלבד (₪72 ליום)

💳 לתשלום מאובטח ומהיר בלחיצה (Bit, Apple Pay, Google Pay או אשראי):
👉 https://sandbox.grow.link/9d170a0ec6b695758deaff4e72b60965-NzM1NDg

🏷️ לצפייה בכרטיסיית הניקוב הדיגיטלית שלך ולשריון מועדי הגעה הבאים:
👉 https://rezort-webapp.vercel.app/?request=true&pass=1302&phone=0586275554&name=מיכאל%20בן%20הר&dog=חיימי

(חיימי כבר רשומה ומאומתת אצלנו, כך שבימים הבאים אין צורך למלא שום שאלון – רק בוחרים תאריך הגעה ולוחצים על שליחה!)

במידה ואתה נתקל בקושי או שאלה, חגי זמין עבורך ישירות ב-054-3200007 וישמח לסייע.
שמוליק וצוות הריזורט לכלב 🐾`;

  console.log('Sending WhatsApp to Michael Ben Har (058-6275554)...');
  const sendUrl = `https://7107.api.greenapi.com/waInstance${greenApiId}/sendMessage/${greenApiToken}`;

  const res = await fetch(sendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: targetChatId,
      message: messageText
    })
  });

  const data = await res.json();
  console.log('Green-API Response:', JSON.stringify(data, null, 2));

  // Also update booking notes with sent timestamp
  if (data && data.idMessage) {
    const { data: bRow } = await supabase.from('bookings').select('*').eq('id', 'b-pass-1791973779014').single();
    if (bRow) {
      const d = bRow.data || {};
      const noteUpdate = (bRow.notes || '') + ' | [נשלחה כרטיסייה והסבר לוואטסאפ ' + new Date().toLocaleTimeString('he-IL') + ']';
      await supabase.from('bookings').update({
        notes: noteUpdate,
        data: { ...d, notes: noteUpdate, passMessageSentAt: new Date().toISOString() }
      }).eq('id', 'b-pass-1791973779014');
      console.log('Updated booking note with sent confirmation');
    }
  }
}

main();
