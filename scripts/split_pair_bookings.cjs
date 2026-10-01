const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

async function splitPairs() {
  console.log('--- STARTING PAIR BOOKINGS SPLIT ---');

  // ==========================================
  // 1. SPLIT: לולה וברנדי (אייל ברקוביץ׳)
  // ==========================================
  console.log('Splitting "לולה וברנדי"...');

  // 1A. Update existing booking to be "לולה"
  const lolaData = {
    dog_name: "לולה",
    total_price: 1350,
    deposit_amount: 1350,
    payment_status: "fully_paid",
    notes: "אורחת 1 מתוך 2 (לולה) | שולם במלואו ₪1,350 (חלק מ-₪2,700 שולם ב-Grow ApplePay אסמכתאות 4909041312 ו-4926270153) | משוכנת בחדר 7 יחד עם ברנדי",
    data: {
      id: "b-1790091249800",
      dogName: "לולה",
      dogBreed: "בלגי מעורב",
      ownerName: "אייל ברקוביץ׳",
      ownerPhone: "0556694789",
      ownerEmail: "eyal@bercovitz.net",
      startDate: "2026-09-28",
      endDate: "2026-10-08",
      serviceType: "boarding",
      totalPrice: 1350,
      depositAmount: 1350,
      paymentStatus: "fully_paid",
      paymentMethod: "credit",
      stayStatus: "checked_in",
      kennelNumber: "room_7",
      vaccinationValid: true,
      dogGender: "female",
      notes: "אורחת 1 מתוך 2 (לולה) | שולם במלואו ₪1,350 (חלק מ-₪2,700 שולם ב-Grow ApplePay אסמכתאות 4909041312 ו-4926270153) | משוכנת בחדר 7 יחד עם ברנדי",
      createdAt: "2026-09-22T15:34:09.8+00:00",
      updatedAt: new Date().toISOString()
    },
    updated_at: new Date().toISOString()
  };

  const resLola = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.b-1790091249800`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(lolaData)
  });
  console.log('Lola update status:', resLola.status);

  // 1B. Insert new booking for "ברנדי"
  const brandyId = `b-brandy-${Date.now()}`;
  const brandyData = {
    id: brandyId,
    dog_name: "ברנדי",
    dog_breed: "בלגי מעורב",
    owner_name: "אייל ברקוביץ׳",
    owner_phone: "0556694789",
    owner_email: "eyal@bercovitz.net",
    service_type: "boarding",
    start_date: "2026-09-28",
    end_date: "2026-10-08",
    total_price: 1350,
    deposit_amount: 1350,
    payment_status: "fully_paid",
    payment_method: "credit",
    stay_status: "checked_in",
    vaccination_valid: true,
    dog_gender: "female",
    notes: "אורחת 2 מתוך 2 (ברנדי) | שולם במלואו ₪1,350 (חלק מ-₪2,700 שולם ב-Grow ApplePay אסמכתאות 4909041312 ו-4926270153) | משוכנת בחדר 7 יחד עם לולה",
    data: {
      id: brandyId,
      dogName: "ברנדי",
      dogBreed: "בלגי מעורב",
      ownerName: "אייל ברקוביץ׳",
      ownerPhone: "0556694789",
      ownerEmail: "eyal@bercovitz.net",
      startDate: "2026-09-28",
      endDate: "2026-10-08",
      serviceType: "boarding",
      totalPrice: 1350,
      depositAmount: 1350,
      paymentStatus: "fully_paid",
      paymentMethod: "credit",
      stayStatus: "checked_in",
      kennelNumber: "room_7",
      vaccinationValid: true,
      dogGender: "female",
      notes: "אורחת 2 מתוך 2 (ברנדי) | שולם במלואו ₪1,350 (חלק מ-₪2,700 שולם ב-Grow ApplePay אסמכתאות 4909041312 ו-4926270153) | משוכנת בחדר 7 יחד עם לולה",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const resBrandy = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(brandyData)
  });
  console.log('Brandy insert status:', resBrandy.status);


  // ==========================================
  // 2. SPLIT: סקובי וג'ינג'ס (שליו ביטון)
  // ==========================================
  console.log('\nSplitting "סקובי וג\'ינג\'ס"...');

  // 2A. Update existing booking to be "סקובי"
  const scoobyData = {
    dog_name: "סקובי",
    total_price: 980,
    deposit_amount: 980,
    payment_status: "fully_paid",
    notes: "אורח 1 מתוך 2 (סקובי) | שולם במלואו ₪980 (חלק מ-₪1,960 שולם ב-Grow אסמכתא 519827839) | משוכן בסוויטה 3 יחד עם ג'ינג'ס",
    data: {
      id: "b-1790443885286",
      dogName: "סקובי",
      dogBreed: "כנעני מעורב",
      ownerName: "שליו ביטון",
      ownerPhone: "050-2845556",
      ownerEmail: "shalevbit123@gmail.com",
      startDate: "2026-09-26",
      endDate: "2026-10-04",
      serviceType: "boarding",
      totalPrice: 980,
      depositAmount: 980,
      paymentStatus: "fully_paid",
      paymentMethod: "credit",
      stayStatus: "checked_in",
      kennelNumber: "suite_3",
      vaccinationValid: true,
      dogGender: "male_neutered",
      notes: "אורח 1 מתוך 2 (סקובי) | שולם במלואו ₪980 (חלק מ-₪1,960 שולם ב-Grow אסמכתא 519827839) | משוכן בסוויטה 3 יחד עם ג'ינג'ס",
      createdAt: "2026-09-26T17:31:26.339221+00:00",
      updatedAt: new Date().toISOString()
    },
    updated_at: new Date().toISOString()
  };

  const resScooby = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.b-1790443885286`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(scoobyData)
  });
  console.log('Scooby update status:', resScooby.status);

  // 2B. Insert new booking for "ג'ינג'ס"
  const gingasId = `b-gingas-${Date.now()}`;
  const gingasData = {
    id: gingasId,
    dog_name: "ג'ינג'ס",
    dog_breed: "כנעני מעורב",
    owner_name: "שליו ביטון",
    owner_phone: "050-2845556",
    owner_email: "shalevbit123@gmail.com",
    service_type: "boarding",
    start_date: "2026-09-26",
    end_date: "2026-10-04",
    total_price: 980,
    deposit_amount: 980,
    payment_status: "fully_paid",
    payment_method: "credit",
    stay_status: "checked_in",
    vaccination_valid: true,
    dog_gender: "male_neutered",
    notes: "אורח 2 מתוך 2 (ג'ינג'ס) | שולם במלואו ₪980 (חלק מ-₪1,960 שולם ב-Grow אסמכתא 519827839) | משוכן בסוויטה 3 יחד עם סקובי",
    data: {
      id: gingasId,
      dogName: "ג'ינג'ס",
      dogBreed: "כנעני מעורב",
      ownerName: "שליו ביטון",
      ownerPhone: "050-2845556",
      ownerEmail: "shalevbit123@gmail.com",
      startDate: "2026-09-26",
      endDate: "2026-10-04",
      serviceType: "boarding",
      totalPrice: 980,
      depositAmount: 980,
      paymentStatus: "fully_paid",
      paymentMethod: "credit",
      stayStatus: "checked_in",
      kennelNumber: "suite_3",
      vaccinationValid: true,
      dogGender: "male_neutered",
      notes: "אורח 2 מתוך 2 (ג'ינג'ס) | שולם במלואו ₪980 (חלק מ-₪1,960 שולם ב-Grow אסמכתא 519827839) | משוכן בסוויטה 3 יחד עם סקובי",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const resGingas = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(gingasData)
  });
  console.log('Gingas insert status:', resGingas.status);

  console.log('\n--- SPLIT COMPLETED SUCCESSFULLY ---');
}

splitPairs();
