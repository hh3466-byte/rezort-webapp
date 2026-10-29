const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function run() {
  const { data } = await supabase.from('settings').select('*');
  const s = data?.[0] || {};
  const d = s.data || {};
  console.log('s.paybox_link:', s.paybox_link);
  console.log('d keys with link or pay:', Object.keys(d).filter(k => k.toLowerCase().includes('link') || k.toLowerCase().includes('pay') || k.toLowerCase().includes('grow')));
  Object.keys(d).filter(k => k.toLowerCase().includes('link') || k.toLowerCase().includes('pay') || k.toLowerCase().includes('grow')).forEach(k => {
    console.log(`d.${k}:`, d[k]);
  });
}
run();
