import { Booking, ResortSettings } from '../types';

export const defaultSettings: ResortSettings = {
  resortName: 'ריזורט הכלבים והאילוף של שמוליק',
  managerName: 'שמוליק',
  managerPhone: '054-8889900',
  maxCapacity: 16,
  defaultDailyRateBoarding: 180,
  defaultDailyRateTraining: 6500, // תהליך אילוף מלא (50 יום)
  defaultDailyRateDayTraining: 250, // אילוף ביומיות (ללא לינה - מחיר ליום)
  defaultDailyRateCombined: 0,
  defaultDailyRateDaycare: 90,
  bitNumber: '054-8889900',
  payboxLink: 'https://paybox.me/shmulikdogresort',
  bankDetails: 'בנק הפועלים (12), סניף 600, ח-ן 123456 על שם שמוליק',
  autoCheckVaccination: true,
};

// Production clean start: no demo dogs
export const initialBookings: Booking[] = [];
