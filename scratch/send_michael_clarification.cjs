const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

async function sendWhatsApp(chatId, message) {
  const url = `https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message })
  });
  return await res.json();
}

async function main() {
  console.log('--- Step 1: Preparing Messages ---');

  const michaelMessage = `היי מיכאל, ערב טוב! 🐾
עשינו עבורך בדיקה מעמיקה ויסודית מול חברת הסליקה Grow כדי לעשות סדר מלא:

1. החיוב ע״ס 720 ₪ שמופיע לך באפליקציית האשראי הוא התשלום שביצעת ב-9 באוקטובר עבור חופשת הפנסיון של חיימי בסוף החודש (29/10–02/11, אסמכתא 4956110120) – התשלום ההוא מוסדר ומאושר אצלנו ב-100%!

2. לגבי הכרטיסייה מהיום (14.10) – הקישור שנשלח בצהריים היה קישור בדיקות טכני (Sandbox). במצב כזה Apple Pay מציג אישור במסך הנייד, אך חברת האשראי אינה סולקת וכרטיסך לא חויב כלל. תוכל לוודא בקלות בפירוט העסקאות של היום שאין שום חיוב נוסף.

3. על מנת להסדיר את כרטיסיית 10 היומיות של חיימי (היום הראשון נוצל בהצלחה היום, ונותרו 9 ימים פנויים למימוש), הנה הקישור הרשמי והמאובטח לתשלום (₪750):
👉 https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg

🏷️ לצפייה בכרטיסיית הניקוב הדיגיטלית ולשריון מועדי הגעה הבאים:
👉 https://rezort-webapp.vercel.app/?request=true&pass=1302&phone=0586275554&name=מיכאל%20בן%20הר&dog=חיימי

שמוליק וצוות הריזורט לכלב 🐾`;

  const shmulikMessage = `היי שמוליק, מעדכן בהמשך לבירור מול מיכאל בן הר (חיימי):

מיכאל ראה באפליקציית האשראי חיוב של 720 ₪ וחשב ששילם היום על הכרטיסייה – בבדיקה מדויקת מול Grow התברר שזה החיוב שלו מ-9 באוקטובר על חופשת הפנסיון (29.10–02.11, אסמכתא 4956110120 שמאושרת ביומן).
הקישור שנשלח אליו היום בצהריים היה קישור בדיקות (Sandbox) ולכן כרטיסו לא חויב היום כלל.

לבקשת חגי, אנחנו שולחים לו כעת הודעת הבהרה מסודרת עם קישור התשלום הרשמי ב-Grow (₪750) עבור כרטיסיית 10 היומיות (1302).

הנוסח שנשלח כעת למיכאל:
"${michaelMessage}"`;

  // 1. Send update to Shmulik first
  console.log('Sending update to Shmulik (050-6336896)...');
  const shmulikRes = await sendWhatsApp('972506336896@c.us', shmulikMessage);
  console.log('Shmulik response:', shmulikRes);

  // Wait 3 seconds
  await new Promise(r => setTimeout(r, 3000));

  // 2. Send message to Michael
  console.log('Sending clarification & official link to Michael (058-6275554)...');
  const michaelRes = await sendWhatsApp('972586275554@c.us', michaelMessage);
  console.log('Michael response:', michaelRes);

  // 3. Update booking notes in Supabase
  try {
    const { data: bRow } = await supabase.from('bookings').select('*').eq('id', 'b-pass-1791973779014').single();
    if (bRow) {
      const curNotes = bRow.notes || '';
      const updatedNotes = curNotes + ' | [נשלחה הודעת הבהרה וקישור רשמי לוואטסאפ ' + new Date().toLocaleTimeString('he-IL') + ']';
      await supabase.from('bookings').update({
        notes: updatedNotes,
        data: { ...(bRow.data || {}), notes: updatedNotes }
      }).eq('id', 'b-pass-1791973779014');
      console.log('Updated booking notes in Supabase');
    }
  } catch (eDb) {
    console.warn('Db update note warning:', eDb);
  }
}

main();
