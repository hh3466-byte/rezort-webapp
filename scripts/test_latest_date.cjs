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

    if (!isSaturday && !isFridayAfternoon) {
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

const whiskyNotes = `[24/09 16:50] 💬 שלחתי לו הודעה בוואטסאפ
[25/09 15:01] 📲 נשלחה תזכורת שיווקית (לא ענה בטלפון - תזמון חזרה: יום ראשון (27/09) בשעה 09:30 (הוסט עקב שבת/חג 🕯️))`;

const latestDate = getLatestActionDateFromNotes(whiskyNotes);
console.log('Latest date from notes:', latestDate);
const weekdayHours = calculateWeekdayBusinessHours(latestDate, new Date());
console.log('Weekday hours since last note:', weekdayHours);
console.log('Is < 24h:', weekdayHours < 24);
