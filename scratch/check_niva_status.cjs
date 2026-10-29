const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const CLUSTER = '7107';

async function fetchChat(chatId, limit = 10) {
  try {
    const res = await fetch(`https://${CLUSTER}.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, count: limit })
    });
    if (!res.ok) {
      return { error: `status ${res.status}: ${await res.text()}` };
    }
    const msgs = await res.json();
    return msgs;
  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  console.log('=== CHECKING WHATSAPP CHAT HISTORY ===');
  
  // 1. Niva
  console.log('\n--- NIVA PORAN (972507900781@c.us) ---');
  const nivaMsgs = await fetchChat('972507900781@c.us', 10);
  if (Array.isArray(nivaMsgs)) {
    nivaMsgs.reverse().forEach(m => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || `[${m.typeMessage}]`;
      console.log(`[${time}] ${m.type} (${m.senderName || m.chatId}):\n${text}\n`);
    });
  } else {
    console.log('Niva chat fetch error:', nivaMsgs);
  }

  // 2. Shmulik
  console.log('\n--- SHMULIK (972506336896@c.us) ---');
  const shmulikMsgs = await fetchChat('972506336896@c.us', 10);
  if (Array.isArray(shmulikMsgs)) {
    shmulikMsgs.reverse().forEach(m => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || `[${m.typeMessage}]`;
      console.log(`[${time}] ${m.type} (${m.senderName || m.chatId}):\n${text}\n`);
    });
  } else {
    console.log('Shmulik chat fetch error:', shmulikMsgs);
  }

  // 3. Hagai
  console.log('\n--- HAGAI (972543200007@c.us) ---');
  const hagaiMsgs = await fetchChat('972543200007@c.us', 10);
  if (Array.isArray(hagaiMsgs)) {
    hagaiMsgs.reverse().forEach(m => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || `[${m.typeMessage}]`;
      console.log(`[${time}] ${m.type} (${m.senderName || m.chatId}):\n${text}\n`);
    });
  } else {
    console.log('Hagai chat fetch error:', hagaiMsgs);
  }

  // 4. Check Grow payments
  console.log('\n=== CHECKING GROW PAYMENTS & BOOKINGS ===');
  const { data: grow } = await supabase.from('grow_incoming_payments').select('*');
  const nivaPayments = (grow || []).filter(p => {
    const s = JSON.stringify(p);
    return s.includes('ניבה') || s.includes('פורן') || s.includes('7900781') || s.includes('שטוץ') || s.includes('דודו');
  });
  console.log('Grow payments matching Niva:', nivaPayments);

  // Check recent payments overall (last 10)
  console.log('\nLast 5 Grow incoming payments:');
  const sortedGrow = (grow || []).sort((a,b) => new Date(b.created_at || b.payment_date) - new Date(a.created_at || a.payment_date)).slice(0, 5);
  sortedGrow.forEach(p => {
    console.log(`ID: ${p.id}, Customer: ${p.customer_name}, Amount: ${p.amount}, Date: ${p.payment_date || p.created_at}, Status: ${p.status}`);
  });

  // Check booking for Niva
  const { data: bookings } = await supabase.from('bookings').select('*');
  const nivaBookings = (bookings || []).filter(b => {
    const s = JSON.stringify(b);
    return s.includes('ניבה') || s.includes('פורן') || s.includes('7900781') || s.includes('שטוץ') || s.includes('דודו');
  });
  console.log('\nBookings matching Niva:');
  nivaBookings.forEach(b => {
    console.log(`ID: ${b.id}, Owner: ${b.ownerName || b.owner_name}, Dog: ${b.dogName || b.dog_name}, Total: ${b.totalPrice || b.total_price}, Deposit: ${b.depositAmount || b.deposit_amount}, PaymentStatus: ${b.paymentStatus || b.payment_status}`);
  });
}

main().catch(console.error);
