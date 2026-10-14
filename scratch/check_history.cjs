const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkHistory() {
  const { data } = await supabase.from('settings').select('*');
  const config = data?.find(r => r.id === 'resort_config');
  console.log('--- AUTO REPLY HISTORY ---');
  console.log(JSON.stringify(config?.data?.autoReplyHistory || {}, null, 2));

  console.log('--- DAYCARE PASSES ---');
  console.log(JSON.stringify(config?.data?.daycare_passes || [], null, 2));

  console.log('--- INTAKE REQUESTS ---');
  console.log(JSON.stringify(config?.data?.intakeRequests || [], null, 2));
}
checkHistory();
