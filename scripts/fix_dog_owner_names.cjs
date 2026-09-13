const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(supabaseUrl, supabaseKey);

const updates = [
  // 1. Shekel - Dog: תיאו, Owner: הדס שקל (054-5670355)
  {
    id: 'b-grow-507400049',
    dog_name: 'תיאו',
    dog_breed: 'מעורב',
    owner_name: 'הדס שקל',
    owner_phone: '0545670355',
    owner_email: 'shekel.hadas@gmail.com',
    notes: 'תשלום סולק Grow (אסמכתא: 507400049) - שהות יומית לתיאו'
  },
  // 2. Shekel Eyal - Dog: תיאו, Owner: איל שקל (050-5564073)
  {
    id: 'b-1788685190273',
    dog_name: 'תיאו',
    dog_breed: 'מעורב',
    owner_name: 'איל שקל',
    owner_phone: '0505564073',
    owner_email: 'eyal.shekel@outlook.com',
    notes: 'עסקת Grow (אסמכתא: 514721903) | תהליך אילוף (טלפון נוסף: הדס 054-5670355)'
  },
  // 3. Navri Or - Dog: ג'סי, Owner: אור נברי (052-7777787)
  {
    id: 'b-grow-509363691',
    dog_name: "ג'סי",
    dog_breed: 'רוטוויילר מעורב',
    owner_name: 'אור נברי',
    owner_phone: '0527777787',
    owner_email: 'navri38@gmail.com',
    notes: 'תשלום סולק Grow (אסמכתא: 509363691) - שהות פנסיון לג\'סי'
  },
  // 4. Navri Rika - Dog: ג'סי הרוטוויילרית, Owner: ריקה נברי (052-7777737)
  {
    id: 'b-1788697331109',
    dog_name: "ג'סי הרוטוויילרית",
    dog_breed: 'רוטוויילר',
    owner_name: 'ריקה נברי',
    owner_phone: '0527777737',
    owner_email: 'navri@netvision.net.il'
  },
  // 5-8. Yerus Bikaya - Dog: ג'וי (Joy)
  {
    id: 'b-grow-507810263',
    dog_name: "ג'וי",
    dog_breed: 'מעורב',
    owner_name: 'ירוס ביקאיה',
    owner_phone: '0556646093',
    owner_email: 'yerusbikaya54@gmail.com'
  },
  {
    id: 'b-pay-507807309',
    dog_name: "ג'וי",
    dog_breed: 'מעורב',
    owner_name: 'ירוס ביקאיה',
    owner_phone: '0556646093',
    owner_email: 'yerusbikaya54@gmail.com'
  },
  {
    id: 'b-aug-4792995703',
    dog_name: "ג'וי",
    dog_breed: 'מעורב',
    owner_name: 'ירוס ביקאיה',
    owner_phone: '0556646093',
    owner_email: 'yerusbikaya54@gmail.com'
  },
  {
    id: 'b-pay-507806497',
    dog_name: "ג'וי",
    dog_breed: 'מעורב',
    owner_name: 'ירוס ביקאיה',
    owner_phone: '0556646093',
    owner_email: 'yerusbikaya54@gmail.com'
  },
  // 9. Neta Bondi - Dog: הדס
  {
    id: 'b-173783725',
    dog_name: 'הדס',
    dog_breed: 'מעורב',
    owner_name: 'נטע בונדי',
    owner_phone: '0526444845',
    owner_email: 'nettabondi@gmail.com'
  },
  // 10. Eli Kobi - Dog: ונוס
  {
    id: 'b-grow-173090500',
    dog_name: 'ונוס',
    dog_breed: 'מעורב',
    owner_name: 'אלי קובי',
    owner_phone: '0546160220',
    owner_email: 'elikobi@gmail.com'
  },
  // 11. Israel Mandel - Dog: קירה
  {
    id: 'b-grow-512844224',
    dog_name: 'קירה',
    dog_breed: 'מעורב',
    owner_name: 'ישראל מנדל',
    owner_phone: '0505642501',
    owner_email: 'dintex@netvision.net.il'
  },
  // 12. Nava Gafni
  {
    id: 'b-grow-507419993',
    dog_name: 'הכלב של נאוה',
    dog_breed: 'מעורב',
    owner_name: 'נאוה גפני',
    owner_phone: '0545949480',
    owner_email: 'gafni_nava@hotmail.com'
  },
  // 13. Dina Dayan
  {
    id: 'b-grow-4788806274',
    dog_name: 'הכלב של דינה',
    dog_breed: 'מעורב',
    owner_name: 'דינה דיין',
    owner_phone: '0527204572',
    owner_email: 'dinadarom@gmail.com'
  },
  // 14. Asher Reiffman
  {
    id: 'b-grow-171099384',
    dog_name: 'הכלב של אשר',
    dog_breed: 'מעורב',
    owner_name: 'אשר ריפמן',
    owner_phone: '0549420995',
    owner_email: 'areiffman@gmail.com'
  },
  // 15-16. Dalia Moskovich
  {
    id: 'b-grow-171140534',
    dog_name: 'הכלב של דליה',
    dog_breed: 'מעורב',
    owner_name: 'דליה מוסקוביץ',
    owner_phone: '0523669361',
    owner_email: 'daliamoskov@gmail.com'
  },
  {
    id: 'b-grow-171893936',
    dog_name: 'הכלב של דליה',
    dog_breed: 'מעורב',
    owner_name: 'דליה מוסקוביץ',
    owner_phone: '0523669361',
    owner_email: 'daliamoskov@gmail.com'
  },
  // 17-18. David Kaher
  {
    id: 'b-grow-508467767',
    dog_name: 'הכלב של דוד',
    dog_breed: 'מעורב',
    owner_name: 'דוד אלקחר',
    owner_phone: '0542211442',
    owner_email: 'dalkaher@gmail.com'
  },
  {
    id: 'b-grow-510464035',
    dog_name: 'הכלב של דוד',
    dog_breed: 'מעורב',
    owner_name: 'דוד אלקחר',
    owner_phone: '0542211442',
    owner_email: 'dalkaher@gmail.com'
  },
  // 19. Lior Amir
  {
    id: 'b-grow-508442380',
    dog_name: 'הכלב של ליאור',
    dog_breed: 'מעורב',
    owner_name: 'Lior Amir',
    owner_phone: '0503166129',
    owner_email: 'amir.lior@gmail.com'
  },
  // 20-22. Ziv Zissu
  {
    id: 'b-aug-508388527',
    dog_name: 'הכלב של זיו',
    dog_breed: 'מעורב',
    owner_name: 'זיו זיסו',
    owner_phone: '0524577752',
    owner_email: 'ziviisme@gmail.com'
  },
  {
    id: 'b-tx-508390101',
    dog_name: 'הכלב של זיו',
    dog_breed: 'מעורב',
    owner_name: 'זיו זיסו',
    owner_phone: '0524577752',
    owner_email: 'ziviisme@gmail.com'
  },
  {
    id: 'b-grow-510777745',
    dog_name: 'הכלב של זיו',
    dog_breed: 'מעורב',
    owner_name: 'זיו זיסו',
    owner_phone: '0524577752',
    owner_email: 'ziviisme@gmail.com'
  },
  // 23. Mali Sinai
  {
    id: 'b-grow-508629487',
    dog_name: 'הכלב של מלי',
    dog_breed: 'מעורב',
    owner_name: 'מלי סיני',
    owner_phone: '0507585533',
    owner_email: 'mmalisinai30@gmail.com'
  },
  // 24. Ido Shavit
  {
    id: 'b-grow-4810894878',
    dog_name: 'הכלב של עידו',
    dog_breed: 'מעורב',
    owner_name: 'עידו שביט',
    owner_phone: '0546260997',
    owner_email: 'idoshavit6@gmail.com'
  },
  // 25. Yarden Wuntsch
  {
    id: 'b-grow-171863155',
    dog_name: 'הכלב של ירדן',
    dog_breed: 'מעורב',
    owner_name: 'ירדן וונטש',
    owner_phone: '0523752473',
    owner_email: 'yardenwun@gmail.com'
  },
  // 26. Yuval Ashuri
  {
    id: 'b-grow-509681462',
    dog_name: 'הכלב של יובל',
    dog_breed: 'מעורב',
    owner_name: 'יובל אשורי',
    owner_phone: '0526757615',
    owner_email: 'yuvalashuri@gmail.com'
  },
  // 27. Alex Bogatyrev
  {
    id: 'b-grow-4813075012',
    dog_name: 'הכלב של אלכס',
    dog_breed: 'מעורב',
    owner_name: 'אלכס בוגטירב',
    owner_phone: '0507729993',
    owner_email: 'alexeyboga@gmail.com'
  },
  // 28. Lika Kovalenko
  {
    id: 'b-grow-510238566',
    dog_name: 'הכלב של ליקה',
    dog_breed: 'מעורב',
    owner_name: 'ליקה קובלנקו',
    owner_phone: '0504858039',
    owner_email: 'lica.kovalenko1@gmail.com'
  },
  // 29. Eran Avraham Gil
  {
    id: 'b-grow-510793633',
    dog_name: 'הכלב של עירן',
    dog_breed: 'מעורב',
    owner_name: 'עירן אברהם גיל',
    owner_phone: '0547778221',
    owner_email: 'aerangil@gmail.com'
  },
  // 30. Ofir Nidri
  {
    id: 'b-grow-510771399',
    dog_name: 'הכלב של אופיר',
    dog_breed: 'מעורב',
    owner_name: 'אופיר נידרי',
    owner_phone: '0502244873',
    owner_email: ''
  },
  // 31. Omer Lotem
  {
    id: 'b-grow-172804032',
    dog_name: 'הכלב של עומר',
    dog_breed: 'מעורב',
    owner_name: 'עומר לוטם',
    owner_phone: '0524399271',
    owner_email: 'omerlotem12@gmail.com'
  }
];

