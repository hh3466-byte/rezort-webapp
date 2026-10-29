const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

function calculateDaysCount(start, end) {
  const d1 = new Date(start + 'T12:00:00');
  const d2 = new Date(end + 'T12:00:00');
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

async function fixSaar() {
  console.log('Fixing Saar: updating Kezach booking to passCode 6311 and activating 6311...');
  
  // 1. Fetch bookings
  const { data: bRows } = await supabase.from('bookings').select('*');
  const kezachBookingRow = bRows.find(r => {
    const d = r.data || r;
    return d.dogName === 'קצח' && (d.ownerName === 'סער' || (d.ownerPhone && d.ownerPhone.includes('5716886')));
  });

  if (kezachBookingRow) {
    const curData = kezachBookingRow.data || kezachBookingRow;
    const updatedData = {
      ...curData,
      daycarePassCode: '6311',
      daycarePassId: 'pass-1792746960779',
      notes: [
        curData.notes?.replace(/#6310/g, '#6311'),
        '[שויך לכרטיסייה #6311 (קצח)]'
      ].filter(Boolean).join(' | '),
      updatedAt: new Date().toISOString()
    };
    await supabase.from('bookings').update({ data: updatedData }).eq('id', kezachBookingRow.id);
    console.log('Updated Kezach booking in bookings table to passCode 6311');
  }

  // 2. Fetch settings and update daycare_passes
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const sData = sRows?.[0]?.data || {};
  const passes = sData.daycare_passes || [];

  const p6311 = passes.find(p => p.passCode === '6311');
  if (p6311) {
    p6311.status = 'active'; // active for Saar
    p6311.dogName = 'קצח (וירדנה)';
    p6311.notes = (p6311.notes || '') + ' | [הופעל לבקשת סער לתשלום עד 02.11.2026]';
    p6311.updatedAt = new Date().toISOString();
  }

  const p6310 = passes.find(p => p.passCode === '6310');
  if (p6310) {
    p6310.dogName = 'ירדנה (וקצח)';
    p6310.updatedAt = new Date().toISOString();
  }

  await supabase.from('settings').update({ data: sData }).eq('id', 'resort_settings');
  console.log('Updated settings daycare_passes: 6310 for Yardena, 6311 for Kezach (active)');
}

fixSaar().catch(console.error);
