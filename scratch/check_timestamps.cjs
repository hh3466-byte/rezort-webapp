const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkDetails() {
  const { data: sRows } = await supabase.from('settings').select('*');
  const d = sRows?.[0]?.data || {};
  console.log('--- TIMESTAMPS ---');
  console.log('last1830SanitySentDate:', d.last1830SanitySentDate);
  console.log('last1830SanitySentTimestamp:', d.last1830SanitySentTimestamp);
  console.log('lastTomorrowOverviewSentDate:', d.lastTomorrowOverviewSentDate);
  console.log('lastTomorrowOverviewSentTimestamp:', d.lastTomorrowOverviewSentTimestamp);
  console.log('last2000DailyUpdateSentDate:', d.last2000DailyUpdateSentDate);
  console.log('last2000DailyUpdateSentTimestamp:', d.last2000DailyUpdateSentTimestamp);
  console.log('systemHealthErrors:', JSON.stringify(d.systemHealthErrors || [], null, 2));
}

checkDetails();
