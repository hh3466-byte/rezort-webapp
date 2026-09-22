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
  placementNotes?: string; // דגשי שיבוץ והוראות מיוחדות (למשל: לשים רק עם ג'נגו / תוקפת דרך גדר)
  emergencyContact?: string;
  ownerAddress?: string; // כתובת מגורים של הבעלים (חיוני לאיתור במקרה בריחה וחירום)
  ownerCoordinates?: { lat: number; lng: number }; // קואורדינטות GPS לניווט ישיר ב-Waze
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
  skipReviewRequest?: boolean;
  isFreeStay?: boolean;
  linkedDogName?: string;
  intakeRequestId?: string;
  lastDailyDogUpdateSent?: string;
  refundAmount?: number;
  refundDate?: string;
  refundNotes?: string;
  refundReason?: string;
  trainerStages?: TrainerPaymentStage[];
  isTrainingCompleted?: boolean;
  trainingCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  email?: string;
  address?: string; // כתובת מגורים
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
  ownerAddress: string; // כתובת מגורים מלאה של הבעלים (שדה חובה לאיתור כלב שברח)
  ownerCoordinates?: { lat: number; lng: number }; // קואורדינטות GPS מזיהוי מיקום
  dogName: string;
  dogBreed: string;
  dogAge?: string;
  dogGender?: 'male' | 'female';
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
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  clientOrigin?: 'new' | 'returning' | 'referral';
  selectedBenefitId?: string;
  voucherCode?: string;
  isPhoneVerified?: boolean;
  isFreeStay?: boolean;
  linkedDogName?: string;
  additionalDogs?: AdditionalDogIntake[];
}

export interface AdditionalDogIntake {
  dogName: string;
  dogBreed: string;
  dogAge?: string;
  dogGender?: 'male' | 'female';
  dogSize?: 'small' | 'medium' | 'large' | 'giant';
  serviceType: ServiceType;
  sameDatesAsPrimary: boolean;
  startDate?: string;
  endDate?: string;
  isFriendlyWithDogs: 'yes' | 'no' | 'depends';
  isNeutered: boolean;
  isVaccinated: boolean;
  isHouseTrained?: boolean;
  isTreatedParasites?: boolean;
  specialNeeds?: string;
  notes?: string;
}

export interface ResortSettings {
  resortName: string;
  managerName: string;
  managerPhone: string;
  maxCapacity: number;
  defaultDailyRateBoarding: number;
  defaultDailyRateIsolation?: number; // תעריף יומי לכלב שחייב בידוד / תוקפני (ברירת מחדל 230 ₪ ליום ללא הנחת תקופה)
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
  lastTomorrowOverviewSentDate?: string;
  lastTomorrowOverviewSentTimestamp?: string;
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
    title: '100 ₪ הנחה ישירה על החופשה',
    badge: 'הטבת מזומן מיידית',
    description: 'חיסכון ישיר של 100 ₪ בהזמנת שהות מפנקת של 3 ימים ומעלה (סופ״ש ארוך)',
    icon: '💰'
  },
  {
    id: 'late_checkout',
    title: 'צ\'ק-אאוט VIP רגוע במוצאי שבת או חג (19:00-21:00)',
    badge: 'שווי ₪100 · ללא לחץ',
    description: 'חזרו מחופשה או מארוחה משפחתית בנחת! איסוף גמיש בערב בין 19:00 ל-21:00 ללא עלות נוספת',
    icon: '🌙'
  },
  {
    id: 'training_consultation',
    title: 'שיחת ייעוץ והדרכת התנהגות אישית 1-על-1 עם שמוליק',
    badge: 'שווי ₪250 · מומחיות וביטחון',
    description: 'שיחה אישית ומעמיקה עם מומחה ההתנהגות של הריזורט – מענה אישי לכל שאלה, טיפים וכלים מעשיים',
    icon: '🐾'
  },
  {
    id: 'daycare_free',
    title: 'יום כיף ושהות יומית VIP במתחם הדשא (09:00-19:00)',
    badge: '10 שעות גן עדן לכלב',
    description: 'יום שלם של מרחבים ירוקים, מתקני מים, משחקים חברתיים מפוקחים ומנוחה מפנקת ומוצלת – מתנה לכלב מאושר!',
    icon: '☀️'
  },
  {
    id: 'premium_treat',
    title: 'מארז שף גורמה: עצם לעיסה טבעית מעושנת + מעדני בריאות',
    badge: 'חוויה קולינרית לכלב',
    description: 'פינוק מלכותי בסוויטה: עצם בקר עסיסית ללעיסה ממושכת וחטיפי פרימיום 100% טבעיים שכלבים משתגעים עליהם!',
    icon: '🦴'
  },
  {
    id: 'vip_photo',
    title: 'בוק צילומי VIP מקצועי מהרגעים היפים בריזורט',
    badge: 'מזכרת מרגשת לסטורי',
    description: 'גלריית תמונות אקשן ודיוקן מרהיבות מהדשא והמשחקים, באיכות גבוהה ומוכנות לשיתוף ולמזכרת לתמיד',
    icon: '📸'
  },
  {
    id: 'brain_games',
    title: 'סשן משחקי חשיבה, רחרוח והעשרה מנטלית (Brain Games)',
    badge: 'מוענק ע״י צוות הריזורט',
    description: 'סשן אישי אחד-על-אחד עם צוות הריזורט: פאזלים אינטראקטיביים ואתגרי הרחה המפתחים חדות ומעניקים סיפוק עמוק',
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

export type TrainerStageType = '1/3' | '2/3' | '3/3' | 'custom';

export interface TrainerPaymentStage {
  stage: TrainerStageType;
  label: string; // e.g. "תשלום 1/3 (ראשון)", "תשלום 2/3 (אמצע)", "תשלום 3/3 (סוף תשלום)"
  amount: number; // default 500 NIS
  isPaidActually: boolean; // האם שולם בפועל ע"י הריזורט
  paidDate?: string;
  paymentMethod?: PaymentMethod;
  receiptNumber?: string; // מס' קבלה מהילה
  receiptDate?: string;
  receiptImageUrl?: string;
  paymentConfirmationUrl?: string; // צילום אישור תשלום ביט שהמנהל שלח
  notes?: string;
  updatedAt: string;
}

export interface TrainerReceiptAllocation {
  bookingId: string;
  dogName: string;
  stage: TrainerStageType;
  amount: number;
}

export interface TrainerReceipt {
  id: string;
  receiptNumber: string;
  receiptDate: string;
  totalAmount: number;
  paymentMethod: string;
  receiptImageUrl?: string;
  rawLineText?: string; // e.g. "גוי תשלום 2/3 + תיאן תשלום 1/3"
  allocations: TrainerReceiptAllocation[];
  isPaidActually: boolean; // האם הועבר בפועל בביט/בנק
  paidDate?: string;
  paymentConfirmationUrl?: string; // צילום אישור ביט/העברה
  bitConfirmationImageUrl?: string; // תמונת אישור ביט
  bitConfirmationNumber?: string; // מספר אישור ב-bit
  paymentConfirmationNotes?: string;
  managerQuerySent: boolean; // האם נשלחה שאלה לוואטסאפ של 0543200007
  managerQuerySentAt?: string;
  status: 'pending_payment' | 'paid' | 'archived';
  createdAt: string;
  updatedAt: string;
}
