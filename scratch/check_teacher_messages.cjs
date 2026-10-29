const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: msgs, error } = await sb
    .from('messages')
    .select('*')
    .or('content.ilike.%זכויות המורה%,content.ilike.%התקבל תשלום%')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Found messages:', msgs?.length);
  msgs?.forEach(m => {
    console.log(`[${m.created_at}] To: ${m.chat_id} | ${m.content}`);
  });
}
check();
