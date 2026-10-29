const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

function calculateDaysCount(start, end) {
  const d1 = new Date(start + 'T12:00:00');
  const d2 = new Date(end + 'T12:00:00');
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

async function sim() {
  const { data: bRows } = await supabase.from('bookings').select('*');
  const allBookings = (bRows || []).map(r => ({ id: r.id, ...(r.data || r) }));
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const sData = sRows?.[0]?.data || {};
  const passesList = sData.daycare_passes || [];

  for (const passCodeClean of ['6310', '6311']) {
    const matchedPass = passesList.find(p => p.passCode === passCodeClean);
    console.log(`\n================ Testing Pass #${passCodeClean} (${matchedPass?.dogName}) ================`);
    const phoneDigits = '5716886';

    const passBookings = allBookings
      .filter(b => {
        if (b.stayStatus === 'cancelled' || b.stay_status === 'cancelled') return false;
        const bPassCode = b.daycarePassCode || b.daycare_pass_code || (b.notes || '').match(/#?([A-Za-z0-9\u0590-\u05FF-]+)/i)?.[1];
        if (bPassCode) {
          return String(bPassCode).trim().toUpperCase() === passCodeClean;
        }
        const bPhoneDigits = String(b.ownerPhone || '').replace(/\D/g, '').slice(-7);
        if (!bPhoneDigits || !phoneDigits || bPhoneDigits !== phoneDigits) return false;
        const bDog = String(b.dogName || '').trim().toLowerCase();
        const pDog = String(matchedPass.dogName || '').trim().toLowerCase();
        if (pDog && bDog) {
          return pDog.includes(bDog) || bDog.includes(pDog);
        }
        return true;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    console.log('passBookings found:', passBookings.map(b => ({ id: b.id, dog: b.dogName, start: b.startDate, end: b.endDate })));

    for (const targetDateStr of ['2026-10-25', '2026-11-01', '2026-11-05', '2026-11-08']) {
      for (const booking of passBookings) {
        let nightsConsumedBeforeThisBooking = 0;
        for (const pb of passBookings) {
          if (pb.id === booking.id) break;
          const isPbBoarding = pb.serviceType === 'boarding';
          const pbNights = isPbBoarding ? Math.max(1, calculateDaysCount(pb.startDate, pb.endDate)) : 1;
          nightsConsumedBeforeThisBooking += pbNights;
        }
        const totalNightsInThisBooking = Math.max(1, calculateDaysCount(booking.startDate, booking.endDate));
        let currentDayInStay = 1;
        if (targetDateStr <= booking.startDate) {
          currentDayInStay = 1;
        } else if (targetDateStr >= booking.endDate) {
          currentDayInStay = totalNightsInThisBooking;
        } else {
          currentDayInStay = Math.min(totalNightsInThisBooking, Math.max(1, calculateDaysCount(booking.startDate, targetDateStr) + 1));
        }
        const totalConsumedOnThisDate = nightsConsumedBeforeThisBooking + currentDayInStay;
        const remainingOnThisDate = matchedPass.totalDays - totalConsumedOnThisDate;
        console.log(`[Date: ${targetDateStr}] Dog: ${booking.dogName} => Consumed: ${totalConsumedOnThisDate}/${matchedPass.totalDays}, Remaining: ${remainingOnThisDate}`);
      }
    }
  }
}

sim().catch(console.error);
