const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function updateShaniAndRiko() {
  console.log('--- 1. UPDATING BOOKINGS ---');
  // Update b-1792341775847 (Current stay: 22.10 to 25.10, checked_in)
  const { data: b1Arr } = await supabase.from('bookings').select('*').eq('id', 'b-1792341775847');
  if (b1Arr && b1Arr.length > 0) {
    const b1 = b1Arr[0];
    const b1Data = b1.data || {};
    const res1 = await supabase.from('bookings').update({
      owner_name: 'שני נחשון',
      start_date: '2026-10-22',
      end_date: '2026-10-25',
      stay_status: 'checked_in',
      data: {
        ...b1Data,
        ownerName: 'שני נחשון',
        startDate: '2026-10-22',
        endDate: '2026-10-25',
        stayStatus: 'checked_in',
        checkInDate: '2026-10-22',
        checkedInAt: '2026-10-22T14:49:00.000Z'
      },
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1792341775847');
    console.log('Updated b-1792341775847 (checked_in, 22.10-25.10, שני נחשון):', res1.error ? res1.error : 'SUCCESS');
  }

  // Update b-1792341838421 (Next stay: 29.10 to 01.11, שני נחשון)
  const { data: b2Arr } = await supabase.from('bookings').select('*').eq('id', 'b-1792341838421');
  if (b2Arr && b2Arr.length > 0) {
    const b2 = b2Arr[0];
    const b2Data = b2.data || {};
    const res2 = await supabase.from('bookings').update({
      owner_name: 'שני נחשון',
      data: {
        ...b2Data,
        ownerName: 'שני נחשון'
      },
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1792341838421');
    console.log('Updated b-1792341838421 (שני נחשון):', res2.error ? res2.error : 'SUCCESS');
  }

  console.log('\n--- 2. UPDATING PASS IN SETTINGS & DAYCARE_PASSES ---');
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const sRow = sRows?.[0] || {};
  const sData = sRow.data || {};

  // Update in settings.data.daycare_passes
  let updatedPasses = (sData.daycare_passes || []).map(p => {
    if (String(p.passCode).includes('8935') || String(p.ownerPhone).includes('6474151')) {
      const history = (p.usageHistory || []).map(entry => {
        if (entry.bookingId === 'b-1792341775847' || entry.date === '2026-10-23') {
          return {
            ...entry,
            date: '2026-10-22',
            endDate: '2026-10-25',
            notes: 'סופ"ש פנסיון VIP (22.10–25.10) לריקו (חמישי עד ראשון)',
            bookingId: 'b-1792341775847',
            daysDeducted: 3,
            daysCount: 3
          };
        }
        return entry;
      });

      return {
        ...p,
        ownerName: 'שני נחשון',
        usedDays: 9, // 3 (trial) + 3 (22-25) + 3 (29-01) = 9 days used, 12 remaining
        usageHistory: history,
        updatedAt: new Date().toISOString()
      };
    }
    return p;
  });

  // Update in settings.data.intakeRequests
  let updatedIntakes = (sData.intakeRequests || []).map(i => {
    if (String(i.ownerPhone || '').includes('6474151') || String(i.ownerName || '').includes('שני')) {
      return {
        ...i,
        ownerName: 'שני נחשון'
      };
    }
    return i;
  });

  const resSettings = await supabase.from('settings').update({
    data: {
      ...sData,
      daycare_passes: updatedPasses,
      intakeRequests: updatedIntakes
    },
    updated_at: new Date().toISOString()
  }).eq('id', sRow.id || 'resort_config');
  console.log('Updated settings (daycare_passes & intakeRequests):', resSettings.error ? resSettings.error : 'SUCCESS');

  // Also update daycare_passes table if it exists
  const { data: dbPasses } = await supabase.from('daycare_passes').select('*');
  if (dbPasses && dbPasses.length > 0) {
    const match = dbPasses.find(p => String(p.pass_code || p.passCode).includes('8935'));
    if (match) {
      await supabase.from('daycare_passes').update({
        owner_name: 'שני נחשון',
        used_days: 9,
        updated_at: new Date().toISOString()
      }).eq('id', match.id);
      console.log('Updated daycare_passes table:', match.id);
    }
  }
}

updateShaniAndRiko().catch(console.error);
