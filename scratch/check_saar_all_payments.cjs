const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkSaarPayments() {
  console.log('--- Checking grow_incoming_payments ---');
  const { data: gRows } = await supabase.from('grow_incoming_payments').select('*');
  const saarGrow = (gRows || []).filter(g => 
    (g.phone && g.phone.includes('5716886')) ||
    (g.customer_name && g.customer_name.includes('סער')) ||
    (g.card_holder && g.card_holder.includes('סער')) ||
    (g.notes && g.notes.includes('5716886'))
  );
  console.log('Grow payments for Saar:', saarGrow);

  console.log('\n--- Checking Settings Incoming / Grow ---');
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const sData = sRows?.[0]?.data || {};
  const passes = sData.daycare_passes || [];
  const p6310 = passes.find(p => p.passCode === '6310');
  const p6311 = passes.find(p => p.passCode === '6311');

  console.log('Pass 6310:', {
    code: p6310?.passCode,
    pricePaid: p6310?.pricePaid,
    paymentStatus: p6310?.paymentStatus,
    paidAt: p6310?.paidAt,
    paymentReference: p6310?.paymentReference
  });

  console.log('Pass 6311:', {
    code: p6311?.passCode,
    pricePaid: p6311?.pricePaid,
    paymentStatus: p6311?.paymentStatus,
    paidAt: p6311?.paidAt,
    paymentReference: p6311?.paymentReference,
    targetPaymentDate: p6311?.targetPaymentDate
  });
}

checkSaarPayments().catch(console.error);
