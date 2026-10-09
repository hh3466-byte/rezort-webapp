const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testAudits() {
  const { data: dbRows } = await supabase.from('bookings').select('*');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

  console.log('Total bookings in DB:', dbRows.length);

  // 1. As mapped in dbService.ts (camelCase):
  const mappedBookings = dbRows.map(row => {
    const rowData = (row.data && typeof row.data === 'object') ? row.data : {};
    return {
      ...rowData,
      id: row.id || rowData.id,
      dogName: row.dog_name || rowData.dogName || '',
      dogBreed: row.dog_breed || rowData.dogBreed || '',
      dogGender: row.dog_gender || rowData.dogGender || undefined,
      ownerName: row.owner_name || rowData.ownerName || '',
      ownerPhone: row.owner_phone || rowData.ownerPhone || '',
      ownerEmail: row.owner_email || rowData.ownerEmail || '',
      serviceType: row.service_type || rowData.serviceType || 'boarding',
      startDate: row.start_date || rowData.startDate || '',
      endDate: row.end_date || rowData.endDate || '',
      totalPrice: Number(row.total_price ?? rowData.totalPrice ?? 0),
      depositAmount: Number(row.deposit_amount ?? rowData.depositAmount ?? 0),
      paymentStatus: row.payment_status || rowData.paymentStatus || 'unpaid',
      isFreeStay: Boolean(row.is_free_stay ?? rowData.isFreeStay ?? false),
      stayStatus: row.stay_status || rowData.stayStatus || 'confirmed',
      notes: row.notes || rowData.notes || '',
      updatedAt: row.updated_at || rowData.updatedAt
    };
  });

  // Let's test with cron-sanity-check.js
  const cronSanity = await import('../api/cron-sanity-check.js');
  const todayStr = '2026-10-08';
  
  console.log('\n--- Running cron-sanity-check with raw dbRows ---');
  const resRaw = cronSanity.run1830SanityAudit(dbRows, settings, intakes || [], [], todayStr, growPayments || []);
  console.log('Report raw:\n', resRaw.reportText);

  console.log('\n--- Running cron-sanity-check with mappedBookings ---');
  const resMapped = cronSanity.run1830SanityAudit(mappedBookings, settings, intakes || [], [], todayStr, growPayments || []);
  console.log('Report mapped:\n', resMapped.reportText);

  // Let's check send_1830_sanity_report.cjs
}

testAudits();
