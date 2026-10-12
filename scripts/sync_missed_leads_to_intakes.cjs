const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const missedLeads = [
  {
    name: 'דרור',
    phone: '054-6050046',
    date: '2026-10-10T08:34:39.000Z',
    source: 'קמפיין ממומן במטא (אילוף בתנאי פנסיון)',
    msg: 'הי! השלמתי את הטופס שלך, וברצוני לדעת יותר על העסק שלך. Full name: דרור Phone number: +972546050046',
    dogName: 'ממתין לבירור בשיחה 🐶',
    dogBreed: '',
    dogAge: '',
    serviceType: 'training',
    internalNotes: 'הלקוח מילא טופס לידים במטא בשבת (10/10 11:34) והיה בטוח שהשלים את השאלון. שמוליק ניסה להתקשר ב-11/10 16:37 אך לא היה מענה. יש ליצור קשר בהקדם לתיאום פרטי האילוף/פנסיון.'
  },
  {
    name: 'מוטי גמבש',
    phone: '052-3866350',
    date: '2026-10-08T14:19:29.000Z',
    source: 'קמפיין ממומן במטא',
    msg: 'הי! השלמתי את הטופס שלך, וברצוני לדעת יותר על העסק שלך. Full name: מוטי גמבש Phone number: +972523866350',
    dogName: 'ממתין לבירור בשיחה 🐶',
    dogBreed: '',
    dogAge: '',
    serviceType: 'boarding',
    internalNotes: 'הלקוח השלים טופס לידים במטא ביום חמישי 8/10. נשלח קישור לשאלון. יש לחזור אליו לבירור צרכים ותיאום.'
  },
  {
    name: 'גלעד גילי בלום',
    phone: '054-5981638',
    date: '2026-10-11T08:14:41.000Z',
    source: 'פנייה מוואטסאפ / פייסבוק',
    msg: 'כמה יעלה לתת אותו לחודשיים? הוא כלב גדול, שנתיים וחצי, מחונך ויפהפה שלום! אשמח לקבל פרטים על פנסיון לכלב שלי בריזורט הכלבים 🐶',
    dogName: 'כלב גדול מחונך',
    dogBreed: 'מעורב גדול',
    dogAge: '2.5',
    serviceType: 'boarding',
    internalNotes: 'מתעניין בשהייה ארוכה של חודשיים לכלב גדול בן שנתיים וחצי מחונך. נשלח קישור לשאלון ב-11/10 11:14. יש ליצור קשר טלפוני לתיאום מועדים ומחיר לחודשיים.'
  },
  {
    name: 'נאווה בשן',
    phone: '052-4840666',
    date: '2026-10-10T07:45:46.000Z',
    source: 'פנייה מוואטסאפ / פייסבוק',
    msg: 'אני אשמח לפרטים עלויות וכדומה מחיר ליום לביגל בן 5 שקט מאוד שלום! אשמח לקבל פרטים על פנסיון לכלב שלי בריזורט הכלבים 🐶',
    dogName: 'ביגל',
    dogBreed: 'ביגל',
    dogAge: '5',
    serviceType: 'boarding',
    internalNotes: 'פנייה משבת 10/10 10:45. מתעניינת בפנסיון לביגל בן 5 שקט מאוד. נשלח קישור לשאלון. יש לחזור לתיאום תאריכים.'
  },
  {
    name: 'ענת',
    phone: '054-6263118',
    date: '2026-10-10T13:43:21.000Z',
    source: 'פנייה מוואטסאפ / פייסבוק',
    msg: 'שלום! אשמח לקבל פרטים על פנסיון לכלב שלי בריזורט הכלבים 🐶',
    dogName: 'ממתין לבירור בשיחה 🐶',
    dogBreed: '',
    dogAge: '',
    serviceType: 'boarding',
    internalNotes: 'פנייה משבת 10/10 16:43. נשלחה הודעת סגירת סופ"ש עם קישור לשאלון. יש ליצור קשר לבירור צרכים.'
  },
  {
    name: 'דוד זינו',
    phone: '055-9838049',
    date: '2026-10-10T16:40:55.000Z',
    source: 'פנייה מוואטסאפ / פייסבוק',
    msg: 'שלום! אשמח לקבל פרטים על פנסיון לכלב שלי בריזורט הכלבים 🐶',
    dogName: 'ממתין לבירור בשיחה 🐶',
    dogBreed: '',
    dogAge: '',
    serviceType: 'boarding',
    internalNotes: 'פנייה ממוצ"ש 10/10 19:40. נשלח קישור לשאלון קליטה. יש ליצור קשר.'
  },
  {
    name: 'סבטלנה',
    phone: '054-7461440',
    date: '2026-10-11T03:06:30.000Z',
    source: 'פנייה מוואטסאפ / פייסבוק',
    msg: 'שלום! אשמח לקבל פרטים על פנסיון לכלב שלי בריזורט הכלבים 🐶',
    dogName: 'ממתין לבירור בשיחה 🐶',
    dogBreed: '',
    dogAge: '',
    serviceType: 'boarding',
    internalNotes: 'פנייה מיום ראשון 11/10 06:06 בבוקר. נשלח קישור לשאלון. יש ליצור קשר.'
  }
];

async function run() {
  console.log('--- Synchronizing Missed Weekend Leads to intakeRequests in Supabase ---');

  const { data: sRow, error: sErr } = await supabase
    .from('settings')
    .select('data')
    .eq('id', 'resort_config')
    .single();

  if (sErr) throw sErr;

  const currentData = sRow?.data || {};
  let currentIntakes = Array.isArray(currentData.intakeRequests) ? currentData.intakeRequests : [];

  let addedCount = 0;
  for (const lead of missedLeads) {
    const phoneSuffix = lead.phone.replace(/\D/g, '').slice(-7);
    const existing = currentIntakes.find(r => (r.ownerPhone || '').replace(/\D/g, '').includes(phoneSuffix));
    
    if (existing) {
      console.log(`Lead ${lead.name} (${lead.phone}) already exists in intakes (ID: ${existing.id}). Updating notes...`);
      existing.internalNotes = lead.internalNotes;
      continue;
    }

    const leadId = `lead_${new Date(lead.date).getTime()}_${phoneSuffix.slice(-4)}`;
    const newIntake = {
      id: leadId,
      createdAt: lead.date,
      status: 'pending',
      ownerName: lead.name,
      ownerPhone: lead.phone,
      dogName: lead.dogName,
      dogBreed: lead.dogBreed || '',
      dogAge: lead.dogAge || '',
      serviceType: lead.serviceType,
      startDate: new Date(lead.date).toISOString().substring(0, 10),
      endDate: new Date(new Date(lead.date).getTime() + 4 * 86400000).toISOString().substring(0, 10),
      clientOrigin: 'meta_lead',
      notes: `[📢 ליד מקמפיין ממומן במטא] | ${lead.msg}`,
      internalNotes: lead.internalNotes,
      termsAccepted: false
    };

    currentIntakes.unshift(newIntake);
    addedCount++;
    console.log(`+ Added lead: ${lead.name} (${lead.phone}) as ${leadId}`);
  }

  const { error: upErr } = await supabase
    .from('settings')
    .update({
      data: { ...currentData, intakeRequests: currentIntakes },
      updated_at: new Date().toISOString()
    })
    .eq('id', 'resort_config');

  if (upErr) throw upErr;
  console.log(`\n✓ SUCCESS! Added ${addedCount} missed leads to intakeRequests in Supabase.`);
}

run().catch(console.error);
