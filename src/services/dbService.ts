import { supabase } from '../utils/supabase';
import { Booking, Customer, ResortSettings } from '../types';
import { initialBookings, defaultSettings } from '../data/initialData';
import { extractCustomers } from '../utils/storage';

const BOOKINGS_TABLE = 'bookings';
const SETTINGS_TABLE = 'settings';
const CUSTOMERS_TABLE = 'customers';
const SETTINGS_DOC_ID = 'resort_config';

type Unsubscribe = () => void;

// Helper to gather all existing bookings across local storage keys + initial data
export const getAllExistingLocalBookings = (): Booking[] => {
  const combinedMap = new Map<string, Booking>();

  for (const b of initialBookings) {
    combinedMap.set(b.id, b);
  }

  const keysToInspect = [
    'dog_resort_bookings',
    'shmulik_dog_resort_bookings_v2',
    'shmulik_dog_resort_bookings_v1'
  ];

  for (const key of keysToInspect) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed: Booking[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const b of parsed) {
            if (b && b.id) {
              if ((b.id === 'b-103' || b.dogName === 'ברונו') && (b.serviceType === 'boarding' || (b as any).serviceType === 'combined')) {
                b.serviceType = 'day_training';
                b.stayStatus = 'checked_in';
                b.totalPrice = 1750;
                b.notes = 'אילוף ביומיות ללא לינה - חיזוקים חיוביים';
              }
              combinedMap.set(b.id, { ...combinedMap.get(b.id), ...b });
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Error reading localStorage key ${key}:`, e);
    }
  }

  return Array.from(combinedMap.values());
};

export const getLocalSettings = (): ResortSettings => {
  const keysToInspect = ['dog_resort_settings', 'shmulik_dog_resort_settings_v2'];
  for (const key of keysToInspect) {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.defaultDailyRateTraining && Number(parsed.defaultDailyRateTraining) < 1000) {
          parsed.defaultDailyRateTraining = 6500;
        }
        return { ...defaultSettings, ...parsed };
      }
    } catch (e) {}
  }
  return defaultSettings;
};

// Sync all local / past user data (bookings, settings, customers) to Supabase
export const syncAllDataToSupabase = async (): Promise<{ bookingsSynced: number; settingsSynced: boolean; customersSynced: number }> => {
  const allBookings = getAllExistingLocalBookings();
  const settings = getLocalSettings();
  const customers = extractCustomers(allBookings);

  let bookingsSynced = 0;
  let settingsSynced = false;
  let customersSynced = 0;

  try {
    // 1. Sync Settings
    const settingsPayload = {
      id: SETTINGS_DOC_ID,
      resort_name: settings.resortName,
      manager_name: settings.managerName,
      manager_phone: settings.managerPhone,
      max_capacity: settings.maxCapacity,
      default_daily_rate_boarding: settings.defaultDailyRateBoarding,
      default_daily_rate_training: settings.defaultDailyRateTraining,
      default_daily_rate_combined: settings.defaultDailyRateCombined,
      default_daily_rate_daycare: settings.defaultDailyRateDaycare,
      bit_number: settings.bitNumber,
      paybox_link: settings.payboxLink,
      bank_details: settings.bankDetails,
      auto_check_vaccination: settings.autoCheckVaccination,
      data: settings,
      updated_at: new Date().toISOString()
    };

    const { error: settingsErr } = await supabase
      .from(SETTINGS_TABLE)
      .upsert(settingsPayload, { onConflict: 'id' });

    if (!settingsErr) settingsSynced = true;

    // 2. Sync Bookings
    if (allBookings.length > 0) {
      const bookingRecords = allBookings.map(b => ({
        id: b.id,
        dog_name: b.dogName,
        dog_breed: b.dogBreed || '',
        owner_name: b.ownerName,
        owner_phone: b.ownerPhone,
        owner_email: b.ownerEmail || '',
        service_type: b.serviceType,
        start_date: b.startDate,
        end_date: b.endDate,
        total_price: b.totalPrice,
        deposit_amount: b.depositAmount,
        payment_status: b.paymentStatus,
        payment_method: b.paymentMethod || 'bit',
        stay_status: b.stayStatus,
        notes: b.notes || '',
        vaccination_valid: b.vaccinationValid ?? true,
        data: b,
        created_at: b.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: bookingsErr } = await supabase
        .from(BOOKINGS_TABLE)
        .upsert(bookingRecords, { onConflict: 'id' });

      if (!bookingsErr) {
        bookingsSynced = allBookings.length;
      } else {
        // Retry row-by-row fallback
        for (const record of bookingRecords) {
          const { error: singleErr } = await supabase
            .from(BOOKINGS_TABLE)
            .upsert(record, { onConflict: 'id' });
          if (!singleErr) bookingsSynced++;
        }
      }
    }

    // 3. Sync Customers
    if (customers.length > 0) {
      const customerRecords = customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email || '',
        dogs: c.dogs,
        total_visits: c.totalVisits,
        total_spent: c.totalSpent,
        open_debt: c.openDebt,
        is_vip: c.isVip,
        last_visit: c.lastVisit || null,
        notes: c.notes || '',
        data: c,
        updated_at: new Date().toISOString()
      }));

      const { error: custErr } = await supabase
        .from(CUSTOMERS_TABLE)
        .upsert(customerRecords, { onConflict: 'id' });

      if (!custErr) {
        customersSynced = customers.length;
      } else {
        for (const record of customerRecords) {
          const { error: singleErr } = await supabase
            .from(CUSTOMERS_TABLE)
            .upsert(record, { onConflict: 'id' });
          if (!singleErr) customersSynced++;
        }
      }
    }
  } catch (err: any) {
    console.warn('Supabase full sync warning:', err?.message || err);
  }

  return { bookingsSynced, settingsSynced, customersSynced };
};

// Real-time listener for Bookings via Supabase
export const subscribeToBookings = (
  onData: (bookings: Booking[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  let isSubscribed = true;

  const fetchAndSyncBookings = async () => {
    try {
      await syncAllDataToSupabase();

      const { data, error } = await supabase
        .from(BOOKINGS_TABLE)
        .select('*');

      if (error) {
        console.warn('Supabase fetch bookings error (using local data):', error.message);
        if (isSubscribed) onData(getAllExistingLocalBookings());
        if (onError) onError(new Error(error.message));
        return;
      }

      if (data && data.length > 0) {
        let didMigrateBruno = false;
        const bookings: Booking[] = data.map((row: any) => {
          let b: Booking;
          if (row.data && typeof row.data === 'object') {
            b = { ...row.data, id: row.id || row.data.id };
          } else {
            b = {
              id: row.id,
              dogName: row.dog_name || row.dogName,
              dogBreed: row.dog_breed || row.dogBreed || '',
              ownerName: row.owner_name || row.ownerName,
              ownerPhone: row.owner_phone || row.ownerPhone,
              ownerEmail: row.owner_email || row.ownerEmail || '',
              serviceType: row.service_type || row.serviceType || 'boarding',
              startDate: row.start_date || row.startDate,
              endDate: row.end_date || row.endDate,
              totalPrice: Number(row.total_price ?? row.totalPrice ?? 0),
              depositAmount: Number(row.deposit_amount ?? row.depositAmount ?? 0),
              paymentStatus: row.payment_status || row.paymentStatus || 'unpaid',
              paymentMethod: row.payment_method || row.paymentMethod || 'bit',
              stayStatus: row.stay_status || row.stayStatus || 'booked',
              notes: row.notes || '',
              vaccinationValid: Boolean(row.vaccination_valid ?? row.vaccinationValid ?? true),
              createdAt: row.created_at || row.createdAt || new Date().toISOString(),
              updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
            } as Booking;
          }

          // Auto-migrate Bruno to day_training if he was still saved as boarding / combined
          if (b.id === 'b-103' || b.dogName === 'ברונו') {
            if (b.serviceType === 'boarding' || (b as any).serviceType === 'combined') {
              b.serviceType = 'day_training';
              b.stayStatus = 'checked_in';
              b.totalPrice = 1750;
              b.notes = 'אילוף ביומיות ללא לינה - חיזוקים חיוביים';
              didMigrateBruno = true;
            }
          }

          return b;
        });

        if (didMigrateBruno) {
          const bruno = bookings.find(b => b.id === 'b-103' || b.dogName === 'ברונו');
          if (bruno) {
            saveBookingToDb(bruno).catch(() => {});
          }
        }

        bookings.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        
        try {
          localStorage.setItem('dog_resort_bookings', JSON.stringify(bookings));
          localStorage.setItem('shmulik_dog_resort_bookings_v2', JSON.stringify(bookings));
        } catch (e) {}

        if (isSubscribed) onData(bookings);
      } else {
        const existing = getAllExistingLocalBookings();
        if (isSubscribed) onData(existing);
      }
    } catch (err: any) {
      console.warn('Failed to fetch from Supabase:', err?.message || err);
      if (isSubscribed) onData(getAllExistingLocalBookings());
    }
  };

  fetchAndSyncBookings();

  const channel = supabase
    .channel('public:bookings')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: BOOKINGS_TABLE },
      () => {
        fetchAndSyncBookings();
      }
    )
    .subscribe();

  return () => {
    isSubscribed = false;
    supabase.removeChannel(channel);
  };
};

// Real-time listener for Settings via Supabase
export const subscribeToSettings = (
  onData: (settings: ResortSettings) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  let isSubscribed = true;

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from(SETTINGS_TABLE)
        .select('*')
        .eq('id', SETTINGS_DOC_ID)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('Supabase fetch settings error (using local cache):', error.message);
        if (isSubscribed) onData(getLocalSettings());
        if (onError) onError(new Error(error.message));
        return;
      }

      if (data) {
        const rawTraining = data.default_daily_rate_training ?? data.defaultDailyRateTraining ?? data.data?.defaultDailyRateTraining;
        const validTrainingRate = (rawTraining && Number(rawTraining) >= 1000) ? Number(rawTraining) : 6500;
        const maxCap = data.max_capacity ?? data.maxCapacity ?? data.data?.maxCapacity ?? defaultSettings.maxCapacity;

        const settingsData: ResortSettings = {
          resortName: data.resort_name || data.resortName || data.data?.resortName || defaultSettings.resortName,
          managerName: data.manager_name || data.managerName || data.data?.managerName || defaultSettings.managerName,
          managerPhone: data.manager_phone || data.managerPhone || data.data?.managerPhone || defaultSettings.managerPhone,
          maxCapacity: Number(maxCap) || defaultSettings.maxCapacity,
          defaultDailyRateBoarding: Number(data.default_daily_rate_boarding ?? data.defaultDailyRateBoarding ?? data.data?.defaultDailyRateBoarding) || defaultSettings.defaultDailyRateBoarding,
          defaultDailyRateTraining: validTrainingRate,
          defaultDailyRateDayTraining: Number(data.default_daily_rate_day_training ?? data.defaultDailyRateDayTraining ?? data.data?.defaultDailyRateDayTraining) || 250,
          defaultDailyRateCombined: 0,
          defaultDailyRateDaycare: Number(data.default_daily_rate_daycare ?? data.defaultDailyRateDaycare ?? data.data?.defaultDailyRateDaycare) || defaultSettings.defaultDailyRateDaycare,
          bitNumber: data.bit_number || data.bitNumber || data.data?.bitNumber || defaultSettings.bitNumber,
          payboxLink: data.paybox_link || data.payboxLink || data.data?.payboxLink || defaultSettings.payboxLink,
          bankDetails: data.bank_details || data.bankDetails || data.data?.bankDetails || defaultSettings.bankDetails,
          autoCheckVaccination: data.auto_check_vaccination ?? data.autoCheckVaccination ?? data.data?.autoCheckVaccination ?? defaultSettings.autoCheckVaccination,
        };

        if (!settingsData.defaultDailyRateTraining || Number(settingsData.defaultDailyRateTraining) < 1000) {
          settingsData.defaultDailyRateTraining = 6500;
        }

        const merged = { ...defaultSettings, ...settingsData };
        try {
          localStorage.setItem('dog_resort_settings', JSON.stringify(merged));
          localStorage.setItem('shmulik_dog_resort_settings_v2', JSON.stringify(merged));
        } catch (e) {}
        if (isSubscribed) onData(merged);
      } else {
        const local = getLocalSettings();
        if (isSubscribed) onData(local);
        saveSettingsToDb(local).catch(() => {});
      }
    } catch (err: any) {
      console.warn('Failed to fetch settings from Supabase:', err?.message || err);
      if (isSubscribed) onData(getLocalSettings());
    }
  };

  fetchSettings();

  const channel = supabase
    .channel('public:settings')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: SETTINGS_TABLE },
      () => {
        fetchSettings();
      }
    )
    .subscribe();

  return () => {
    isSubscribed = false;
    supabase.removeChannel(channel);
  };
};

// Real-time listener for Customers via Supabase
export const subscribeToCustomers = (
  onData: (customers: Customer[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  let isSubscribed = true;

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from(CUSTOMERS_TABLE)
        .select('*');

      if (error) {
        if (isSubscribed) onData(extractCustomers(getAllExistingLocalBookings()));
        if (onError) onError(new Error(error.message));
        return;
      }

      if (data && data.length > 0) {
        const customers: Customer[] = data.map((row: any) => {
          if (row.data && typeof row.data === 'object') {
            return { ...row.data, id: row.id || row.data.id };
          }
          return {
            id: row.id,
            name: row.name,
            phone: row.phone,
            email: row.email || '',
            dogs: row.dogs || [],
            totalVisits: Number(row.total_visits ?? row.totalVisits ?? 0),
            totalSpent: Number(row.total_spent ?? row.totalSpent ?? 0),
            openDebt: Number(row.open_debt ?? row.openDebt ?? 0),
            isVip: Boolean(row.is_vip ?? row.isVip ?? false),
            lastVisit: row.last_visit || row.lastVisit || undefined,
            notes: row.notes || ''
          } as Customer;
        });

        if (isSubscribed) onData(customers);
      } else {
        const derived = extractCustomers(getAllExistingLocalBookings());
        if (isSubscribed) onData(derived);
      }
    } catch (err: any) {
      if (isSubscribed) onData(extractCustomers(getAllExistingLocalBookings()));
    }
  };

  fetchCustomers();

  const channel = supabase
    .channel('public:customers')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: CUSTOMERS_TABLE },
      () => {
        fetchCustomers();
      }
    )
    .subscribe();

  return () => {
    isSubscribed = false;
    supabase.removeChannel(channel);
  };
};

// Save or Update a Booking in Supabase
export const saveBookingToDb = async (booking: Booking): Promise<void> => {
  const updatedBooking = {
    ...booking,
    updatedAt: new Date().toISOString(),
  };

  try {
    const local = getAllExistingLocalBookings();
    const idx = local.findIndex(b => b.id === booking.id);
    if (idx >= 0) {
      local[idx] = updatedBooking;
    } else {
      local.push(updatedBooking);
    }
    localStorage.setItem('dog_resort_bookings', JSON.stringify(local));
    localStorage.setItem('shmulik_dog_resort_bookings_v2', JSON.stringify(local));
  } catch (e) {}

  try {
    const payload = {
      id: booking.id,
      dog_name: booking.dogName,
      dog_breed: booking.dogBreed || '',
      owner_name: booking.ownerName,
      owner_phone: booking.ownerPhone,
      owner_email: booking.ownerEmail || '',
      service_type: booking.serviceType,
      start_date: booking.startDate,
      end_date: booking.endDate,
      total_price: booking.totalPrice,
      deposit_amount: booking.depositAmount,
      payment_status: booking.paymentStatus,
      payment_method: booking.paymentMethod || 'bit',
      stay_status: booking.stayStatus,
      notes: booking.notes || '',
      vaccination_valid: booking.vaccinationValid ?? true,
      data: updatedBooking,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from(BOOKINGS_TABLE)
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase save booking warning:', error.message);
    }
  } catch (err: any) {
    console.warn('Supabase save error:', err?.message || err);
  }

  // Also refresh customers list in Supabase
  try {
    const all = getAllExistingLocalBookings();
    const customers = extractCustomers(all);
    const customerRecords = customers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      dogs: c.dogs,
      total_visits: c.totalVisits,
      total_spent: c.totalSpent,
      open_debt: c.openDebt,
      is_vip: c.isVip,
      last_visit: c.lastVisit || null,
      notes: c.notes || '',
      data: c,
      updated_at: new Date().toISOString()
    }));
    await supabase.from(CUSTOMERS_TABLE).upsert(customerRecords, { onConflict: 'id' });
  } catch (e) {}
};

// Delete a Booking from Supabase
export const deleteBookingFromDb = async (bookingId: string): Promise<void> => {
  try {
    const local = getAllExistingLocalBookings().filter(b => b.id !== bookingId);
    localStorage.setItem('dog_resort_bookings', JSON.stringify(local));
    localStorage.setItem('shmulik_dog_resort_bookings_v2', JSON.stringify(local));
  } catch (e) {}

  try {
    const { error } = await supabase
      .from(BOOKINGS_TABLE)
      .delete()
      .eq('id', bookingId);

    if (error) {
      console.warn('Supabase delete booking warning:', error.message);
    }
  } catch (err: any) {
    console.warn('Supabase delete error:', err?.message || err);
  }
};

// Update Resort Settings in Supabase
export const saveSettingsToDb = async (settings: ResortSettings): Promise<void> => {
  const sanitizedSettings: ResortSettings = {
    ...settings,
    defaultDailyRateTraining: Number(settings.defaultDailyRateTraining) || 6500,
    defaultDailyRateDayTraining: Number(settings.defaultDailyRateDayTraining) || 250,
  };

  try {
    localStorage.setItem('dog_resort_settings', JSON.stringify(sanitizedSettings));
    localStorage.setItem('shmulik_dog_resort_settings_v2', JSON.stringify(sanitizedSettings));
  } catch (e) {}

  try {
    const payload = {
      id: SETTINGS_DOC_ID,
      resort_name: sanitizedSettings.resortName,
      manager_name: sanitizedSettings.managerName,
      manager_phone: sanitizedSettings.managerPhone,
      max_capacity: sanitizedSettings.maxCapacity,
      default_daily_rate_boarding: sanitizedSettings.defaultDailyRateBoarding,
      default_daily_rate_training: sanitizedSettings.defaultDailyRateTraining,
      default_daily_rate_combined: sanitizedSettings.defaultDailyRateCombined || 0,
      default_daily_rate_daycare: sanitizedSettings.defaultDailyRateDaycare,
      bit_number: sanitizedSettings.bitNumber,
      paybox_link: sanitizedSettings.payboxLink,
      bank_details: sanitizedSettings.bankDetails,
      auto_check_vaccination: sanitizedSettings.autoCheckVaccination,
      data: sanitizedSettings,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from(SETTINGS_TABLE)
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase save settings warning:', error.message);
    }
  } catch (err: any) {
    console.warn('Supabase settings save error:', err?.message || err);
  }
};

// Batch restore bookings
export const batchRestoreToDb = async (
  bookings: Booking[], 
  settings?: ResortSettings
): Promise<void> => {
  try {
    localStorage.setItem('dog_resort_bookings', JSON.stringify(bookings));
    localStorage.setItem('shmulik_dog_resort_bookings_v2', JSON.stringify(bookings));
    if (settings) {
      localStorage.setItem('dog_resort_settings', JSON.stringify(settings));
      localStorage.setItem('shmulik_dog_resort_settings_v2', JSON.stringify(settings));
    }
  } catch (e) {}

  try {
    await supabase.from(BOOKINGS_TABLE).delete().neq('id', '___none___');

    if (bookings.length > 0) {
      const records = bookings.map(b => ({
        id: b.id,
        dog_name: b.dogName,
        dog_breed: b.dogBreed || '',
        owner_name: b.ownerName,
        owner_phone: b.ownerPhone,
        owner_email: b.ownerEmail || '',
        service_type: b.serviceType,
        start_date: b.startDate,
        end_date: b.endDate,
        total_price: b.totalPrice,
        deposit_amount: b.depositAmount,
        payment_status: b.paymentStatus,
        payment_method: b.paymentMethod || 'bit',
        stay_status: b.stayStatus,
        notes: b.notes || '',
        vaccination_valid: b.vaccinationValid ?? true,
        data: b,
        updated_at: new Date().toISOString()
      }));
      await supabase.from(BOOKINGS_TABLE).upsert(records, { onConflict: 'id' });
    }

    if (settings) {
      await saveSettingsToDb(settings);
    }
  } catch (err: any) {
    console.warn('Supabase batch restore warning:', err?.message || err);
  }
};

// Clear all bookings from database
export const clearAllBookingsFromDb = async (): Promise<void> => {
  try {
    localStorage.removeItem('dog_resort_bookings');
    localStorage.removeItem('shmulik_dog_resort_bookings_v2');
    localStorage.removeItem('shmulik_dog_resort_bookings_v1');
  } catch (e) {}

  try {
    await supabase.from(BOOKINGS_TABLE).delete().neq('id', '___none___');
    await supabase.from(CUSTOMERS_TABLE).delete().neq('id', '___none___');
  } catch (err: any) {
    console.warn('Supabase clear all warning:', err?.message || err);
  }
};

// Reset database to demo data
export const resetDbToDemo = async (): Promise<void> => {
  await batchRestoreToDb(initialBookings, defaultSettings);
};
