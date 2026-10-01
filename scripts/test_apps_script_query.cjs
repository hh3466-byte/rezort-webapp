const https = require('https');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const queryUrl = `${SUPABASE_URL}/rest/v1/bookings?stay_status=neq.cancelled&select=*`;

https.get(queryUrl, {
  headers: {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const allBookings = JSON.parse(data);
      console.log(`Returned bookings: ${allBookings.length}`);
      
      const tomorrowStr = '2026-10-01';
      const incomingDogs = [];
      const departingDogs = [];
      const endOfDayDogs = [];
      const daytimeDogs = [];

      for (let bIdx = 0; bIdx < allBookings.length; bIdx++) {
        const bk = allBookings[bIdx];
        const sDate = bk.start_date;
        const eDate = bk.end_date;

        if (sDate === tomorrowStr) incomingDogs.push(bk);
        if (eDate === tomorrowStr) departingDogs.push(bk);
        if (sDate <= tomorrowStr && eDate > tomorrowStr) endOfDayDogs.push(bk);
        if (sDate <= tomorrowStr && eDate >= tomorrowStr) daytimeDogs.push(bk);
      }

      console.log(`For tomorrowStr = ${tomorrowStr}:`);
      console.log(`incomingDogs: ${incomingDogs.length}`);
      console.log(`departingDogs: ${departingDogs.length}`);
      console.log(`endOfDayDogs: ${endOfDayDogs.length}`);
      console.log(`daytimeDogs: ${daytimeDogs.length}`);

      console.log('\nAll bookings start_date and end_date:');
      allBookings.forEach(b => {
        console.log(`- ${b.dog_name} (${b.owner_name}): ${b.start_date} -> ${b.end_date} [status: ${b.stay_status}]`);
      });

    } catch (e) {
      console.error(e);
    }
  });
}).on('error', console.error);
