const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getPassInfoForBooking(booking, settings, targetDateStr, allBookings = []) {
  const passesList = (settings?.daycare_passes || settings?.daycarePasses || []);
  const bData = booking.data || {};
  const passCode = booking.daycarePassCode || booking.daycare_pass_code || bData.daycarePassCode ||
                   (booking.notes || '').match(/קוד כרטיסייה:\s*([A-Za-z0-9\u0590-\u05FF-]+)/i)?.[1] ||
                   (booking.notes || '').match(/בנק.*?:\s*#?([A-Za-z0-9\u0590-\u05FF-]+)/i)?.[1] ||
                   (booking.notes || '').match(/כרטיסיי?ה.*?#?([A-Za-z0-9\u0590-\u05FF-]+)/i)?.[1];

  let matchedPass = undefined;
  if (passCode) {
    const clean = String(passCode).trim().toUpperCase();
    matchedPass = passesList.find(p => String(p.passCode || '').toUpperCase() === clean || p.id === clean);
  }
  if (!matchedPass && (booking.ownerPhone || bData.ownerPhone)) {
    const phone = booking.ownerPhone || bData.ownerPhone;
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-7);
    if (cleanPhone.length >= 7) {
      matchedPass = passesList.find(p => {
        const pDigits = String(p.ownerPhone || '').replace(/\D/g, '').slice(-7);
        return pDigits === cleanPhone && p.status === 'active';
      });
    }
  }

  if (matchedPass) {
    const totalDays = matchedPass.totalDays || 21;
    const isBoarding = matchedPass.serviceType === 'boarding';

    // If targetDateStr is not provided, return the pass's current snapshot
    if (!targetDateStr) {
      const remainingDays = Math.max(0, totalDays - matchedPass.usedDays);
      return {
        isPass: true,
        passCode: matchedPass.passCode,
        totalDays,
        usedDays: matchedPass.usedDays,
        remainingDays,
        dayIndex: matchedPass.usedDays,
        isBoarding,
        label: `🎟️ ${remainingDays}/${totalDays}`
      };
    }

    // Dynamic chronological calculation for targetDateStr
    // 1. Gather all active bookings for this pass
    const passCodeClean = String(matchedPass.passCode).trim().toUpperCase();
    const phoneDigits = String(matchedPass.ownerPhone || '').replace(/\D/g, '').slice(-7);
    
    const passBookings = (allBookings || []).filter(b => {
      if (b.stay_status === 'cancelled' || b.stayStatus === 'cancelled') return false;
      const bPassCode = b.daycarePassCode || b.daycare_pass_code || b.data?.daycarePassCode ||
                        (b.notes || '').match(/#?([A-Za-z0-9\u0590-\u05FF-]+)/i)?.[1];
      if (bPassCode && String(bPassCode).trim().toUpperCase() === passCodeClean) return true;
      const bPhoneDigits = String(b.owner_phone || b.ownerPhone || '').replace(/\D/g, '').slice(-7);
      return (bPhoneDigits && phoneDigits && bPhoneDigits === phoneDigits);
    });

    // 2. Expand all stay nights/dates across all bookings
    const stayDateSet = new Set();
    passBookings.forEach(pb => {
      const s = pb.start_date || pb.startDate;
      const e = pb.end_date || pb.endDate;
      if (!s) return;
      const isPbBoarding = pb.service_type === 'boarding' || pb.serviceType === 'boarding' || isBoarding;
      
      // Boarding consumes nights (from s up to e - 1, or s if s === e)
      let curr = s;
      const endLimit = (isPbBoarding && e && e > s) ? e : addDays(s, 1);
      while (curr < endLimit) {
        stayDateSet.add(curr);
        curr = addDays(curr, 1);
      }
    });

    const allStayDates = Array.from(stayDateSet).sort();

    // 3. Find unbooked prior usage (e.g. trial stays or manual entries in usageHistory)
    const earliestBookingDate = allStayDates[0] || (booking.start_date || booking.startDate);
    let priorUnbookedDays = 0;
    (matchedPass.usageHistory || []).forEach(entry => {
      const hasBooking = entry.bookingId && passBookings.some(pb => pb.id === entry.bookingId);
      if (!hasBooking && (!entry.date || entry.date < earliestBookingDate)) {
        priorUnbookedDays += (entry.daysDeducted || entry.daysCount || 0);
      }
    });

    // 4. Count days consumed up to targetDateStr
    const bookedDatesUsedUpToTarget = allStayDates.filter(d => d <= targetDateStr).length;
    const totalConsumedOnThisDate = priorUnbookedDays + bookedDatesUsedUpToTarget;
    const remainingOnThisDate = Math.max(0, totalDays - totalConsumedOnThisDate);
    const dayIndexOnThisDate = totalConsumedOnThisDate;

    return {
      isPass: true,
      passCode: matchedPass.passCode,
      totalDays,
      usedDays: totalConsumedOnThisDate,
      remainingDays: remainingOnThisDate,
      dayIndex: dayIndexOnThisDate,
      isBoarding,
      label: `🎟️ נותרו ${remainingOnThisDate}`
    };
  }

  return null;
}

async function testCalculation() {
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const settings = sRows[0]?.data || {};
  const { data: bookings } = await supabase.from('bookings').select('*');

  const rikoBooking = bookings.find(b => b.id === 'b-1792341775847');
  console.log('Testing Riko booking b-1792341775847:');

  const testDates = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
  testDates.forEach(dateStr => {
    const info = getPassInfoForBooking(rikoBooking, settings, dateStr, bookings);
    console.log(`Date ${dateStr}: day ${info.dayIndex} of ${info.totalDays} -> ${info.remainingDays} נותרו`);
  });
}

testCalculation().catch(console.error);
