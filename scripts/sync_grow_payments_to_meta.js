/**
 * =========================================================================
 * סנכרון תשלומי Grow (משולם) ל-Meta Conversions API (CAPI)
 * מעביר את כל נתוני המשלמים והסכומים מ-Grow ישירות למטא אדס מנג'ר
 * לצורך מדידת החזר השקעה (ROAS) ויצירת קהלי Lookalike של משלמים!
 * =========================================================================
 */

import { createClient } from '@supabase/supabase-js';
import { sendMetaPurchaseEvent } from '../api/meta-capi.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncAllGrowPaymentsToMeta() {
  console.log('🔄 מתחיל שליפת תשלומי Grow מסופאבייס לסנכרון למטא...');

  const { data: payments, error } = await supabase
    .from('grow_incoming_payments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ שגיאה בשליפת תשלומים מסופאבייס:', error.message);
    return;
  }

  if (!payments || payments.length === 0) {
    console.log('ℹ️ לא נמצאו תשלומי Grow לשליחה.');
    return;
  }

  console.log(`📊 נמצאו ${payments.length} תשלומי Grow. מתחיל שידור אירועי Purchase למטא CAPI...`);

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    const phone = p.customer_phone || '';
    const name = p.customer_name || '';
    const amount = Number(p.amount) || 0;
    const ref = p.reference_id || p.id;

    if (!phone && !name) {
      skippedCount++;
      continue;
    }

    // בדיקת סכום תקין (גדול מ-0)
    if (amount <= 0) {
      skippedCount++;
      continue;
    }

    try {
      const res = await sendMetaPurchaseEvent({
        phone: phone,
        customerName: name,
        amount: amount,
        transactionId: ref,
        currency: 'ILS',
        eventSourceUrl: 'https://rezort-webapp.vercel.app/'
      });

      if (res.ok) {
        successCount++;
        console.log(`[${i + 1}/${payments.length}] ✅ שודר למטא: ${name} (📞 ${phone}) | סכום: ₪${amount.toLocaleString()} | אסמכתא: ${ref}`);
      } else {
        errorCount++;
        console.warn(`[${i + 1}/${payments.length}] ⚠️ שגיאה במטא עבור ${name}:`, res.error);
      }
    } catch (sendErr) {
      errorCount++;
      console.error(`[${i + 1}/${payments.length}] ❌ חריגה בשליחת תשלום ${ref}:`, sendErr.message);
    }

    // השהיה קלה בין בקשות למניעת Rate Limit
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n=============================================');
  console.log(`🎉 סיום סנכרון תשלומי Grow למטא:`);
  console.log(`• שודרו בהצלחה: ${successCount}`);
  console.log(`• דולגו (ללא מזהים / 0 ₪): ${skippedCount}`);
  console.log(`• שגיאות: ${errorCount}`);
  console.log('=============================================\n');
}

syncAllGrowPaymentsToMeta().catch(console.error);
