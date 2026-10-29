function calculateDaysCount(start, end) {
  if (!start || !end) return 1;
  const s = new Date(start + 'T12:00:00Z');
  const e = new Date(end + 'T12:00:00Z');
  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function addDays(d, n) {
  const dt = new Date(d + 'T12:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().split('T')[0];
}

// Pass bookings for Riko
const passBookings = [
  { id: 'b-1792341775847', startDate: '2026-10-22', endDate: '2026-10-25', serviceType: 'boarding' },
  { id: 'b-1792341838421', startDate: '2026-10-29', endDate: '2026-11-01', serviceType: 'boarding' }
].sort((a, b) => a.startDate.localeCompare(b.startDate));

const totalDays = 21;
const priorUnbookedDays = 3; // trial stay 15.10-18.10

function getPassRemainingForDate(booking, targetDateStr) {
  const isBoarding = booking.serviceType === 'boarding';
  
  // Calculate total nights consumed by prior bookings
  let nightsConsumedBeforeThisBooking = 0;
  for (const pb of passBookings) {
    if (pb.id === booking.id) break;
    const isPbBoarding = pb.serviceType === 'boarding';
    const pbNights = isPbBoarding 
      ? Math.max(1, calculateDaysCount(pb.startDate, pb.endDate))
      : 1;
    nightsConsumedBeforeThisBooking += pbNights;
  }

  // Calculate nights passed within this booking up to targetDateStr
  const totalNightsInThisBooking = isBoarding 
    ? Math.max(1, calculateDaysCount(booking.startDate, booking.endDate))
    : 1;

  let nightsPassedInThisBooking = 0;
  if (isBoarding) {
    const daysSinceStart = calculateDaysCount(booking.startDate, targetDateStr);
    nightsPassedInThisBooking = Math.min(totalNightsInThisBooking, Math.max(0, daysSinceStart));
  } else {
    nightsPassedInThisBooking = 0; // or 1 if already attended
  }

  const totalConsumed = priorUnbookedDays + nightsConsumedBeforeThisBooking + nightsPassedInThisBooking;
  const remaining = Math.max(0, totalDays - totalConsumed);

  return {
    remaining,
    totalConsumed,
    nightsPassedInThisBooking,
    totalNightsInThisBooking
  };
}

console.log('--- WEEKEND 1 (22.10 - 25.10) ---');
const b1 = passBookings[0];
for (let d = '2026-10-22'; d <= '2026-10-25'; d = addDays(d, 1)) {
  const res = getPassRemainingForDate(b1, d);
  console.log(`${d}: 🎟️ ${res.remaining} נותרו (עברו ${res.nightsPassedInThisBooking}/${res.totalNightsInThisBooking} לילות, סה"כ נוצלו ${res.totalConsumed}/${totalDays})`);
}

console.log('\n--- WEEKEND 2 (29.10 - 01.11) ---');
const b2 = passBookings[1];
for (let d = '2026-10-29'; d <= '2026-11-01'; d = addDays(d, 1)) {
  const res = getPassRemainingForDate(b2, d);
  console.log(`${d}: 🎟️ ${res.remaining} נותרו (עברו ${res.nightsPassedInThisBooking}/${res.totalNightsInThisBooking} לילות, סה"כ נוצלו ${res.totalConsumed}/${totalDays})`);
}
