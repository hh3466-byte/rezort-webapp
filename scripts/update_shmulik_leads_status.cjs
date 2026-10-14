const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function updateLeads() {
  const { data: cfg } = await supabase.from('settings').select('*').limit(1);
  const settings = cfg?.[0]?.data || cfg?.[0] || {};
  const intakes = settings.intakeRequests || [];

  // 1. Omer
  const omer = intakes.find(i => i.id === 'lead_1791891886849_9060' || (i.ownerName || '').includes('עומר כהן'));
  if (omer) {
    omer.status = 'handled';
    omer.internalNotes = (omer.internalNotes || '') + '\n[טופל: חזרנו אליה - ראיון לחטיבת יזרעאלי, לא פנסיון לכלב]';
    console.log('✓ עומר סומנה כטופלה (handled)!');
  }

  // 2. Tomer
  const tomer = intakes.find(i => i.id === 'lead_1791862369289_5077' || (i.ownerName || '').includes('tomeron95'));
  if (tomer) {
    tomer.status = 'in_progress';
    tomer.startDate = '2026-11-25';
    tomer.endDate = '2026-12-31';
    tomer.internalNotes = (tomer.internalNotes || '') + '\n[מעודכן: סוכם מחיר מילואימניק 4000 ₪ לחודש וחצי לסוף נובמבר לאחר החתונה - יחזיר תשובה סופית]';
    console.log('✓ תומר עודכן כ-in_progress לתאריכי נובמבר!');
  }

  // 3. Roei Regev
  const roei = intakes.find(i => i.id === 'req-1791739631614' || (i.ownerName || '').includes('רואי רגב'));
  if (roei) {
    roei.internalNotes = (roei.internalNotes || '') + '\n[מעודכן באפליקציה: סוכם בשיחה עם שמוליק, ממתין לתשלום לקראת 22/10]';
    console.log('✓ רואי רגב עודכן!');
  }

  settings.intakeRequests = intakes;

  const { error } = await supabase.from('settings').update({
    data: settings,
    updated_at: new Date().toISOString()
  }).eq('id', 'resort_config');

  if (error) {
    console.error('Error updating settings:', error);
  } else {
    console.log('✓ כל השאלונים והלידים עודכנו בהצלחה ב-Supabase!');
  }
}

updateLeads().catch(console.error);
