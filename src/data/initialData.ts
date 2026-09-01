import { Booking, ResortSettings } from '../types';

export const defaultSettings: ResortSettings = {
  resortName: 'הריזורט לכלב - פנסיון, אילוף ושיקום התנהגותי',
  managerName: 'צוות הריזורט לכלב',
  managerPhone: '054-8889900',
  maxCapacity: 16,
  defaultDailyRateBoarding: 180,
  defaultDailyRateTraining: 6500, // תהליך אילוף מלא (50 יום)
  defaultDailyRateDayTraining: 250, // אילוף ביומיות (ללא לינה - מחיר ליום)
  defaultDailyRateCombined: 0,
  defaultDailyRateDaycare: 90,
  bitNumber: '054-8889900',
  payboxLink: 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg',
  growPaymentLink: 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg',
  whatsappNotificationPhone: '054-8889900',
  bankDetails: 'בנק הפועלים (12), סניף 600, ח-ן 123456 על שם הריזורט לכלב',
  autoCheckVaccination: true,
};

// Production clean start: no demo dogs
export const initialBookings: Booking[] = [];
