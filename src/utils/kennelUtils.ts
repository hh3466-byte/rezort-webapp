import { Booking } from '../types';
import { formatDateIL, formatFullHebrewDate, getTodayStr } from './dateUtils';
import { formatIsraeliPhoneDisplay } from './whatsappUtils';

export interface KennelSlotData {
  kennelId: string | number; // 1..11 or 'home'
  kennelNumber?: number; // 1..11
  isHomeBoarding?: boolean;
  name: string; // "תא 1" ... "תא 11" | "הלנה ביתית (בבית של שמוליק)"
  bucketName: string; // "דלי מס' 1" ... "דלי מס' 11" | "דלי הלנה ביתית"
  dogs: Booking[];
  totalBags: number;
}

/**
 * Groups active staying dogs on a given date into 11 Kennels + Home Boarding + Unassigned.
 */
export function getKennelOccupancyForDate(bookings: Booking[], dateStr: string = getTodayStr()): {
  kennels: KennelSlotData[];
  homeBoarding: KennelSlotData;
  unassigned: Booking[];
  totalStaying: number;
  occupiedKennelsCount: number;
} {
  const activeBookings = bookings.filter(b => {
    if (b.stayStatus === 'cancelled') return false;
    return b.startDate <= dateStr && b.endDate >= dateStr;
  });

  const kennelsMap: { [num: number]: Booking[] } = {};
  for (let i = 1; i <= 11; i++) {
    kennelsMap[i] = [];
  }
  const homeDogs: Booking[] = [];
  const unassigned: Booking[] = [];

  activeBookings.forEach(b => {
    const k = b.kennelNumber;
    if (k === 'home' || k === ('home' as any)) {
      homeDogs.push(b);
    } else if (typeof k === 'number' && k >= 1 && k <= 11) {
      kennelsMap[k].push(b);
    } else if (typeof k === 'string' && Number(k) >= 1 && Number(k) <= 11) {
      kennelsMap[Number(k)].push(b);
    } else {
      unassigned.push(b);
    }
  });

  const kennels: KennelSlotData[] = [];
  let occupiedCount = 0;

  for (let i = 1; i <= 11; i++) {
    const dogsInKennel = kennelsMap[i] || [];
    if (dogsInKennel.length > 0) occupiedCount++;
    kennels.push({
      kennelId: i,
      kennelNumber: i,
      name: `תא ${i}`,
      bucketName: `דלי מס' ${i}`,
      dogs: dogsInKennel,
      totalBags: dogsInKennel.length,
    });
  }

  const homeBoarding: KennelSlotData = {
    kennelId: 'home',
    isHomeBoarding: true,
    name: 'הלנה ביתית (בבית של שמוליק)',
    bucketName: 'דלי הלנה ביתית',
    dogs: homeDogs,
    totalBags: homeDogs.length,
  };

  return {
    kennels,
    homeBoarding,
    unassigned,
    totalStaying: activeBookings.length,
    occupiedKennelsCount: occupiedCount + (homeDogs.length > 0 ? 1 : 0),
  };
}

/**
 * Format structured WhatsApp message for 11 Kennels + Home Boarding & Buckets daily roster
 */
export function formatKennelsAndFeedingWhatsAppMessage(
  bookings: Booking[],
  dateStr: string = getTodayStr()
): string {
  const { kennels, homeBoarding, unassigned, totalStaying, occupiedKennelsCount } = getKennelOccupancyForDate(bookings, dateStr);
  const formattedDate = formatFullHebrewDate(dateStr);

  const lines: string[] = [];
  lines.push(`🪣 *דוח 11 תאים, הלנה ביתית ודליי האכלה – הריזורט לכלב* 🐾`);
  lines.push(`📅 ${formattedDate}`);
  lines.push(`📊 *תפוסה כוללת:* ${totalStaying} כלבים ב-${occupiedKennelsCount} מיקומי לינה\n`);

  let medCount = 0;

  // 1. Kennels 1 to 11
  kennels.forEach(k => {
    const kNum = k.kennelNumber;
    if (k.dogs.length === 0) {
      lines.push(`🏠 *תא ${kNum} | 🪣 דלי מס' ${kNum}:* פנוי ⚪`);
      return;
    }

    const bagText = k.totalBags === 1 ? 'שקית 1' : `${k.totalBags} שקיות נפרדות`;
    lines.push(`🏠 *תא ${kNum} | 🪣 דלי מס' ${kNum} (${bagText} - ${k.dogs.length} כלבים):*`);

    k.dogs.forEach((dog, idx) => {
      const dogName = dog.dogName || 'כלב';
      const breed = dog.dogBreed ? ` (${dog.dogBreed})` : '';
      const owner = dog.ownerName ? ` | בעלים: ${dog.ownerName}` : '';
      const phone = dog.ownerPhone ? ` 📞 ${formatIsraeliPhoneDisplay(dog.ownerPhone)}` : '';

      lines.push(`  ${idx + 1}. 🐕 *${dogName}*${breed}${owner}${phone}`);

      // Feeding schedule & food
      const schedule = dog.feedingSchedule?.trim() || '';
      const portion = dog.foodPortion?.trim() || '';
      const diet = dog.specialDiet?.trim() || '';
      const foodDetails = [portion, diet].filter(Boolean).join(' | ');

      if (schedule || foodDetails) {
        lines.push(`     ⏰ *שעות האכלה:* ${schedule || 'כרגיל'} ${foodDetails ? `(${foodDetails})` : ''}`);
      }

      // Medication
      const meds = (dog.medicationSchedule || dog.medications || '').trim();
      if (meds && !meds.includes('אין') && !meds.includes('בריא')) {
        medCount++;
        lines.push(`     💊 *תרופות והנחיות:* ${meds}`);
      }

      // Complexity surcharge
      if (dog.complexitySurcharge && dog.complexitySurcharge > 0) {
        lines.push(`     💰 *תוספת טיפול מורכב:* ₪${dog.complexitySurcharge}${dog.complexityReason ? ` (${dog.complexityReason})` : ''}`);
      }

      // Placement notes
      if (dog.placementNotes?.trim()) {
        lines.push(`     🚩 *דגש שיבוץ:* ${dog.placementNotes.trim()}`);
      }
    });

    lines.push('');
  });

  // 2. Home Boarding (Shmulik's House)
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

  // 3. Unassigned dogs
  if (unassigned.length > 0) {
    lines.push(`⚠️ *כלבים שטרם שובצו למיקום לינה (${unassigned.length}) - חובה לשבץ תא/בית:*`);
    unassigned.forEach((u, i) => {
      const schedule = u.feedingSchedule ? ` | ⏰ ${u.feedingSchedule}` : '';
      const meds = (u.medicationSchedule || u.medications || '').trim();
      const medText = meds && !meds.includes('אין') ? ` | 💊 ${meds}` : '';
      lines.push(`${i + 1}. 🐕 ${u.dogName} (${u.ownerName})${schedule}${medText}`);
    });
    lines.push('');
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📋 *סיכום:* ${occupiedKennelsCount} מיקומים פעילים | ${totalStaying} שקיות מזון בדליים | ${medCount} כלבים עם תרופות`);
  lines.push(`שיהיה יום רגוע, שמח ומוצלח! ❤️🐶🐾`);

  return lines.join('\n');
}
