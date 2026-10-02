const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

async function main() {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("=== CHECKING SUPABASE FOR ADI FLITMAN ===");
  const { data: bookings } = await supabase.from('bookings').select('*').or('owner_phone.ilike.%525288140%,owner_name.ilike.%פליטמן%,dog_name.ilike.%קצ%');
  console.log("Bookings found:", bookings?.length);
  bookings?.forEach(b => {
    console.log(`Booking ID: ${b.id}, Dog: ${b.dog_name}, Owner: ${b.owner_name}, Total: ${b.total_price}, Deposit: ${b.deposit_amount}, Status: ${b.payment_status}, Dates: ${b.start_date} -> ${b.end_date}`);
    console.log("Notes:", b.notes);
  });

  const { data: intakes } = await supabase.from('intake_requests').select('*').or('owner_phone.ilike.%525288140%,owner_name.ilike.%פליטמן%,dog_name.ilike.%קצ%');
  console.log("\nIntakes found:", intakes?.length);
  intakes?.forEach(i => {
    console.log(`Intake ID: ${i.id}, Dog: ${i.dog_name}, Owner: ${i.owner_name}, Total: ${i.total_price}, Deposit: ${i.deposit_amount}, Status: ${i.status}`);
  });

  const { data: payments } = await supabase.from('grow_incoming_payments').select('*').or('customer_phone.ilike.%525288140%,customer_name.ilike.%פליטמן%');
  console.log("\nGrow Incoming Payments found:", payments?.length);
  payments?.forEach(p => {
    console.log(`Payment: ${p.customer_name} (₪${p.amount}), Reference: ${p.reference}, Method: ${p.payment_method}, Date: ${p.created_at}`);
  });

  console.log("\n=== CHECKING WHATSAPP CHAT WITH ADI FLITMAN ===");
  try {
    const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972525288140@c.us', count: 20 })
    });
    const msgs = await res.json();
    console.log("Total messages in chat:", msgs?.length);
    (msgs || []).reverse().forEach(m => {
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || '[Media/Other]';
      const sender = m.type === 'outgoing' ? 'שמוליק/ריזורט' : 'עדי פליטמן';
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`[${time}] ${sender}: ${text}\n`);
    });
  } catch (err) {
    console.error("Error fetching chat:", err);
  }
}

main();
