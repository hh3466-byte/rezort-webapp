const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkSettingsAndLogs() {
  const { data: sData, error: sErr } = await supabase.from('settings').select('*');
  if (sErr) console.error('Settings err:', sErr);
  const d = sData?.[0]?.data || {};
  console.log('last1830SanitySentDate:', d.last1830SanitySentDate);
  console.log('lastTomorrowOverviewSentDate:', d.lastTomorrowOverviewSentDate);
  console.log('last2000DailyUpdateSentDate:', d.last2000DailyUpdateSentDate);
  console.log('autoReplyHistory count:', Object.keys(d.autoReplyHistory || {}).length);
  
  // check tables for logs
  const tables = ['system_logs', 'audit_logs', 'logs', 'cron_logs', 'error_logs', 'messages'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(5);
    if (!error) {
      console.log(`Table ${t} exists! Rows:`, data?.length);
    }
  }
}

checkSettingsAndLogs();
