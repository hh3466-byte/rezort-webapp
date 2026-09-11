import { supabase } from '../utils/supabase';
import { Booking, Customer, ResortSettings, GrowIncomingPayment, IntakeRequest, IntakeRequestStatus } from '../types';
import { initialBookings, defaultSettings } from '../data/initialData';
import { extractCustomers } from '../utils/storage';

const BOOKINGS_TABLE = 'bookings';
const SETTINGS_TABLE = 'settings';
const CUSTOMERS_TABLE = 'customers';
const GROW_PAYMENTS_TABLE = 'grow_incoming_payments';
const INTAKE_REQUESTS_TABLE = 'intake_requests';
const LOCAL_INTAKE_REQUESTS_KEY = 'dog_resort_intake_requests';
const SETTINGS_DOC_ID = 'resort_config';
const DELETED_BOOKINGS_KEY = 'shmulik_dog_resort_deleted_ids';

type Unsubscribe = () => void;

export const getDeletedBookingIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DELETED_BOOKINGS_KEY);
    if (raw) {
      return new Set(JSON.parse(raw));
    }
  } catch (e) {}
  return new Set();
};

export const markBookingAsDeleted = (id: string) => {
  const set = getDeletedBookingIds();
  set.add(id);
  try {
    localStorage.setItem(DELETED_BOOKINGS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {}
};

// Helper to gather all existing bookings across local storage keys + initial data
export const getAllExistingLocalBookings = (): Booking[] => {
  const combinedMap = new Map<string, Booking>();
  const deletedIds = getDeletedBookingIds();

  // Safely cleanup legacy keys
  try {
    localStorage.removeItem('shmulik_dog_resort_bookings_v1');
  } catch (e) {}

  let hasLocalData = false;
  const raw = localStorage.getItem('dog_resort_bookings') || localStorage.getItem('shmulik_dog_resort_bookings_v2');

  if (raw) {
    try {
      const parsed: Booking[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        hasLocalData = true;
        for (const b of parsed) {
          if (b && b.id && !deletedIds.has(b.id)) {
            if ((b.id === 'b-103' || b.dogName === 'ברונו') && (b.serviceType === 'boarding' || (b as any).serviceType === 'combined')) {
              b.serviceType = 'day_training';
              b.stayStatus = 'checked_in';
              b.totalPrice = 1750;
              b.notes = 'אילוף ביומיות ללא לינה - חיזוקים חיוביים';
            }
            combinedMap.set(b.id, b);
          }
        }
      }
    } catch (e) {
      console.warn('Error reading localStorage bookings:', e);
    }
  }

  // Only inject initialBookings if user has completely empty localStorage
  if (!hasLocalData) {
    for (const b of initialBookings) {
      if (!deletedIds.has(b.id)) {
        combinedMap.set(b.id, b);
      }
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
        if (parsed.managerPhone && parsed.managerPhone.includes('8889900')) {
          parsed.managerPhone = defaultSettings.managerPhone;
        }
        if (parsed.whatsappNotificationPhone && parsed.whatsappNotificationPhone.includes('8889900')) {
          parsed.whatsappNotificationPhone = defaultSettings.whatsappNotificationPhone;
        }
        if (parsed.bitNumber && parsed.bitNumber.includes('8889900')) {
          parsed.bitNumber = defaultSettings.bitNumber;
        }
        return { ...defaultSettings, ...parsed };
      }
    } catch (e) {}
  }
  return { ...defaultSettings };
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
    const sanitizePhone = (ph?: string) => (!ph || ph.includes('8889900')) ? defaultSettings.managerPhone : ph;
    const effectivePhone = sanitizePhone(settings.managerPhone || settings.whatsappNotificationPhone);
    const settingsPayload = {
      id: SETTINGS_DOC_ID,
      resort_name: settings.resortName,
      manager_name: settings.managerName,
      manager_phone: effectivePhone,
      max_capacity: settings.maxCapacity,
      default_daily_rate_boarding: settings.defaultDailyRateBoarding,
      default_daily_rate_training: settings.defaultDailyRateTraining,
      default_daily_rate_combined: settings.defaultDailyRateCombined,
      default_daily_rate_daycare: settings.defaultDailyRateDaycare,
      bit_number: sanitizePhone(settings.bitNumber) || effectivePhone,
      paybox_link: settings.payboxLink || settings.growPaymentLink,
      bank_details: settings.bankDetails,
      auto_check_vaccination: settings.autoCheckVaccination,
      data: {
        ...settings,
        managerPhone: effectivePhone,
        whatsappNotificationPhone: effectivePhone,
        bitNumber: sanitizePhone(settings.bitNumber) || effectivePhone
      },
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

let hasPerformedInitialSync = false;
let lastBookingsSignature = '';

// Real-time listener for Bookings via Supabase
export const subscribeToBookings = (
  onData: (bookings: Booking[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  let isSubscribed = true;

  const fetchBookings = async (isInitial = false) => {
    try {
      // NOTE: We deliberately do NOT call syncAllDataToSupabase() automatically here.
      // Supabase is the central source of truth across all devices.
      // Calling sync on startup caused deleted bookings to be re-uploaded from another device's cache!

      const { data, error } = await supabase
        .from(BOOKINGS_TABLE)
        .select('*');

      if (error) {
        console.warn('Supabase fetch bookings error (using local data):', error.message);
        if (isSubscribed) onData(getAllExistingLocalBookings());
        if (onError) onError(new Error(error.message));
        return;
      }

      if (data) {
        // Fetch deleted IDs from local cache
        const localDeletedIds = getDeletedBookingIds();

        if (data.length === 0) {
          try {
            localStorage.setItem('dog_resort_bookings', JSON.stringify([]));
            localStorage.removeItem('shmulik_dog_resort_bookings_v2');
          } catch (e) {}
          lastBookingsSignature = '[]';
          if (isSubscribed) onData([]);
          return;
        }

        const rawBookings: Booking[] = data.map((row: any) => {
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

          if (b.id === 'b-103' || b.dogName === 'ברונו') {
            if (b.serviceType === 'boarding' || (b as any).serviceType === 'combined') {
              b.serviceType = 'day_training';
              b.stayStatus = 'checked_in';
              b.totalPrice = 1750;
              b.notes = 'אילוף ביומיות ללא לינה - חיזוקים חיוביים';
            }
          }

          return b;
        });

        // 1. Filter out any bookings known to be deleted
        const activeBookings = rawBookings.filter(b => {
          if (localDeletedIds.has(b.id)) {
            // Silently purge from Supabase in background
            supabase.from(BOOKINGS_TABLE).delete().eq('id', b.id).catch(() => {});
            return false;
          }
          return true;
        });

        // 2. Automatic Deduplication Guard (e.g. duplicate Joy or Theo)
        const dedupMap = new Map<string, Booking>();
        const duplicateIdsToDelete: string[] = [];

        for (const b of activeBookings) {
          const normDog = (b.dogName || '').trim().toLowerCase();
          const normOwner = (b.ownerName || '').trim().toLowerCase();
          const dedupKey = `${normDog}___${normOwner}___${b.startDate}___${b.endDate}`;

          if (dedupMap.has(dedupKey)) {
            const existing = dedupMap.get(dedupKey)!;
            const existingPaid = existing.paymentStatus === 'fully_paid' || existing.paymentStatus === 'deposit_paid';
            const currentPaid = b.paymentStatus === 'fully_paid' || b.paymentStatus === 'deposit_paid';

            if (currentPaid && !existingPaid) {
              dedupMap.set(dedupKey, b);
              duplicateIdsToDelete.push(existing.id);
            } else {
              duplicateIdsToDelete.push(b.id);
            }
          } else {
            dedupMap.set(dedupKey, b);
          }
        }

        // Purge duplicates from Supabase in background
        if (duplicateIdsToDelete.length > 0) {
          for (const dupId of duplicateIdsToDelete) {
            markBookingAsDeleted(dupId);
            supabase.from(BOOKINGS_TABLE).delete().eq('id', dupId).catch(() => {});
          }
        }

        const bookings = Array.from(dedupMap.values());
        bookings.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        
        const currentSignature = JSON.stringify(bookings.map(b => ({
          id: b.id,
          p: b.paymentStatus,
          d: b.depositAmount,
          t: b.totalPrice,
          s: b.stayStatus,
          sd: b.startDate,
          ed: b.endDate,
        })));

        if (currentSignature === lastBookingsSignature && !isInitial) {
          return; // No real data change, avoid unnecessary state dispatch
        }

        lastBookingsSignature = currentSignature;

        try {
          localStorage.setItem('dog_resort_bookings', JSON.stringify(bookings));
          localStorage.removeItem('shmulik_dog_resort_bookings_v2');
          localStorage.removeItem('shmulik_dog_resort_bookings_v1');
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

  fetchBookings(true);

  const channel = supabase
    .channel('public:bookings')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: BOOKINGS_TABLE },
      () => {
        fetchBookings(false);
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
        const extraData = (data.data && typeof data.data === 'object') ? data.data : {};
        const rawTraining = data.default_daily_rate_training ?? data.defaultDailyRateTraining ?? extraData.defaultDailyRateTraining;
        const validTrainingRate = (rawTraining && Number(rawTraining) >= 1000) ? Number(rawTraining) : 6500;
        const maxCap = data.max_capacity ?? data.maxCapacity ?? extraData.maxCapacity ?? defaultSettings.maxCapacity;

        const sanitizePhone = (ph?: string) => (!ph || ph.includes('8889900')) ? defaultSettings.managerPhone : ph;
        const effectivePhone = sanitizePhone(data.manager_phone || extraData.whatsappNotificationPhone || extraData.managerPhone);

        const settingsData: ResortSettings = {
          ...defaultSettings,
          ...extraData,
          resortName: data.resort_name || data.resortName || extraData.resortName || defaultSettings.resortName,
          managerName: data.manager_name || data.managerName || extraData.managerName || defaultSettings.managerName,
          managerPhone: effectivePhone,
          whatsappNotificationPhone: effectivePhone,
          maxCapacity: Number(maxCap) || defaultSettings.maxCapacity,
          defaultDailyRateBoarding: Number(data.default_daily_rate_boarding ?? extraData.defaultDailyRateBoarding) || defaultSettings.defaultDailyRateBoarding,
          defaultDailyRateTraining: validTrainingRate,
          defaultDailyRateDayTraining: Number(data.default_daily_rate_day_training ?? extraData.defaultDailyRateDayTraining) || 250,
          defaultDailyRateCombined: 0,
          defaultDailyRateDaycare: Number(data.default_daily_rate_daycare ?? extraData.defaultDailyRateDaycare) || defaultSettings.defaultDailyRateDaycare,
          bitNumber: sanitizePhone(data.bit_number || extraData.bitNumber),
          payboxLink: data.paybox_link || extraData.payboxLink || defaultSettings.payboxLink,
          growPaymentLink: extraData.growPaymentLink || data.paybox_link || extraData.payboxLink || defaultSettings.growPaymentLink,
          bankDetails: data.bank_details || extraData.bankDetails || defaultSettings.bankDetails,
          autoCheckVaccination: data.auto_check_vaccination ?? extraData.autoCheckVaccination ?? defaultSettings.autoCheckVaccination,
          callmebotApiKey: extraData.callmebotApiKey || '',
          greenApiIdInstance: extraData.greenApiIdInstance || '',
          greenApiToken: extraData.greenApiToken || '',
          payboxPaymentLink: extraData.payboxPaymentLink || '',
          whatsappBookingConfirmationTemplate: extraData.whatsappBookingConfirmationTemplate || defaultSettings.whatsappBookingConfirmationTemplate,
          whatsappPaymentReminderTemplate: extraData.whatsappPaymentReminderTemplate || defaultSettings.whatsappPaymentReminderTemplate,
        };

        if (!settingsData.defaultDailyRateTraining || Number(settingsData.defaultDailyRateTraining) < 1000) {
          settingsData.defaultDailyRateTraining = 6500;
        }

        // Sync cloud deletedBookingIds to local storage so this device never restores them
        if (Array.isArray(extraData.deletedBookingIds) && extraData.deletedBookingIds.length > 0) {
          try {
            const set = getDeletedBookingIds();
            for (const dId of extraData.deletedBookingIds) {
              set.add(dId);
            }
            localStorage.setItem(DELETED_BOOKINGS_KEY, JSON.stringify(Array.from(set)));
          } catch (e) {}
        }

        try {
          localStorage.setItem('dog_resort_settings', JSON.stringify(settingsData));
          localStorage.removeItem('shmulik_dog_resort_settings_v2');
        } catch (e) {}
        if (isSubscribed) onData(settingsData);
      } else {
        const local = getLocalSettings();
        if (isSubscribed) onData(local);
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
    const json = JSON.stringify(local);
    localStorage.setItem('dog_resort_bookings', json);
    localStorage.setItem('shmulik_dog_resort_bookings_v2', json);
    localStorage.removeItem('shmulik_dog_resort_bookings_v1');
  } catch (e) {}

  try {
    const payload = {
      id: updatedBooking.id,
      dog_name: updatedBooking.dogName,
      dog_breed: updatedBooking.dogBreed || '',
      owner_name: updatedBooking.ownerName,
      owner_phone: updatedBooking.ownerPhone,
      owner_email: updatedBooking.ownerEmail || '',
      service_type: updatedBooking.serviceType,
      start_date: updatedBooking.startDate,
      end_date: updatedBooking.endDate,
      total_price: Number(updatedBooking.totalPrice) || 0,
      deposit_amount: Number(updatedBooking.depositAmount) || 0,
      payment_status: updatedBooking.paymentStatus,
      payment_method: updatedBooking.paymentMethod || 'bit',
      stay_status: updatedBooking.stayStatus,
      notes: updatedBooking.notes || '',
      vaccination_valid: updatedBooking.vaccinationValid ?? true,
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
  markBookingAsDeleted(bookingId);

  // 1. Immediately clean up local storage cache
  try {
    const raw = localStorage.getItem('dog_resort_bookings');
    if (raw) {
      const parsed: Booking[] = JSON.parse(raw);
      const filtered = parsed.filter(b => b.id !== bookingId);
      localStorage.setItem('dog_resort_bookings', JSON.stringify(filtered));
    }
    localStorage.removeItem('shmulik_dog_resort_bookings_v2');
    localStorage.removeItem('shmulik_dog_resort_bookings_v1');
  } catch (e) {}

  // 2. Delete from Supabase with robust retry
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { error } = await supabase
        .from(BOOKINGS_TABLE)
        .delete()
        .eq('id', bookingId);
      if (!error) break;
      console.warn(`Supabase delete booking attempt ${attempt + 1} warning:`, error.message);
    } catch (err: any) {
      console.warn(`Supabase delete booking attempt ${attempt + 1} error:`, err?.message || err);
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // 3. Persist deleted ID in Supabase cloud settings so NO device can EVER resurrect it
  try {
    const { data: currentSettings } = await supabase
      .from(SETTINGS_TABLE)
      .select('data')
      .eq('id', SETTINGS_DOC_ID)
      .single();

    if (currentSettings) {
      const extraData = currentSettings.data || {};
      const deletedIds = new Set<string>(extraData.deletedBookingIds || []);
      deletedIds.add(bookingId);
      const deletedArr = Array.from(deletedIds).slice(-500); // keep last 500
      await supabase
        .from(SETTINGS_TABLE)
        .update({
          data: { ...extraData, deletedBookingIds: deletedArr },
          updated_at: new Date().toISOString()
        })
        .eq('id', SETTINGS_DOC_ID);
    }
  } catch (e) {}
};

// Update Resort Settings in Supabase
export const saveSettingsToDb = async (settings: ResortSettings): Promise<void> => {
  const sanitizePhone = (ph?: string) => (!ph || ph.includes('8889900')) ? defaultSettings.managerPhone : ph;
  const phone = sanitizePhone(settings.whatsappNotificationPhone || settings.managerPhone);

  const sanitizedSettings: ResortSettings = {
    ...settings,
    managerPhone: sanitizePhone(settings.managerPhone) || phone,
    whatsappNotificationPhone: sanitizePhone(settings.whatsappNotificationPhone) || phone,
    bitNumber: sanitizePhone(settings.bitNumber) || phone,
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
      paybox_link: sanitizedSettings.payboxLink || sanitizedSettings.growPaymentLink,
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
    localStorage.setItem('dog_resort_bookings', JSON.stringify([]));
    localStorage.setItem('shmulik_dog_resort_bookings_v2', JSON.stringify([]));
    localStorage.setItem('shmulik_dog_resort_bookings_v1', JSON.stringify([]));
    localStorage.setItem('shmulik_dog_resort_is_cleared', 'true');
  } catch (e) {}

  try {
    const { error: err1 } = await supabase.from(BOOKINGS_TABLE).delete().neq('id', '___none___');
    if (err1) console.warn('Supabase delete bookings warning:', err1.message);
    const { error: err2 } = await supabase.from(CUSTOMERS_TABLE).delete().neq('id', '___none___');
    if (err2) console.warn('Supabase delete customers warning:', err2.message);
  } catch (err: any) {
    console.warn('Supabase clear all warning:', err?.message || err);
  }
};

// =========================================================================
// Real-time Grow Incoming Payments & Drafts Handlers
// =========================================================================

export const subscribeToGrowPayments = (
  callback: (payments: GrowIncomingPayment[]) => void
): Unsubscribe => {
  const fetchPending = async () => {
    try {
      const { data, error } = await supabase
        .from(GROW_PAYMENTS_TABLE)
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching Grow payments:', error.message);
        return;
      }

      if (data) {
        const mapped: GrowIncomingPayment[] = data.map((row: any) => ({
          id: row.id,
          reference_id: row.reference_id,
          customer_name: row.customer_name,
          customer_phone: row.customer_phone,
          customer_email: row.customer_email || '',
          amount: Number(row.amount) || 0,
          payment_method: row.payment_method || 'Bit',
          raw_email_snippet: row.raw_email_snippet || '',
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at
        }));
        callback(mapped);
      }
    } catch (e) {
      console.warn('Grow payments fetch exception:', e);
    }
  };

  fetchPending();

  const channel = supabase
    .channel('public:grow_incoming_payments')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: GROW_PAYMENTS_TABLE },
      () => {
        fetchPending();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const updateGrowPaymentStatus = async (
  id: string,
  status: 'completed' | 'dismissed'
): Promise<void> => {
  try {
    const { error } = await supabase
      .from(GROW_PAYMENTS_TABLE)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.warn('Error updating Grow payment status:', error.message);
    }
  } catch (e) {
    console.warn('Grow payment update exception:', e);
  }
};

/**
 * Load intake requests from local storage
 */
export const loadStoredIntakeRequests = (): IntakeRequest[] => {
  try {
    const raw = localStorage.getItem(LOCAL_INTAKE_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

/**
 * Save a new intake request to Supabase and LocalStorage
 */
export const saveIntakeRequestToDb = async (request: IntakeRequest): Promise<void> => {
  try {
    // 1. Update local storage
    const current = loadStoredIntakeRequests();
    const updated = [request, ...current.filter(r => r.id !== request.id)];
    localStorage.setItem(LOCAL_INTAKE_REQUESTS_KEY, JSON.stringify(updated));

    // 2. Upsert to Supabase intake_requests table
    const { error } = await supabase
      .from(INTAKE_REQUESTS_TABLE)
      .upsert({
        id: request.id,
        created_at: request.createdAt,
        status: request.status,
        owner_name: request.ownerName,
        owner_phone: request.ownerPhone,
        owner_email: request.ownerEmail || '',
        dog_name: request.dogName,
        dog_breed: request.dogBreed || '',
        dog_age: request.dogAge || '',
        dog_size: request.dogSize || 'medium',
        service_type: request.serviceType,
        start_date: request.startDate,
        end_date: request.endDate,
        is_friendly_with_dogs: request.isFriendlyWithDogs,
        is_neutered: request.isNeutered,
        is_vaccinated: request.isVaccinated,
        is_house_trained: request.isHouseTrained !== false,
        is_treated_parasites: request.isTreatedParasites !== false,
        special_needs: request.specialNeeds || '',
        notes: request.notes || '',
        calculated_price: request.calculatedPrice || 0,
        deposit_requested: request.depositRequested || 0,
        internal_notes: request.internalNotes || '',
        data: request
      });

    // 3. Fallback: If table does not exist or fails, save to settings.data.intakeRequests in Supabase
    if (error) {
      console.warn('Supabase save intake request notice (syncing via settings channel):', error.message);
      try {
        const { data: sRow } = await supabase
          .from(SETTINGS_TABLE)
          .select('data')
          .eq('id', SETTINGS_DOC_ID)
          .single();

        const extraData = (sRow && sRow.data && typeof sRow.data === 'object') ? sRow.data : {};
        const existing: IntakeRequest[] = Array.isArray(extraData.intakeRequests) ? extraData.intakeRequests : [];
        const merged = [request, ...existing.filter(r => r.id !== request.id)];

        await supabase
          .from(SETTINGS_TABLE)
          .update({
            data: { ...extraData, intakeRequests: merged },
            updated_at: new Date().toISOString()
          })
          .eq('id', SETTINGS_DOC_ID);
      } catch (fallbackErr) {
        console.warn('Fallback settings intake save error:', fallbackErr);
      }
    }
  } catch (e) {
    console.warn('saveIntakeRequestToDb error:', e);
  }
};

/**
 * Update the status of an intake request
 */
export const updateIntakeRequestStatusInDb = async (
  id: string,
  status: IntakeRequestStatus,
  internalNotes?: string
): Promise<void> => {
  try {
    // 1. Update local storage
    const current = loadStoredIntakeRequests();
    const updated = current.map(r => {
      if (r.id === id) {
        return {
          ...r,
          status,
          internalNotes: internalNotes !== undefined ? internalNotes : r.internalNotes
        };
      }
      return r;
    });
    localStorage.setItem(LOCAL_INTAKE_REQUESTS_KEY, JSON.stringify(updated));

    // 2. Update in Supabase intake_requests table
    const updatePayload: any = { status };
    if (internalNotes !== undefined) updatePayload.internal_notes = internalNotes;

    const { error } = await supabase
      .from(INTAKE_REQUESTS_TABLE)
      .update(updatePayload)
      .eq('id', id);

    // 3. Fallback update in settings.data.intakeRequests
    if (error) {
      try {
        const { data: sRow } = await supabase
          .from(SETTINGS_TABLE)
          .select('data')
          .eq('id', SETTINGS_DOC_ID)
          .single();

        const extraData = (sRow && sRow.data && typeof sRow.data === 'object') ? sRow.data : {};
        const existing: IntakeRequest[] = Array.isArray(extraData.intakeRequests) ? extraData.intakeRequests : [];
        const mapped = existing.map(r => {
          if (r.id === id) {
            return {
              ...r,
              status,
              internalNotes: internalNotes !== undefined ? internalNotes : r.internalNotes
            };
          }
          return r;
        });

        await supabase
          .from(SETTINGS_TABLE)
          .update({
            data: { ...extraData, intakeRequests: mapped },
            updated_at: new Date().toISOString()
          })
          .eq('id', SETTINGS_DOC_ID);
      } catch (e2) {}
    }
  } catch (e) {
    console.warn('updateIntakeRequestStatusInDb error:', e);
  }
};

/**
 * Delete an intake request
 */
export const deleteIntakeRequestFromDb = async (id: string): Promise<void> => {
  try {
    const current = loadStoredIntakeRequests();
    const updated = current.filter(r => r.id !== id);
    localStorage.setItem(LOCAL_INTAKE_REQUESTS_KEY, JSON.stringify(updated));

    const { error } = await supabase
      .from(INTAKE_REQUESTS_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      try {
        const { data: sRow } = await supabase
          .from(SETTINGS_TABLE)
          .select('data')
          .eq('id', SETTINGS_DOC_ID)
          .single();

        const extraData = (sRow && sRow.data && typeof sRow.data === 'object') ? sRow.data : {};
        const existing: IntakeRequest[] = Array.isArray(extraData.intakeRequests) ? extraData.intakeRequests : [];
        const filtered = existing.filter(r => r.id !== id);

        await supabase
          .from(SETTINGS_TABLE)
          .update({
            data: { ...extraData, intakeRequests: filtered },
            updated_at: new Date().toISOString()
          })
          .eq('id', SETTINGS_DOC_ID);
      } catch (e2) {}
    }
  } catch (e) {
    console.warn('deleteIntakeRequestFromDb error:', e);
  }
};

/**
 * Real-time subscription to intake requests
 */
export const subscribeToIntakeRequests = (
  callback: (requests: IntakeRequest[]) => void
): Unsubscribe => {
  // Always emit local data first
  callback(loadStoredIntakeRequests());

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from(INTAKE_REQUESTS_TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet, fallback to reading settings.data.intakeRequests
        try {
          const { data: sRow } = await supabase
            .from(SETTINGS_TABLE)
            .select('data')
            .eq('id', SETTINGS_DOC_ID)
            .single();

          if (sRow?.data?.intakeRequests && Array.isArray(sRow.data.intakeRequests)) {
            const list: IntakeRequest[] = sRow.data.intakeRequests;
            localStorage.setItem(LOCAL_INTAKE_REQUESTS_KEY, JSON.stringify(list));
            callback(list);
            return;
          }
        } catch (e2) {}

        callback(loadStoredIntakeRequests());
        return;
      }

      if (data && data.length > 0) {
        const mapped: IntakeRequest[] = data.map((row: any) => {
          if (row.data && typeof row.data === 'object') {
            return { ...row.data, id: row.id, status: row.status || row.data.status };
          }
          return {
            id: row.id,
            createdAt: row.created_at || new Date().toISOString(),
            status: row.status || 'pending',
            ownerName: row.owner_name,
            ownerPhone: row.owner_phone,
            ownerEmail: row.owner_email || '',
            dogName: row.dog_name,
            dogBreed: row.dog_breed || '',
            dogAge: row.dog_age || '',
            dogSize: row.dog_size || 'medium',
            serviceType: row.service_type || 'boarding',
            startDate: row.start_date,
            endDate: row.end_date,
            isFriendlyWithDogs: row.is_friendly_with_dogs || 'yes',
            isNeutered: Boolean(row.is_neutered),
            isVaccinated: Boolean(row.is_vaccinated),
            isHouseTrained: row.is_house_trained !== undefined ? Boolean(row.is_house_trained) : (row.data?.isHouseTrained !== false),
            isTreatedParasites: row.is_treated_parasites !== undefined ? Boolean(row.is_treated_parasites) : (row.data?.isTreatedParasites !== false),
            specialNeeds: row.special_needs || '',
            notes: row.notes || '',
            calculatedPrice: Number(row.calculated_price) || 0,
            depositRequested: Number(row.deposit_requested) || 0,
            internalNotes: row.internal_notes || '',
          } as IntakeRequest;
        });

        localStorage.setItem(LOCAL_INTAKE_REQUESTS_KEY, JSON.stringify(mapped));
        callback(mapped);
      } else {
        // Check if settings fallback has any
        try {
          const { data: sRow } = await supabase
            .from(SETTINGS_TABLE)
            .select('data')
            .eq('id', SETTINGS_DOC_ID)
            .single();

          if (sRow?.data?.intakeRequests && Array.isArray(sRow.data.intakeRequests) && sRow.data.intakeRequests.length > 0) {
            const list: IntakeRequest[] = sRow.data.intakeRequests;
            localStorage.setItem(LOCAL_INTAKE_REQUESTS_KEY, JSON.stringify(list));
            callback(list);
            return;
          }
        } catch (e2) {}
      }
    } catch (e) {
      callback(loadStoredIntakeRequests());
    }
  };

  fetchRequests();

  const channel = supabase
    .channel('public:intake_requests_all')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: INTAKE_REQUESTS_TABLE },
      () => {
        fetchRequests();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: SETTINGS_TABLE },
      () => {
        fetchRequests();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};


