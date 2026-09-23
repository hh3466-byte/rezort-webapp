const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSettingsIntakes() {
  const { data: settingsRows } = await supabase.from('settings').select('*');
  const sRow = settingsRows?.[0] || {};
  const sData = sRow.data || {};
  const intakes = sData.intakeRequests || [];
  const karinI = intakes.filter(i => JSON.stringify(i).includes('קארין') || JSON.stringify(i).includes('0546610321'));
  console.log('Intakes in settings:', JSON.stringify(karinI, null, 2));
}

inspectSettingsIntakes().catch(console.error);
