const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let env = {};
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim();
  });
} catch(e) {}

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

function isShabbatOrHolidayRestricted(date) {
  const day = date.getDay();
  const hour = date.getHours();
  if (day === 6) return { isRestricted: true };
  if (day === 5 && hour >= 14) return { isRestricted: true };
  return { isRestricted: false };
}

function calculateWeekdayBusinessHours(fromInput, toInput = new Date()) {
  const from = new Date(fromInput).getTime();
  const to = new Date(toInput).getTime();
  if (isNaN(from) || isNaN(to) || to <= from) return 0;

  const ONE_HOUR = 60 * 60 * 1000;
  let current = from;
  let weekdayHours = 0;

  while (current < to) {
    const nextStep = Math.min(current + ONE_HOUR, to);
    const fractionOfHour = (nextStep - current) / ONE_HOUR;
    const checkDate = new Date(current);
    
    const day = checkDate.getDay();
    const hour = checkDate.getHours();
    
    const isSaturday = day === 6;
    const isFridayAfternoon = day === 5 && hour >= 14;
    const holidayCheck = isShabbatOrHolidayRestricted(checkDate);

    if (!isSaturday && !isFridayAfternoon && !holidayCheck.isRestricted) {
      weekdayHours += fractionOfHour;
    }

    current = nextStep;
  }

  return weekdayHours;
}

function getLatestActionDateFromNotes(notes) {
  if (!notes) return null;
  const regex = /\[(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})\]/g;
  const matches = [...notes.matchAll(regex)];
  if (!matches || matches.length === 0) return null;
  const lastMatch = matches[matches.length - 1];
  const [, d, m, hh, mm] = lastMatch;
  const nowYear = new Date().getFullYear();
  const date = new Date(nowYear, parseInt(m, 10) - 1, parseInt(d, 10), parseInt(hh, 10), parseInt(mm, 10));
  return isNaN(date.getTime()) ? null : date;
}

function getIntakeRequestWeekdayAgeHours(r, now = new Date()) {
  const created = new Date(r.createdAt || r.startDate).getTime();
  if (isNaN(created)) return 0;
  return calculateWeekdayBusinessHours(created, now);
}

function isUnansweredIntakeRequest(r, bookings = []) {
  if (r.status === 'approved') return false;
  if (r.status === 'rejected' || r.status === 'abandoned') return false;

  const notes = r.internalNotes || '';
  const latestActionDate = getLatestActionDateFromNotes(notes);

  if (notes.includes('תזמון חזרה:') || notes.includes('תזכורת מעקב לחזרה:')) {
    if (latestActionDate) {
      const weekdayHoursSinceAction = calculateWeekdayBusinessHours(latestActionDate, new Date());
      if (weekdayHoursSinceAction < 24) {
        return false;
      }
    } else {
      const weekdayAge = getIntakeRequestWeekdayAgeHours(r);
      if (weekdayAge < 24) {
        return false;
      }
    }
  }

  if (notes.includes('לא ענה') || notes.includes('תזכורת שיווקית')) {
    if (latestActionDate) {
      const weekdayHoursSinceNote = calculateWeekdayBusinessHours(latestActionDate, new Date());
      return weekdayHoursSinceNote >= 24;
    }
    const weekdayAge = getIntakeRequestWeekdayAgeHours(r);
    return weekdayAge >= 24;
  }

  const isWeekdayAgeOver24h = getIntakeRequestWeekdayAgeHours(r) >= 24;
  return isWeekdayAgeOver24h;
}

function isIntakeRequestInTreatment(r, bookings = []) {
  if (r.status === 'abandoned' || r.status === 'rejected') return false;
  if (isUnansweredIntakeRequest(r, bookings)) return false;
  return r.status === 'payment_requested' || (r.status === 'pending' && Boolean(r.internalNotes && r.internalNotes.trim()));
}

function isIntakeRequestNew(r, bookings = []) {
  if (r.status === 'abandoned' || r.status === 'rejected') return false;
  if (isUnansweredIntakeRequest(r, bookings)) return false;
  return r.status === 'pending' && (!r.internalNotes || !r.internalNotes.trim());
}

async function verifyAll() {
  const { data } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  const intakes = data.data.intakeRequests || [];
  
  const inTreatment = intakes.filter(i => isIntakeRequestInTreatment(i));
  console.log(`=== IN TREATMENT REQUESTS (${inTreatment.length}) ===`);
  inTreatment.forEach(i => {
    console.log(`- ${i.dogName} (${i.ownerName}, ${i.ownerPhone}) | status: ${i.status}`);
  });

  const isNew = intakes.filter(i => isIntakeRequestNew(i));
  console.log(`=== NEW REQUESTS (${isNew.length}) ===`);
  isNew.forEach(i => {
    console.log(`- ${i.dogName} (${i.ownerName}, ${i.ownerPhone}) | status: ${i.status}`);
  });
}

verifyAll();
