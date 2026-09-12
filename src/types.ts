export type ServiceType = 'boarding' | 'training' | 'day_training' | 'daycare' | 'combined';

export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'fully_paid';

export type StayStatus = 'booked' | 'checked_in' | 'checked_out' | 'cancelled';

export type PaymentMethod = 'bit' | 'paybox' | 'cash' | 'credit' | 'bank_transfer' | 'other';

export interface Booking {
  id: string;
  dogName: string;
  dogBreed: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  serviceType: ServiceType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalPrice: number;
  depositAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  stayStatus: StayStatus;
  notes?: string;
  vaccinationValid: boolean;
  specialDiet?: string;
  medications?: string;
  behaviorNotes?: string;
  emergencyContact?: string;
  // Extended fields from the streamlined wizard
  dogAgeGroup?: 'puppy' | 'young' | 'adult' | 'senior';
  dogGender?: 'male_neutered' | 'female_spayed' | 'male_intact' | 'female_intact';
  crateTrained?: boolean;
  vaccinationDates?: { rabies?: string; combo?: string; cough?: string };
  dogPhotoUrl?: string;
  arrivalTime?: string;
  pickupTime?: string;
  extraServices?: { id: string; name: string; price: number }[];
  signatureDataUrl?: string;
  pricingMode?: 'daily' | 'period';
  dailyRate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  email?: string;
  dogs: {
    name: string;
    breed: string;
    notes?: string;
    specialDiet?: string;
  }[];
  totalVisits: number;
  totalSpent: number;
  openDebt: number;
  isVip: boolean; // 3+ visits
  lastVisit?: string;
  notes?: string;
}

export interface GrowIncomingPayment {
  id: string;
  reference_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  amount: number;
  payment_method: string;
  raw_email_snippet?: string;
  status: 'pending' | 'completed' | 'dismissed';
  created_at: string;
  updated_at?: string;
}

export type IntakeRequestStatus = 'pending' | 'payment_requested' | 'approved' | 'rejected';

export interface IntakeRequest {
  id: string;
  createdAt: string;
  status: IntakeRequestStatus;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  dogName: string;
  dogBreed: string;
  dogAge?: string;
  dogSize?: 'small' | 'medium' | 'large' | 'giant';
  serviceType: ServiceType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isFriendlyWithDogs: 'yes' | 'no' | 'depends';
  isNeutered: boolean;
  isVaccinated: boolean;
  isHouseTrained?: boolean; // מחונך לצרכים
  isTreatedParasites?: boolean; // מטופל נגד קרציות ופשפשים
  specialNeeds?: string;
  notes?: string;
  calculatedPrice?: number;
  depositRequested?: number;
  internalNotes?: string;
}

export interface ResortSettings {
  resortName: string;
  managerName: string;
  managerPhone: string;
  maxCapacity: number;
  defaultDailyRateBoarding: number;
  defaultDailyRateTraining: number; // Process price (6,500 NIS for 50 days)
  defaultDailyRateDayTraining: number; // אילוף ביומיות (ללא לינה - מחיר ליום)
  defaultDailyRateCombined?: number;
  defaultDailyRateDaycare: number;
  bitNumber: string;
  payboxLink: string;
  growPaymentLink?: string;
  whatsappNotificationPhone?: string;
  callmebotApiKey?: string;
  greenApiIdInstance?: string;
  greenApiToken?: string;
  bitPaymentLink?: string;
  payboxPaymentLink?: string;
  bankDetails: string;
  autoCheckVaccination: boolean;
  whatsappBookingConfirmationTemplate?: string;
  whatsappPaymentReminderTemplate?: string;
}

export type AgentIntent = 
  | 'new_booking' 
  | 'payment_update' 
  | 'cancel_booking' 
  | 'clear_all_data' 
  | 'backup_data' 
  | 'navigate_tab' 
  | 'query';

export interface AgentActionProposal {
  intent: AgentIntent;
  confidence: number;
  parsedBooking: Partial<Booking>;
  existingBookingId?: string;
  existingBookingMatch?: Booking;
  rawText: string;
  explanation: string;
  targetTab?: 'calendar' | 'forecast' | 'bookings' | 'customers' | 'reports' | 'backup';
  overbookingCheck?: {
    isOverbooked: boolean;
    maxCapacity: number;
    highestOccupancy: number;
    conflictDates: string[];
  };
}

export type TabType = 'calendar' | 'occupancy' | 'bookings' | 'customers' | 'reports' | 'guide';

export type VoucherStatus = 'active' | 'redeemed' | 'expired';

export interface BenefitOption {
  id: string;
  title: string;
  badge: string;
  description: string;
  icon: string;
}

export const RESORT_BENEFIT_OPTIONS: BenefitOption[] = [
  {
    id: 'discount_100',
    title: '100 ₪ הנחה בהזמנה',
    badge: 'הנחה כספית',
    description: 'בהזמנת שהות של 3 ימים ומעלה (סופ״ש ארוך)',
    icon: '💰'
  },
  {
    id: 'late_checkout',
    title: 'צ\'ק-אאוט במוצאי שבת או חג (19:00-21:00)',
    badge: 'שווי ₪100',
    description: 'איסוף מיוחד במוצאי שבת או חג בין 19:00 ל-21:00 ללא תוספת תשלום',
    icon: '🌙'
  },
  {
    id: 'training_consultation',
    title: 'שיחת ייעוץ אילוף והתנהגות עם שמוליק',
    badge: 'שווי ₪250',
    description: 'שיחת ייעוץ אישית 1-על-1 למיקוד בהתנהגות הכלב',
    icon: '🐾'
  },
  {
    id: 'daycare_free',
    title: 'יום שהות יומי (Daycare) / יום כיף 09:00-19:00',
    badge: 'חוויה במתחם',
    description: 'יום כיף ומשחקים במתחם הדשא בין השעות 09:00 ל-19:00 מתנה',
    icon: '☀️'
  },
  {
    id: 'premium_treat',
    title: 'מארז פינוק: עצם לעיסה טבעית + חטיפי בריאות',
    badge: 'פינוק קבלת פנים',
    description: 'מארז חטיפי פרימיום ועצם בקר טבעית מובחרת',
    icon: '🦴'
  },
  {
    id: 'vip_photo',
    title: 'מזכרת צילום VIP מהחופשה לשיתוף ברשתות',
    badge: 'מזכרת דיגיטלית',
    description: 'תמונת איכות מקצועית של הכלב במתחם מוכנה לסטורי',
    icon: '📸'
  },
  {
    id: 'brain_games',
    title: 'סשן משחקי חשיבה והעשרה מנטלית אישי (Brain Games)',
    badge: 'העשרה קוגניטיבית',
    description: 'משחקי רחרוח ופאזלים מותאמים אישית לכלב – מוענק על ידי צוות הריזורט',
    icon: '🧠'
  }
];

export interface DigitalVoucher {
  id: string;
  code: string;
  type: 'loyalty' | 'refer_friend';
  customerName: string;
  dogName: string;
  phone: string;
  benefitText: string;
  selectedBenefitId?: string;
  selectedBenefitText?: string;
  status: VoucherStatus;
  createdAt: string;
  expiryDate: string;
  redeemedAt?: string;
  redeemedByOwner?: string;
  redeemedByDog?: string;
  redeemedBookingId?: string;
  notes?: string;
}
