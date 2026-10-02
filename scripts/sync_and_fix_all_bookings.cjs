const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function syncAndFixAllBookings() {
  const { data: allBookings, error: bErr } = await supabase.from('bookings').select('*');
  if (bErr) {
    console.error('Error fetching bookings:', bErr);
    return;
  }

  const bookingsMap = new Map();
  (allBookings || []).forEach(b => {
    bookingsMap.set(b.id, b);
  });

  console.log(`Loaded ${bookingsMap.size} bookings from Supabase.`);

  // 1. Jingas (ג'ינגס) - Pair with Scooby in Suite 3
  const jingasBooking = {
    id: 'b-jingas-1790443885286',
    dog_name: "ג'ינגס",
    dog_breed: 'מעורב',
    dog_gender: 'male_neutered',
    owner_name: 'שליו ביטון',
    owner_phone: '054-9721752',
    owner_email: '',
    service_type: 'boarding',
    start_date: '2026-09-26',
    end_date: '2026-10-04',
    total_price: 0,
    deposit_amount: 0,
    payment_status: 'fully_paid',
    payment_method: 'bit',
    stay_status: 'checked_in',
    notes: "זוג כלבים (סקובי + ג'ינג'ס) | תשלום מוסדר ומלא ₪1,960 דרך כרטיס סקובי | משוכן בסוויטה 3 יחד עם סקובי",
    vaccination_valid: true,
    data: {
      id: 'b-jingas-1790443885286',
      dogName: "ג'ינגס",
      dogBreed: 'מעורב',
      dogGender: 'male_neutered',
      ownerName: 'שליו ביטון',
      ownerPhone: '054-9721752',
      serviceType: 'boarding',
      startDate: '2026-09-26',
      endDate: '2026-10-04',
      totalPrice: 0,
      depositAmount: 0,
      paymentStatus: 'fully_paid',
      paymentMethod: 'bit',
      stayStatus: 'checked_in',
      isFreeStay: true,
      linkedDogName: 'סקובי',
      kennelNumber: 'suite_3',
      notes: "זוג כלבים (סקובי + ג'ינג'ס) | תשלום מוסדר ומלא ₪1,960 דרך כרטיס סקובי | משוכן בסוויטה 3 יחד עם סקובי",
      vaccinationValid: true,
      createdAt: '2026-09-26T10:00:00.000Z',
      updatedAt: new Date().toISOString()
    },
    updated_at: new Date().toISOString()
  };
  bookingsMap.set(jingasBooking.id, jingasBooking);

  // 2. Scooby (סקובי) in Suite 3
  const scoobyRow = bookingsMap.get('b-1790443885286');
  if (scoobyRow) {
    const d = scoobyRow.data || {};
    d.kennelNumber = 'suite_3';
    d.linkedDogName = "ג'ינגס";
    scoobyRow.data = d;
    bookingsMap.set('b-1790443885286', scoobyRow);
  }

  // 3. Lola & Brandi in Room 7
  const lolaRow = bookingsMap.get('b-1790091249800');
  if (lolaRow) {
    const d = lolaRow.data || {};
    d.kennelNumber = 'room_7';
    d.linkedDogName = 'ברנדי';
    lolaRow.data = d;
    bookingsMap.set('b-1790091249800', lolaRow);
  }
  const brandyRow = bookingsMap.get('b-brandy-1790835651215');
  if (brandyRow) {
    const d = brandyRow.data || {};
    d.kennelNumber = 'room_7';
    d.linkedDogName = 'לולה';
    d.isFreeStay = true;
    d.totalPrice = 0;
    d.depositAmount = 0;
    d.paymentStatus = 'fully_paid';
    brandyRow.total_price = 0;
    brandyRow.deposit_amount = 0;
    brandyRow.payment_status = 'fully_paid';
    brandyRow.data = d;
    bookingsMap.set('b-brandy-1790835651215', brandyRow);
  }

  // 4. Luna Malamud in Suite 1
  const lunaMalamudRow = bookingsMap.get('b-1789541492653');
  if (lunaMalamudRow) {
    const d = lunaMalamudRow.data || {};
    d.kennelNumber = 'suite_1';
    d.stayStatus = 'checked_in';
    lunaMalamudRow.data = d;
    bookingsMap.set('b-1789541492653', lunaMalamudRow);
  }

  // 5. Raven in Suite 2
  const ravenRow = bookingsMap.get('b-1790517583342');
  if (ravenRow) {
    const d = ravenRow.data || {};
    d.kennelNumber = 'suite_2';
    d.stayStatus = 'checked_in';
    ravenRow.data = d;
    bookingsMap.set('b-1790517583342', ravenRow);
  }

  // 6. Mike in Suite 4
  const mikeRow = bookingsMap.get('b-1790047289926');
  if (mikeRow) {
    const d = mikeRow.data || {};
    d.kennelNumber = 'suite_4';
    d.stayStatus = 'checked_in';
    d.paymentStatus = 'fully_paid';
    d.totalPrice = 2220;
    d.depositAmount = 2220;
    d.notes = (d.notes || '') + ' | מחיר סופי ₪2,220 אושר ע״י שמוליק והמנהל ושולם במלואו';
    mikeRow.total_price = 2220;
    mikeRow.deposit_amount = 2220;
    mikeRow.payment_status = 'fully_paid';
    mikeRow.data = d;
    bookingsMap.set('b-1790047289926', mikeRow);
  }

  // 7. Kira in Room 2 (extended to Sunday 04.10.2026)
  const kiraRow = bookingsMap.get('b-grow-512844224');
  if (kiraRow) {
    const d = kiraRow.data || {};
    d.kennelNumber = 'room_2';
    d.stayStatus = 'checked_in';
    d.endDate = '2026-10-04';
    d.totalPrice = 2160;
    d.depositAmount = 2160;
    d.paymentStatus = 'fully_paid';
    d.notes = 'תשלום מקורי ₪1,560 (Grow) + הארכת שהייה ₪600 שולמו במלואם (איסוף ביום ראשון 04.10)';
    kiraRow.end_date = '2026-10-04';
    kiraRow.total_price = 2160;
    kiraRow.deposit_amount = 2160;
    kiraRow.payment_status = 'fully_paid';
    kiraRow.data = d;
    bookingsMap.set('b-grow-512844224', kiraRow);
  }

  // 8. Theo in Room 3
  const theoRow = bookingsMap.get('b-1788685190273');
  if (theoRow) {
    const d = theoRow.data || {};
    d.kennelNumber = 'room_3';
    d.stayStatus = 'checked_in';
    theoRow.data = d;
    bookingsMap.set('b-1788685190273', theoRow);
  }

  // 9. Joy in Room 4
  const joyRow = bookingsMap.get('b-1789657778767');
  if (joyRow) {
    const d = joyRow.data || {};
    d.kennelNumber = 'room_4';
    d.stayStatus = 'checked_in';
    joyRow.data = d;
    bookingsMap.set('b-1789657778767', joyRow);
  }

  // 10. Luna the Longing (של שלומי ממן) in Home (הלנה ביתית)
  const lunaHomeRow = bookingsMap.get('b-1789361510508');
  if (lunaHomeRow) {
    const d = lunaHomeRow.data || {};
    d.kennelNumber = 'home';
    d.stayStatus = 'checked_in';
    d.isFreeStay = true;
    lunaHomeRow.data = d;
    bookingsMap.set('b-1789361510508', lunaHomeRow);
  }

  // 11. Boss (בוס - איתי אהרונסון)
  const bossRow = bookingsMap.get('b-1789732108163');
  if (bossRow) {
    const d = bossRow.data || {};
    d.startDate = '2026-10-02';
    d.endDate = '2026-11-16';
    d.totalPrice = 6500;
    d.depositAmount = 2200;
    d.paymentStatus = 'deposit_paid';
    d.stayStatus = 'booked';
    d.notes = 'אילוף פנסיון - עלות כוללת ₪6,500 | שולם ₪200 מקדמה ע״י אריאל שרייבר + ₪2,000 ע״י איתי אהרונסון ב-Grow | יתרה לתשלום בקליטה: ₪4,300';
    bossRow.start_date = '2026-10-02';
    bossRow.end_date = '2026-11-16';
    bossRow.total_price = 6500;
    bossRow.deposit_amount = 2200;
    bossRow.payment_status = 'deposit_paid';
    bossRow.stay_status = 'booked';
    bossRow.data = d;
    bookingsMap.set('b-1789732108163', bossRow);
  }

  // 12. Boni (בוני - יובל אדגה)
  const boniRow = bookingsMap.get('b-1790241483197');
  if (boniRow) {
    const d = boniRow.data || {};
    d.startDate = '2026-10-02';
    d.endDate = '2026-10-05';
    d.totalPrice = 540;
    d.depositAmount = 540;
    d.paymentStatus = 'fully_paid';
    d.paymentMethod = 'cash';
    d.stayStatus = 'booked';
    d.notes = 'שולם ₪540 במזומן במלואו לשמוליק | שוריין מקום וישובץ בחדר בהגעתו';
    boniRow.start_date = '2026-10-02';
    boniRow.end_date = '2026-10-05';
    boniRow.total_price = 540;
    boniRow.deposit_amount = 540;
    boniRow.payment_status = 'fully_paid';
    boniRow.payment_method = 'cash';
    boniRow.stay_status = 'booked';
    boniRow.data = d;
    bookingsMap.set('b-1790241483197', boniRow);
  }

  // 13. Tony (טוני - הלל שמש)
  const tonyRow = bookingsMap.get('b-1790323950927');
  if (tonyRow) {
    const d = tonyRow.data || {};
    d.totalPrice = 200;
    d.depositAmount = 200;
    d.paymentStatus = 'fully_paid';
    d.stayStatus = 'checked_out';
    d.notes = 'שולם ₪200 במלואו כפי שסוכם ואושר ע״י שמוליק';
    tonyRow.total_price = 200;
    tonyRow.deposit_amount = 200;
    tonyRow.payment_status = 'fully_paid';
    tonyRow.stay_status = 'checked_out';
    tonyRow.data = d;
    bookingsMap.set('b-1790323950927', tonyRow);
  }

  // 14. Jessi (ג'סי הרוטוויילרית - ריקה נברי)
  const jessiRow = bookingsMap.get('b-1788697331109');
  if (jessiRow) {
    const d = jessiRow.data || {};
    d.kennelNumber = 'room_1';
    d.endDate = '2026-10-02';
    d.stayStatus = 'checked_out';
    jessiRow.end_date = '2026-10-02';
    jessiRow.stay_status = 'checked_out';
    jessiRow.data = d;
    bookingsMap.set('b-1788697331109', jessiRow);
  }

  // Upsert all modified bookings to Supabase
  const recordsToUpsert = Array.from(bookingsMap.values());
  console.log(`Upserting ${recordsToUpsert.length} records to Supabase bookings table...`);

  const { error: upsertErr } = await supabase.from('bookings').upsert(recordsToUpsert, { onConflict: 'id' });
  if (upsertErr) {
    console.error('Error upserting bookings:', upsertErr);
  } else {
    console.log('Successfully synchronized and updated all bookings in Supabase!');
  }
}

syncAndFixAllBookings().catch(console.error);
