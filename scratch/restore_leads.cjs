const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function restoreLeads() {
  const { data: sRow } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  const currentRequests = sRow?.data?.intakeRequests || [];
  console.log('Current intake requests in DB:', currentRequests.length);

  const leadsToRestore = [
    {
      id: 'req-rotem-mashiah',
      ownerName: 'רותם משיח',
      dogName: 'באקסטר',
      ownerPhone: '054-7706342',
      serviceType: 'boarding',
      status: 'pending',
      startDate: '2026-10-16',
      endDate: '2026-10-18',
      createdAt: '2026-10-14T17:36:00.000Z',
      notes: 'פנייה בוואטסאפ: "שלום! אשמח לקבל פרטים על פנסיון לכלב שלי בריזורט הכלבים 🐶"',
      internalNotes: '[ליד חדש מוואטסאפ - ממתין למענה/שאלון]',
      dogGender: 'male',
      termsAccepted: false
    },
    {
      id: 'req-mirella-klein',
      ownerName: 'מירלה קליין',
      dogName: 'לא צוין עדיין',
      ownerPhone: '052-4274740',
      serviceType: 'boarding',
      status: 'pending',
      startDate: '2026-10-18',
      endDate: '2026-10-22',
      createdAt: '2026-10-14T15:44:00.000Z',
      notes: 'ליד מקמפיין ממומן / טופס לידים מטא: "הי! השלמתי את הטופס שלך, וברצוני לדעת יותר על העסק שלך. Full name: מירלה קליין | שאלה: רוצה לדעת היכן אתם נמצאים וכמה לוקחים ליום"',
      internalNotes: '[📢 ליד מקמפיין ממומן במטא - ממתין לתיאום טלפוני ומילוי שאלון]',
      dogGender: 'male',
      termsAccepted: false
    },
    {
      id: 'req-shlomo-roimi',
      ownerName: 'שלמה רואימי',
      dogName: 'לא צוין עדיין',
      ownerPhone: '050-6278834',
      serviceType: 'boarding',
      status: 'pending',
      startDate: '2026-10-17',
      endDate: '2026-10-20',
      createdAt: '2026-10-14T14:54:00.000Z',
      notes: 'פנייה בוואטסאפ: "שלום! אשמח לקבל פרטים על פנסיון לכלב שלי בריזורט הכלבים 🐶"',
      internalNotes: '[ליד חדש מוואטסאפ - התעניין בפנסיון]',
      dogGender: 'male',
      termsAccepted: false
    },
    {
      id: 'req-adi-kadosh',
      ownerName: 'עדי קדוש',
      dogName: 'לא צוין עדיין',
      ownerPhone: '050-9551447',
      serviceType: 'boarding',
      status: 'pending',
      startDate: '2026-10-18',
      endDate: '2026-10-21',
      createdAt: '2026-10-13T17:59:00.000Z',
      notes: 'פנייה מאינסטגרם: "🐶היי, הגעתי מהאינסטגרם"',
      internalNotes: '[ליד מאינסטגרם]',
      dogGender: 'male',
      termsAccepted: false
    },
    {
      id: 'req-gennadiy-bimbat',
      ownerName: 'גנאדי בימבט (Gennadiy)',
      dogName: 'לא צוין עדיין',
      ownerPhone: '053-6268071',
      serviceType: 'boarding',
      status: 'pending',
      startDate: '2026-10-19',
      endDate: '2026-10-23',
      createdAt: '2026-10-12T21:42:00.000Z',
      notes: 'ליד מקמפיין ממומן: "Здравствуйте! Я заполнил(-а) форму и хочу узнать больше о вашей компании"',
      internalNotes: '[📢 ליד מקמפיין ממומן]',
      dogGender: 'male',
      termsAccepted: false
    },
    {
      id: 'req-orly-deri',
      ownerName: 'אור-לי דרי',
      dogName: 'צ׳ארלי',
      ownerPhone: '052-3337599',
      serviceType: 'boarding',
      status: 'pending',
      startDate: '2026-10-18',
      endDate: '2026-10-22',
      createdAt: '2026-10-12T04:35:00.000Z',
      notes: 'פנייה בוואטסאפ: "בוקר טוב🌸 נגיע השבוע לבקר:) נתעדכן בהקדם על מועד שמתאים לך"',
      internalNotes: '[פנייה לביקור והיכרות - כלב צ׳ארלי]',
      dogGender: 'male',
      termsAccepted: false
    }
  ];

  // Merge so existing requests (like Shani) are preserved
  const existingMap = new Map();
  currentRequests.forEach(r => existingMap.set(r.ownerPhone.replace(/\D/g, '').slice(-7), r));

  leadsToRestore.forEach(lead => {
    const key = lead.ownerPhone.replace(/\D/g, '').slice(-7);
    if (!existingMap.has(key)) {
      existingMap.set(key, lead);
    }
  });

  const merged = Array.from(existingMap.values());
  console.log('Restoring total intake requests:', merged.length);

  const { data, error } = await supabase.from('settings').update({
    data: {
      ...sRow.data,
      intakeRequests: merged
    },
    updated_at: new Date().toISOString()
  }).eq('id', 'resort_config').select();

  if (error) {
    console.error('Error saving restored leads:', error);
  } else {
    console.log('Successfully restored leads to Supabase! Count:', merged.length);
    merged.forEach((r, i) => {
      console.log(`[${i+1}] ${r.ownerName} | Dog: ${r.dogName} | Phone: ${r.ownerPhone} | Status: ${r.status}`);
    });
  }
}
restoreLeads();
