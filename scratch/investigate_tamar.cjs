const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function investigate() {
  console.log('=== 1. BOOKINGS FOR TAMAR / LADY / KOBI ===');
  const { data: bookings } = await supabase.from('bookings').select('*');
  const relevantBookings = bookings.filter(b => {
    const s = JSON.stringify(b);
    return s.includes('0542188921') || s.includes('תמר') || s.includes('ליידי') || s.includes('0523679637') || s.includes('חלה') || s.includes('קובי');
  });
  console.log('Found bookings:', relevantBookings.length);
  relevantBookings.forEach(b => {
    console.log({
      id: b.id,
      owner_name: b.owner_name || b.data?.ownerName,
      owner_phone: b.owner_phone || b.data?.ownerPhone,
      dog_name: b.dog_name || b.data?.dogName,
      dates: `${b.start_date || b.data?.startDate} -> ${b.end_date || b.data?.endDate}`,
      total_price: b.total_price || b.data?.totalPrice,
      deposit_amount: b.deposit_amount || b.data?.depositAmount,
      payment_status: b.payment_status || b.data?.paymentStatus,
      payment_method: b.payment_method || b.data?.paymentMethod,
      notes: b.notes || b.data?.notes,
      created_at: b.created_at,
      updated_at: b.updated_at
    });
  });

  console.log('\n=== 2. GROW PAYMENTS ===');
  const { data: grow } = await supabase.from('grow_incoming_payments').select('*');
  const relevantGrow = grow.filter(g => {
    const s = JSON.stringify(g);
    return s.includes('0542188921') || s.includes('תמר') || s.includes('ליידי') || s.includes('0523679637') || s.includes('חלה') || s.includes('קובי') || s.includes('220') || s.includes('560094');
  });
  console.log('Relevant Grow:', JSON.stringify(relevantGrow, null, 2));

  console.log('\n=== 3. GREEN API CHAT FOR TAMAR (0542188921) ===');
  const GREEN_API_URL = process.env.GREEN_API_URL || 'https://7105.api.greenapi.com';
  const GREEN_API_ID = process.env.GREEN_API_ID_INSTANCE || '7105244547';
  const GREEN_API_TOKEN = process.env.GREEN_API_API_TOKEN_INSTANCE || 'fbc2a3a5f7824874b9f2ebfe7fef56f2e82f767dfd7b4db1b38cf4826f4f2cff';

  const cleanPhone = '972542188921@c.us';
  try {
    const res = await fetch(`${GREEN_API_URL}/waInstance${GREEN_API_ID}/GetChatHistory/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: cleanPhone, count: 20 })
    });
    const msgs = await res.json();
    console.log(`Found ${Array.isArray(msgs) ? msgs.length : 0} messages with Tamar:`);
    if (Array.isArray(msgs)) {
      msgs.reverse().forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || (m.caption ? `[Media: ${m.caption}]` : `[${m.typeMessage}]`);
        console.log(`[${new Date(m.timestamp * 1000).toLocaleString('he-IL')}] ${m.type === 'outgoing' ? 'Me ->' : '<- Tamar'}: ${text}`);
      });
    }
  } catch (e) {
    console.error('Error fetching chat history:', e.message);
  }

  console.log('\n=== 4. GREEN API CHAT FOR KOBI (0523679637) ===');
  const kobiPhone = '972523679637@c.us';
  try {
    const res = await fetch(`${GREEN_API_URL}/waInstance${GREEN_API_ID}/GetChatHistory/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: kobiPhone, count: 20 })
    });
    const msgs = await res.json();
    console.log(`Found ${Array.isArray(msgs) ? msgs.length : 0} messages with Kobi:`);
    if (Array.isArray(msgs)) {
      msgs.reverse().forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || (m.caption ? `[Media: ${m.caption}]` : `[${m.typeMessage}]`);
        console.log(`[${new Date(m.timestamp * 1000).toLocaleString('he-IL')}] ${m.type === 'outgoing' ? 'Me ->' : '<- Kobi'}: ${text}`);
      });
    }
  } catch (e) {
    console.error('Error fetching chat history:', e.message);
  }
}

investigate();
