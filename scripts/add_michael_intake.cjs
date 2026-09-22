const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('=== 1. Adding Intake Request for Michael Ben Har (חיימי) ===');
  const { data: sRow, error: sErr } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  if (sErr) throw sErr;

  const currentData = sRow.data || {};
  const intakeRequests = currentData.intakeRequests || [];

  // Check if Michael already exists
  const existingMichael = intakeRequests.find(r => r.ownerPhone?.includes('0586275554') || r.ownerPhone?.includes('058-6275554'));
  if (!existingMichael) {
    const michaelReq = {
      id: `req-${Date.now()}-michael`,
      dogName: 'חיימי',
      dogBreed: 'לברדורית',
      dogAge: '8 חודשים',
      dogGender: 'female',
      dogSize: 'medium',
      isNeutered: false,
      isVaccinated: true,
      isHouseTrained: true,
      isFriendlyWithDogs: 'yes',
      isTreatedParasites: true,
      specialNeeds: 'לברדורית בת 8 חודשים, לא מעוקרת. הגיע עצמאית לריזורט מחריש.',
      ownerName: 'מיכאל בן הר',
      ownerPhone: '058-6275554',
      ownerEmail: '',
      ownerAddress: 'חריש',
      serviceType: 'boarding',
      startDate: '2026-09-22',
      endDate: '2026-09-25',
      status: 'pending',
      clientOrigin: 'whatsapp_lead',
      termsAccepted: true,
      isPhoneVerified: true,
      notes: '[🐾 פנייה בוואטסאפ: מיכאל בן הר - גר בחריש, מעוניין בפנסיון ללברדורית חיימי] | [הגיע לביקור בריזורט]',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    intakeRequests.unshift(michaelReq);
    console.log('Added Michael Ben Har intake request!');
  } else {
    console.log('Michael Ben Har already in list:', existingMichael.id);
  }

  // 2. Also ensure Eyal Berkovich request (Lola + Brandy) is clear
  console.log('\n=== 2. Checking Eyal Berkovich (Lola + Brandy) ===');
  const eyalReq = intakeRequests.find(r => r.id === 'req-1790061069178');
  if (eyalReq) {
    console.log('Eyal Req found: Dog:', eyalReq.dogName, 'Additional:', eyalReq.additionalDogs);
  }

  const { error: upErr } = await supabase.from('settings').update({
    data: {
      ...currentData,
      intakeRequests
    },
    updated_at: new Date().toISOString()
  }).eq('id', 'resort_config');

  if (upErr) throw upErr;
  console.log('Supabase updated successfully!');
}

run().catch(console.error);
