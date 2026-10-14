const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
let supabaseUrl = '', supabaseKey = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanData() {
  const { data: sRow, error } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  if (error || !sRow) {
    console.error('Fetch error:', error);
    return;
  }

  const list = sRow.data.intakeRequests || [];
  const idsToAbandon = [
    'req-1791117496191', // רון הולצמן (לוקי)
    'req-1791107108931', // Oren Luner Briza Skate (קוקו)
    'req-1791280735390', // ענבר גל (באנה)
    'req-1791470466164', // Ron Gil (בייבי)
    'lead_1791469169000_6350', // מוטי גמבש
    'lead_1791650455000_8049'  // דוד זינו
  ];

  let updatedCount = 0;
  const updatedList = list.map(r => {
    if (idsToAbandon.includes(r.id) && r.status !== 'abandoned') {
      updatedCount++;
      return {
        ...r,
        status: 'abandoned',
        internalNotes: (r.internalNotes || '') + '\n[הועבר לארכיון עקב סימון לא רלוונטי ע"י שמוליק]'
      };
    }
    return r;
  });

  console.log('Items updated to abandoned:', updatedCount);

  const { error: saveErr } = await supabase.from('settings').update({
    data: {
      ...sRow.data,
      intakeRequests: updatedList
    },
    updated_at: new Date().toISOString()
  }).eq('id', 'resort_config');

  if (saveErr) {
    console.error('Save error:', saveErr);
  } else {
    console.log('Successfully updated settings.data.intakeRequests in Supabase!');
  }
}
cleanData();
