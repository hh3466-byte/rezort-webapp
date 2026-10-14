const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  console.log("=== GROW INCOMING PAYMENTS ===");
  const { data: grow, error: growErr } = await supabase
    .from("grow_incoming_payments")
    .select("*")
    .or("customer_phone.ilike.%5554%,customer_name.ilike.%מיכאל%,amount.eq.720")
    .order("created_at", { ascending: false });
  console.log("Grow payments:", JSON.stringify(grow, null, 2), growErr);

  console.log("=== DAYCARE PASSES ===");
  const { data: passes, error: passErr } = await supabase
    .from("daycare_passes")
    .select("*")
    .or("phone.ilike.%5554%,owner_name.ilike.%מיכאל%,pass_number.eq.1302");
  console.log("Passes:", JSON.stringify(passes, null, 2), passErr);

  console.log("=== BOOKINGS ===");
  const { data: bookings, error: bErr } = await supabase
    .from("bookings")
    .select("*")
    .or("phone.ilike.%5554%,ownerName.ilike.%מיכאל%,dogName.ilike.%חיימי%")
    .order("created_at", { ascending: false });
  console.log("Bookings:", JSON.stringify(bookings, null, 2), bErr);

  console.log("=== RECENT GROW (ALL) ===");
  const { data: recentGrow } = await supabase
    .from("grow_incoming_payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("Recent Grow:", JSON.stringify(recentGrow, null, 2));

  console.log("=== INTAKE FORMS ===");
  const { data: intakes } = await supabase
    .from("intake_forms")
    .select("*")
    .or("phone.ilike.%5554%,ownerName.ilike.%מיכאל%,dogName.ilike.%חיימי%")
    .order("created_at", { ascending: false });
  console.log("Intakes:", JSON.stringify(intakes, null, 2));
}

check();
