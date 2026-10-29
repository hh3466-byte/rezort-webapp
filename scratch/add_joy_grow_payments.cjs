const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function addJoyGrowPayments() {
  const payments = [
    {
      id: 'grow_joy_507806497',
      reference_id: '507806497',
      customer_name: 'ירוס ביקאיה (ג\'וי)',
      customer_phone: '0556646093',
      customer_email: 'yerusbikaya54@gmail.com',
      amount: 3000,
      payment_method: 'Bit',
      raw_email_snippet: 'תשלום Grow עבור אילוף ג\'וי (אסמכתא 507806497)',
      status: 'completed',
      created_at: '2026-08-11T10:00:00+00:00'
    },
    {
      id: 'grow_joy_507807309',
      reference_id: '507807309',
      customer_name: 'ירוס ביקאיה (ג\'וי)',
      customer_phone: '0556646093',
      customer_email: 'yerusbikaya54@gmail.com',
      amount: 1000,
      payment_method: 'Bit',
      raw_email_snippet: 'תשלום Grow עבור אילוף ג\'וי (אסמכתא 507807309)',
      status: 'completed',
      created_at: '2026-08-11T10:05:00+00:00'
    },
    {
      id: 'grow_joy_507810263',
      reference_id: '507810263',
      customer_name: 'ירוס ביקאיה (ג\'וי)',
      customer_phone: '0556646093',
      customer_email: 'yerusbikaya54@gmail.com',
      amount: 1500,
      payment_method: 'Bit',
      raw_email_snippet: 'תשלום Grow עבור אילוף ג\'וי (אסמכתא 507810263)',
      status: 'completed',
      created_at: '2026-08-11T10:10:00+00:00'
    },
    {
      id: 'grow_joy_4792995703',
      reference_id: '4792995703',
      customer_name: 'ירוס ביקאיה (ג\'וי)',
      customer_phone: '0556646093',
      customer_email: 'yerusbikaya54@gmail.com',
      amount: 1000,
      payment_method: 'Bit',
      raw_email_snippet: 'תשלום Grow עבור אילוף ג\'וי (אסמכתא 4792995703)',
      status: 'completed',
      created_at: '2026-08-11T10:15:00+00:00'
    }
  ];

  for (const p of payments) {
    const { error } = await supabase.from('grow_incoming_payments').upsert(p);
    if (error) console.error('Error inserting payment:', p.id, error);
    else console.log('✓ Added Grow payment:', p.id, '₪' + p.amount);
  }
}

addJoyGrowPayments();
