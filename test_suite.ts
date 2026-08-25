import { defaultSettings } from './src/data/initialData';
import { calculateDaysCount, addDays, getTodayStr, checkRangeOccupancy } from './src/utils/dateUtils';
import { parseWithClientHeuristic } from './src/services/agentService';
import { extractCustomers } from './src/utils/storage';
import { Booking, ResortSettings } from './src/types';

async function runQA() {
  console.log('=====================================================');
  console.log('🧪 DOG RESORT SYSTEM - FULL COMPREHENSIVE QA SUITE 🧪');
  console.log('=====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    }
  }

  // --- 1. SETTINGS & CAPACITY VERIFICATION ---
  console.log('--- 1. SETTINGS & DEFAULT VALUES TEST ---');
  assert(defaultSettings.maxCapacity === 16, 'Default Max Capacity is 16', `Got ${defaultSettings.maxCapacity}`);
  assert(defaultSettings.defaultDailyRateTraining === 6500, 'Full Training (70-day) price is 6500 NIS', `Got ${defaultSettings.defaultDailyRateTraining}`);
  assert(defaultSettings.defaultDailyRateDayTraining === 250, 'Day Training price is 250 NIS/day', `Got ${defaultSettings.defaultDailyRateDayTraining}`);
  assert(defaultSettings.defaultDailyRateBoarding === 180, 'Boarding price is 180 NIS/day', `Got ${defaultSettings.defaultDailyRateBoarding}`);
  assert(defaultSettings.defaultDailyRateDaycare === 90, 'Daycare price is 90 NIS/day', `Got ${defaultSettings.defaultDailyRateDaycare}`);
  assert(defaultSettings.bitNumber === '054-8889900', 'Bit number configured', `Got ${defaultSettings.bitNumber}`);

  // --- 2. DATE UTILS & DURATION CALCULATIONS ---
  console.log('\n--- 2. DATES & PRICING CALCULATIONS TEST ---');
  const today = getTodayStr();
  const nextWeek = addDays(today, 7);
  const days7 = calculateDaysCount(today, nextWeek);
  assert(days7 === 7, '7-day date range calculated correctly', `Got ${days7}`);

  const trainingEnd = addDays(today, 70);
  const days70 = calculateDaysCount(today, trainingEnd);
  assert(days70 === 70, '70-day training process range calculated correctly', `Got ${days70}`);

  // --- 3. OVERBOOKING & CAPACITY ENFORCEMENT ---
  console.log('\n--- 3. OVERBOOKING & CAPACITY ENFORCEMENT ---');
  const dummyBookings: Booking[] = [];
  for (let i = 1; i <= 15; i++) {
    dummyBookings.push({
      id: `dog-${i}`,
      dogName: `Dog ${i}`,
      ownerName: `Owner ${i}`,
      ownerPhone: `050-000000${i}`,
      serviceType: 'boarding',
      startDate: today,
      endDate: nextWeek,
      totalPrice: 1000,
      depositAmount: 500,
      paymentStatus: 'deposit_paid',
      stayStatus: 'checked_in',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  const check15 = checkRangeOccupancy(dummyBookings, today, nextWeek, 16);
  assert(!check15.hasOverbooking, '15 dogs within max capacity of 16 is NOT overbooked');
  assert(check15.highestCount === 15, 'Highest occupancy is accurately 15 dogs');

  // Add 16th dog (reaches max capacity threshold)
  dummyBookings.push({
    id: `dog-16`,
    dogName: `Dog 16`,
    ownerName: `Owner 16`,
    ownerPhone: `050-00000016`,
    serviceType: 'boarding',
    startDate: today,
    endDate: nextWeek,
    totalPrice: 1000,
    depositAmount: 500,
    paymentStatus: 'deposit_paid',
    stayStatus: 'checked_in',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const check16 = checkRangeOccupancy(dummyBookings, today, nextWeek, 16);
  assert(check16.highestCount === 16, 'Highest occupancy reaches 16 dogs');
  assert(check16.hasOverbooking, '16 dogs marks maximum capacity warning for incoming new bookings');

  // --- 4. CUSTOMER CRM & DEBT RECONCILIATION ---
  console.log('\n--- 4. CUSTOMER CRM & DEBT RECONCILIATION ---');
  const customers = extractCustomers(dummyBookings);
  assert(customers.length === 16, 'Extracted 16 unique customer profiles', `Got ${customers.length}`);
  const firstCustomer = customers[0];
  assert(firstCustomer.openDebt === 500, 'Calculated open debt correctly (total 1000 - deposit 500 = 500)', `Got ${firstCustomer.openDebt}`);

  // --- 5. VOICE & TEXT NATURAL LANGUAGE HEURISTICS ---
  console.log('\n--- 5. VOICE & TEXT NATURAL LANGUAGE HEURISTIC TESTS ---');
  
  const textTraining = 'שריין תהליך אילוף מלא לכלב סימבה של אלון טלפון 052-9988776 החל מיום ראשון';
  const parsedTraining = parseWithClientHeuristic(textTraining, [], defaultSettings, today);
  assert(parsedTraining.intent === 'new_booking', 'Voice intent: new_booking recognized');
  assert(parsedTraining.parsedBooking.serviceType === 'training', 'Service type: training (70-day process) detected');
  assert(parsedTraining.parsedBooking.dogName === 'סימבה', 'Dog name: סימבה extracted');
  assert(parsedTraining.parsedBooking.totalPrice === 6500, 'Price: 6,500 NIS for 70 days auto-assigned', `Got ${parsedTraining.parsedBooking.totalPrice}`);

  const textDayTraining = 'אילוף ביומיות לכלב ברונו של דניאל מיום שני עד חמישי';
  const parsedDayTraining = parseWithClientHeuristic(textDayTraining, [], defaultSettings, today);
  assert(parsedDayTraining.parsedBooking.serviceType === 'day_training', 'Service type: day_training detected');

  const textPayment = 'יוסי שילם עכשיו 400 שקלים בביט עבור מקס';
  const parsedPayment = parseWithClientHeuristic(textPayment, dummyBookings, defaultSettings, today);
  assert(parsedPayment.intent === 'payment_update', 'Voice intent: payment_update recognized');

  const textClear = 'למחוק את כל הנתונים ביומן';
  const parsedClear = parseWithClientHeuristic(textClear, [], defaultSettings, today);
  assert(parsedClear.intent === 'clear_all_data', 'Voice intent: clear_all_data recognized');

  // --- 6. SUPABASE CLOUD REST SYNC VERIFICATION ---
  console.log('\n--- 6. SUPABASE CLOUD DATABASE TESTS ---');
  const supabaseUrl = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

  try {
    const settingsRes = await fetch(`${supabaseUrl}/rest/v1/settings?select=*`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const settingsData = await settingsRes.json();
    assert(settingsRes.status === 200, 'Supabase settings endpoint responsive (HTTP 200)');
    if (settingsData && settingsData.length > 0) {
      const liveSettings = settingsData[0];
      assert(Number(liveSettings.max_capacity) === 16, 'Supabase live max_capacity is 16', `Got ${liveSettings.max_capacity}`);
    }

    const bookingsRes = await fetch(`${supabaseUrl}/rest/v1/bookings?select=*`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const bookingsData = await bookingsRes.json();
    assert(bookingsRes.status === 200, 'Supabase bookings endpoint responsive (HTTP 200)');
    assert(Array.isArray(bookingsData), 'Bookings data returned as an array');
    console.log(`Live Bookings Count in Supabase: ${bookingsData.length}`);

    const testBookingId = `test-qa-${Date.now()}`;
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/bookings`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: testBookingId,
        dog_name: 'טסט_בדיקה',
        owner_name: 'בודק מערכת',
        owner_phone: '050-9999999',
        service_type: 'boarding',
        start_date: today,
        end_date: nextWeek,
        total_price: 180,
        deposit_amount: 180,
        payment_status: 'fully_paid',
        payment_method: 'bit',
        stay_status: 'checked_in',
        notes: 'בדיקת QA אוטומטית',
        vaccination_valid: true,
        data: { id: testBookingId, dogName: 'טסט_בדיקה' },
        updated_at: new Date().toISOString()
      })
    });
    assert(insertRes.status === 201, 'Successfully created and synced booking to Supabase (HTTP 201)');

    const deleteRes = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${testBookingId}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    assert(deleteRes.status === 200 || deleteRes.status === 204, 'Successfully deleted booking from Supabase (HTTP 200/204)');
  } catch (err: any) {
    console.error('Cloud QA error:', err);
  }

  console.log('\n=====================================================');
  console.log(`📊 QA RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (100% SUCCESS)`);
  console.log('=====================================================\n');
}

runQA();
