const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: rows, error } = await sb
    .from('grow_incoming_payments')
    .select('*')
    .gte('created_at', '2026-10-01T00:00:00')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  let resortSum = 0;
  let teacherSum = 0;

  const resortList = [];
  const teacherList = [];

  for (const r of rows || []) {
    // Skip duplicate webhook pings
    if (r.id === 'grow_554341' || r.id === 'grow_555970') continue;

    const isTeacher = (r.customer_name || '').includes('זכויות המורה') || (r.raw_email_snippet || '').includes('זכויות המורה');

    if (isTeacher) {
      teacherSum += Number(r.amount);
      teacherList.push({ name: r.customer_name, amount: r.amount, date: r.created_at?.slice(0, 10), method: r.payment_method, ref: r.reference_id });
    } else {
      resortSum += Number(r.amount);
      resortList.push({ name: r.customer_name, amount: r.amount, date: r.created_at?.slice(0, 10), method: r.payment_method, ref: r.reference_id });
    }
  }

  console.log('=== הריזורט לכלב (' + resortList.length + ' עסקאות) ===');
  resortList.forEach((r, idx) => console.log(`${idx + 1}. [${r.date}] ${r.name} - ₪${r.amount} (${r.method}) [אסמכתא: ${r.ref}]`));
  console.log('סה"כ הריזורט לכלב: ₪' + resortSum.toLocaleString());

  console.log('\n=== זכויות המורה (' + teacherList.length + ' עסקאות) ===');
  teacherList.forEach((r, idx) => console.log(`${idx + 1}. [${r.date}] ${r.name} - ₪${r.amount} (${r.method}) [אסמכתא: ${r.ref}]`));
  console.log('סה"כ זכויות המורה: ₪' + teacherSum.toLocaleString());

  console.log('\n==========================================');
  console.log('⭐ סך הכל כולל להפקדה ב-10.11.2026: ₪' + (resortSum + teacherSum).toLocaleString());
  console.log('==========================================');
}

check();
