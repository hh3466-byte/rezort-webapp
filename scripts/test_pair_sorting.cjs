const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function isTrainingBooking(b) {
  const service = (b.serviceType || '').toLowerCase();
  const notes = (b.notes || '').toLowerCase();
  return service.includes('training') || service.includes('אילוף') || notes.includes('אילוף');
}

function sortBookingsForDate(bookingsList, dateStr) {
  return [...bookingsList].sort((a, b) => {
    const aTrain = isTrainingBooking(a) ? 1 : 0;
    const bTrain = isTrainingBooking(b) ? 1 : 0;
    if (aTrain !== bTrain) return aTrain - bTrain;

    const getPriority = (bk) => {
      if (bk.endDate === dateStr) return 1;
      if (bk.startDate === dateStr) return 2;
      if (bk.startDate < dateStr && bk.endDate > dateStr) return 3;
      return 4;
    };

    const prioA = getPriority(a);
    const prioB = getPriority(b);
    if (prioA !== prioB) return prioA - prioB;

    const cleanPhoneA = (a.ownerPhone || '').replace(/\D/g, '');
    const cleanPhoneB = (b.ownerPhone || '').replace(/\D/g, '');
    const isSamePhone = cleanPhoneA.length >= 7 && cleanPhoneA === cleanPhoneB;
    const isSameOwner = (a.ownerName || '').trim().toLowerCase() === (b.ownerName || '').trim().toLowerCase();

    if (isSamePhone || isSameOwner) {
      const aFree = (a.isFreeStay || a.is_free_stay) ? 1 : 0;
      const bFree = (b.isFreeStay || b.is_free_stay) ? 1 : 0;
      if (aFree !== bFree) return aFree - bFree;
      return (a.dogName || '').localeCompare(b.dogName || '', 'he');
    }

    const ownerComp = (a.ownerName || '').localeCompare(b.ownerName || '', 'he');
    if (ownerComp !== 0) return ownerComp;

    return (a.dogName || '').localeCompare(b.dogName || '', 'he');
  });
}

async function test() {
  const { data: rows, error } = await supabase.from('bookings').select('*').neq('stay_status', 'cancelled');
  if (error) {
    console.error(error);
    return;
  }
  console.log('Sample rows:', rows.slice(0, 2).map(r => Object.keys(r)));
  const dayBookings = rows.map(r => ({
    id: r.id,
    dogName: r.dog_name,
    ownerName: r.owner_name,
    ownerPhone: r.owner_phone,
    startDate: r.start_date,
    endDate: r.end_date,
    serviceType: r.service_type,
    notes: r.notes,
    isFreeStay: r.is_free_stay
  })).filter(b => b.startDate <= dateStr && b.endDate >= dateStr);

  const sorted = sortBookingsForDate(dayBookings, dateStr);
  console.log('--- SORTED BOOKINGS FOR ' + dateStr + ' (' + sorted.length + ' dogs) ---');
  sorted.forEach((b, i) => {
    console.log((i+1) + '. ' + b.dogName + ' (' + b.ownerName + ') [Training: ' + isTrainingBooking(b) + ', isFreeStay: ' + b.isFreeStay + ']');
  });
}
test();
