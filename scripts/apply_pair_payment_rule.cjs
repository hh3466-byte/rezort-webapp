const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

async function applyPairPaymentRule() {
  console.log('--- APPLYING PAIR PAYMENT RULE IN SUPABASE ---');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings?select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const data = await res.json();

  // Find Lola & Brandy
  const lola = data.find(b => b.dog_name === 'לולה' && b.owner_name.includes('ברקוביץ'));
  const brandy = data.find(b => b.dog_name === 'ברנדי' && b.owner_name.includes('ברקוביץ'));

  if (lola) {
    const lolaNotes = `זוג כלבים (לולה + ברנדי) | התשלום המלא עבור 2 הכלבות (₪2,700) נרשם על כרטיס זה | שולם במלואו ב-Grow ApplePay (אסמכתאות 4909041312 ו-4926270153) | משוכנת בחדר 7 יחד עם ברנדי`;
    const lolaPayload = {
      total_price: 2700,
      deposit_amount: 2700,
      payment_status: 'fully_paid',
      notes: lolaNotes,
      data: {
        ...(lola.data || {}),
        totalPrice: 2700,
        depositAmount: 2700,
        paymentStatus: 'fully_paid',
        isFreeStay: false,
        notes: lolaNotes,
        updatedAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${lola.id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(lolaPayload)
    });
    console.log('Updated Lola: ₪2,700 full payment');
  }

  if (brandy) {
    const brandyNotes = `זוג כלבים | שולם במלואו דרך כרטיס הכלב הראשון: לולה (₪2,700 עבור 2 הכלבות) | משוכנת בחדר 7 יחד עם לולה`;
    const brandyPayload = {
      total_price: 0,
      deposit_amount: 0,
      payment_status: 'fully_paid',
      is_free_stay: true,
      notes: brandyNotes,
      data: {
        ...(brandy.data || {}),
        totalPrice: 0,
        depositAmount: 0,
        paymentStatus: 'fully_paid',
        isFreeStay: true,
        notes: brandyNotes,
        updatedAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${brandy.id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(brandyPayload)
    });
    console.log('Updated Brandy: ₪0 (paid via Lola)');
  }

  // Find Scooby & Gingas
  const scooby = data.find(b => b.dog_name === 'סקובי' && b.owner_name.includes('שליו'));
  const gingas = data.find(b => b.dog_name === "ג'ינג'ס" && b.owner_name.includes('שליו'));

  if (scooby) {
    const scoobyNotes = `זוג כלבים (סקובי + ג'ינג'ס) | התשלום המלא עבור 2 הכלבים (₪1,960) נרשם על כרטיס זה | שולם במלואו ב-Grow (אסמכתא 519827839) | משוכן בסוויטה 3 יחד עם ג'ינג'ס`;
    const scoobyPayload = {
      total_price: 1960,
      deposit_amount: 1960,
      payment_status: 'fully_paid',
      notes: scoobyNotes,
      data: {
        ...(scooby.data || {}),
        totalPrice: 1960,
        depositAmount: 1960,
        paymentStatus: 'fully_paid',
        isFreeStay: false,
        notes: scoobyNotes,
        updatedAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${scooby.id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(scoobyPayload)
    });
    console.log('Updated Scooby: ₪1,960 full payment');
  }

  if (gingas) {
    const gingasNotes = `זוג כלבים | שולם במלואו דרך כרטיס הכלב הראשון: סקובי (₪1,960 עבור 2 הכלבים) | משוכן בסוויטה 3 יחד עם סקובי`;
    const gingasPayload = {
      total_price: 0,
      deposit_amount: 0,
      payment_status: 'fully_paid',
      is_free_stay: true,
      notes: gingasNotes,
      data: {
        ...(gingas.data || {}),
        totalPrice: 0,
        depositAmount: 0,
        paymentStatus: 'fully_paid',
        isFreeStay: true,
        notes: gingasNotes,
        updatedAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${gingas.id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(gingasPayload)
    });
    console.log('Updated Gingas: ₪0 (paid via Scooby)');
  }

  console.log('--- COMPLETED SUCCESSFULLY ---');
}

applyPairPaymentRule();
