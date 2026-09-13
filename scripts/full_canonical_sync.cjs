const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(supabaseUrl, supabaseKey);

// All 35 transactions from the user's payment table image:
// 7 September transactions (Total: ₪8,415)
// 28 August transactions (Total: ₪25,370)
// Grand total = ₪33,785
const ledgerData = [
  // September 2026
  { ref: '4857277218', paid: 180, phone: '0522458841', email: 'benyosefgal@gmail.com', name: 'גל שרה שמש בן יוסף', date: '2026-09-02', month: 'ספטמבר', dog: 'אוניל', service: 'daycare' },
  { ref: '173783725', paid: 180, phone: '0526444845', email: 'nettabondi@gmail.com', name: 'נטע הדס', date: '2026-09-06', month: 'ספטמבר', dog: 'הדס', service: 'daycare' },
  { ref: '173758692', paid: 180, phone: '0527777737', email: 'navri@netvision.net.il', name: 'ריקה נברי', date: '2026-09-06', month: 'ספטמבר', dog: "ג'סי הרוטוויילרית", service: 'boarding' },
  { ref: '514721903', paid: 6300, phone: '0505564073', email: 'eyal.shekel@outlook.com', name: 'איל שקל', date: '2026-09-06', month: 'ספטמבר', dog: 'תיאו', service: 'training' },
  { ref: '515223561', paid: 360, phone: '0505856800', email: 'bennygreen007@gmail.com', name: 'בני גרין', date: '2026-09-07', month: 'ספטמבר', dog: 'ספסוף', service: 'boarding' },
  { ref: '174291549', paid: 540, phone: '0508273209', email: 'nisan.abramov27@gmail.com', name: 'Tali Nisan Avramov', date: '2026-09-10', month: 'ספטמבר', dog: 'פאבלו', service: 'boarding' },
  { ref: '516299998', paid: 675, phone: '0529270115', email: 'lucas.dorin@gmail.com', name: 'דורין לוקס', date: '2026-09-11', month: 'ספטמבר', dog: 'מגן', service: 'boarding' },

  // August 2026
  { ref: '171099384', paid: 2200, phone: '0549420995', email: 'areiffman@gmail.com', name: 'אשר ריפמן', date: '2026-08-09', month: 'אוגוסט', dog: 'הכלב של אשר', service: 'boarding' },
  { ref: '507419993', paid: 180, phone: '0545949480', email: 'gafni_nava@hotmail.com', name: 'נאוה גפני', date: '2026-08-10', month: 'אוגוסט', dog: 'הכלב של נאוה', service: 'daycare' },
  { ref: '4788806274', paid: 900, phone: '0527204572', email: 'dinadarom@gmail.com', name: 'דינה דיין', date: '2026-08-10', month: 'אוגוסט', dog: 'הכלב של דינה', service: 'boarding' },
  { ref: '507400049', paid: 200, phone: '0545670355', email: 'shekel.hadas@gmail.com', name: 'הדס שקל', date: '2026-08-10', month: 'אוגוסט', dog: 'תיאו', service: 'daycare' },
  { ref: '171140534', paid: 180, phone: '0523669361', email: 'daliamoskov@gmail.com', name: 'דליה מוסקוביץ', date: '2026-08-10', month: 'אוגוסט', dog: 'הכלב של דליה', service: 'daycare' },
  { ref: '507810263', paid: 1500, phone: '0556646093', email: 'yerusbikaya54@gmail.com', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי", service: 'boarding' },
  { ref: '507807309', paid: 1000, phone: '0556646093', email: 'yerusbikaya54@gmail.com', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי", service: 'boarding' },
  { ref: '4792995703', paid: 1000, phone: '0556646093', email: 'yerusbikaya54@gmail.com', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי", service: 'boarding' },
  { ref: '507806497', paid: 3000, phone: '0556646093', email: 'yerusbikaya54@gmail.com', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי", service: 'boarding' },
  { ref: '508467767', paid: 180, phone: '0542211442', email: 'dalkaher@gmail.com', name: 'דוד אלקחר', date: '2026-08-13', month: 'אוגוסט', dog: 'הכלב של דוד', service: 'daycare' },
  { ref: '508442380', paid: 540, phone: '0503166129', email: 'amir.lior@gmail.com', name: 'ליאור אמיר', date: '2026-08-13', month: 'אוגוסט', dog: 'הכלב של ליאור', service: 'boarding' },
  { ref: '508390101', paid: 180, phone: '0524577752', email: 'ziviisme@gmail.com', name: 'זיו זיסו', date: '2026-08-13', month: 'אוגוסט', dog: 'הכלב של זיו', service: 'daycare' },
  { ref: '508388527', paid: 180, phone: '0524577752', email: 'ziviisme@gmail.com', name: 'זיו זיסו', date: '2026-08-13', month: 'אוגוסט', dog: 'הכלב של זיו', service: 'daycare' },
  { ref: '508629487', paid: 180, phone: '0507585533', email: 'mmalisinai30@gmail.com', name: 'מלי סיני', date: '2026-08-14', month: 'אוגוסט', dog: 'הכלב של מלי', service: 'daycare' },
  { ref: '4810894878', paid: 1950, phone: '0546260997', email: 'idoshavit6@gmail.com', name: 'עידו שביט', date: '2026-08-17', month: 'אוגוסט', dog: 'הכלב של עידו', service: 'boarding' },
  { ref: '171893936', paid: 1170, phone: '0523669361', email: 'daliamoskov@gmail.com', name: 'דליה מוסקוביץ', date: '2026-08-17', month: 'אוגוסט', dog: 'הכלב של דליה', service: 'boarding' },
  { ref: '509363691', paid: 2550, phone: '0527777787', email: 'navri38@gmail.com', name: 'אור נברי', date: '2026-08-17', month: 'אוגוסט', dog: "ג'סי", service: 'boarding' },
  { ref: '171863155', paid: 360, phone: '0523752473', email: 'yardenwun@gmail.com', name: 'ירדן וונטש', date: '2026-08-17', month: 'אוגוסט', dog: 'הכלב של ירדן', service: 'boarding' },
  { ref: '509681462', paid: 540, phone: '0526757615', email: 'yuvalashuri@gmail.com', name: 'יובל אשורי', date: '2026-08-18', month: 'אוגוסט', dog: 'הכלב של יובל', service: 'boarding' },
  { ref: '4813075012', paid: 1050, phone: '0507729993', email: 'alexeyboga@gmail.com', name: 'אלכס בוגטירב', date: '2026-08-18', month: 'אוגוסט', dog: 'הכלב של אלכס', service: 'boarding' },
  { ref: '510238566', paid: 300, phone: '0504858039', email: 'lica.kovalenko1@gmail.com', name: 'ליקה קובלנקו', date: '2026-08-20', month: 'אוגוסט', dog: 'הכלב של ליקה', service: 'daycare' },
  { ref: '510464035', paid: 1770, phone: '0542211442', email: 'dalkaher@gmail.com', name: 'דוד אלקחר', date: '2026-08-21', month: 'אוגוסט', dog: 'הכלב של דוד', service: 'boarding' },
  { ref: '510793633', paid: 180, phone: '0547778221', email: 'aerangil@gmail.com', name: 'עירן אברהם גיל', date: '2026-08-23', month: 'אוגוסט', dog: 'הכלב של עירן', service: 'daycare' },
  { ref: '510777745', paid: 1740, phone: '0524577752', email: 'ziviisme@gmail.com', name: 'זיו זיסו', date: '2026-08-23', month: 'אוגוסט', dog: 'הכלב של זיו', service: 'boarding' },
  { ref: '510771399', paid: 270, phone: '0502244873', email: '', name: 'אופיר נידרי', date: '2026-08-23', month: 'אוגוסט', dog: 'הכלב של אופיר', service: 'daycare' },
  { ref: '172804032', paid: 540, phone: '0524399271', email: 'omerlotem12@gmail.com', name: 'עומר לוטם', date: '2026-08-27', month: 'אוגוסט', dog: 'הכלב של עומר', service: 'boarding' },
  { ref: '173090500', paid: 1350, phone: '0546160220', email: 'elikobi@gmail.com', name: 'אלי קובי', date: '2026-08-30', month: 'אוגוסט', dog: 'ונוס', service: 'boarding' },
  { ref: '512844224', paid: 180, phone: '0505642501', email: 'dintex@netvision.net.il', name: 'ישראל מנדל', date: '2026-08-30', month: 'אוגוסט', dog: 'קירה', service: 'daycare' }
];

async function syncAll() {
  console.log('Fetching all existing bookings from Supabase...');
  const { data: existingBookings, error: fetchErr } = await supabase.from('bookings').select('*');
  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }
  console.log(`Found ${existingBookings.length} existing bookings in DB.`);

  // Map existing bookings by ref (extracted from notes or id)
  const existingByRef = new Map();
  for (const b of existingBookings) {
    // Extract ref from id (e.g. b-grow-123456, b-aug-123456, b-123456)
    // or from notes (e.g. אסמכתא: 123456)
    const matchNote = (b.notes || '').match(/אסמכתא:\s*([0-9]+)/);
    if (matchNote) {
      existingByRef.set(matchNote[1], b);
    }
    const matchId = b.id.replace(/^b-(grow-|aug-|tx-|pay-)?/, '');
    if (/^[0-9]+$/.test(matchId)) {
      existingByRef.set(matchId, b);
    }
  }

  // Also check existing known September IDs
  const septKnown = {
    '4857277218': 'b-1788370908724', // Gal Sara Shemesh
    '173783725': 'b-173783725',       // Neta Hadas
    '173758692': 'b-1788697331109',   // Rika Navri
    '514721903': 'b-1788685190273',   // Eyal Shekel
    '515223561': 'b-1788861047172',   // Benny Green
    '174291549': 'b-1789110721502',   // Tali Nisan
    '516299998': 'b-1789123671100'    // Dorin Lucas
  };

  for (const [ref, knownId] of Object.entries(septKnown)) {
    const found = existingBookings.find(b => b.id === knownId);
    if (found) existingByRef.set(ref, found);
  }

  console.log(`\nSynchronizing all 35 transactions...`);
  for (const item of ledgerData) {
    const existing = existingByRef.get(item.ref);
    if (existing) {
      console.log(`[EXISTS] Ref ${item.ref}: ${existing.owner_name} (ID: ${existing.id})`);
    } else {
      console.log(`[MISSING] Ref ${item.ref}: ${item.name} (${item.date}) -> Inserting now...`);
      const bookingId = `b-tx-${item.ref}`;
      const payload = {
        id: bookingId,
        dog_name: item.dog,
        dog_breed: 'מעורב',
        owner_name: item.name,
        owner_phone: item.phone,
        owner_email: item.email || '',
        service_type: item.service || 'boarding',
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
          dogName: item.dog,
          dogBreed: 'מעורב',
          ownerName: item.name,
          ownerPhone: item.phone,
          ownerEmail: item.email || '',
          serviceType: item.service || 'boarding',
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

      const { data, error } = await supabase.from('bookings').upsert(payload, { onConflict: 'id' }).select();
      if (error) {
        console.error(`  ERROR inserting ${bookingId}:`, error);
      } else {
        console.log(`  ✓ Inserted ${bookingId} successfully.`);
      }
    }
  }

  // Verification
  console.log('\nRunning final calculation audit on Supabase...');
  const { data: finalBookings } = await supabase.from('bookings').select('*');

  function getBookingPaymentsInMonth(b, targetMonthKey) {
    if (b.stay_status === 'cancelled' || b.payment_status === 'unpaid') return 0;
    const depAmount = Number(b.deposit_amount ?? b.depositAmount ?? 0);
    const totalPrice = Number(b.total_price ?? b.totalPrice ?? 0);
    const depositDate = (b.data && b.data.depositPaidAt) || b.created_at || b.startDate || b.start_date || '';
    const depositMonth = depositDate.substring(0, 7);

    if (b.payment_status === 'fully_paid') {
      if (depositMonth === targetMonthKey) return totalPrice;
    } else if (b.payment_status === 'deposit_paid') {
      if (depositMonth === targetMonthKey) return depAmount;
    }
    return 0;
  }

  let septSum = 0;
  let augSum = 0;
  let septCount = 0;
  let augCount = 0;

  for (const b of finalBookings) {
    const s = getBookingPaymentsInMonth(b, '2026-09');
    const a = getBookingPaymentsInMonth(b, '2026-08');
    if (s > 0) { septSum += s; septCount++; }
    if (a > 0) { augSum += a; augCount++; }
  }

  console.log('====================================================');
  console.log(`Total Bookings in DB: ${finalBookings.length}`);
  console.log(`September Collections: ₪${septSum} (${septCount} transactions) | Target: ₪8415`);
  console.log(`August Collections:    ₪${augSum} (${augCount} transactions) | Target: ₪25370`);
  console.log(`Grand Total Cleared:   ₪${septSum + augSum} (${septCount + augCount} transactions) | Target: ₪33785`);
  console.log(`Match Sept? ${septSum === 8415 ? '✅ YES' : '❌ NO'}`);
  console.log(`Match Aug?  ${augSum === 25370 ? '✅ YES' : '❌ NO'}`);
  console.log(`Match Total? ${septSum + augSum === 33785 ? '✅ YES' : '❌ NO'}`);
  console.log('====================================================');
}

syncAll();