async function applyUpdates() {
  console.log('Applying dog & owner name updates...');
  for (const item of updates) {
    const { data: current } = await supabase.from('bookings').select('*').eq('id', item.id).single();
    if (!current) {
      console.log(`Booking ${item.id} not found, skipping.`);
      continue;
    }

    const currentData = current.data || {};
    const updatedData = {
      ...currentData,
      dogName: item.dog_name,
      dogBreed: item.dog_breed || current.dog_breed || 'מעורב',
      ownerName: item.owner_name,
      ownerPhone: item.owner_phone,
      ownerEmail: item.owner_email !== undefined ? item.owner_email : current.owner_email
    };
    if (item.notes) {
      updatedData.notes = item.notes;
    }

    const patch = {
      dog_name: item.dog_name,
      dog_breed: item.dog_breed || current.dog_breed || 'מעורב',
      owner_name: item.owner_name,
      owner_phone: item.owner_phone,
      owner_email: item.owner_email !== undefined ? item.owner_email : current.owner_email,
      data: updatedData,
      updated_at: new Date().toISOString()
    };
    if (item.notes) {
      patch.notes = item.notes;
    }

    const { error } = await supabase.from('bookings').update(patch).eq('id', item.id);
    if (error) {
      console.error(`Error updating ${item.id}:`, error);
    } else {
      console.log(`✓ Updated ${item.id}: dog="${item.dog_name}", owner="${item.owner_name}"`);
    }
  }

  console.log('\n--- Verification: Checking all 35 bookings in DB ---');
  const { data: all } = await supabase.from('bookings').select('id, dog_name, owner_name, owner_phone, start_date').order('start_date');
  all.forEach((b, idx) => {
    console.log(`${idx + 1}. [${b.id}] 🐕 כלב: ${b.dog_name} | 👤 בעלים: ${b.owner_name} (${b.owner_phone})`);
  });
}

applyUpdates();
