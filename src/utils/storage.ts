import { Booking, Customer, ResortSettings } from '../types';
import { defaultSettings, initialBookings } from '../data/initialData';

const STORAGE_KEYS = {
  BOOKINGS: 'shmulik_dog_resort_bookings_v2',
  LEGACY_BOOKINGS: 'shmulik_dog_resort_bookings_v1',
  SETTINGS: 'shmulik_dog_resort_settings_v2',
  TUTORIAL_SEEN: 'shmulik_dog_resort_tutorial_seen'
};

export function loadStoredBookings(): Booking[] {
  let loadedBookings: Booking[] = [];

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    if (raw) {
      loadedBookings = JSON.parse(raw);
    } else {
      // Check legacy store if exists
      const legacyRaw = localStorage.getItem(STORAGE_KEYS.LEGACY_BOOKINGS);
      if (legacyRaw) {
        const legacyBookings: Booking[] = JSON.parse(legacyRaw);
        loadedBookings = legacyBookings;
        localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(loadedBookings));
      } else {
        // First time initialization
        loadedBookings = initialBookings;
        localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(loadedBookings));
      }
    }
  } catch (err) {
    console.error('Error loading stored bookings:', err);
    loadedBookings = initialBookings;
  }

  return loadedBookings;
}

export function resetToDemoData(): { bookings: Booking[]; settings: ResortSettings } {
  try {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(initialBookings));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
  } catch (err) {
    console.error('Error resetting demo data:', err);
  }
  return { bookings: initialBookings, settings: defaultSettings };
}

export function saveStoredBookings(bookings: Booking[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    return true;
  } catch (err) {
    console.error('Error saving bookings to localStorage:', err);
    return false;
  }
}

export function loadStoredSettings(): ResortSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      return { ...defaultSettings, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Error loading stored settings:', err);
  }
  return defaultSettings;
}

export function saveStoredSettings(settings: ResortSettings): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.error('Error saving settings:', err);
    return false;
  }
}

/**
 * Automatically compute customer list and stats from all bookings
 */
export function extractCustomers(bookings: Booking[]): Customer[] {
  const customerMap = new Map<string, Customer>();

  // Sort bookings by creation date
  const sorted = [...bookings].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  for (const b of sorted) {
    const key = (b.ownerPhone || b.ownerName).trim();
    if (!key) continue;

    const existing = customerMap.get(key);
    const bookingDebt = Math.max(0, b.totalPrice - b.depositAmount);
    const isCompleted = b.stayStatus !== 'cancelled';

    if (!existing) {
      customerMap.set(key, {
        id: `c-${key.replace(/\D/g, '') || Math.random().toString(36).substring(2, 7)}`,
        name: b.ownerName,
        phone: b.ownerPhone,
        email: b.ownerEmail,
        dogs: [{
          name: b.dogName,
          breed: b.dogBreed || '',
          notes: b.notes,
          specialDiet: b.specialDiet
        }],
        totalVisits: isCompleted ? 1 : 0,
        totalSpent: b.depositAmount,
        openDebt: bookingDebt,
        isVip: false,
        lastVisit: b.endDate,
        notes: b.behaviorNotes || ''
      });
    } else {
      // Update existing
      if (isCompleted) existing.totalVisits += 1;
      existing.totalSpent += b.depositAmount;
      existing.openDebt += bookingDebt;
      existing.lastVisit = b.endDate;

      // Add dog if not already listed
      if (!existing.dogs.some(d => d.name.toLowerCase() === b.dogName.toLowerCase())) {
        existing.dogs.push({
          name: b.dogName,
          breed: b.dogBreed || '',
          notes: b.notes,
          specialDiet: b.specialDiet
        });
      }

      existing.isVip = existing.totalVisits >= 3;
    }
  }

  return Array.from(customerMap.values()).map(c => ({
    ...c,
    isVip: c.totalVisits >= 3
  }));
}
