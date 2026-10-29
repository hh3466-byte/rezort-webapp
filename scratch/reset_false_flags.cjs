const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function resetFalseFlags() {
  // 1. Reset settings
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const sRow = sRows?.[0] || {};
  const curData = sRow.data || {};
  
  await supabase.from('settings').update({
    data: {
      ...curData,
      lastTomorrowOverviewSentDate: '2026-10-21',
      last2000DailyUpdateSentDate: '2026-10-21'
    },
    updated_at: new Date().toISOString()
  }).eq('id', sRow.id || 'resort_config');
  console.log('Reset settings.lastTomorrowOverviewSentDate and last2000DailyUpdateSentDate to 2026-10-21');

  // 2. Reset bookings that got lastDailyDogUpdateSent: '2026-10-22'
  const { data: bookings } = await supabase.from('bookings').select('id, dog_name, data');
  let clearedCount = 0;
  for (const b of (bookings || [])) {
    if (b.data?.lastDailyDogUpdateSent === '2026-10-22') {
      const updatedData = { ...b.data };
      delete updatedData.lastDailyDogUpdateSent;
      await supabase.from('bookings').update({
        data: updatedData,
        updated_at: new Date().toISOString()
      }).eq('id', b.id);
      console.log(`Cleared lastDailyDogUpdateSent for ${b.dog_name}`);
      clearedCount++;
    }
  }
  console.log(`Total bookings cleared: ${clearedCount}`);
}

resetFalseFlags().catch(console.error);
