import { createClient } from '@supabase/supabase-js';

const meta = import.meta as any;
const supabaseUrl = meta.env?.VITE_SUPABASE_URL || 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const FALLBACK_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const isValidKey = (k: any): boolean => {
  return typeof k === 'string' && k.length > 30 && !k.includes('your_anon_key');
};

const rawAnonKey = meta.env?.VITE_SUPABASE_ANON_KEY;
const rawPub = meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabaseKey = isValidKey(rawAnonKey)
  ? rawAnonKey
  : isValidKey(rawPub)
  ? rawPub
  : FALLBACK_JWT;

export const supabase = createClient(supabaseUrl, supabaseKey);

