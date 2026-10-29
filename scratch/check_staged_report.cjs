const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkStaged() {
  const { data: sRows } = await supabase.from('settings').select('*');
  const d = sRows?.[0]?.data || {};
  console.log('stagedTomorrowReport:');
  console.log('date:', d.stagedTomorrowReport?.date);
  console.log('timestamp:', d.stagedTomorrowReport?.timestamp);
  console.log('preflightVerified:', d.stagedTomorrowReport?.preflightVerified);
  console.log('shmulikMsg length:', d.stagedTomorrowReport?.shmulikMsg?.length);
  console.log('hagaiMsg length:', d.stagedTomorrowReport?.hagaiMsg?.length);
  console.log('last1900ReviewsSentCount:', d.last1900ReviewsSentCount);
  console.log('last2000Summary:', d.last2000Summary);
}

checkStaged();
