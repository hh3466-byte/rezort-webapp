import { Booking } from '../types';
import { formatDateIL, formatFullHebrewDate, getTodayStr } from './dateUtils';
import { formatIsraeliPhoneDisplay } from './whatsappUtils';

export type PlacementCategory = 'room' | 'suite' | 'outdoor' | 'home';

export interface PlacementSlotDefinition {
  id: string; // 'room_1'..'room_7', 'suite_1'..'suite_4', 'trail_east', 'trail_west', 'yard_central', 'home'
  name: string; // "חדר 1", "סוויטה 1", "שביל מזרחי", "שביל מערבי", "חצר מרכזית", "הלנה ביתית"
  shortName: string;
  bucketName: string; // "דלי חדר 1", "דלי סוויטה 1", "דלי שביל מזרחי", "דלי שביל מערבי", "דלי חצר מרכזית", "דלי הלנה ביתית"
  category: PlacementCategory;
  icon: string;
  legacyNumber?: number;
}

export const ALL_PLACEMENT_SLOTS: PlacementSlotDefinition[] = [
  // 1. חדרים 1-7
  { id: 'room_1', name: 'חדר 1', shortName: 'חדר 1', bucketName: 'דלי חדר 1', category: 'room', icon: '🚪', legacyNumber: 1 },
  { id: 'room_2', name: 'חדר 2', shortName: 'חדר 2', bucketName: 'דלי חדר 2', category: 'room', icon: '🚪', legacyNumber: 2 },
  { id: 'room_3', name: 'חדר 3', shortName: 'חדר 3', bucketName: 'דלי חדר 3', category: 'room', icon: '🚪', legacyNumber: 3 },
  { id: 'room_4', name: 'חדר 4', shortName: 'חדר 4', bucketName: 'דלי חדר 4', category: 'room', icon: '🚪', legacyNumber: 4 },
  { id: 'room_5', name: 'חדר 5', shortName: 'חדר 5', bucketName: 'דלי חדר 5', category: 'room', icon: '🚪', legacyNumber: 5 },
  { id: 'room_6', name: 'חדר 6', shortName: 'חדר 6', bucketName: 'דלי חדר 6', category: 'room', icon: '🚪', legacyNumber: 6 },
  { id: 'room_7', name: 'חדר 7', shortName: 'חדר 7', bucketName: 'דלי חדר 7', category: 'room', icon: '🚪', legacyNumber: 7 },

  // 2. סוויטות 1-4
  { id: 'suite_1', name: 'סוויטה 1', shortName: 'סוויטה 1', bucketName: 'דלי סוויטה 1', category: 'suite', icon: '⭐', legacyNumber: 8 },
  { id: 'suite_2', name: 'סוויטה 2', shortName: 'סוויטה 2', bucketName: 'דלי סוויטה 2', category: 'suite', icon: '⭐', legacyNumber: 9 },
  { id: 'suite_3', name: 'סוויטה 3', shortName: 'סוויטה 3', bucketName: 'דלי סוויטה 3', category: 'suite', icon: '⭐', legacyNumber: 10 },
  { id: 'suite_4', name: 'סוויטה 4', shortName: 'סוויטה 4', bucketName: 'דלי סוויטה 4', category: 'suite', icon: '⭐', legacyNumber: 11 },

  // 3. שבילים וחצר מרכזית
  { id: 'trail_east', name: 'שביל מזרחי', shortName: 'שביל מזרחי', bucketName: 'דלי שביל מזרחי', category: 'outdoor', icon: '🌲' },
  { id: 'trail_west', name: 'שביל מערבי', shortName: 'שביל מערבי', bucketName: 'דלי שביל מערבי', category: 'outdoor', icon: '🌿' },
  { id: 'yard_central', name: 'חצר מרכזית', shortName: 'חצר מרכזית', bucketName: 'דלי חצר מרכזית', category: 'outdoor', icon: '🌳' },

  // 4. הלנה ביתית (בבית של שמוליק)
  { id: 'home', name: 'הלנה ביתית (בבית של שמוליק)', shortName: 'הלנה ביתית', bucketName: 'דלי הלנה ביתית', category: 'home', icon: '🏡' },
];

/**
 * Normalizes any legacy number, string, or alias to a canonical placement ID.
 */
