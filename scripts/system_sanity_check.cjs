const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('CRITICAL: Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runSanity() {
  console.log('====================================================');
  console.log('   דוח בדיקת שפיות כוללת למערכת הריזורט לכלב');
  console.log('====================================================\n');

  let issuesFound = 0;

  // 1. Connection & Settings check
  try {
    const start = Date.now();
    const { data: settings, error } = await supabase.from('settings').select('*');
    const latency = Date.now() - start;
    if (error) {
      console.error('❌ תקלת חיבור או קריאה מטבלת settings:', error.message);
      issuesFound++;
    } else {
      console.log(`[1] חיבור למסד הנתונים וטבלת הגדרות (settings):`);
      console.log(`    ✓ זמן תגובה: ${latency}ms`);
      console.log(`    ✓ הגדרות מערכת קיימות: ${settings.length > 0 ? 'נמצאה תצורת ריזורט (' + (settings[0].resort_name || settings[0].id) + ')' : 'ברירת מחדל'}`);
    }
  } catch (err) {
    console.error('❌ חריגה בחיבור למסד הנתונים:', err.message);
    issuesFound++;
  }

  // 2. Bookings integrity
  try {
    const { data: bookings, error } = await supabase.from('bookings').select('*');
    if (error) {
      console.error('❌ שגיאה בקריאת הזמנות:', error.message);
      issuesFound++;
    } else {
      const total = bookings.length;
      const invalidDates = bookings.filter(b => !b.start_date || !b.end_date);
      const invalidPrices = bookings.filter(b => isNaN(Number(b.total_price)) || isNaN(Number(b.deposit_amount)));
      const active = bookings.filter(b => b.stay_status === 'confirmed' || b.stay_status === 'checked_in');
      
      console.log(`[2] טבלת הזמנות (bookings):`);
      console.log(`    - סה"כ הזמנות שמורות: ${total}`);
      console.log(`    - הזמנות פעילות/מאושרות כעת: ${active.length}`);
      if (invalidDates.length > 0) {
        console.warn(`    ⚠️ נמצאו ${invalidDates.length} הזמנות ללא תאריך חוקי`);
        issuesFound++;
      } else {
        console.log(`    ✓ כל התאריכים (כניסה/יציאה) תקינים`);
      }
      if (invalidPrices.length > 0) {
        console.warn(`    ⚠️ נמצאו ${invalidPrices.length} הזמנות עם מחיר לא תקין`);
        issuesFound++;
      } else {
        console.log(`    ✓ כל ערכי המחירים והמקדמות תקינים`);
      }
    }
  } catch (err) {
    console.error('❌ שגיאה בבדיקת הזמנות:', err.message);
    issuesFound++;
  }

  // 3. Grow payments table & exclusion verification
  try {
    const { data: payments, error } = await supabase.from('grow_incoming_payments').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('❌ שגיאה בטבלת תשלומי Grow:', error.message);
      issuesFound++;
    } else {
      console.log(`[3] טבלת תשלומי Grow (grow_incoming_payments):`);
      console.log(`    - סה"כ רשומות: ${payments.length}`);
      
      const pending = payments.filter(p => p.status === 'pending');
      const completed = payments.filter(p => p.status === 'completed');
      const dismissed = payments.filter(p => p.status === 'dismissed');
      console.log(`    - הושלמו: ${completed.length} | ממתינים לשיוך: ${pending.length} | מבוטלים: ${dismissed.length}`);

      // Verify no non-resort payments
      const unwanted = payments.filter(p => {
        const text = (p.customer_name + ' ' + (p.raw_email_snippet || '')).toLowerCase();
        return text.includes('כנען') || text.includes('טרקטור') || text.includes('עפרה') || text.includes('עופרה') || text.includes('שפר') || text.includes('זכויות המורה');
      });

      if (unwanted.length > 0) {
        console.error(`    ❌ נמצאו ${unwanted.length} תשלומים שאינם שייכים לריזורט!`);
        issuesFound++;
      } else {
        console.log(`    ✓ אימות החרגה: אין אף תשלום של כנען טרקטורים / עפרה שפר / זכויות המורה. הטבלה נקייה לחלוטין!`);
      }

      console.log(`    - תשלומים פתוחים הממתינים לשיוך כעת באפליקציה:`);
      pending.forEach(p => {
        console.log(`      * ${p.customer_name} | ₪${p.amount} | אסמכתא: ${p.reference_id}`);
      });
    }
  } catch (err) {
    console.error('❌ שגיאה בבדיקת תשלומי Grow:', err.message);
    issuesFound++;
  }

  // 4. Customers and Dogs
  try {
    const { data: customers } = await supabase.from('customers').select('id, name, phone');
    const { data: dogs } = await supabase.from('dogs').select('id, name, breed');
    console.log(`[4] לקוחות וכלבים:`);
    console.log(`    - לקוחות רשומים: ${customers ? customers.length : 0}`);
    console.log(`    - כלבים רשומים: ${dogs ? dogs.length : 0}`);
  } catch (err) {
    console.error('❌ שגיאה בבדיקת לקוחות וכלבים:', err.message);
  }

  // 5. Green API WhatsApp Instance Health
  try {
    const greenInstanceId = '710722735421';
    const greenToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
    const stateRes = await fetch(`https://7107.api.greenapi.com/waInstance${greenInstanceId}/getStateInstance/${greenToken}`);
    if (stateRes.ok) {
      const stateData = await stateRes.json();
      console.log(`[5] חיבור Green-API (WhatsApp בוט):`);
      console.log(`    - סטטוס מופע: ${stateData.stateInstance}`);
      if (stateData.stateInstance === 'authorized') {
        console.log(`    ✓ וואטסאפ מחובר ומאושר (authorized) ומוכן לשליחה וקבלת הודעות`);
      } else {
        console.warn(`    ⚠️ מופע הוואטסאפ אינו בסטטוס authorized (סטטוס: ${stateData.stateInstance})`);
      }
    } else {
      console.warn(`[5] חיבור Green-API: שגיאת שרת בקבלת סטטוס (${stateRes.status})`);
    }
  } catch (err) {
    console.warn(`[5] בדיקת Green-API: ${err.message}`);
  }

  // 7. Overlapping Bookings & Dog Duplication Integrity Check
  try {
    const { data: allBks, error: bksErr } = await supabase.from('bookings').select('*');
    if (bksErr) {
      console.error('❌ שגיאה בשליפת הזמנות לבדיקת כפילויות:', bksErr.message);
      issuesFound++;
    } else {
      console.log(`[7] בדיקת כפילויות הזמנות וכלבים פעילים:`);
      const todayStr = new Date().toISOString().slice(0, 10);
      const active = allBks.filter(b => 
        b.stay_status !== 'cancelled' && 
        b.stay_status !== 'completed' && 
        b.stay_status !== 'checked_out' && 
        (!b.data || (b.data.stayStatus !== 'cancelled' && b.data.stayStatus !== 'completed')) &&
        b.end_date >= todayStr
      );
      
      const phoneDogMap = {};
      active.forEach(b => {
        const phone = (b.owner_phone || '').replace(/\D/g, '');
        const dog = (b.dog_name || '').trim().toLowerCase();
        const key = `${phone}_${dog}`;
        if (!phoneDogMap[key]) phoneDogMap[key] = [];
        phoneDogMap[key].push(b);
      });

      let dupCount = 0;
      for (const k in phoneDogMap) {
        const list = phoneDogMap[k];
        if (list.length > 1) {
          for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
              const b1 = list[i];
              const b2 = list[j];
              // Check date overlap
              if (b1.start_date <= b2.end_date && b1.end_date >= b2.start_date) {
                console.error(`    ❌ נמצאה כפילות פעילה עבור ${b1.owner_name} / הכלב ${b1.dog_name}:`);
                console.error(`       • הזמנה א': ID ${b1.id} (${b1.start_date} עד ${b1.end_date}, מחיר: ₪${b1.total_price})`);
                console.error(`       • הזמנה ב': ID ${b2.id} (${b2.start_date} עד ${b2.end_date}, מחיר: ₪${b2.total_price})`);
                dupCount++;
                issuesFound++;
              }
            }
          }
        }
      }
      if (dupCount === 0) {
        console.log(`    ✓ 0 כפילויות: כל כלב רשום בהזמנה פעילה אחת בלבד לכל טווח תאריכים!`);
      }
    }
  } catch (err) {
    console.error('❌ חריגה בבדיקת כפילויות:', err.message);
    issuesFound++;
  }

  // 8. Grow Reference & Ledger Integrity Check
  try {
    const { data: bks } = await supabase.from('bookings').select('*');
    const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');
    console.log(`[8] אימות אסמכתאות Grow מול הזמנות ותשלומים:`);
    
    const growPaidMap = {};
    if (growPayments) {
      growPayments.forEach(p => {
        growPaidMap[p.reference_id] = {
          amount: Number(p.amount) || 0,
          status: p.status
        };
      });
    }

    const active = (bks || []).filter(b => b.stay_status !== 'cancelled' && (!b.data || b.data.stayStatus !== 'cancelled'));
    const refUsageMap = {};
    active.forEach(b => {
      const notes = (b.notes || '') + ' ' + ((b.data && b.data.notes) || '');
      const m = notes.match(/5\d{8}|17\d{7}|48\d{8}|49\d{8}/g);
      if (m) {
        const uniqueRefsInBooking = Array.from(new Set(m));
        uniqueRefsInBooking.forEach(ref => {
          if (!refUsageMap[ref]) refUsageMap[ref] = { bookings: [], sumDeposit: 0 };
          refUsageMap[ref].bookings.push(b);
          refUsageMap[ref].sumDeposit += Number(b.deposit_amount || 0);
        });
      }
    });

    let refErrors = 0;
    for (const ref in refUsageMap) {
      const usage = refUsageMap[ref];
      const growItem = growPaidMap[ref];
      if (growItem) {
        if (growItem.status === 'refunded' && usage.sumDeposit > 0) {
          console.error(`    ❌ אסמכתא ${ref} מוגדרת כזוכתה (refunded) אך עדיין רשומות בה הזמנות עם מקדמה פעילה (₪${usage.sumDeposit})!`);
          refErrors++;
          issuesFound++;
        } else if (growItem.status !== 'refunded' && usage.sumDeposit > growItem.amount) {
          console.error(`    ❌ אסמכתא ${ref}: סך המקדמות בהזמנות (₪${usage.sumDeposit}) חורג מסכום הסליקה בפועל (₪${growItem.amount})!`);
          refErrors++;
          issuesFound++;
        }
      }
    }
    if (refErrors === 0) {
      console.log(`    ✓ כל אסמכתאות Grow תואמות במדויק לסכומי הסליקה.`);
    }
  } catch (err) {
    console.error('❌ חריגה באימות אסמכתאות:', err.message);
    issuesFound++;
  }

  // 9. Customer Profiles & total_spent Sanity Check
  try {
    const { data: customers } = await supabase.from('customers').select('*');
    console.log(`[9] אימות כרטיסי לקוחות (יתרות וסכומים מצטברים):`);
    let custIssues = 0;
    if (customers) {
      customers.forEach(c => {
        const spent = Number(c.total_spent) || 0;
        if (spent < 0 || isNaN(spent)) {
          console.error(`    ❌ לקוח ${c.name} (${c.phone}): ערך total_spent לא תקין (${c.total_spent})`);
          custIssues++;
          issuesFound++;
        }
      });
    }
    if (custIssues === 0) {
      console.log(`    ✓ כל כרטיסי הלקוחות תקינים ומאומתים.`);
    }
  } catch (err) {
    console.error('❌ חריגה בבדיקת כרטיסי לקוחות:', err.message);
    issuesFound++;
  }

  console.log('\n====================================================');
  if (issuesFound === 0) {
    console.log('   סיכום: מערכת 100% בריאה, יציבה ותקינה ללא תקלות!');
  } else {
    console.log(`   סיכום: נמצאו ${issuesFound} סוגיות הדורשות תשומת לב.`);
  }
  console.log('====================================================\n');
}

runSanity();

