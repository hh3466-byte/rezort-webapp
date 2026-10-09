const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let envContent = '';
if (fs.existsSync('.env')) envContent = fs.readFileSync('.env', 'utf8');
if (fs.existsSync('.env.local')) envContent += '\n' + fs.readFileSync('.env.local', 'utf8');

const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/) || envContent.match(/SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/) || envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || envContent.match(/SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const greenApiId = '710722735421';
  const greenApiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const paymentUrl = 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

  const messageText = `היי מיכאל, שמחנו לשוחח! 🐾🐶
שמחים לעדכן שהמקום עבור *חיימי* נשמר בריזורט לכלב בין התאריכים 29/10/2026 עד 02/11/2026 (סכום מוסכם: ₪720).
להשלמת השריון, יש ללחוץ על הקישור המאובטח (סכום מוסכם: ₪720):
👉 https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg

💡 *לתשלום ב-Bit, Apple Pay, Google Pay, PayBox או אשראי:* פשוט לוחצים על הקישור למעלה ובוחרים באמצעי התשלום הרצוי (התשלום נקלט ומעדכן את המערכת אוטומטית עם קבלה וחשבונית מס מיידית!).

⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:30 - 18:30*
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:30
• מעבר לשעות הפעילות (לפני 09:30 ואחרי 18:30), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾

בברכה חמה,
שמוליק וכל צוות הריזורט לכלב 🐾`;

  const targetPhone = '972586275554@c.us';
  const greenUrl = `https://7107.api.greenapi.com/waInstance${greenApiId}/sendMessage/${greenApiToken}`;
  console.log('Sending message to WhatsApp:', targetPhone);
  
  const sendRes = await fetch(greenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: targetPhone,
      message: messageText
    })
  });
  
  const sendData = await sendRes.json();
  console.log('Green-API Send Result:', sendData);

  // Update booking in Supabase
  const { data: bRow } = await supabase.from('bookings').select('*').eq('id', 'b-1791525217215').single();
  if (bRow) {
    const d = bRow.data || {};
    const updatedNotes = (bRow.notes || '').replace(/\[שולם[^\]]*\]/g, '').trim() + ' | [נשלח קישור לתשלום ב-Grow בסך ₪720]';
    await supabase.from('bookings').update({
      deposit_amount: 0,
      payment_status: 'unpaid',
      payment_method: null,
      notes: updatedNotes,
      data: {
        ...d,
        depositAmount: 0,
        paymentStatus: 'unpaid',
        paymentMethod: undefined,
        notes: updatedNotes,
        paymentLink: paymentUrl
      },
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1791525217215');
    console.log('Booking b-1791525217215 successfully reset to UNPAID (deposit = 0)!');
  }

  // Also save message in whatsapp_messages table
  try {
    await supabase.from('whatsapp_messages').insert({
      chat_id: '972586275554@c.us',
      sender_type: 'resort',
      message_text: messageText,
      status: 'sent',
      created_at: new Date().toISOString()
    });
    console.log('Message logged to CRM database.');
  } catch (e) {
    console.error('Error logging to CRM:', e);
  }
}

run().catch(console.error);
