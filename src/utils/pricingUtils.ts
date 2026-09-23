export interface BoardingRateOptions {
  isFriendlyWithDogs?: 'yes' | 'no' | 'depends' | string | boolean;
  dogGender?: 'male' | 'female' | 'male_intact' | 'female_intact' | string;
  isNeutered?: boolean;
  isolationRate?: number;
}

/**
 * Calculate boarding daily rate based on duration and dog profile:
 * - Isolation / aggressive (isFriendlyWithDogs === 'no' / false) OR unneutered male (male_intact or male + isNeutered === false):
 *   Fixed rate of 230 NIS/night (or isolationRate from settings) with NO duration discounts.
 * - Regular dogs:
 *   - 1 to 6 nights: 180 NIS/night (defaultDailyRateBoarding)
 *   - 7 to 20 nights (from 1 week): 150 NIS/night
 *   - 21+ nights (3 weeks and above): 120 NIS/night
 */
export function calculateBoardingRate(
  daysOrNights: number,
  defaultRate: number = 180,
  optionsOrFriendly?: BoardingRateOptions | 'yes' | 'no' | 'depends' | string | boolean,
  isolationRateParam: number = 230
): { dailyRate: number; totalPrice: number; explanation: string; isSpecialRate: boolean } {
  const count = Math.max(1, daysOrNights || 1);
  const isObj = typeof optionsOrFriendly === 'object' && optionsOrFriendly !== null;
  const isFriendlyWithDogs = isObj ? optionsOrFriendly.isFriendlyWithDogs : optionsOrFriendly;
  const dogGender = isObj ? optionsOrFriendly.dogGender : undefined;
  const isNeutered = isObj ? optionsOrFriendly.isNeutered : undefined;
  const isolationRate = (isObj && optionsOrFriendly.isolationRate) ? optionsOrFriendly.isolationRate : (isolationRateParam || 230);

  const isAggressiveOrIsolation = isFriendlyWithDogs === 'no' || isFriendlyWithDogs === false;
  const isMaleIntact = dogGender === 'male_intact' || (dogGender === 'male' && isNeutered === false);

  // 1. Isolation / Aggressive / Unneutered Male: 230 NIS/night (NO duration discount)
  if (isAggressiveOrIsolation || isMaleIntact) {
    const rate = isolationRate || 230;
    let reason = 'בידוד / תוקפני';
    if (isAggressiveOrIsolation && isMaleIntact) {
      reason = 'בידוד / זכר לא מסורס';
    } else if (isMaleIntact) {
      reason = 'זכר לא מסורס';
    }
    return {
      dailyRate: rate,
      totalPrice: count * rate,
      explanation: `${count} לילות × ₪${rate} (${reason})`,
      isSpecialRate: true
    };
  }

  // 2. 21+ nights (3 weeks and up): 120 NIS/night
  if (count >= 21) {
    return {
      dailyRate: 120,
      totalPrice: count * 120,
      explanation: `${count} לילות × ₪120 (מעל 3 שבועות)`,
      isSpecialRate: false
    };
  }

  // 3. 7 to 20 nights (1 week and up): 150 NIS/night
  if (count >= 7) {
    return {
      dailyRate: 150,
      totalPrice: count * 150,
      explanation: `${count} לילות × ₪150 (7 לילות ומעלה)`,
      isSpecialRate: false
    };
  }

  // 4. 1 to 6 nights: 180 NIS/night (default rate)
  const rate = defaultRate || 180;
  return {
    dailyRate: rate,
    totalPrice: count * rate,
    explanation: `${count} לילות × ₪${rate} (עד 6 לילות)`,
    isSpecialRate: false
  };
}
