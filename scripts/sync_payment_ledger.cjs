const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(supabaseUrl, supabaseKey);

// All 35 transactions from the user's payment table
const ledgerData = [
  // September 2026 (7 items, total: 8,415)
  { ref: '4857277218', paid: 180, phone: '0522458841', email: 'benyosefgal@gmail.com', name: 'גל שרה שמש בן יוסף', date: '2026-09-02', month: 'ספטמבר', dog: 'אוניל' },
  { ref: '173783725', paid: 180, phone: '0526444845', email: 'nettabondi@gmail.com', name: 'נטע הדס', date: '2026-09-06', month: 'ספטמבר', dog: 'הדס' },
  { ref: '173758692', paid: 180, phone: '0527777737', email: 'navri@netvision.net.il', name: 'ריקה נברי', date: '2026-09-06', month: 'ספטמבר', dog: "ג'סי הרוטוויילרית" },
  { ref: '514721903', paid: 6300, phone: '0505564073', email: 'eyal.shekel@outlook.com', name: 'איל שקל', date: '2026-09-06', month: 'ספטמבר', dog: 'תיאו' },
  { ref: '515223561', paid: 360, phone: '0505856800', email: 'bennygreen007@gmail.com', name: 'בני גרין', date: '2026-09-07', month: 'ספטמבר', dog: 'ספסוף' },
  { ref: '174291549', paid: 540, phone: '0508273209', email: 'nisan.abramov27@gmail.com', name: 'Tali Nisan Avramov', date: '2026-09-10', month: 'ספטמבר', dog: 'פאבלו' },
  { ref: '516299998', paid: 675, phone: '0529270115', email: 'lucas.dorin@gmail.com', name: 'דורין לוקס', date: '2026-09-11', month: 'ספטמבר', dog: 'מגן' },

  // August 2026 (28 items, total: 25,370)
  { ref: '171099384', paid: 2200, phone: '0549420995', email: 'areiffman@gmail.com', name: 'אשר ריפמן', date: '2026-08-09', month: 'אוגוסט', dog: 'ריפמן' },
  { ref: '507419993', paid: 180, phone: '0545949480', email: 'gafni_nava@hotmail.com', name: 'נאוה גפני', date: '2026-08-10', month: 'אוגוסט', dog: 'גפני' },
  { ref: '4788806274', paid: 900, phone: '0527204572', email: 'dinadarom@gmail.com', name: 'דינה דיין', date: '2026-08-10', month: 'אוגוסט', dog: 'דיין' },
  { ref: '507400049', paid: 200, phone: '0545670355', email: 'shekel.hadas@gmail.com', name: 'תיאן שקל', date: '2026-08-10', month: 'אוגוסט', dog: 'שקל' },
  { ref: '171140534', paid: 180, phone: '0523669361', email: 'daliamoskov@gmail.com', name: 'דליה מוסקוביץ', date: '2026-08-10', month: 'אוגוסט', dog: 'מוסקוביץ' },
  { ref: '507810263', paid: 1500, phone: '0556646093', email: 'yerusbikaya54@gmail.com', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי" },
  { ref: '507807309', paid: 1000, phone: '0556646093', email: 'yerusbikaya54@gmail.com', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי" },
  { ref: '4792995703', paid: 1000, phone: '0556646093', email: 'yerusbikaya54@gmail.com', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי" },
  { ref: '507806497', paid: 3000, phone: '0556646093', email: 'yerusbikaya54@gmail.com', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי" },
  { ref: '508467767', paid: 180, phone: '0542211442', email: 'dalkaher@gmail.com', name: 'דוד אלקחר', date: '2026-08-13', month: 'אוגוסט', dog: 'אלקחר' },
  { ref: '508442380', paid: 540, phone: '0503166129', email: 'amir.lior@gmail.com', name: 'Lior Amir', date: '2026-08-13', month: 'אוגוסט', dog: 'אמיר' },
  { ref: '508390101', paid: 180, phone: '0524577752', email: 'ziviisme@gmail.com', name: 'זיו זיסו', date: '2026-08-13', month: 'אוגוסט', dog: 'זיסו' },
  { ref: '508388527', paid: 180, phone: '0524577752', email: 'ziviisme@gmail.com', name: 'זיו זיסו', date: '2026-08-13', month: 'אוגוסט', dog: 'זיסו' },
  { ref: '508629487', paid: 180, phone: '0507585533', email: 'mmalisinai30@gmail.com', name: 'מלי סיני', date: '2026-08-14', month: 'אוגוסט', dog: 'סיני' },
  { ref: '4810894878', paid: 1950, phone: '0546260997', email: 'idoshavit6@gmail.com', name: 'עידו שביט', date: '2026-08-17', month: 'אוגוסט', dog: 'שביט' },
  { ref: '171893936', paid: 1170, phone: '0523669361', email: 'daliamoskov@gmail.com', name: 'דליה מוסקוביץ', date: '2026-08-17', month: 'אוגוסט', dog: 'מוסקוביץ' },
  { ref: '509363691', paid: 2550, phone: '0527777787', email: 'navri38@gmail.com', name: 'אור נברי', date: '2026-08-17', month: 'אוגוסט', dog: 'נברי' },
  { ref: '171863155', paid: 360, phone: '0523752473', email: 'yardenwun@gmail.com', name: 'ירדן וונטש', date: '2026-08-17', month: 'אוגוסט', dog: 'וונטש' },
  { ref: '509681462', paid: 540, phone: '0526757615', email: 'yuvalashuri@gmail.com', name: 'יובל אשורי', date: '2026-08-18', month: 'אוגוסט', dog: 'אשורי' },
  { ref: '4813075012', paid: 1050, phone: '0507729993', email: 'alexeyboga@gmail.com', name: 'אלכס בוגטירב', date: '2026-08-18', month: 'אוגוסט', dog: 'בוגטירב' },
  { ref: '510238566', paid: 300, phone: '0504858039', email: 'lica.kovalenko1@gmail.com', name: 'ליקה קובלנקו', date: '2026-08-20', month: 'אוגוסט', dog: 'קובלנקו' },
  { ref: '510464035', paid: 1770, phone: '0542211442', email: 'dalkaher@gmail.com', name: 'דוד אלקחר', date: '2026-08-21', month: 'אוגוסט', dog: 'אלקחר' },
  { ref: '510793633', paid: 180, phone: '0547778221', email: 'aerangil@gmail.com', name: 'עירן אברהם גיל', date: '2026-08-23', month: 'אוגוסט', dog: 'גיל' },
  { ref: '510777745', paid: 1740, phone: '0524577752', email: 'ziviisme@gmail.com', name: 'זיו זיסו', date: '2026-08-23', month: 'אוגוסט', dog: 'זיסו' },
  { ref: '510771399', paid: 270, phone: '0502244873', email: '', name: 'אופיר נידרי', date: '2026-08-23', month: 'אוגוסט', dog: 'נידרי' },
  { ref: '172804032', paid: 540, phone: '0524399271', email: 'omerlotem12@gmail.com', name: 'עומר לוטם', date: '2026-08-27', month: 'אוגוסט', dog: 'לוטם' },
  { ref: '173090500', paid: 1350, phone: '0546160220', email: 'elikobi@gmail.com', name: 'אלי קובי', date: '2026-08-30', month: 'אוגוסט', dog: 'ונוס' },
  { ref: '512844224', paid: 180, phone: '0505642501', email: 'dintex@netvision.net.il', name: 'ישראל מנדל', date: '2026-08-30', month: 'אוגוסט', dog: 'קירה' }
];

async function run() {
  console.log('=== Step 1: Upserting Customer Profiles ===');
  const customerMap = new Map();
  for (const item of ledgerData) {
    const cleanPhone = item.phone.replace(/\D/g, '');
    if (!customerMap.has(cleanPhone)) {
      customerMap.set(cleanPhone, {
        id: `c-${cleanPhone}`,
        phone: item.phone,
        name: item.name,
        email: item.email || '',
        dogNames: new Set(),
        totalVisits: 0,
        totalSpent: 0,
        lastVisit: item.date,
        refs: []
      });
    }
    const c = customerMap.get(cleanPhone);
    c.totalVisits++;
    c.totalSpent += item.paid;
    if (item.date > c.lastVisit) c.lastVisit = item.date;
    c.refs.push(item.ref);
    if (!c.email && item.email) c.email = item.email;
    if (item.dog) c.dogNames.add(item.dog);
  }

  for (const [phone, c] of customerMap.entries()) {
    const dogs = Array.from(c.dogNames).map(d => ({
      name: d,
      breed: 'מעורב',
      notes: `אסמכתאות תשלום Grow: ${c.refs.join(', ')}`,
      specialDiet: ''
    }));

    const isVip = c.totalVisits >= 4 || c.totalSpent >= 4000;

    const record = {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      dogs: dogs.length > 0 ? dogs : [{ name: 'כלב הריזורט', breed: 'מעורב', notes: '', specialDiet: '' }],
      total_visits: c.totalVisits,
      total_spent: c.totalSpent,
      open_debt: 0,
      is_vip: isVip,
      last_visit: c.lastVisit,
      notes: `לקוח פעיל מטבלת תקבולים Grow | סה"כ שולם: ₪${c.totalSpent}`,
      data: {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email || '',
        dogs: dogs.length > 0 ? dogs : [{ name: 'כלב הריזורט', breed: 'מעורב', notes: '', specialDiet: '' }],
        totalVisits: c.totalVisits,
        totalSpent: c.totalSpent,
        openDebt: 0,
        isVip: isVip,
        lastVisit: c.lastVisit,
        notes: `לקוח פעיל מטבלת תקבולים Grow | סה"כ שולם: ₪${c.totalSpent}`
      },
      updated_at: new Date().toISOString()
    };

    await supabase.from('customers').upsert(record, { onConflict: 'id' });
    console.log(`✓ Customer profile saved: ${c.name} (${c.phone}) | ₪${c.totalSpent}`);
  }

  console.log('\n=== Step 2: Cleaning up existing duplicate and unverified bookings ===');
  // Delete legacy unverified bookings
  const idsToDelete = [
    'b-1788880028107', // Shiran Goldie (6500) - unverified / test
    'b-1788158441712', // duplicate Yerus Bikaya 6500 (now replaced by 4 ledger items)
    'b-1788157354365', // duplicate Eli Kobi (now b-grow-173090500)
    'b-1788109083728', // duplicate Israel Mandel 2100 (now b-grow-512844224 = 180)
    'b-1787816159030', // dummy test booking
    'b-1787816416433', // dummy test booking
    'b-1787816298537', // dummy test booking
    'b-1787816513357', // dummy test booking
    'b-1787815825016', // dummy test booking
    'b-1787816465594'  // dummy test booking
  ];

  for (const id of idsToDelete) {
    await supabase.from('bookings').delete().eq('id', id);
    console.log(`Deleted legacy/duplicate booking: ${id}`);
  }

  console.log('\n=== Step 3: Synchronizing September Bookings ===');
  // 1. Gal Sara Shemesh: 180
  await supabase.from('bookings').upsert({
    id: 'b-1788370908724',
    dog_name: 'אוניל',
    dog_breed: 'מעורב',
    owner_name: 'גל שרה שמש בן יוסף',
    owner_phone: '0522458841',
    owner_email: 'benyosefgal@gmail.com',
    service_type: 'daycare',
    start_date: '2026-09-02',
    end_date: '2026-09-02',
    total_price: 180,
    deposit_amount: 180,
    payment_status: 'fully_paid',
    payment_method: 'gpay',
    stay_status: 'completed',
    notes: 'עסקת Grow (אסמכתא: 4857277218)',
    vaccination_valid: true,
    created_at: '2026-09-02T15:49:03.000Z',
    updated_at: '2026-09-02T15:49:03.000Z',
    data: {
      id: 'b-1788370908724',
      dogName: 'אוניל',
      dogBreed: 'מעורב',
      ownerName: 'גל שרה שמש בן יוסף',
      ownerPhone: '0522458841',
      ownerEmail: 'benyosefgal@gmail.com',
      serviceType: 'daycare',
      startDate: '2026-09-02',
      endDate: '2026-09-02',
      totalPrice: 180,
      depositAmount: 180,
      paymentStatus: 'fully_paid',
      paymentMethod: 'gpay',
      stayStatus: 'completed',
      notes: 'עסקת Grow (אסמכתא: 4857277218)',
      createdAt: '2026-09-02T15:49:03.000Z',
      updatedAt: '2026-09-02T15:49:03.000Z'
    }
  }, { onConflict: 'id' });

  // 2. Neta Hadas: 180
  await supabase.from('bookings').upsert({
    id: 'b-grow-173783725',
    dog_name: 'הדס',
    dog_breed: 'מעורב',
    owner_name: 'נטע הדס',
    owner_phone: '0526444845',
    owner_email: 'nettabondi@gmail.com',
    service_type: 'daycare',
    start_date: '2026-09-06',
    end_date: '2026-09-06',
    total_price: 180,
    deposit_amount: 180,
    payment_status: 'fully_paid',
    payment_method: 'bit',
    stay_status: 'completed',
    notes: 'עסקת Grow (אסמכתא: 173783725)',
    vaccination_valid: true,
    created_at: '2026-09-06T13:09:06.000Z',
    updated_at: '2026-09-06T13:09:06.000Z',
    data: {
      id: 'b-grow-173783725',
      dogName: 'הדס',
      dogBreed: 'מעורב',
      ownerName: 'נטע הדס',
      ownerPhone: '0526444845',
      ownerEmail: 'nettabondi@gmail.com',
      serviceType: 'daycare',
      startDate: '2026-09-06',
      endDate: '2026-09-06',
      totalPrice: 180,
      depositAmount: 180,
      paymentStatus: 'fully_paid',
      paymentMethod: 'bit',
      stayStatus: 'completed',
      notes: 'עסקת Grow (אסמכתא: 173783725)',
      createdAt: '2026-09-06T13:09:06.000Z',
      updatedAt: '2026-09-06T13:09:06.000Z'
    }
  }, { onConflict: 'id' });

  // 3. Doreen Lucas: 675 (first installment)
  await supabase.from('bookings').upsert({
    id: 'b-1789123671100',
    dog_name: 'מגן',
    dog_breed: 'מעורב',
    owner_name: 'דורין לוקס',
    owner_phone: '0529270115',
    owner_email: 'lucas.dorin@gmail.com',
    service_type: 'boarding',
    start_date: '2026-09-11',
    end_date: '2026-09-29',
    total_price: 2700,
    deposit_amount: 675,
    payment_status: 'deposit_paid',
    payment_method: 'credit',
    stay_status: 'booked',
    notes: 'עסקת Grow (אסמכתא: 516299998) - תשלום ראשון 675 ₪ מתוך 4',
    vaccination_valid: true,
    created_at: '2026-09-11T10:14:04.000Z',
    updated_at: '2026-09-11T10:14:04.000Z',
    data: {
      id: 'b-1789123671100',
      dogName: 'מגן',
      dogBreed: 'מעורב',
      ownerName: 'דורין לוקס',
      ownerPhone: '0529270115',
      ownerEmail: 'lucas.dorin@gmail.com',
      serviceType: 'boarding',
      startDate: '2026-09-11',
      endDate: '2026-09-29',
      totalPrice: 2700,
      depositAmount: 675,
      paymentStatus: 'deposit_paid',
      paymentMethod: 'credit',
      stayStatus: 'booked',
      notes: 'עסקת Grow (אסמכתא: 516299998) - תשלום ראשון 675 ₪ מתוך 4',
      createdAt: '2026-09-11T10:14:04.000Z',
      updatedAt: '2026-09-11T10:14:04.000Z'
    }
  }, { onConflict: 'id' });

  console.log('\n=== Step 4: Synchronizing August Bookings ===');
  const augItems = ledgerData.filter(d => d.month === 'אוגוסט');
  for (const item of augItems) {
    const bookingId = `b-grow-${item.ref}`;
    const payload = {
      id: bookingId,
      dog_name: item.dog || 'כלב הריזורט',
      dog_breed: 'מעורב',
      owner_name: item.name,
      owner_phone: item.phone,
      owner_email: item.email || '',
      service_type: item.paid >= 4000 ? 'training' : (item.paid <= 360 ? 'daycare' : 'boarding'),
      start_date: item.date,
      end_date: item.date,
      total_price: item.paid,
      deposit_amount: item.paid,
      payment_status: 'fully_paid',
      payment_method: 'bit',
      stay_status: 'completed',
      notes: `תשלום סולק Grow (אסמכתא: ${item.ref})`,
      vaccination_valid: true,
      created_at: `${item.date}T10:00:00.000Z`,
      updated_at: `${item.date}T10:00:00.000Z`,
      data: {
        id: bookingId,
        dogName: item.dog || 'כלב הריזורט',
        dogBreed: 'מעורב',
        ownerName: item.name,
        ownerPhone: item.phone,
        ownerEmail: item.email || '',
        serviceType: item.paid >= 4000 ? 'training' : (item.paid <= 360 ? 'daycare' : 'boarding'),
        startDate: item.date,
        endDate: item.date,
        totalPrice: item.paid,
        depositAmount: item.paid,
        paymentStatus: 'fully_paid',
        paymentMethod: 'bit',
        stayStatus: 'completed',
        notes: `תשלום סולק Grow (אסמכתא: ${item.ref})`,
        vaccinationValid: true,
        createdAt: `${item.date}T10:00:00.000Z`,
        updatedAt: `${item.date}T10:00:00.000Z`
      }
    };
    await supabase.from('bookings').upsert(payload, { onConflict: 'id' });
    console.log(`✓ August booking saved: ${item.name} (${item.date}) | ₪${item.paid} (אסמכתא: ${item.ref})`);
  }

  console.log('\n=== Step 5: Final Collections Audit & Verification ===');
  const { data: allBookings } = await supabase.from('bookings').select('*');

  function getBookingPaymentsInMonth(b, targetMonthKey) {
    if (b.stay_status === 'cancelled' || b.payment_status === 'unpaid') return 0;
    const depAmount = Number(b.deposit_amount ?? b.depositAmount ?? 0);
    const totalPrice = Number(b.total_price ?? b.totalPrice ?? 0);
    const depositDate = (b.data && b.data.depositPaidAt) || b.created_at || b.startDate || b.start_date || '';
    const depositMonth = depositDate.substring(0, 7);

    if (b.payment_status === 'fully_paid') {
      if (depositMonth === targetMonthKey) {
        return totalPrice;
      }
    } else if (b.payment_status === 'deposit_paid') {
      if (depositMonth === targetMonthKey) {
        return depAmount;
      }
    }
    return 0;
  }

  let septSum = 0;
  let augSum = 0;
  for (const b of allBookings) {
    const s = getBookingPaymentsInMonth(b, '2026-09');
    const a = getBookingPaymentsInMonth(b, '2026-08');
    if (s > 0) septSum += s;
    if (a > 0) augSum += a;
  }

  console.log(`\n***************************************************`);
  console.log(`VERIFICATION RESULT:`);
  console.log(`September Collections: ₪${septSum} (Target: ₪8415)`);
  console.log(`August Collections:    ₪${augSum} (Target: ₪25370)`);
  console.log(`Grand Total Cleared:   ₪${septSum + augSum} (Target: ₪33785)`);
  console.log(`Status: ${septSum === 8415 && augSum === 25370 ? 'SUCCESS 100% MATCH!' : 'MISMATCH'}`);
  console.log(`***************************************************\n`);
}

run();
