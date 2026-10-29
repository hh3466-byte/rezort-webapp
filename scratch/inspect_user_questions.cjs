const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function inspect() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  
  console.log('--- FINDING 540 IN BOOKINGS ---');
  bookings.forEach(b => {
    const s = JSON.stringify(b);
    if (s.includes('540')) {
      console.log('Found 540:', b.id, b.owner_name || b.ownerName, b.dog_name || b.dogName, 'dates:', (b.start_date || b.startDate), '->', (b.end_date || b.endDate), 'total:', b.total_price || b.totalPrice, 'deposit:', b.deposit_amount || b.depositAmount, 'method:', b.payment_method || b.paymentMethod, 'status:', b.payment_status || b.paymentStatus, 'notes:', b.notes);
    }
  });

  console.log('\n--- FINDING ALL CASH BOOKINGS IN OCT 2026 ---');
  bookings.forEach(b => {
    const d = b.data || {};
    const ownerName = (b.owner_name || b.ownerName || d.ownerName || '').toLowerCase();
    const dogName = (b.dog_name || b.dogName || d.dogName || '');
    const start = b.start_date || b.startDate || d.startDate || '';
    const end = b.end_date || b.endDate || d.endDate || '';
    const payMethod = (b.payment_method || b.paymentMethod || d.paymentMethod || '').toLowerCase();
    const notes = ((b.notes || d.notes || '') + ' ' + (d.internalNotes || '')).toLowerCase();
    const status = b.payment_status || b.paymentStatus || d.paymentStatus;
    const total = b.total_price || b.totalPrice || d.totalPrice || 0;
    const dep = b.deposit_amount || b.depositAmount || d.depositAmount || 0;

    const isInOct = start.startsWith('2026-10') || end.startsWith('2026-10');
    if (isInOct && (payMethod === 'cash' || notes.includes('מזומן') || notes.includes('שטרות') || notes.includes('קופה') || ownerName.includes('שיין') || ownerName.includes('מהדי') || ownerName.includes('שיגינה') || ownerName.includes('מרינה'))) {
      console.log('Cash booking in Oct:', b.id, ownerName, dogName, `${start} -> ${end}`, `total: ${total}, dep: ${dep}`, `method: ${payMethod}`, `status: ${status}`, `notes: ${notes}`);
    }
  });

  console.log('\n--- FINDING ALL LUNA BOOKINGS AND INTAKES ---');
  bookings.forEach(b => {
    const dog = (b.dog_name || b.dogName || (b.data && b.data.dogName) || '');
    const owner = (b.owner_name || b.ownerName || (b.data && b.data.ownerName) || '');
    if (dog.includes('לונה') || dog.toLowerCase().includes('luna') || owner.includes('לונה')) {
      console.log('Luna booking:', b.id, owner, dog, `${b.start_date || b.startDate} -> ${b.end_date || b.endDate}`, `total: ${b.total_price || b.totalPrice}`, `dep: ${b.deposit_amount || b.depositAmount}`, `status: ${b.payment_status || b.paymentStatus}`, `method: ${b.payment_method || b.paymentMethod}`, `notes: ${b.notes || (b.data && b.data.notes)}`);
    }
  });

  const { data: training } = await supabase.from('training_agreements').select('*');
  console.log('\n--- TRAINING AGREEMENTS FOR LUNA ---');
  training?.forEach(t => {
    const s = JSON.stringify(t);
    if (s.includes('לונה') || s.toLowerCase().includes('luna')) {
      console.log('Training agreement Luna:', t.id, t.owner_name || t.client_name, t.dog_name, t.price, t.deposit, t.created_at, t.notes);
    }
  });

  console.log('\n--- FINDING LADY / TAMAR / 360 / KOBI CHALA ---');
  bookings.forEach(b => {
    const s = JSON.stringify(b);
    if (s.includes('0523679637') || s.includes('תמר') || s.includes('ליידי') || s.includes('חלה') || s.includes('קובי')) {
      console.log('Match Lady/Tamar/Kobi:', b.id, b.owner_name || b.ownerName, b.owner_phone || b.ownerPhone, b.dog_name || b.dogName, `${b.start_date || b.startDate} -> ${b.end_date || b.endDate}`, `total: ${b.total_price || b.totalPrice}`, `dep: ${b.deposit_amount || b.depositAmount}`, `status: ${b.payment_status || b.paymentStatus}`, `notes: ${b.notes}`);
    }
  });
}

inspect();