export function normalizePlacementKey(val: any): string | undefined {
  if (val === undefined || val === null || val === '' || val === 'none') return undefined;
  if (val === 'home' || val === 'הלנה ביתית' || val === 'בית' || val === 'בבית') return 'home';
  if (val === 'trail_east' || val === 'east_trail' || val === 'שביל מזרחי') return 'trail_east';
  if (val === 'trail_west' || val === 'west_trail' || val === 'שביל מערבי') return 'trail_west';
  if (val === 'yard_central' || val === 'central_yard' || val === 'חצר מרכזית' || val === 'חצר') return 'yard_central';
  
  if (typeof val === 'string') {
    const s = val.trim();
    if (s.startsWith('room_') || s.startsWith('room-')) {
      const num = parseInt(s.replace(/\D/g, ''), 10);
      if (num >= 1 && num <= 7) return `room_${num}`;
    }
    if (s.startsWith('suite_') || s.startsWith('suite-')) {
      const num = parseInt(s.replace(/\D/g, ''), 10);
      if (num >= 1 && num <= 4) return `suite_${num}`;
    }
    if (s.includes('חדר')) {
      const num = parseInt(s.replace(/\D/g, ''), 10);
      if (num >= 1 && num <= 7) return `room_${num}`;
    }
    if (s.includes('סוויטה')) {
      const num = parseInt(s.replace(/\D/g, ''), 10);
      if (num >= 1 && num <= 4) return `suite_${num}`;
    }
    if (s.includes('מזרחי')) return 'trail_east';
    if (s.includes('מערבי')) return 'trail_west';
    if (s.includes('מרכזית')) return 'yard_central';
    if (s.includes('תא')) {
      const num = parseInt(s.replace(/\D/g, ''), 10);
      if (num >= 1 && num <= 7) return `room_${num}`;
      if (num >= 8 && num <= 11) return `suite_${num - 7}`;
    }
  }

  const num = Number(val);
  if (!isNaN(num) && num > 0) {
    if (num >= 1 && num <= 7) return `room_${num}`;
    if (num === 8) return 'suite_1';
    if (num === 9) return 'suite_2';
    if (num === 10) return 'suite_3';
    if (num === 11) return 'suite_4';
  }

  return undefined;
}

/**
 * Returns human-readable placement Hebrew title (e.g. "חדר 3", "סוויטה 2", "שביל מזרחי", "הלנה ביתית")
 */
export function getPlacementDisplayName(val: any): string {
  const norm = normalizePlacementKey(val);
  if (!norm) return 'טרם שובץ';
  const slot = ALL_PLACEMENT_SLOTS.find(s => s.id === norm);
  return slot ? slot.name : String(val);
}

/**
 * Returns human-readable short placement name
 */
export function getPlacementShortName(val: any): string {
  const norm = normalizePlacementKey(val);
  if (!norm) return 'ללא שיבוץ';
  const slot = ALL_PLACEMENT_SLOTS.find(s => s.id === norm);
  return slot ? slot.shortName : String(val);
}

export interface KennelSlotData {
  slotId: string; // 'room_1'..'room_7', 'suite_1'..'suite_4', 'trail_east', 'trail_west', 'yard_central', 'home'
  name: string; // "חדר 1", "סוויטה 1", "שביל מזרחי", "שביל מערבי", "חצר מרכזית", "הלנה ביתית (בבית של שמוליק)"
  shortName: string;
  bucketName: string; // "דלי חדר 1", "דלי סוויטה 1", "דלי שביל מזרחי"...
  category: PlacementCategory;
  icon: string;
  dogs: Booking[];
  totalBags: number;
}

/**
 * Groups active staying dogs on a given date into:
 * - 7 Rooms (חדרים 1-7)
 * - 4 Suites (סוויטות 1-4)
 * - 3 Outdoors (שביל מזרחי, שביל מערבי, חצר מרכזית)
 * - Home Boarding (הלנה ביתית)
 * - Unassigned dogs (ממתינים לשיבוץ)
 */
