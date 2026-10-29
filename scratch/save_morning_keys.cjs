const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const MORNING_API_KEY = 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const MORNING_SECRET = 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function updateSettings() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: current } = await supabase.from('settings').select('*').eq('id', 'resort_config').maybeSingle();
  const existingData = current?.data || {};

  const updatedData = {
    ...existingData,
    morning_api_key: MORNING_API_KEY,
    morning_api_secret: MORNING_SECRET
  };

  const { error } = await supabase.from('settings').upsert({
    id: 'resort_config',
    data: updatedData,
    updated_at: new Date().toISOString()
  });

  if (error) {
    console.error('Error updating settings:', error);
  } else {
    console.log('✓ Successfully saved Morning API keys in Supabase settings table!');
  }
}

updateSettings();
