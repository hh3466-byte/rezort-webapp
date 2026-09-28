const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
else if (fs.existsSync('.env')) dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function syncShmulikReality() {
  console.log('=== SYNCING SHMULIK EXACT ROOM & DOG STATE ===');

  // 1. לולה וברנדי (אייל ברקוביץ') -> חדר 7, תאריך התחלה 28.09, שולם מלא 2700
  await supabase.from('bookings').update({
    start_date: '2026-09-28',
    stay_status: 'checked_in',
    total_price: 2700,
    deposit_amount: 2700,
    payment_status: 'fully_paid',
    data: {
      dogName: 'לולה וברנדי',
      ownerName: 'אייל ברקוביץ׳',
      ownerPhone: '0556694789',
      ownerEmail: 'eyal@bercovitz.net',
      startDate: '2026-09-28',
      endDate: '2026-10-08',
      totalPrice: 2700,
      depositAmount: 2700,
      paymentStatus: 'fully_paid',
      stayStatus: 'checked_in',
      kennelNumber: 'room_7',
      serviceType: 'boarding',
      notes: '2 כלבות: לולה + ברנדי | משובצות בחדר 7 | שולם במלואו ₪2,700 ב-ApplePay Grow'
    }
  }).eq('id', 'b-1790091249800');
  console.log('✅ 1. לולה וברנדי עודכנו לחדר 7 (28.09 עד 08.10, שולם מלא ₪2,700)');

  // 2. מגן (דורין לוקט) -> שוחרר היום 28.09
  await supabase.from('bookings').update({
    end_date: '2026-09-28',
    stay_status: 'checked_out',
    data: {
      dogName: 'מגן',
      ownerName: 'דורין לוקס',
      ownerPhone: '0529270115',
      startDate: '2026-09-11',
      endDate: '2026-09-28',
      stayStatus: 'checked_out',
      kennelNumber: undefined,
      totalPrice: 2700,
      depositAmount: 2700,
      paymentStatus: 'fully_paid',
      serviceType: 'boarding',
      notes: 'שוחרר הביתה ב-28.09.26'
    }
  }).eq('id', 'b-1789123671100');
  console.log('✅ 2. מגן עודכן כמשוחרר (checked_out)');

  // 3. סקובי וג'ינג'ס (שליו ביטון) -> סוויטה 3 (2 כלבים)
  await supabase.from('bookings').update({
    dog_name: 'סקובי וג\'ינג\'ס',
    stay_status: 'checked_in',
    data: {
      dogName: 'סקובי וג\'ינג\'ס',
      ownerName: 'שליו ביטון',
      ownerPhone: '0543666579',
      startDate: '2026-09-26',
      endDate: '2026-10-04',
      stayStatus: 'checked_in',
      kennelNumber: 'suite_3',
      totalPrice: 1960,
      depositAmount: 1960,
      paymentStatus: 'fully_paid',
      serviceType: 'boarding',
      notes: '2 כלבים: סקובי וג\'ינג\'ס בסוויטה 3 | שולם מלא ב-Grow'
    }
  }).eq('id', 'b-1790443885286');
  console.log('✅ 3. סקובי וג\'ינג\'ס עודכנו לסוויטה 3 (2 כלבים)');

  // 4. קירה (ישראל מנדל) -> הארכה עד 04.10 (יום א'), תשלום 600 ב-Grow אסמכתא 520490751, חדר 2
  await supabase.from('bookings').update({
    end_date: '2026-10-04',
    stay_status: 'checked_in',
    total_price: 2160,
    deposit_amount: 2160,
    payment_status: 'fully_paid',
    data: {
      dogName: 'קירה',
      ownerName: 'ישראל מנדל',
      ownerPhone: '0505642501',
      startDate: '2026-09-15',
      endDate: '2026-10-04',
      totalPrice: 2160,
      depositAmount: 2160,
      paymentStatus: 'fully_paid',
      stayStatus: 'checked_in',
      kennelNumber: 'room_2',
      serviceType: 'boarding',
      notes: 'שהות הוארכה עד 04.10.26 (עקב מזג אוויר בשייט) | שולם סה"כ ₪2,160 מלא (כולל ₪600 נוספים ב-Grow 28/09 אסמכתא 520490751)'
    }
  }).eq('id', 'b-grow-512844224');
  console.log('✅ 4. קירה עודכנה: הוארכה ל-04.10, חדר 2, שולם ₪2,160 מלא (כולל ₪600 נוספים)');

  // 5. לונה מלמוד -> סוויטה 1, אילוף פנסיון, checked_in
  await supabase.from('bookings').update({
    start_date: '2026-09-18',
    end_date: '2026-10-08',
    stay_status: 'checked_in',
    service_type: 'training',
    data: {
      dogName: 'לונה',
      ownerName: 'רונן מלמוד',
      ownerPhone: '0543666874',
      startDate: '2026-09-18',
      endDate: '2026-10-08',
      stayStatus: 'checked_in',
      kennelNumber: 'suite_1',
      serviceType: 'training',
      totalPrice: 4500,
      depositAmount: 4500,
      paymentStatus: 'fully_paid',
      notes: 'לונה באילוף פנסיון | משובצת בסוויטה 1 | שולם מלא ב-Bit/Grow'
    }
  }).eq('id', 'b-1789541492653');
  console.log('✅ 5. לונה מלמוד עודכנה לסוויטה 1 באילוף פנסיון (training)');

  // 6. סינדי (לירון אבטה) -> שולם מלא ₪360 ב-Bit (Grow 28/09)
  await supabase.from('bookings').update({
    deposit_amount: 360,
    payment_status: 'fully_paid',
    payment_method: 'bit',
    data: {
      dogName: 'סינדי',
      ownerName: 'liron Abta',
      ownerPhone: '052-8191261',
      ownerEmail: 'lironab1@gmail.com',
      startDate: '2026-09-29',
      endDate: '2026-10-01',
      totalPrice: 360,
      depositAmount: 360,
      paymentStatus: 'fully_paid',
      paymentMethod: 'bit',
      stayStatus: 'booked',
      serviceType: 'boarding',
      notes: 'בריא לחלוטין | שולם במלואו ₪360 ב-Bit (Grow 28/09)'
    }
  }).eq('id', 'b-1790619347733');
  console.log('✅ 6. סינדי (לירון אבטה) עודכנה: שולם מלא ₪360 ב-Bit ב-Grow 28/09');

  // 7. שאר החדרים והשיבוצים (לוודא שכל ה-14 כלבים משובצים מדויק):
  // חדר 1: ג'סי
  await supabase.from('bookings').update({
    stay_status: 'checked_in',
    data: { kennelNumber: 'room_1', stayStatus: 'checked_in' }
  }).eq('id', 'b-1788697331109');

  // חדר 3: תיאו (אילוף)
  await supabase.from('bookings').update({
    stay_status: 'checked_in',
    service_type: 'training',
    data: { kennelNumber: 'room_3', stayStatus: 'checked_in', serviceType: 'training' }
  }).eq('id', 'b-1788685190273');

  // חדר 4: ג'וי (אילוף)
  await supabase.from('bookings').update({
    stay_status: 'checked_in',
    service_type: 'training',
    data: { kennelNumber: 'room_4', stayStatus: 'checked_in', serviceType: 'training' }
  }).eq('id', 'b-1789657778767');

  // חדר 5: לונה שלומי (אילוף)
  await supabase.from('bookings').update({
    stay_status: 'checked_in',
    service_type: 'training',
    data: { kennelNumber: 'room_5', stayStatus: 'checked_in', serviceType: 'training' }
  }).eq('id', 'b-1789361510508');

  // חדר 6: דאפי
  await supabase.from('bookings').update({
    stay_status: 'checked_in',
    data: { kennelNumber: 'room_6', stayStatus: 'checked_in' }
  }).eq('id', 'b-1790580530198');

  // סוויטה 2: רייבן
  await supabase.from('bookings').update({
    stay_status: 'checked_in',
    data: { kennelNumber: 'suite_2', stayStatus: 'checked_in' }
  }).eq('id', 'b-1790517583342');

  // סוויטה 4: מייק
  await supabase.from('bookings').update({
    stay_status: 'checked_in',
    data: { kennelNumber: 'suite_4', stayStatus: 'checked_in' }
  }).eq('id', 'b-1790047289926');

  // הלנה ביתית: טר
  await supabase.from('bookings').update({
    stay_status: 'checked_in',
    data: { kennelNumber: 'home', stayStatus: 'checked_in' }
  }).eq('id', 'b-1789473595829');

  console.log('🎉 כל 12 המשבצות, 14 הכלבים והתשלומים האחרונים סונכרנו בהצלחה מלאה!');
}

syncShmulikReality();
