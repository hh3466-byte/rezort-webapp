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

export interface ResortSettings {
  resortName: string;
  managerName: string;
  managerPhone: string;
  maxCapacity: number;
  defaultDailyRateBoarding: number;
  defaultDailyRateTraining: number; // Process price (6,500 NIS for 70 days)
  defaultDailyRateDayTraining: number; // אילוף ביומיות (ללא לינה - מחיר ליום)
  defaultDailyRateCombined?: number;
  defaultDailyRateDaycare: number;
  bitNumber: string;
  payboxLink: string;
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
  | 'reset_to_demo'
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
