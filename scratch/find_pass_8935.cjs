const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function findPass() {
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const sData = sRows?.[0]?.data || {};
  for (const k of Object.keys(sData)) {
    const str = JSON.stringify(sData[k]);
    if (str.includes('8935') || str.includes('1792001439077')) {
      console.log(`Found pass reference in key: ${k}`);
      if (Array.isArray(sData[k])) {
        sData[k].forEach(item => {
          if (JSON.stringify(item).includes('8935')) {
            console.log(JSON.stringify(item, null, 2));
          }
        });
      }
    }
  }
}

findPass().catch(console.error);