export function getKennelOccupancyForDate(bookings: Booking[], dateStr: string = getTodayStr()) {
  const activeBookings = bookings.filter(b => {
    if (b.stayStatus === 'cancelled') return false;
    return b.startDate <= dateStr && b.endDate >= dateStr;
  });

  const slotDogsMap: { [slotId: string]: Booking[] } = {};
  ALL_PLACEMENT_SLOTS.forEach(s => {
    slotDogsMap[s.id] = [];
  });

  const unassigned: Booking[] = [];

  activeBookings.forEach(b => {
    const norm = normalizePlacementKey(b.kennelNumber);
    if (norm && slotDogsMap[norm]) {
      slotDogsMap[norm].push(b);
    } else {
      unassigned.push(b);
    }
  });

  const allSlots: KennelSlotData[] = ALL_PLACEMENT_SLOTS.map(def => {
    const dogs = slotDogsMap[def.id] || [];
    return {
      slotId: def.id,
      name: def.name,
      shortName: def.shortName,
      bucketName: def.bucketName,
      category: def.category,
      icon: def.icon,
      dogs,
      totalBags: dogs.length,
    };
  });

  const rooms = allSlots.filter(s => s.category === 'room');
  const suites = allSlots.filter(s => s.category === 'suite');
  const outdoors = allSlots.filter(s => s.category === 'outdoor');
  const homeBoarding = allSlots.find(s => s.category === 'home') || allSlots[allSlots.length - 1];

  const occupiedSlotsCount = allSlots.filter(s => s.dogs.length > 0).length;

  return {
    allSlots,
    rooms,
    suites,
    outdoors,
    homeBoarding,
    unassigned,
    totalStaying: activeBookings.length,
    occupiedSlotsCount,
    // Backward compatibility aliases
    kennels: [...rooms, ...suites],
    occupiedKennelsCount: occupiedSlotsCount
  };
}

/**
 * Format structured WhatsApp message for Rooms 1-7, Suites 1-4, Trails & Central Yard, Home Boarding
 */
