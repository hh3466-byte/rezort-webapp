import { Booking, Customer, ResortSettings } from '../types';
import { defaultSettings, initialBookings } from '../data/initialData';
import { getAllExistingLocalBookings, getLocalSettings } from '../services/dbService';

const STORAGE_KEYS = {
  BOOKINGS: 'dog_resort_bookings',
  LEGACY_BOOKINGS: 'shmulik_dog_resort_bookings_v2',
  SETTINGS: 'dog_resort_settings',
  TUTORIAL_SEEN: 'shmulik_dog_resort_tutorial_seen'
};

export function loadStoredBookings(): Booking[] {
  return getAllExistingLocalBookings();
}

export function resetToDemoData(): { bookings: Booking[]; settings: ResortSettings } {
  try {
    localStorage.removeItem('shmulik_dog_resort_is_cleared');
    localStorage.removeItem('shmulik_dog_resort_deleted_ids');
    localStorage.setItem('dog_resort_bookings', JSON.stringify(initialBookings));
    localStorage.setItem('shmulik_dog_resort_bookings_v2', JSON.stringify(initialBookings));
    localStorage.setItem('dog_resort_settings', JSON.stringify(defaultSettings));
    localStorage.setItem('shmulik_dog_resort_settings_v2', JSON.stringify(defaultSettings));
  } catch (err) {
    console.error('Error resetting demo data:', err);
  }
  return { bookings: initialBookings, settings: defaultSettings };
}

export function clearAllStoredBookings(): void {
  try {
    localStorage.setItem('dog_resort_bookings', JSON.stringify([]));
    localStorage.setItem('shmulik_dog_resort_bookings_v2', JSON.stringify([]));
    localStorage.setItem('shmulik_dog_resort_bookings_v1', JSON.stringify([]));
    localStorage.setItem('shmulik_dog_resort_is_cleared', 'true');
  } catch (e) {}
}

export function saveStoredBookings(bookings: Booking[]): boolean {
  try {
    localStorage.setItem('dog_resort_bookings', JSON.stringify(bookings));
    localStorage.setItem('shmulik_dog_resort_bookings_v2', JSON.stringify(bookings));
    return true;
  } catch (err) {
    console.error('Error saving bookings to localStorage:', err);
    return false;
  }
}

export function loadStoredSettings(): ResortSettings {
  return getLocalSettings();
}

export function saveStoredSettings(settings: ResortSettings): boolean {
  try {
    localStorage.setItem('dog_resort_settings', JSON.stringify(settings));
    localStorage.setItem('shmulik_dog_resort_settings_v2', JSON.stringify(settings));
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
