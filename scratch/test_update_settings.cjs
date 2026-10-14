const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function testUpdate() {
  const { data: sRow, error: sErr } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  console.log('Select settings error:', sErr);
  console.log('Current intakeRequests count:', sRow?.data?.intakeRequests?.length);

  // Test updating
  const { data: uData, error: uErr } = await supabase.from('settings').update({
    updated_at: new Date().toISOString()
  }).eq('id', 'resort_config').select();
  console.log('Update settings error:', uErr);
  console.log('Update returned:', uData);
}
testUpdate();
