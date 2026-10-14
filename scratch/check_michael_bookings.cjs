const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  console.log("=== BOOKINGS FOR MICHAEL ===");
  const { data: bookings, error: bErr } = await supabase
    .from("bookings")
    .select("*");

  if (bookings) {
    const michaelBookings = bookings.filter(b => {
      const str = JSON.stringify(b);
      return str.includes("5554") || str.includes("מיכאל") || str.includes("חיימי");
    });
    console.log("Found", michaelBookings.length, "bookings:");
    for (const b of michaelBookings) {
      console.log({
        id: b.id,
        owner_name: b.owner_name || b.data?.ownerName,
        owner_phone: b.owner_phone || b.data?.ownerPhone,
        dog_name: b.dog_name || b.data?.dogName,
        start_date: b.start_date || b.data?.startDate,
        end_date: b.end_date || b.data?.endDate,
        total_price: b.total_price || b.data?.totalPrice,
        deposit_amount: b.deposit_amount || b.data?.depositAmount,
        payment_status: b.payment_status || b.data?.paymentStatus,
        payment_method: b.payment_method || b.data?.paymentMethod,
        stay_status: b.stay_status || b.data?.stayStatus,
        notes: b.notes || b.data?.notes,
        created_at: b.created_at,
        updated_at: b.updated_at
      });
    }
  } else {
    console.log("Error fetching bookings:", bErr);
  }

  console.log("=== SETTINGS RESORT_CONFIG (DAYCARE PASSES) ===");
  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("id", "resort_config")
    .single();

  if (settings?.data?.daycare_passes) {
    const passes = settings.data.daycare_passes.filter(p => {
      const s = JSON.stringify(p);
      return s.includes("5554") || s.includes("מיכאל") || s.includes("1302") || s.includes("1584");
    });
    console.log("Passes in config:", JSON.stringify(passes, null, 2));
  } else {
    console.log("No daycare_passes found in resort_config");
  }
}

check();
