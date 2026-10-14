const fs = require('fs');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function investigate() {
  console.log('=== 1. SEARCH ALL BOOKINGS ===');
  const { data: bookings } = await supabase.from('bookings').select('*');
  const queries = ['חמו', 'מרים', 'עומר', 'תומר', 'רגב', 'ליאו', 'ספינדל', 'אלון', '0545705976', '054-5705976'];
  
  for (const b of (bookings || [])) {
    const hay = [
      b.id, b.owner_name, b.dog_name, b.owner_phone, b.notes, b.kennel_number,
      JSON.stringify(b.data || {})
    ].join(' ').toLowerCase();

    for (const q of queries) {
      if (hay.includes(q.toLowerCase())) {
        console.log(`[BOOKING MATCH "${q}"]:`, {
          id: b.id,
          dog_name: b.dog_name,
          owner_name: b.owner_name,
          owner_phone: b.owner_phone,
          start_date: b.start_date,
          end_date: b.end_date,
          kennel_number: b.kennel_number,
          data_kennel: b.data?.kennelNumber,
          total_price: b.total_price,
          deposit_amount: b.deposit_amount,
          payment_status: b.payment_status,
          stay_status: b.stay_status,
          notes: b.notes
        });
        break;
      }
    }
  }

  console.log('\n=== 2. SEARCH SETTINGS (INTAKES, CHATS, CONFIG) ===');
  const { data: settingsList } = await supabase.from('settings').select('*');
  for (const s of (settingsList || [])) {
    console.log('Settings key:', s.key, 'keys in data:', Object.keys(s.data || {}));
    const val = s.data || {};
    
    // Check intakes
    const intakes = val.intakeRequests || [];
    console.log(`Intakes count in key ${s.key}:`, intakes.length);
    for (const i of intakes) {
      const hay = [i.id, i.ownerName, i.dogName, i.phone, i.notes, i.status, i.chatStatus].join(' ').toLowerCase();
      for (const q of queries) {
        if (hay.includes(q.toLowerCase())) {
          console.log(`[INTAKE MATCH "${q}"]:`, {
            id: i.id,
            dogName: i.dogName,
            ownerName: i.ownerName,
            phone: i.phone,
            status: i.status,
            chatStatus: i.chatStatus,
            startDate: i.startDate,
            endDate: i.endDate,
            notes: i.notes
          });
          break;
        }
      }
    }

    // Check leads
    const leads = val.leads || [];
    for (const l of leads) {
      const hay = [l.name, l.phone, l.status, l.notes].join(' ').toLowerCase();
      for (const q of queries) {
        if (hay.includes(q.toLowerCase())) {
          console.log(`[LEAD MATCH "${q}"]:`, l);
          break;
        }
      }
    }
  }

  console.log('\n=== 3. SEARCH GROW PAYMENTS ===');
  const { data: growList } = await supabase.from('grow_incoming_payments').select('*');
  for (const g of (growList || [])) {
    const hay = [g.id, g.payer_name, g.payer_phone, g.raw_data ? JSON.stringify(g.raw_data) : ''].join(' ').toLowerCase();
    for (const q of queries) {
      if (hay.includes(q.toLowerCase())) {
        console.log(`[GROW MATCH "${q}"]:`, {
          id: g.id,
          payer_name: g.payer_name,
          payer_phone: g.payer_phone,
          amount: g.amount,
          created_at: g.created_at,
          raw_data: g.raw_data
        });
        break;
      }
    }
  }
}

investigate().catch(console.error);
