const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkAllGrow() {
  const { data: grow, error } = await supabase.from('grow_incoming_payments').select('*');
  console.log('Total grow rows in table:', grow?.length);
  grow?.forEach(p => {
    const raw = JSON.stringify(p);
    if (raw.includes('מורה') || raw.includes('זכויות') || raw.includes('אתי') || raw.includes('teacher')) {
      console.log('Found teacher rights in grow table:', p);
    }
  });

  // Check if there is another table for teacher rights or other payments
  const { data: tp, error: tpErr } = await supabase.from('teacher_rights_payments').select('*');
  console.log('teacher_rights_payments table count:', tp?.length, 'error:', tpErr?.message || 'none');
}
checkAllGrow();