export function formatKennelsAndFeedingWhatsAppMessage(
  bookings: Booking[],
  dateStr: string = getTodayStr()
): string {
  const { rooms, suites, outdoors, homeBoarding, unassigned, totalStaying, occupiedSlotsCount } = getKennelOccupancyForDate(bookings, dateStr);
  const formattedDate = formatFullHebrewDate(dateStr);

  const lines: string[] = [];
  lines.push(`🪣 *דוח שיבוצי חדרים, סוויטות, שבילים ודליי האכלה – הריזורט לכלב* 🐾`);
  lines.push(`📅 ${formattedDate}`);
  lines.push(`📊 *תפוסה כוללת:* ${totalStaying} כלבים ב-${occupiedSlotsCount} מיקומים פעילים\n`);

  let medCount = 0;

  const renderSlotGroup = (title: string, slots: KennelSlotData[]) => {
    lines.push(title);
    slots.forEach(k => {
      if (k.dogs.length === 0) {
        lines.push(`  ${k.icon} *${k.name} | 🪣 ${k.bucketName}:* פנוי ⚪`);
        return;
      }

      const bagText = k.totalBags === 1 ? 'שקית 1' : `${k.totalBags} שקיות נפרדות`;
      lines.push(`  ${k.icon} *${k.name} | 🪣 ${k.bucketName} (${bagText} - ${k.dogs.length} כלבים):*`);

      k.dogs.forEach((dog, idx) => {
        const dogName = dog.dogName || 'כלב';
        const breed = dog.dogBreed ? ` (${dog.dogBreed})` : '';
        const owner = dog.ownerName ? ` | בעלים: ${dog.ownerName}` : '';
        const phone = dog.ownerPhone ? ` 📞 ${formatIsraeliPhoneDisplay(dog.ownerPhone)}` : '';

        lines.push(`    ${idx + 1}. 🐕 *${dogName}*${breed}${owner}${phone}`);

        const schedule = dog.feedingSchedule?.trim() || '';
        const portion = dog.foodPortion?.trim() || '';
        const diet = dog.specialDiet?.trim() || '';
        const foodDetails = [portion, diet].filter(Boolean).join(' | ');

        if (schedule || foodDetails) {
          lines.push(`       ⏰ *שעות האכלה:* ${schedule || 'כרגיל'} ${foodDetails ? `(${foodDetails})` : ''}`);
        }

        const meds = (dog.medicationSchedule || dog.medications || '').trim();
        if (meds && !meds.includes('אין') && !meds.includes('בריא')) {
          medCount++;
          lines.push(`       💊 *תרופות והנחיות:* ${meds}`);
        }

        if (dog.complexitySurcharge && dog.complexitySurcharge > 0) {
          lines.push(`       💰 *תוספת טיפול מורכב:* ₪${dog.complexitySurcharge}${dog.complexityReason ? ` (${dog.complexityReason})` : ''}`);
        }

        if (dog.placementNotes?.trim()) {
          lines.push(`       🚩 *דגש שיבוץ:* ${dog.placementNotes.trim()}`);
        }
      });
    });
    lines.push('');
  };

  // 1. Rooms 1-7
  renderSlotGroup('🚪 *חדרי אירוח (חדר 1–7):*', rooms);

  // 2. Suites 1-4
  renderSlotGroup('⭐ *סוויטות אירוח (סוויטה 1–4):*', suites);

  // 3. Outdoor Trails & Central Yard
  renderSlotGroup('🌿 *שבילים וחצר מרכזית (שביל מזרחי, שביל מערבי, חצר מרכזית):*', outdoors);

  // 4. Home Boarding (Shmulik's House)
  if (homeBoarding.dogs.length > 0) {
    const bagText = homeBoarding.totalBags === 1 ? 'שקית 1' : `${homeBoarding.totalBags} שקיות נפרדות`;
    lines.push(`🏡 *הלנה ביתית (בבית של שמוליק) | 🪣 דלי הלנה ביתית (${bagText} - ${homeBoarding.dogs.length} כלבים):*`);
    homeBoarding.dogs.forEach((dog, idx) => {
      const dogName = dog.dogName || 'כלב';
      const breed = dog.dogBreed ? ` (${dog.dogBreed})` : '';
      const owner = dog.ownerName ? ` | בעלים: ${dog.ownerName}` : '';
      const phone = dog.ownerPhone ? ` 📞 ${formatIsraeliPhoneDisplay(dog.ownerPhone)}` : '';
      lines.push(`  ${idx + 1}. 🐕 *${dogName}*${breed}${owner}${phone}`);

      const schedule = dog.feedingSchedule?.trim() || '';
      const portion = dog.foodPortion?.trim() || '';
      const diet = dog.specialDiet?.trim() || '';
      const foodDetails = [portion, diet].filter(Boolean).join(' | ');
      if (schedule || foodDetails) {
        lines.push(`     ⏰ *שעות האכלה:* ${schedule || 'כרגיל'} ${foodDetails ? `(${foodDetails})` : ''}`);
      }

      const meds = (dog.medicationSchedule || dog.medications || '').trim();
      if (meds && !meds.includes('אין') && !meds.includes('בריא')) {
        medCount++;
        lines.push(`     💊 *תרופות והנחיות:* ${meds}`);
      }

      if (dog.complexitySurcharge && dog.complexitySurcharge > 0) {
        lines.push(`     💰 *תוספת טיפול מורכב:* ₪${dog.complexitySurcharge}${dog.complexityReason ? ` (${dog.complexityReason})` : ''}`);
      }

      if (dog.placementNotes?.trim()) {
        lines.push(`     🚩 *דגש שיבוץ:* ${dog.placementNotes.trim()}`);
      }
    });
    lines.push('');
  } else {
    lines.push(`🏡 *הלנה ביתית (בבית של שמוליק):* אין כלבים הלילה ⚪\n`);
  }

  // 5. Unassigned dogs
  if (unassigned.length > 0) {
    lines.push(`📋 *כלבים הממתינים לשיבוץ מיקום לינה (${unassigned.length}):*`);
    unassigned.forEach((u, i) => {
      const schedule = u.feedingSchedule ? ` | ⏰ ${u.feedingSchedule}` : '';
      const meds = (u.medicationSchedule || u.medications || '').trim();
      const medText = meds && !meds.includes('אין') ? ` | 💊 ${meds}` : '';
      lines.push(`${i + 1}. 🐕 ${u.dogName} (${u.ownerName})${schedule}${medText}`);
    });
    lines.push('');
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📋 *סיכום:* ${occupiedSlotsCount} מיקומים פעילים | ${totalStaying} שקיות מזון בדליים | ${medCount} כלבים עם תרופות`);
  lines.push(`שיהיה יום רגוע, שמח ומוצלח! ❤️🐶🐾`);

  return lines.join('\n');
}
