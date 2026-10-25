import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  User, 
  Phone, 
  Dog, 
  Share2, 
  Clock, 
  Ticket, 
  Copy, 
  Check, 
  Search, 
  AlertCircle,
  CreditCard,
  Layers,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  CalendarDays,
  ExternalLink,
  Link2,
  DollarSign,
  Send,
  Loader2,
  Trash2,
  Lock,
  Sun,
  Moon,
  Pencil,
  Receipt,
  ChevronUp,
  ChevronDown,
  Repeat,
  ArrowLeftRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  Booking, 
  Customer, 
  DaycarePass, 
  PassUsageEntry, 
  PaymentMethod, 
  PaymentStatus, 
  ResortSettings,
  IntakeRequest
} from '../types';
import { 
  loadStoredDaycarePasses, 
  saveDaycarePassToDb, 
  deleteDaycarePassFromDb,
  deductDayFromPassInDb,
  transferDaysBetweenPassesInDb,
  subscribeToDaycarePasses 
} from '../services/dbService';
import { createGrowDynamicPaymentLink } from '../services/growPaymentService';
import { sendMessage } from '../services/whatsappCrmService';
import { openWhatsAppMessage, cleanPhoneNumber, getFirstName } from '../utils/whatsappUtils';
import { formatDateIL, getTodayStr, addDays, calculateDaysCount } from '../utils/dateUtils';

export interface UnifiedCustomerCandidate {
  id: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  ownerAddress?: string;
  dogName: string;
  dogBreed?: string;
  specialDiet?: string;
  notes?: string;
  source: 'booking' | 'intake' | 'pass';
  sourceLabel: string;
}

/**
 * Progressive discount calculation for Daycare passes:
 * - Base price for 1 day = 90 NIS
 * - Price drops down to 75 NIS/day for 10 days in a linear progression:
 *   (1.5 NIS discount per day for each day, capped at 15 NIS discount)
 * - 1 day: 90 NIS/day (90 NIS)
 * - 5 days: 82.5 NIS/day (412.5 NIS)
 * - 10 days: 75 NIS/day (750 NIS - savings of 150 NIS!)
 * - >10 days: 75 NIS/day (e.g. 15 days = 1,125 NIS)
 */
export function getDaycareProgressiveRate(days: number, baseRate: number = 90): {
  dailyRate: number;
  totalPrice: number;
  discountPerDay: number;
  totalSavings: number;
} {
  const d = Math.max(1, Math.round(Number(days) || 1));
  if (d === 1) {
    return {
      dailyRate: baseRate,
      totalPrice: baseRate,
      discountPerDay: 0,
      totalSavings: 0
    };
  }
  const discountPerDay = Math.min(15, d * 1.5);
  const dailyRate = Math.max(75, baseRate - discountPerDay);
  const totalPrice = Math.round(dailyRate * d * 10) / 10;
  const regularTotal = baseRate * d;
  const totalSavings = Math.max(0, regularTotal - totalPrice);

  return { dailyRate, totalPrice, discountPerDay, totalSavings };
}

interface DaycarePassModalProps {
  settings: ResortSettings;
  customers: Customer[];
  bookings: Booking[];
  intakeRequests?: IntakeRequest[];
  initialCustomer?: {
    ownerName?: string;
    ownerPhone?: string;
    dogName?: string;
    dogBreed?: string;
    ownerEmail?: string;
  } | null;
  onClose: () => void;
  onSaveBooking: (booking: Booking) => Promise<void> | void;
}

export const DaycarePassModal: React.FC<DaycarePassModalProps> = ({
  settings,
  customers,
  bookings,
  intakeRequests = [],
  initialCustomer,
  onClose,
  onSaveBooking
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [passesList, setPassesList] = useState<DaycarePass[]>(() => loadStoredDaycarePasses());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPassForBooking, setSelectedPassForBooking] = useState<DaycarePass | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(getTodayStr());
  const [bookingEndDate, setBookingEndDate] = useState<string>(getTodayStr());
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [createdPassResult, setCreatedPassResult] = useState<DaycarePass | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingGrowLink, setIsGeneratingGrowLink] = useState(false);
  const [autoSentDirectly, setAutoSentDirectly] = useState(false);

  // Editing / Calibrating an existing pass
  // Filter & UI states for Pass List
  const [listFilter, setListFilter] = useState<'all' | 'paid' | 'pending' | 'unsent'>('all');
  const [expandedDaysPassIds, setExpandedDaysPassIds] = useState<Set<string>>(new Set());

  // Quick Payment & Reference Management Modal state
  const [paymentModalPass, setPaymentModalPass] = useState<DaycarePass | null>(null);
  const [payModalStatus, setPayModalStatus] = useState<PaymentStatus>('fully_paid');
  const [payModalReference, setPayModalReference] = useState<string>('');
  const [payModalMethod, setPayModalMethod] = useState<string>('Grow (אשראי / Bit)');
  const [payModalAmount, setPayModalAmount] = useState<number | string>(0);
  const [payModalDate, setPayModalDate] = useState<string>(getTodayStr());
  const [payModalNotes, setPayModalNotes] = useState<string>('');
  const [isSavingPaymentModal, setIsSavingPaymentModal] = useState<boolean>(false);

  // Editing / Calibrating an existing pass
  const [editingPass, setEditingPass] = useState<DaycarePass | null>(null);
  const [editDogName, setEditDogName] = useState<string>('');
  const [editTotalDays, setEditTotalDays] = useState<number | string>(10);
  const [editUsedDays, setEditUsedDays] = useState<number | string>(0);
  const [editPricePaid, setEditPricePaid] = useState<number | string>(750);
  const [editPaymentStatus, setEditPaymentStatus] = useState<PaymentStatus>('fully_paid');
  const [editPaymentReference, setEditPaymentReference] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('Grow (אשראי / Bit)');
  const [editPaidAt, setEditPaidAt] = useState<string>('');
  const [editSentAt, setEditSentAt] = useState<string>('');
  const [editSentToPhone, setEditSentToPhone] = useState<string>('');
  const [editPaymentUrl, setEditPaymentUrl] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editValidUntil, setEditValidUntil] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Transfer Days Between Passes / Dogs Modal State
  const [transferModal, setTransferModal] = useState<{
    isOpen: boolean;
    sourcePassId: string;
    targetPassId: string;
    daysCount: number | string;
    reason: string;
  } | null>(null);
  const [isSavingTransfer, setIsSavingTransfer] = useState<boolean>(false);

  // Form State for creating a new pass
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [selectedCandidate, setSelectedCandidate] = useState<UnifiedCustomerCandidate | null>(null);
  const [dogName, setDogName] = useState<string>('');
  const [dogBreed, setDogBreed] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [ownerPhone, setOwnerPhone] = useState<string>('');
  const [ownerEmail, setOwnerEmail] = useState<string>('');
  const [ownerAddress, setOwnerAddress] = useState<string>('');
  const [serviceType, setServiceType] = useState<'daycare' | 'day_training' | 'boarding'>('daycare');
  
  // Initialize with 10 days progressive rate
  const initialDays = 10;
  const initialRates = getDaycareProgressiveRate(initialDays, settings.defaultDailyRateDaycare || 90);
  const [totalDays, setTotalDays] = useState<number | string>(initialDays);
  const [dailyRate, setDailyRate] = useState<number>(initialRates.dailyRate);
  const [pricePaid, setPricePaid] = useState<number | string>(initialRates.totalPrice);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('fully_paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bit');
  const [customNotes, setCustomNotes] = useState<string>('');

  // Live reactive pricing and rate derivations
  const numericPricePaid = typeof pricePaid === 'number' 
    ? pricePaid 
    : (pricePaid === '' ? 0 : parseFloat(pricePaid) || 0);
  const numTotalDays = typeof totalDays === 'number' 
    ? totalDays 
    : (totalDays === '' ? 1 : parseInt(totalDays, 10) || 1);
  const effectiveDays = numTotalDays;
  const effectiveDailyRate = effectiveDays > 0 ? Math.round((numericPricePaid / effectiveDays) * 10) / 10 : 0;
  const baseStandardRate = serviceType === 'boarding' 
    ? 180 
    : serviceType === 'day_training' 
    ? (settings.defaultDailyRateDayTraining || 250) 
    : (settings.defaultDailyRateDaycare || 90);
  const standardTotalPrice = baseStandardRate * effectiveDays;
  const effectiveSavings = Math.max(0, standardTotalPrice - numericPricePaid);

  // Subscribe to real-time daycare passes updates
  useEffect(() => {
    const unsub = subscribeToDaycarePasses((updatedList) => {
      setPassesList(updatedList);
    });
    return () => unsub();
  }, []);

  // Pre-fill initial customer if provided
  useEffect(() => {
    if (initialCustomer) {
      if (initialCustomer.ownerName) setOwnerName(initialCustomer.ownerName);
      if (initialCustomer.ownerPhone) setOwnerPhone(initialCustomer.ownerPhone);
      if (initialCustomer.dogName) setDogName(initialCustomer.dogName);
      if (initialCustomer.dogBreed) setDogBreed(initialCustomer.dogBreed);
      if (initialCustomer.ownerEmail) setOwnerEmail(initialCustomer.ownerEmail);
      setSelectedCandidate({
        id: 'initial',
        ownerName: initialCustomer.ownerName || '',
        ownerPhone: initialCustomer.ownerPhone || '',
        ownerEmail: initialCustomer.ownerEmail || '',
        dogName: initialCustomer.dogName || '',
        dogBreed: initialCustomer.dogBreed || '',
        source: 'intake',
        sourceLabel: 'לקוח נוכחי'
      });
    }
  }, [initialCustomer]);

  // Build unified customer candidates pool from Bookings, Intake Requests and Passes with cross-record enrichment
  const allCandidates = React.useMemo<UnifiedCustomerCandidate[]>(() => {
    const map = new Map<string, UnifiedCustomerCandidate>();

    // Build phone-to-meta lookup from bookings and intakes to ensure email/address/notes are NEVER missing
    const phoneEnrichmentMap = new Map<string, { email?: string; address?: string; diet?: string; notes?: string; breed?: string }>();

    for (const b of (bookings || [])) {
      const p = (b.ownerPhone || '').replace(/\D/g, '').slice(-9);
      if (p) {
        const cur = phoneEnrichmentMap.get(p) || {};
        const bAny = b as any;
        phoneEnrichmentMap.set(p, {
          email: cur.email || b.ownerEmail || bAny.owner_email || (bAny.data && bAny.data.ownerEmail) || undefined,
          address: cur.address || b.ownerAddress || bAny.owner_address || (bAny.data && bAny.data.ownerAddress) || undefined,
          diet: cur.diet || b.specialDiet || (bAny.data && bAny.data.specialDiet) || undefined,
          notes: cur.notes || (bAny.data && bAny.data.notes) || undefined,
          breed: cur.breed || b.dogBreed || (bAny.data && bAny.data.dogBreed) || undefined,
        });
      }
    }

    for (const req of (intakeRequests || [])) {
      const p = (req.ownerPhone || '').replace(/\D/g, '').slice(-9);
      if (p) {
        const cur = phoneEnrichmentMap.get(p) || {};
        phoneEnrichmentMap.set(p, {
          email: cur.email || req.ownerEmail || undefined,
          address: cur.address || req.ownerAddress || undefined,
          diet: cur.diet || req.specialNeeds || req.specialDiet || undefined,
          notes: cur.notes || req.notes || req.internalNotes || undefined,
          breed: cur.breed || req.dogBreed || undefined,
        });
      }
    }

    const makeKey = (phone: string, dog: string) => {
      const cleanP = (phone || '').replace(/\D/g, '').slice(-9);
      const cleanD = (dog || '').trim().toLowerCase();
      return `${cleanP}_${cleanD}`;
    };

    // 1. From intakeRequests (includes Michael Ben Har - Haimi, etc.)
    if (intakeRequests && intakeRequests.length > 0) {
      for (const req of intakeRequests) {
        if (!req.ownerName?.trim() && !req.dogName?.trim()) continue;
        const cleanP = (req.ownerPhone || '').replace(/\D/g, '').slice(-9);
        const enriched = phoneEnrichmentMap.get(cleanP) || {};
        const key = makeKey(req.ownerPhone || '', req.dogName || '');
        if (key && !map.has(key)) {
          map.set(key, {
            id: `intake-${req.id}`,
            ownerName: req.ownerName || '',
            ownerPhone: req.ownerPhone || '',
            ownerEmail: req.ownerEmail || enriched.email || '',
            ownerAddress: req.ownerAddress || enriched.address || '',
            dogName: req.additionalDogs && req.additionalDogs.length > 0
              ? [req.dogName, ...req.additionalDogs.map(d => d.dogName)].filter(Boolean).join(' ו')
              : (req.dogName || ''),
            dogBreed: req.additionalDogs && req.additionalDogs.length > 0
              ? [req.dogBreed, ...req.additionalDogs.map(d => d.dogBreed)].filter(Boolean).join(' + ')
              : (req.dogBreed || enriched.breed || ''),
            specialDiet: req.specialNeeds || req.specialDiet || enriched.diet || '',
            notes: req.notes || req.internalNotes || enriched.notes || '',
            source: 'intake',
            sourceLabel: 'שאלון קליטה / ליד'
          });
        }
      }
    }

    // 2. From bookings directly
    if (bookings && bookings.length > 0) {
      for (const b of bookings) {
        if (!b.ownerName?.trim() && !b.dogName?.trim()) continue;
        const cleanP = (b.ownerPhone || '').replace(/\D/g, '').slice(-9);
        const enriched = phoneEnrichmentMap.get(cleanP) || {};
        const key = makeKey(b.ownerPhone || '', b.dogName || '');
        if (key && !map.has(key)) {
          const bAny = b as any;
          map.set(key, {
            id: `bkg-${b.id}`,
            ownerName: b.ownerName || '',
            ownerPhone: b.ownerPhone || '',
            ownerEmail: b.ownerEmail || bAny.owner_email || (bAny.data && bAny.data.ownerEmail) || enriched.email || '',
            ownerAddress: b.ownerAddress || bAny.owner_address || (bAny.data && bAny.data.ownerAddress) || enriched.address || '',
            dogName: b.dogName || '',
            dogBreed: b.dogBreed || (bAny.data && bAny.data.dogBreed) || enriched.breed || '',
            specialDiet: b.specialDiet || (bAny.data && bAny.data.specialDiet) || enriched.diet || '',
            notes: b.notes || (bAny.data && bAny.data.notes) || enriched.notes || '',
            source: 'booking',
            sourceLabel: 'לקוח קיים ביומן'
          });
        }
      }
    }

    // 3. From customers
    if (customers && customers.length > 0) {
      for (const c of customers) {
        if (!c.name?.trim()) continue;
        const cleanP = (c.phone || '').replace(/\D/g, '').slice(-9);
        const enriched = phoneEnrichmentMap.get(cleanP) || {};
        if (c.dogs && c.dogs.length > 0) {
          for (const d of c.dogs) {
            const key = makeKey(c.phone || '', d.name || '');
            if (key && !map.has(key)) {
              map.set(key, {
                id: `cust-${c.id}-${d.name}`,
                ownerName: c.name,
                ownerPhone: c.phone || '',
                ownerEmail: c.email || enriched.email || '',
                ownerAddress: enriched.address || '',
                dogName: d.name || '',
                dogBreed: d.breed || enriched.breed || '',
                specialDiet: d.specialDiet || enriched.diet || '',
                notes: d.notes || enriched.notes || '',
                source: 'booking',
                sourceLabel: 'לקוח קיים ביומן'
              });
            }
          }
        }
      }
    }

    // 4. From passesList
    for (const p of passesList) {
      const cleanP = (p.ownerPhone || '').replace(/\D/g, '').slice(-9);
      const enriched = phoneEnrichmentMap.get(cleanP) || {};
      const key = makeKey(p.ownerPhone || '', p.dogName || '');
      if (key && !map.has(key)) {
        map.set(key, {
          id: `pass-${p.id}`,
          ownerName: p.ownerName,
          ownerPhone: p.ownerPhone,
          ownerEmail: p.ownerEmail || enriched.email || '',
          ownerAddress: enriched.address || '',
          dogName: p.dogName,
          dogBreed: p.dogBreed || enriched.breed || '',
          notes: p.notes || enriched.notes || '',
          source: 'pass',
          sourceLabel: 'כרטיסייה קודמת'
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const nameA = (a.dogName || a.ownerName).toLowerCase();
      const nameB = (b.dogName || b.ownerName).toLowerCase();
      return nameA.localeCompare(nameB, 'he');
    });
  }, [bookings, customers, intakeRequests, passesList]);

  // Filter candidates matching search query
  const filteredCandidates = React.useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) {
      return allCandidates.slice(0, 10);
    }
    const cleanNum = q.replace(/\D/g, '');
    return allCandidates.filter(c => {
      const matchName = c.ownerName.toLowerCase().includes(q);
      const matchDog = c.dogName.toLowerCase().includes(q);
      const matchBreed = (c.dogBreed || '').toLowerCase().includes(q);
      const matchEmail = (c.ownerEmail || '').toLowerCase().includes(q);
      const matchPhone = cleanNum ? c.ownerPhone.replace(/\D/g, '').includes(cleanNum) : false;
      return matchName || matchDog || matchBreed || matchEmail || matchPhone;
    });
  }, [allCandidates, customerSearchQuery]);

  // Handle selecting candidate - auto-fills ALL known fields!
  const handleSelectCandidate = (cand: UnifiedCustomerCandidate) => {
    setSelectedCandidate(cand);
    setDogName(cand.dogName);
    setDogBreed(cand.dogBreed || '');
    setOwnerName(cand.ownerName);
    setOwnerPhone(cand.ownerPhone);
    setOwnerEmail(cand.ownerEmail || '');
    setOwnerAddress(cand.ownerAddress || '');
    if (cand.specialDiet || cand.notes) {
      const parts = [cand.specialDiet, cand.notes].filter(Boolean);
      setCustomNotes(parts.join(' | '));
    }
    setCustomerSearchQuery('');
  };

  // Update rates when service type or totalDays changes
  const handleServiceTypeChange = (type: 'daycare' | 'day_training' | 'boarding') => {
    setServiceType(type);
    if (type === 'boarding') {
      // Boarding pass default rate is 120 NIS/day (21 days = 2,520 NIS, 42 days = 5,040 NIS for couple)
      const targetDays = numTotalDays && numTotalDays % 21 === 0 ? numTotalDays : 21;
      setTotalDays(targetDays);
      setDailyRate(120);
      setPricePaid(targetDays * 120);
    } else if (type === 'day_training') {
      const targetDays = numTotalDays && numTotalDays % 10 === 0 ? numTotalDays : 10;
      setTotalDays(targetDays);
      const rate = settings.defaultDailyRateDayTraining || 250;
      setDailyRate(rate);
      setPricePaid(rate * targetDays);
    } else {
      const targetDays = numTotalDays && numTotalDays % 10 === 0 ? numTotalDays : 10;
      setTotalDays(targetDays);
      const calc = getDaycareProgressiveRate(targetDays, settings.defaultDailyRateDaycare || 90);
      setDailyRate(calc.dailyRate);
      setPricePaid(calc.totalPrice);
    }
  };

  const handleTotalDaysChange = (days: number | string) => {
    const raw = typeof days === 'number' ? days : parseInt(String(days), 10) || 10;
    if (serviceType === 'boarding') {
      const mult = Math.max(1, Math.round(raw / 21));
      const validD = mult * 21;
      setTotalDays(validD);
      setDailyRate(120);
      setPricePaid(validD * 120);
      return;
    }
    const mult = Math.max(1, Math.round(raw / 10));
    const validD = mult * 10;
    setTotalDays(validD);
    if (serviceType === 'daycare') {
      const calc = getDaycareProgressiveRate(validD, settings.defaultDailyRateDaycare || 90);
      setDailyRate(calc.dailyRate);
      setPricePaid(calc.totalPrice);
    } else {
      const rate = settings.defaultDailyRateDayTraining || 250;
      setDailyRate(rate);
      setPricePaid(rate * validD);
    }
  };

  // Generate unique numeric pass code e.g. 8492
  const generatePassCode = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${rand}`;
  };

  // Calculate validity: 12 months for 21-day boarding pass, 6 months for daycare/training
  const calculatePassExpiry = (sType: 'daycare' | 'day_training' | 'boarding') => {
    const d = new Date();
    if (sType === 'boarding') {
      d.setFullYear(d.getFullYear() + 1);
    } else {
      d.setMonth(d.getMonth() + 6);
    }
    return d.toISOString().split('T')[0];
  };

  // Build direct digital card link for this pass
  const getPassBookingLink = (pass: DaycarePass) => {
    return `https://rezort-webapp.vercel.app/?pass=${pass.passCode}`;
  };

  // Submit new pass (Prepaid / Direct)
  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dogName.trim() || !ownerName.trim() || !ownerPhone.trim()) {
      alert('נא למלא את שם הכלב, שם הבעלים ומספר הטלפון');
      return;
    }

    const today = getTodayStr();
    const expiry = calculatePassExpiry(serviceType);
    const passCode = generatePassCode();
    const passId = `pass-${Date.now()}`;

    const newPass: DaycarePass = {
      id: passId,
      passCode,
      dogName: dogName.trim(),
      dogBreed: dogBreed.trim() || undefined,
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerEmail: ownerEmail.trim() || undefined,
      serviceType,
      totalDays: effectiveDays,
      usedDays: 0,
      pricePaid: numericPricePaid,
      dailyRate: effectiveDailyRate,
      paymentStatus,
      paymentMethod,
      notes: customNotes.trim() || undefined,
      validFrom: today,
      validUntil: expiry,
      status: 'active',
      usageHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Auto-send voucher directly to customer WhatsApp if owner phone exists
    let sentAuto = false;
    try {
      const cleanP = cleanPhoneNumber(ownerPhone);
      const chatId = cleanP.startsWith('0') ? `972${cleanP.slice(1)}@c.us` : `${cleanP}@c.us`;
      const link = getPassBookingLink(newPass);
      const isBoarding = serviceType === 'boarding';
      const serviceName = isBoarding 
        ? `בנק ${effectiveDays} יממות פנסיון מלא (VIP)`
        : serviceType === 'day_training' 
        ? 'אילוף ביומיות (ללא לינה)' 
        : 'שהייה יומית בריזורט לכלב (מעון יום)';

      const isPaid = paymentStatus === 'fully_paid';
      const paymentLine = isPaid 
        ? `💰 *סטטוס תשלום:* שולם במלואו (₪${numericPricePaid.toLocaleString()})` 
        : `💰 *סכום לתשלום שסוכם:* ₪${numericPricePaid.toLocaleString()} (ניתן להסדיר ישירות ובמהירות ב-Bit / אשראי בקישור למטה)`;

      const msg = isBoarding ? `שלום ${ownerName.trim()}! 🐾🐶
הונפקה עבורכם בהצלחה *כרטיסיית בנק ${effectiveDays} יממות פנסיון VIP* עבור *${dogName.trim()}* בריזורט לכלב! 🌟

🎟️ *מספר הכרטיסייה שלכם:* *#${passCode}*
📅 *כמות ימים בחבילה:* *${effectiveDays} יממות פנסיון מלא* (יתרה נוכחית: *${effectiveDays} יממות*)
⏳ *תוקף הכרטיסייה:* עד לתאריך *${formatDateIL(expiry)}* (שנה מלאה)
${paymentLine}

🏷️ *לצפייה בכרטיסייה הדיגיטלית, ביצוע תשלום וניקוב/שריון שהיות בלחיצה:*
👉 \u200E${link}

(הכלב כבר מאושר במערכת – אין צורך למלא שום שאלון מחדש!)
שמוליק וצוות הריזורט לכלב 🐾` : `שלום ${ownerName.trim()}! 🐾🐶
הונפקה עבורכם בהצלחה *כרטיסיית ${serviceName}* עבור *${dogName.trim()}* בריזורט לכלב!

🎟️ *מספר הכרטיסייה שלכם:* *#${passCode}*
📅 *כמות ימים:* *${effectiveDays} ימים* (יתרה נוכחית: *${effectiveDays} ימים*)
⏳ *תוקף הכרטיסייה:* עד לתאריך *${formatDateIL(expiry)}* (חצי שנה)
${paymentLine}

🏷️ *לצפייה בכרטיסיית הניקוב הדיגיטלית, תשלום ושריון הגעה הבאה בלחיצה:*
👉 \u200E${link}

(הכלב כבר מאושר במערכת – אין צורך למלא שום שאלון מחדש!)
שמוליק וצוות הריזורט לכלב 🐾`;

      await sendMessage(chatId, msg, settings);
      sentAuto = true;
      newPass.status = 'sent';
    } catch (err) {
      console.warn('Auto send WhatsApp upon pass creation failed:', err);
    }

    await saveDaycarePassToDb(newPass);
    setCreatedPassResult(newPass);
    setAutoSentDirectly(sentAuto);

    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Generate Grow Payment Link and send WhatsApp directly
  const handleGenerateAndSendGrowLink = async () => {
    if (!dogName.trim() || !ownerName.trim() || !ownerPhone.trim()) {
      alert('נא למלא את שם הכלב, שם הבעלים ומספר הטלפון');
      return;
    }

    setIsGeneratingGrowLink(true);
    try {
      const isBoarding = serviceType === 'boarding';
      const finalDays = effectiveDays;
      const today = getTodayStr();
      const expiry = calculatePassExpiry(serviceType);
      const expiryText = expiry ? ` | תוקף למימוש: עד ${formatDateIL(expiry)}` : '';
      const desc = isBoarding
        ? `בנק 21 יממות פנסיון VIP עבור ${dogName.trim()}${expiryText}`
        : serviceType === 'day_training'
        ? `כרטיסיית ${finalDays} ימי אילוף יומי עבור ${dogName.trim()}${expiryText}`
        : `כרטיסיית ${finalDays} ימי כיף (שהות יומית) עבור ${dogName.trim()}${expiryText}`;

      const finalPrice = numericPricePaid;
      const finalDailyRate = effectiveDailyRate;
      const totalSavings = effectiveSavings;

      const growRes = await createGrowDynamicPaymentLink({
        amount: finalPrice,
        dogName: dogName.trim(),
        ownerName: ownerName.trim(),
        ownerPhone: ownerPhone.trim(),
        ownerEmail: ownerEmail.trim() || undefined,
        description: desc,
        startDate: today,
        endDate: expiry,
        serviceType: serviceType
      });

      const paymentUrl = growRes.paymentUrl;
      const passCode = generatePassCode();
      const passId = `pass-${Date.now()}`;

      const newPass: DaycarePass = {
        id: passId,
        passCode,
        dogName: dogName.trim(),
        dogBreed: dogBreed.trim() || undefined,
        ownerName: ownerName.trim(),
        ownerPhone: ownerPhone.trim(),
        ownerEmail: ownerEmail.trim() || undefined,
        serviceType,
        totalDays: finalDays,
        usedDays: 0,
        pricePaid: finalPrice,
        dailyRate: finalDailyRate,
        paymentStatus: 'unpaid',
        paymentMethod: 'credit',
        notes: customNotes.trim() ? `${customNotes.trim()} | [נשלח קישור לתשלום Grow]` : '[נשלח קישור לתשלום Grow]',
        validFrom: today,
        validUntil: expiry,
        status: 'active',
        usageHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveDaycarePassToDb(newPass);
      setCreatedPassResult(newPass);

      const progressiveNote = totalSavings > 0
        ? ` (תעריף מוזל: ₪${finalDailyRate} ליום במקום ₪${baseStandardRate}! חיסכון של ₪${totalSavings.toLocaleString()} 🎉)`
        : '';

      const msg = isBoarding ? `שלום ${ownerName.trim()}! 🐾🐶
שמחים לצרף אתכם למועדון ה-VIP של הריזורט לכלב! 🌟
לבקשתך, מצורף קישור לרכישה מאובטחת של *חבילת ${finalDays} יממות פנסיון מלא (VIP)* עבור *${dogName.trim()}*:

🌙 *חבילה:* ${finalDays} יממות פנסיון ואירוח מלא (לינה, חצרות, השגחה ואהבה ❤️)
💰 *סכום לתשלום:* ₪${finalPrice.toLocaleString()}${totalSavings > 0 ? ` (₪${finalDailyRate} ליממה במקום ₪180 – חיסכון ענק של ₪${totalSavings.toLocaleString()}! 🎉)` : ` (₪${finalDailyRate} ליממה)`}
⏳ *תוקף החבילה:* שנה מלאה (עד ${formatDateIL(expiry)})
🎟️ *מספר כרטיסייה שמור עבורכם:* *${passCode}*
💡 *אופן הניצול:* גמיש וחופשי לחלוטין – משריינים ימים מתי שרוצים לאורך השנה עד לגמר היתרה!

💳 *לתשלום מאובטח בלחיצה (כולל Bit, Apple Pay, Google Pay, PayBox וכרטיסי אשראי):*
👉 \u200E${paymentUrl}

לאחר ביצוע התשלום המערכת מפעילה את הכרטיסייה אוטומטית ותוכלו להתחיל לשריין מועדים לכל השנה! מחכים לראותכם 🐶✨
שמוליק וצוות הריזורט לכלב 🐾` : `שלום ${ownerName.trim()}! 🐾
לבקשתך, מצורף קישור לרכישה מאובטחת של *כרטיסיית ${finalDays} יומיות* עבור *${dogName.trim()}* בריזורט לכלב:

🎟️ *חבילה:* ${finalDays} ימי שהייה ביומיות (${serviceType === 'day_training' ? 'אילוף ביומיות' : 'מעון יום'})
💰 *סכום לתשלום:* ₪${finalPrice.toLocaleString()}${progressiveNote}
⏳ *תוקף הכרטיסייה:* חצי שנה (עד ${formatDateIL(expiry)})
🎟️ *מספר כרטיסייה שמור עבורכם:* *${passCode}*

💳 *לתשלום מאובטח בלחיצה (כולל Bit, Apple Pay, Google Pay, PayBox וכרטיסי אשראי):*
👉 \u200E${paymentUrl}

לאחר ביצוע התשלום המערכת מאשרת את הכרטיסייה אוטומטית וניתן לתאם ימי הגעה לריזורט! מחכים לראותכם 🐶✨
שמוליק וצוות הריזורט לכלב 🐾`;

      let sentAuto = false;
      try {
        const cleanP = cleanPhoneNumber(ownerPhone);
        const chatId = cleanP.startsWith('0') ? `972${cleanP.slice(1)}@c.us` : `${cleanP}@c.us`;
        await sendMessage(chatId, msg, settings);
        sentAuto = true;
        newPass.status = 'sent';
      } catch (err) {
        console.warn('Auto send Grow link via Green-API failed, opening web whatsapp fallback:', err);
        openWhatsAppMessage(ownerPhone, msg);
      }

      await saveDaycarePassToDb(newPass);
      setCreatedPassResult(newPass);
      setAutoSentDirectly(sentAuto);
    } catch (err: any) {
      alert(`שגיאה בהפקת קישור תשלום: ${err?.message || 'נסה שוב'}`);
    } finally {
      setIsGeneratingGrowLink(false);
    }
  };

  // Send WhatsApp to Customer with instructions and direct digital voucher link
  const handleSendWhatsAppToCustomer = async (pass: DaycarePass) => {
    const remainingDays = pass.totalDays - pass.usedDays;
    const isBoarding = pass.serviceType === 'boarding';
    const serviceName = isBoarding 
      ? 'בנק 21 יממות פנסיון מלא (VIP)'
      : pass.serviceType === 'day_training' 
      ? 'אילוף ביומיות (ללא לינה)' 
      : 'שהייה יומית בריזורט לכלב (מעון יום)';

    const link = getPassBookingLink(pass);

    const isPaid = pass.paymentStatus === 'fully_paid';
    const paymentLine = isPaid 
      ? `💰 *סטטוס תשלום:* שולם במלואו (₪${pass.pricePaid})` 
      : `💰 *סכום לתשלום שסוכם:* ₪${pass.pricePaid} (ניתן להסדיר ישירות ובמהירות ב-Bit / אשראי בקישור למטה)`;

    const msg = isBoarding ? `שלום ${pass.ownerName}! 🐾🐶
הונפקה עבורכם בהצלחה *כרטיסיית בנק 21 יממות פנסיון VIP* עבור *${pass.dogName}* בריזורט לכלב! 🌟

🎟️ *מספר הכרטיסייה שלכם:* *#${pass.passCode}*
📅 *כמות ימים בחבילה:* *21 יממות פנסיון מלא* (יתרה נוכחית: *${remainingDays} יממות*)
⏳ *תוקף הכרטיסייה:* עד לתאריך *${formatDateIL(pass.validUntil)}* (שנה מלאה)
${paymentLine}

🏷️ *לצפייה בכרטיסייה הדיגיטלית, ביצוע תשלום וניקוב/שריון שהיות בלחיצה:*
👉 \u200E${link}

(הכלב כבר מאושר במערכת – אין צורך למלא שום שאלון מחדש!)
שמוליק וצוות הריזורט לכלב 🐾` : `שלום ${pass.ownerName}! 🐾🐶
הונפקה עבורכם בהצלחה *כרטיסיית ${serviceName}* עבור *${pass.dogName}* בריזורט לכלב!

🎟️ *מספר הכרטיסייה שלכם:* *#${pass.passCode}*
📅 *כמות ימים:* *${pass.totalDays} ימים* (יתרה נוכחית: *${remainingDays} ימים*)
⏳ *תוקף הכרטיסייה:* עד לתאריך *${formatDateIL(pass.validUntil)}* (חצי שנה)
${paymentLine}

🏷️ *לצפייה בכרטיסיית הניקוב הדיגיטלית, תשלום ושריון הגעה הבאה בלחיצה:*
👉 \u200E${link}

(הכלב כבר מאושר במערכת – אין צורך למלא שום שאלון מחדש!)
שמוליק וצוות הריזורט לכלב 🐾`;

    try {
      const cleanP = cleanPhoneNumber(pass.ownerPhone);
      const chatId = cleanP.startsWith('0') ? `972${cleanP.slice(1)}@c.us` : `${cleanP}@c.us`;
      await sendMessage(chatId, msg, settings);
      alert(`הודעת השובר נשלחה ישירות לוואטסאפ של ${pass.ownerName} בהצלחה! 📲`);
      handleMarkPassAsSent(pass);
    } catch (e) {
      console.warn('Direct sendMessage failed, opening WhatsApp Web:', e);
      openWhatsAppMessage(pass.ownerPhone, msg);
    }
  };

  // Copy booking link to clipboard
  const handleCopyPassLink = (pass: DaycarePass) => {
    const link = getPassBookingLink(pass);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Toggle punch circles view for a card
  const toggleDaysExpanded = (passId: string) => {
    setExpandedDaysPassIds(prev => {
      const next = new Set(prev);
      if (next.has(passId)) next.delete(passId);
      else next.add(passId);
      return next;
    });
  };

  // Quick Payment Reference Modal Handlers
  const handleOpenPaymentReferenceModal = (pass: DaycarePass) => {
    setPaymentModalPass(pass);
    setPayModalStatus(pass.paymentStatus || 'fully_paid');
    setPayModalReference(pass.paymentReference || '');
    setPayModalMethod(pass.paymentMethod || 'Grow (אשראי / Bit)');
    setPayModalAmount(pass.pricePaid || 0);
    setPayModalDate(pass.paidAt ? pass.paidAt.slice(0, 10) : getTodayStr());
    setPayModalNotes(pass.paymentNotes || '');
  };

  const handleSavePaymentReferenceModal = async () => {
    if (!paymentModalPass) return;
    setIsSavingPaymentModal(true);
    try {
      const isPaid = payModalStatus === 'fully_paid';
      const nowIso = new Date().toISOString();
      const updated: DaycarePass = {
        ...paymentModalPass,
        paymentStatus: payModalStatus,
        paymentReference: payModalReference.trim() || undefined,
        paymentMethod: payModalMethod,
        pricePaid: typeof payModalAmount === 'number' ? payModalAmount : (parseFloat(String(payModalAmount)) || paymentModalPass.pricePaid),
        paidAt: isPaid ? (payModalDate ? `${payModalDate}T12:00:00` : (paymentModalPass.paidAt || nowIso)) : undefined,
        paymentNotes: payModalNotes.trim() || undefined,
        status: isPaid ? 'active' : (paymentModalPass.status === 'active' ? 'pending_payment' : paymentModalPass.status),
        updatedAt: nowIso
      };

      await saveDaycarePassToDb(updated);
      const fresh = await loadStoredDaycarePasses();
      setPassesList(fresh);
      setPaymentModalPass(null);
      if (isPaid) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      }
    } catch (e: any) {
      alert(`שגיאה בשמירת נתוני התשלום: ${e?.message || e}`);
    } finally {
      setIsSavingPaymentModal(false);
    }
  };

  // 1. Mark pass as Sent to customer
  const handleMarkPassAsSent = async (pass: DaycarePass) => {
    try {
      const nowIso = new Date().toISOString();
      const updated: DaycarePass = {
        ...pass,
        status: 'sent',
        sentAt: pass.sentAt || nowIso,
        sentToPhone: pass.sentToPhone || pass.ownerPhone,
        updatedAt: nowIso
      };
      await saveDaycarePassToDb(updated);
      setPassesList(prev => prev.map(p => p.id === pass.id ? updated : p));
      handleSendWhatsAppToCustomer(pass);
    } catch (e: any) {
      alert(`שגיאה בעדכון כרטיסייה: ${e?.message}`);
    }
  };

  // 2. Mark pass as Paid / Toggle Paid
  const handleTogglePassPaid = async (pass: DaycarePass) => {
    if (pass.paymentStatus !== 'fully_paid') {
      handleOpenPaymentReferenceModal(pass);
      return;
    }

    const confirmToggle = window.confirm(`לבטל את סימון התשלום עבור כרטיסייה #${pass.passCode} של ${pass.dogName}?`);
    if (!confirmToggle) return;

    try {
      const updated: DaycarePass = {
        ...pass,
        paymentStatus: 'unpaid',
        status: 'pending_payment',
        paidAt: undefined,
        updatedAt: new Date().toISOString()
      };
      await saveDaycarePassToDb(updated);
      setPassesList(prev => prev.map(p => p.id === pass.id ? updated : p));
    } catch (e: any) {
      alert(`שגיאה בביטול תשלום כרטיסייה: ${e?.message}`);
    }
  };

  // 3. Delete pass from DB & storage
  const handleDeletePass = async (pass: DaycarePass) => {
    const confirmMsg = `האם אתה בטוח שברצונך למחוק לצמיתות את הכרטיסייה (${pass.passCode}) של ${pass.dogName} (${pass.ownerName})?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteDaycarePassFromDb(pass.id);
      setPassesList(prev => prev.filter(p => p.id !== pass.id));
    } catch (e: any) {
      alert(`שגיאה במחיקת כרטיסייה: ${e?.message}`);
    }
  };

  // Deduct a day (or multi-day boarding stay) and create a real booking in Calendar
  const handleConfirmDeductBooking = async () => {
    if (!selectedPassForBooking) return;
    if (selectedPassForBooking.paymentStatus !== 'fully_paid') {
      const confirmDebt = window.confirm(
        `⚠️ שים לב: כרטיסייה זו עדיין לא שולמה (חוב פתוח של ₪${selectedPassForBooking.pricePaid}).\n\nהאם לאשר קליטה/שריון בהקפה? (השהייה תסומן ביומן עם התרעת חוב אדומה עד להסדרת התשלום)`
      );
      if (!confirmDebt) return;
    }
    if (!bookingDate) {
      alert('נא לבחור תאריך הגעה');
      return;
    }

    const isBoardingBooking = selectedPassForBooking.serviceType === 'boarding';
    const finalEndDate = isBoardingBooking ? (bookingEndDate || bookingDate) : bookingDate;
    const daysToDeduct = isBoardingBooking ? Math.max(1, calculateDaysCount(bookingDate, finalEndDate)) : 1;
    const availableDays = selectedPassForBooking.totalDays - selectedPassForBooking.usedDays;

    if (daysToDeduct > availableDays) {
      alert(`לא ניתן לשריין ${daysToDeduct} יממות: נותרו רק ${availableDays} יממות בכרטיסייה זו.`);
      return;
    }

    setIsBookingSubmitting(true);
    try {
      const bookingId = `b-pass-${Date.now()}`;
      const res = await deductDayFromPassInDb(
        selectedPassForBooking.id,
        bookingDate,
        bookingId,
        'shmulik',
        bookingNotes,
        daysToDeduct,
        finalEndDate
      );

      if (!res.success || !res.pass) {
        alert(`שגיאה: ${res.error || 'לא ניתן לממש יום מהכרטיסייה'}`);
        setIsBookingSubmitting(false);
        return;
      }

      // Create booking in the Resort Calendar
      const isPaid = selectedPassForBooking.paymentStatus === 'fully_paid';
      const isToday = bookingDate === getTodayStr();
      const newBooking: Booking = {
        id: bookingId,
        dogName: selectedPassForBooking.dogName,
        dogBreed: selectedPassForBooking.dogBreed || 'מעורב',
        ownerName: selectedPassForBooking.ownerName,
        ownerPhone: selectedPassForBooking.ownerPhone,
        ownerEmail: selectedPassForBooking.ownerEmail,
        serviceType: selectedPassForBooking.serviceType,
        startDate: bookingDate,
        endDate: finalEndDate,
        totalPrice: 0, // Already prepaid / tracked via pass
        depositAmount: 0,
        paymentStatus: isPaid ? 'fully_paid' : 'unpaid',
        paymentMethod: (selectedPassForBooking.paymentMethod as PaymentMethod) || 'credit',
        stayStatus: isToday ? 'checked_in' : 'booked',
        vaccinationValid: true,
        daycarePassId: selectedPassForBooking.id,
        daycarePassCode: selectedPassForBooking.passCode,
        daycarePassPaid: isPaid,
        notes: `מימוש מתוך ${isBoardingBooking ? 'בנק 21 יממות פנסיון VIP' : 'כרטיסייה'} ${selectedPassForBooking.passCode} (${daysToDeduct} ${isBoardingBooking ? 'יממות' : 'ימים'}, נותרו ${res.pass.totalDays - res.pass.usedDays} ימים)${!isPaid ? ' | [⚠️ חוב כרטיסייה טרם שולם - אושר בהקפה]' : ''}${bookingNotes ? ` | ${bookingNotes}` : ''}`,
        arrivalTime: isBoardingBooking ? '10:00 - 12:00' : '08:30 - 10:00',
        pickupTime: isBoardingBooking ? '10:00 - 12:00' : '17:00 - 18:30',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSaveBooking(newBooking);

      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 }
      });

      // Prompt to send WhatsApp confirmation to client
      const remainingDays = res.pass.totalDays - res.pass.usedDays;
      const stayDatesDisplay = isBoardingBooking 
        ? `${formatDateIL(bookingDate)} עד ${formatDateIL(finalEndDate)} (${daysToDeduct} יממות)` 
        : formatDateIL(bookingDate);

      if (confirm(`השריון נשמר בהצלחה ביומן לתאריכים: ${stayDatesDisplay}!\nנותרו עוד ${remainingDays} ימים בכרטיסייה.\n\nלשלוח עכשיו הודעת אישור ללקוח בוואטסאפ?`)) {
        const confirmMsg = `היי ${selectedPassForBooking.ownerName}, שוריין בהצלחה מקום ל-${selectedPassForBooking.dogName} בריזורט ${isBoardingBooking ? `בין התאריכים *${formatDateIL(bookingDate)} - ${formatDateIL(finalEndDate)}* (*${daysToDeduct} יממות*)` : `לתאריך *${formatDateIL(bookingDate)}*`}! 🐾
🎟️ נוצלו ${daysToDeduct} ${isBoardingBooking ? 'יממות' : 'ימים'} מתוך כרטיסייה *${selectedPassForBooking.passCode}*.
📊 *יתרת הימים שנותרו לך בכרטיסייה:* *${remainingDays} מתוך ${selectedPassForBooking.totalDays} ימים*.
מחכים לראותכם! 🐶🤍
שמוליק וכל צוות הריזורט לכלב 🐾`;
        openWhatsAppMessage(selectedPassForBooking.ownerPhone, confirmMsg);
      }

      setSelectedPassForBooking(null);
      setBookingNotes('');
    } catch (err: any) {
      alert(`שגיאה בשמירת שריון יום: ${err?.message || 'נסה שוב'}`);
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  const handleOpenEditPass = (pass: DaycarePass) => {
    setEditingPass(pass);
    setEditDogName(pass.dogName || '');
    setEditTotalDays(pass.totalDays);
    setEditUsedDays(pass.usedDays);
    setEditPricePaid(pass.pricePaid || 0);
    setEditPaymentStatus(pass.paymentStatus);
    setEditPaymentReference(pass.paymentReference || '');
    setEditPaymentMethod(pass.paymentMethod || 'Grow (אשראי / Bit)');
    setEditPaidAt(pass.paidAt ? pass.paidAt.slice(0, 10) : '');
    setEditSentAt(pass.sentAt ? pass.sentAt.slice(0, 10) : '');
    setEditSentToPhone(pass.sentToPhone || pass.ownerPhone || '');
    setEditPaymentUrl(pass.paymentUrl || '');
    setEditNotes(pass.notes || '');
    setEditValidUntil(pass.validUntil ? pass.validUntil.slice(0, 10) : '');
  };

  const handleSaveEditedPass = async () => {
    if (!editingPass) return;
    setIsSavingEdit(true);
    try {
      const numEditTotal = typeof editTotalDays === 'number' ? editTotalDays : (parseInt(String(editTotalDays), 10) || 1);
      const numEditUsed = typeof editUsedDays === 'number' ? editUsedDays : (parseInt(String(editUsedDays), 10) || 0);
      const numEditPrice = typeof editPricePaid === 'number' ? editPricePaid : (parseFloat(String(editPricePaid)) || 0);
      const remaining = Math.max(0, numEditTotal - numEditUsed);
      const isCompleted = remaining === 0;
      const nowIso = new Date().toISOString();
      const updatedPass: DaycarePass = {
        ...editingPass,
        dogName: editDogName.trim() || editingPass.dogName,
        totalDays: numEditTotal,
        usedDays: numEditUsed,
        pricePaid: numEditPrice,
        dailyRate: numEditTotal > 0 ? Math.round(numEditPrice / numEditTotal) : editingPass.dailyRate,
        paymentStatus: editPaymentStatus,
        paymentReference: editPaymentReference.trim() || undefined,
        paymentMethod: editPaymentMethod || undefined,
        paidAt: editPaymentStatus === 'fully_paid' ? (editPaidAt ? `${editPaidAt}T12:00:00` : (editingPass.paidAt || nowIso)) : undefined,
        sentAt: editSentAt ? `${editSentAt}T12:00:00` : editingPass.sentAt,
        sentToPhone: editSentToPhone.trim() || editingPass.ownerPhone,
        paymentUrl: editPaymentUrl.trim() || editingPass.paymentUrl,
        notes: editNotes,
        status: isCompleted ? 'completed' : (editingPass.status === 'completed' ? 'active' : editingPass.status),
        validUntil: editValidUntil || editingPass.validUntil,
        updatedAt: nowIso
      };
      await saveDaycarePassToDb(updatedPass);
      const fresh = await loadStoredDaycarePasses();
      setPassesList(fresh);
      setEditingPass(null);
      alert(`כרטיסייה ${updatedPass.passCode} עודכנה וכויְילה בהצלחה! נותרו: ${remaining} מתוך ${updatedPass.totalDays} ימים.`);
    } catch (e: any) {
      alert(`שגיאה בשמירת השינויים בכרטיסייה: ${e?.message || e}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Transfer Modal for moving days between passes / dogs
  const handleOpenTransferModal = (sourcePass?: DaycarePass, targetPass?: DaycarePass) => {
    let initialSourceId = sourcePass?.id || '';
    let initialTargetId = targetPass?.id || '';
    let initialDays = 1;

    if (sourcePass) {
      const cleanPhone = cleanPhoneNumber(sourcePass.ownerPhone);
      const otherPasses = passesList.filter(p => 
        p.id !== sourcePass.id && 
        ((cleanPhone && cleanPhoneNumber(p.ownerPhone) === cleanPhone) || p.ownerName === sourcePass.ownerName)
      );

      if (!initialTargetId && otherPasses.length > 0) {
        // Prefer one in overdraft
        const overdraftPass = otherPasses.find(p => (p.totalDays - p.usedDays) < 0);
        if (overdraftPass) {
          initialTargetId = overdraftPass.id;
          const deficit = Math.abs(overdraftPass.totalDays - overdraftPass.usedDays);
          const availableInSource = Math.max(1, sourcePass.totalDays - sourcePass.usedDays);
          initialDays = Math.min(availableInSource, deficit);
        } else {
          initialTargetId = otherPasses[0].id;
        }
      }
    } else if (passesList.length >= 2) {
      // Find a customer with 2+ passes
      const counts: Record<string, DaycarePass[]> = {};
      passesList.forEach(p => {
        const ph = cleanPhoneNumber(p.ownerPhone) || p.ownerName;
        if (!counts[ph]) counts[ph] = [];
        counts[ph].push(p);
      });
      const multi = Object.values(counts).find(list => list.length >= 2);
      if (multi) {
        const overdraft = multi.find(p => (p.totalDays - p.usedDays) < 0);
        const surplus = multi.find(p => (p.totalDays - p.usedDays) > 0);
        if (overdraft && surplus) {
          initialSourceId = surplus.id;
          initialTargetId = overdraft.id;
          initialDays = Math.abs(overdraft.totalDays - overdraft.usedDays);
        } else {
          initialSourceId = multi[0].id;
          initialTargetId = multi[1].id;
        }
      } else {
        initialSourceId = passesList[0].id;
        initialTargetId = passesList[1].id;
      }
    }

    setTransferModal({
      isOpen: true,
      sourcePassId: initialSourceId,
      targetPassId: initialTargetId,
      daysCount: Math.max(1, initialDays),
      reason: 'ניוד ימים בין כרטיסיות / כלבי המשפחה לבקשת הלקוח'
    });
  };

  const handleExecuteTransfer = async () => {
    if (!transferModal || !transferModal.sourcePassId || !transferModal.targetPassId) {
      alert('נא לבחור כרטיסיית מקור וכרטיסיית יעד');
      return;
    }
    if (transferModal.sourcePassId === transferModal.targetPassId) {
      alert('לא ניתן לנייד ימים מאותה כרטיסייה לעצמה');
      return;
    }
    const days = Math.max(1, Math.round(Number(transferModal.daysCount) || 1));
    setIsSavingTransfer(true);
    try {
      const res = await transferDaysBetweenPassesInDb({
        sourcePassIdOrCode: transferModal.sourcePassId,
        targetPassIdOrCode: transferModal.targetPassId,
        daysToTransfer: days,
        reason: transferModal.reason,
        transferredBy: 'shmulik'
      });

      if (!res.success || !res.sourcePass || !res.targetPass) {
        alert(`שגיאה בביצוע הניוד: ${res.error || 'נסה שוב'}`);
        return;
      }

      // Reload fresh passes
      const fresh = await loadStoredDaycarePasses();
      setPassesList(fresh);

      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 }
      });

      alert(`✅ ניוד ${days} ימים בוצע בהצלחה!\n\n📤 מכרטיסייה #${res.sourcePass.passCode} (${res.sourcePass.dogName}): נותרו ${res.sourcePass.totalDays - res.sourcePass.usedDays} מתוך ${res.sourcePass.totalDays} ימים.\n📥 אל כרטיסייה #${res.targetPass.passCode} (${res.targetPass.dogName}): נותרו ${res.targetPass.totalDays - res.targetPass.usedDays} מתוך ${res.targetPass.totalDays} ימים.`);
      setTransferModal(null);
    } catch (err: any) {
      alert(`שגיאה בביצוע ניוד ימים: ${err?.message || err}`);
    } finally {
      setIsSavingTransfer(false);
    }
  };

  // Metrics derivation
  const paidPasses = passesList.filter(p => p.paymentStatus === 'fully_paid');
  const pendingPasses = passesList.filter(p => p.paymentStatus !== 'fully_paid' && (p.status === 'sent' || Boolean(p.sentAt)));
  const unsentPasses = passesList.filter(p => p.paymentStatus !== 'fully_paid' && p.status !== 'sent' && !p.sentAt);

  const totalPaidRevenue = paidPasses.reduce((sum, p) => sum + (Number(p.pricePaid) || 0), 0);
  const totalPendingRevenue = pendingPasses.reduce((sum, p) => sum + (Number(p.pricePaid) || 0), 0);

  // Filtered list of passes for search & tab filter
  const filteredPasses = passesList.filter(p => {
    if (listFilter === 'paid' && p.paymentStatus !== 'fully_paid') return false;
    if (listFilter === 'pending' && (p.paymentStatus === 'fully_paid' || (p.status !== 'sent' && !p.sentAt))) return false;
    if (listFilter === 'unsent' && (p.paymentStatus === 'fully_paid' || p.status === 'sent' || Boolean(p.sentAt))) return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const cleanNum = q.replace(/\D/g, '');
    return (
      p.passCode.toLowerCase().includes(q) ||
      p.dogName.toLowerCase().includes(q) ||
      p.ownerName.toLowerCase().includes(q) ||
      Boolean(p.paymentReference && p.paymentReference.toLowerCase().includes(q)) ||
      (Boolean(cleanNum) && p.ownerPhone.replace(/\D/g, '').includes(cleanNum)) ||
      p.ownerPhone.includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col text-slate-900 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-inner backdrop-blur-md">
              🎟️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">כרטיסיות פעילות יומית</h2>
                <span className="text-[11px] bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                  תוקף 6 חודשים
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                תמחור מוזל בטור יורד (עד ₪75 ליום), חיפוש מהיר של כל לקוח, הפקת שוברים ושליחת קישורי תשלום
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('create'); setCreatedPassResult(null); }}
            className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>הנפקת כרטיסייה חדשה</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>כרטיסיות פעילות ({passesList.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: CREATE NEW PASS */}
          {activeTab === 'create' && (
            <div>
              {createdPassResult ? (
                /* Success Voucher View */
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-500/30 rounded-3xl p-6 text-center space-y-5 animate-in zoom-in-95">
                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/20">
                    🎟️
                  </div>
                  <div>
                    {autoSentDirectly ? (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-200/80 border border-emerald-300 px-3.5 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs">
                        <span>✓</span>
                        <span>הכרטיסייה הונפקה ונשלחה אוטומטית לוואטסאפ של {createdPassResult.ownerName}! 📲</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                        הכרטיסייה הונפקה ונשמרה בהצלחה!
                      </span>
                    )}
                    <h3 className="text-2xl font-black text-slate-900 mt-2">
                      {createdPassResult.dogName} ({createdPassResult.ownerName})
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {createdPassResult.serviceType === 'boarding'
                        ? 'בנק 21 יממות פנסיון מלא (VIP)'
                        : createdPassResult.serviceType === 'day_training'
                        ? 'אילוף ביומיות'
                        : 'שהייה יומית בריזורט (מעון יום)'} • {createdPassResult.totalDays} {createdPassResult.serviceType === 'boarding' ? 'יממות' : 'ימים'}
                    </p>
                  </div>

                  {/* Voucher Card Box */}
                  <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm max-w-md mx-auto space-y-3 text-right">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs text-slate-500">קוד שובר למימוש:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-emerald-700 font-mono tracking-wider">
                          {createdPassResult.passCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(createdPassResult.passCode);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer"
                          title="העתק קוד"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block">סה״כ ימים:</span>
                        <span className="font-bold text-slate-800">
                          {createdPassResult.totalDays} {createdPassResult.serviceType === 'boarding' ? 'יממות' : 'ימים'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">סכום לתשלום:</span>
                        <span className="font-bold text-emerald-600">
                          ₪{createdPassResult.pricePaid} (₪{createdPassResult.dailyRate}/{createdPassResult.serviceType === 'boarding' ? 'יממה' : 'יום'})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">
                          {createdPassResult.serviceType === 'boarding' ? 'תוקף לשנה מלאה:' : 'תוקף לחצי שנה:'}
                        </span>
                        <span className="font-bold text-slate-800">{formatDateIL(createdPassResult.validUntil)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">סטטוס תשלום:</span>
                        <span className="font-bold text-slate-800">
                          {createdPassResult.paymentStatus === 'fully_paid' ? '🟢 שולם במלואו' : '🟡 טרם שולם / ממתין ל-Grow'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppToCustomer(createdPassResult)}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>{autoSentDirectly ? 'שלח שוב שובר בוואטסאפ ללקוח 📲' : 'שלח שובר והסבר בוואטסאפ ללקוח 📲'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyPassLink(createdPassResult)}
                      className="px-5 py-3 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Link2 className="w-4 h-4" />}
                      <span>{copiedLink ? 'הקישור הועתק!' : 'העתק קישור ישיר ללקוח 🔗'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCreatedPassResult(null);
                        setActiveTab('list');
                      }}
                      className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-sm rounded-xl transition-all cursor-pointer"
                    >
                      צפה ברשימת הכרטיסיות
                    </button>
                  </div>
                </div>
              ) : (
                /* Pass Creation Form */
                <form onSubmit={handleCreatePass} className="space-y-5">
                  
                  {/* Step 1: Smart Unified Customer Selection & Instant Search */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Search className="w-4 h-4 text-emerald-600" />
                        <span>איתור מהיר של בעלים או כלב (מכלל הלקוחות, השאלונים והשיחות):</span>
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {allCandidates.length} לקוחות במערכת
                      </span>
                    </div>

                    {selectedCandidate ? (
                      /* Selected Customer Banner */
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400 rounded-2xl p-3 flex items-center justify-between animate-in fade-in">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                            🐶
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-base">{selectedCandidate.dogName}</span>
                              {selectedCandidate.dogBreed && (
                                <span className="text-xs text-slate-600 font-medium">({selectedCandidate.dogBreed})</span>
                              )}
                              <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-extrabold">
                                {selectedCandidate.sourceLabel}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5">
                              <span className="font-bold">👤 {selectedCandidate.ownerName}</span>
                              <span>•</span>
                              <span dir="ltr" className="font-mono">📞 {selectedCandidate.ownerPhone}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCandidate(null);
                            setCustomerSearchQuery('');
                          }}
                          className="text-xs text-slate-600 hover:text-red-700 font-bold px-3 py-1.5 rounded-xl border border-slate-300 hover:border-red-300 bg-white hover:bg-red-50 transition-all cursor-pointer"
                        >
                          ✕ החלף לקוח
                        </button>
                      </div>
                    ) : (
                      /* Live Autocomplete Search Input */
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="w-4 h-4 text-emerald-600 absolute right-3.5 top-3.5" />
                          <input
                            type="text"
                            value={customerSearchQuery}
                            onChange={(e) => setCustomerSearchQuery(e.target.value)}
                            placeholder="הקלד לחיפוש מהיר: מיכאל, חיימי, 058..."
                            className="w-full bg-white text-slate-900 text-sm pr-10 pl-8 py-2.5 rounded-xl border-2 border-emerald-400 focus:border-emerald-600 focus:outline-none shadow-xs font-medium"
                          />
                          {customerSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setCustomerSearchQuery('')}
                              className="absolute left-3 top-3 text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Matching candidates list */}
                        {filteredCandidates.length > 0 && (
                          <div className="max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
                            {filteredCandidates.map((cand) => (
                              <div
                                key={cand.id}
                                onClick={() => handleSelectCandidate(cand)}
                                className="p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition-colors group"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="text-lg">🐶</span>
                                  <div>
                                    <div className="text-xs font-black text-slate-900 group-hover:text-emerald-800">
                                      {cand.dogName || 'כלב'} <span className="text-slate-500 font-normal">({cand.dogBreed || 'מעורב'})</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {cand.ownerName} · <span dir="ltr">{cand.ownerPhone}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold group-hover:bg-emerald-200 group-hover:text-emerald-900">
                                    {cand.sourceLabel}
                                  </span>
                                  <span className="text-xs font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                    בחר ↵
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {customerSearchQuery && filteredCandidates.length === 0 && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                            <span>לא נמצא לקוח בשם זה. ניתן להזין את הפרטים ידנית בשדות למטה ⬇️</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Editable fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-xs text-slate-600 font-bold block mb-1">שם הכלב *</label>
                        <input
                          type="text"
                          required
                          value={dogName}
                          onChange={(e) => setDogName(e.target.value)}
                          placeholder="למשל: חיימי"
                          className="w-full bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 font-bold block mb-1">גזע הכלב</label>
                        <input
                          type="text"
                          value={dogBreed}
                          onChange={(e) => setDogBreed(e.target.value)}
                          placeholder="למשל: לברדורית"
                          className="w-full bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 font-bold block mb-1">שם הבעלים *</label>
                        <input
                          type="text"
                          required
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          placeholder="למשל: מיכאל בן הר"
                          className="w-full bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 font-bold block mb-1">טלפון נייד *</label>
                        <input
                          type="tel"
                          required
                          value={ownerPhone}
                          onChange={(e) => setOwnerPhone(e.target.value)}
                          placeholder="058-6275554"
                          className="w-full bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none text-left"
                          dir="ltr"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 font-bold block mb-1">אימייל הבעלים ✉️</label>
                        <input
                          type="email"
                          value={ownerEmail}
                          onChange={(e) => setOwnerEmail(e.target.value)}
                          placeholder="client@gmail.com"
                          className="w-full bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none text-left"
                          dir="ltr"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 font-bold block mb-1">כתובת מגורים 🏠</label>
                        <input
                          type="text"
                          value={ownerAddress}
                          onChange={(e) => setOwnerAddress(e.target.value)}
                          placeholder="עיר, רחוב ומספר בית"
                          className="w-full bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Service Type Selection */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-2">
                      סוג השירות המבוקש
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => handleServiceTypeChange('daycare')}
                        className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                          serviceType === 'daycare'
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xl">🐾</span>
                          <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-extrabold">
                            מ-₪75 עד ₪90 ליום
                          </span>
                        </div>
                        <div className="text-sm font-black mt-2">שהייה יומית (מעון יום)</div>
                        <div className="text-[11px] text-slate-500 font-normal">חצרות משחקים ללא לינה</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleServiceTypeChange('day_training')}
                        className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                          serviceType === 'day_training'
                            ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xl">🦮</span>
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-extrabold">
                            ₪{settings.defaultDailyRateDayTraining || 250}/יום
                          </span>
                        </div>
                        <div className="text-sm font-black mt-2">אילוף ביומיות</div>
                        <div className="text-[11px] text-slate-500 font-normal">סשנים אישיים עם מאלף ללא לינה</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleServiceTypeChange('boarding')}
                        className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                          serviceType === 'boarding'
                            ? 'bg-gradient-to-br from-indigo-50 to-amber-50/40 border-indigo-500 ring-2 ring-indigo-500/30 text-indigo-950 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xl">🌙</span>
                          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-extrabold border border-indigo-200">
                            ₪100/יממה VIP ⭐
                          </span>
                        </div>
                        <div className="text-sm font-black mt-2">בנק 21 יממות פנסיון מלא</div>
                        <div className="text-[11px] text-slate-500 font-normal">לינה מלאה בריזורט, בתוקף לשנה</div>
                      </button>
                    </div>
                  </div>

                  {/* Step 3: Progressive Discount Quantity & Total Price */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                    {serviceType === 'boarding' ? (
                      /* Strictly Locked 21-Day Boarding VIP Package */
                      <div className="space-y-4">
                        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md border border-indigo-700 relative overflow-hidden">
                          <div className="absolute -left-6 -bottom-6 w-28 h-28 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />
                          <div className="flex items-start justify-between gap-3 relative z-10">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                                  חבילת VIP בלעדית
                                </span>
                                <span className="text-xs text-indigo-200">בתוקף ל-12 חודשים מלאים</span>
                              </div>
                              <h3 className="text-xl font-black text-white flex items-center gap-2">
                                <span>🌙 בנק {effectiveDays} יממות פנסיון מלא</span>
                                {effectiveDays > 21 && (
                                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                                    חבילה מוכפלת ({Math.round(effectiveDays / 21)} כרטיסיות)
                                  </span>
                                )}
                              </h3>
                              <p className="text-xs text-indigo-200/90 mt-1 max-w-md">
                                התחייבות מראש על {effectiveDays} יממות פנסיון בריזורט לכלב. הלקוח בוחר ומושך ימי שהייה באופן גמיש לאורך שנה שלמה.
                              </p>
                            </div>
                            <div className="text-left shrink-0 bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/15">
                              <span className="text-[11px] text-indigo-200 block">מחיר חבילה:</span>
                              <span className="text-2xl font-black text-amber-300">₪{numericPricePaid.toLocaleString()}</span>
                              <span className="text-[10px] text-indigo-200 block">(₪{effectiveDailyRate.toLocaleString()} ליממה)</span>
                            </div>
                          </div>

                          {/* Boarding Multiplier Selector */}
                          <div className="mt-3 pt-3 border-t border-white/15 relative z-10">
                            <label className="text-xs font-bold text-amber-200 block mb-1.5">
                              בחירת כפולות חבילה (כפולות של 21 יממות בלבד):
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { packs: 1, days: 21, label: '1 חבילה (21 יממות)', sub: '₪2,520 (כלב יחיד)' },
                                { packs: 2, days: 42, label: '2 חבילות (42 יממות) ⭐', sub: '₪5,040 (לזוג כלבים)' },
                                { packs: 3, days: 63, label: '3 חבילות (63 יממות)', sub: '₪7,560' },
                                { packs: 4, days: 84, label: '4 חבילות (84 יממות)', sub: '₪10,080' }
                              ].map(pack => {
                                const isSelected = numTotalDays === pack.days;
                                return (
                                  <button
                                    key={pack.days}
                                    type="button"
                                    onClick={() => handleTotalDaysChange(pack.days)}
                                    className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 text-center active:scale-95 ${
                                      isSelected
                                        ? 'bg-amber-400 text-slate-950 shadow-lg ring-2 ring-white font-black'
                                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                                    }`}
                                  >
                                    <span className="text-xs font-black leading-tight">{pack.label}</span>
                                    <span className={`text-[10px] ${isSelected ? 'text-slate-800 font-bold' : 'text-amber-200'}`}>
                                      {pack.sub}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs relative z-10">
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-indigo-300 block text-[10px]">כמות יממות בחבילה:</span>
                              <span className="font-bold text-white">🌙 {effectiveDays} יממות</span>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-indigo-300 block text-[10px]">תעריף ליממה:</span>
                              <span className="font-bold text-amber-300">₪{effectiveDailyRate} (במקום ₪180)</span>
                            </div>
                            <div className="bg-emerald-500/20 border border-emerald-400/30 p-2 rounded-lg text-emerald-200 font-bold">
                              <span>חיסכון כולל של ₪{effectiveSavings.toLocaleString()}! 🎉</span>
                            </div>
                          </div>
                        </div>

                        {/* Editable Price / Payment Details */}
                        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-slate-700 font-bold block mb-1">
                              מחיר סופי לחבילה (₪) - <span className="text-emerald-700 font-normal">הסכום לגבייה</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={pricePaid}
                              placeholder="0"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPricePaid(val);
                                const num = val === '' ? 0 : parseFloat(val) || 0;
                                setDailyRate(Math.round((num / (effectiveDays || 21)) * 10) / 10);
                              }}
                              onBlur={() => {
                                if (pricePaid === '' || Number(pricePaid) < 0) {
                                  setPricePaid(0);
                                }
                              }}
                              className="w-full bg-slate-50 font-black text-lg text-indigo-900 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none"
                            />
                            <span className="text-[11px] text-slate-400 mt-1 block">
                              {effectiveDays} יממות @ ₪{effectiveDailyRate} ליממה
                            </span>
                          </div>

                          <div>
                            <label className="text-xs text-slate-700 font-bold block mb-1">אמצעי תשלום</label>
                            <select
                              value={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                              className="w-full bg-slate-50 text-slate-800 text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
                            >
                              <option value="bit">ביט (Bit / Grow)</option>
                              <option value="cash">מזומן (שולם לשמוליק)</option>
                              <option value="credit">כרטיס אשראי</option>
                              <option value="paybox">פייבוקס (PayBox)</option>
                              <option value="bank_transfer">העברה בנקאית</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-slate-500 block mb-1">הערות לשמוליק / אסמכתא (אופציונלי)</label>
                          <input
                            type="text"
                            value={customNotes}
                            onChange={(e) => setCustomNotes(e.target.value)}
                            placeholder="למשל: סוכם בטלפון עם הבעלים, חבילת VIP לשנה"
                            className="w-full bg-slate-50 text-slate-800 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Daycare / Day Training Progressive Rate UI */
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-slate-700">בחירת כרטיסייה (כפולות של 10 ימים בלבד):</label>
                            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {effectiveDays} ימי פעילות
                            </span>
                          </div>

                          {/* Quick chip buttons - strictly multiples of 10 */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { days: 10, label: '1 כרטיסייה (10 ימים) ⭐' },
                              { days: 20, label: '2 כרטיסיות (20 ימים)' },
                              { days: 30, label: '3 כרטיסיות (30 ימים)' },
                              { days: 40, label: '4 כרטיסיות (40 ימים)' }
                            ].map(item => {
                              const isSelected = numTotalDays === item.days;
                              const chipCalc = serviceType === 'daycare' 
                                ? getDaycareProgressiveRate(item.days, settings.defaultDailyRateDaycare || 90)
                                : null;
                              return (
                                <button
                                  key={item.days}
                                  type="button"
                                  onClick={() => handleTotalDaysChange(item.days)}
                                  className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 text-center active:scale-95 ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400 font-black'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                                  }`}
                                >
                                  <span className="font-black text-xs leading-tight">
                                    {item.label}
                                  </span>
                                  {chipCalc && (
                                    <span className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                                      ₪{isSelected ? effectiveDailyRate : chipCalc.dailyRate}/יום (₪{isSelected ? numericPricePaid : chipCalc.totalPrice})
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Rate & Pricing Live Summary Banner */}
                        <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🏷️</span>
                            <div>
                              <span className="font-extrabold">תמחור מחושב לעסקה: </span>
                              <span>
                                ₪{effectiveDailyRate} ליום {serviceType === 'daycare' ? `(במקום ₪${settings.defaultDailyRateDaycare || 90})` : `(במקום ₪${settings.defaultDailyRateDayTraining || 250})`}
                              </span>
                            </div>
                          </div>
                          {effectiveSavings > 0 && (
                            <span className="bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-full text-[11px] shadow-xs">
                              חיסכון של ₪{effectiveSavings.toLocaleString()} 🎉
                            </span>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-slate-700 font-bold block mb-1">
                              מחיר כולל לעסקה (₪) - <span className="text-emerald-700 font-normal">ניתן לעריכה חופשית ע״י שמוליק</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={pricePaid}
                              placeholder="0"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPricePaid(val);
                                const num = val === '' ? 0 : parseFloat(val) || 0;
                                const d = typeof totalDays === 'number' ? totalDays : (parseInt(totalDays, 10) || 1);
                                if (d > 0) {
                                  setDailyRate(Math.round((num / d) * 10) / 10);
                                }
                              }}
                              onBlur={() => {
                                if (pricePaid === '' || Number(pricePaid) < 0) {
                                  setPricePaid(0);
                                }
                              }}
                              className="w-full bg-slate-50 font-black text-lg text-emerald-700 px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                            />
                            <span className="text-[11px] text-slate-400 mt-1 block">
                              מחושב: ₪{effectiveDailyRate} ליום
                            </span>
                          </div>

                          <div>
                            <label className="text-xs text-slate-700 font-bold block mb-1">אמצעי תשלום</label>
                            <select
                              value={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                              className="w-full bg-slate-50 text-slate-800 text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none cursor-pointer"
                            >
                              <option value="bit">ביט (Bit / Grow)</option>
                              <option value="cash">מזומן (שולם לשמוליק)</option>
                              <option value="credit">כרטיס אשראי</option>
                              <option value="paybox">פייבוקס (PayBox)</option>
                              <option value="bank_transfer">העברה בנקאית</option>
                            </select>
                          </div>
                        </div>

                        <div className="pt-2">
                          <label className="text-xs text-slate-500 block mb-1">הערות לשמוליק / אסמכתא (אופציונלי)</label>
                          <input
                            type="text"
                            value={customNotes}
                            onChange={(e) => setCustomNotes(e.target.value)}
                            placeholder="למשל: סוכם בטלפון, מגיע פעם בשבוע באופן קבוע"
                            className="w-full bg-slate-50 text-slate-800 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Validity Info Box */}
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">
                        תוקף הכרטיסייה: {serviceType === 'boarding' ? 'שנה מלאה (12 חודשים) מיום ההנפקה' : 'חצי שנה מיום ההנפקה'}
                      </span>{' '}
                      (עד {formatDateIL(calculatePassExpiry(serviceType))}).
                      <p className="text-[11px] text-amber-800/90 mt-0.5">
                        {serviceType === 'boarding'
                          ? 'הלקוח מגיש בקשות שהייה ישירות מהקישור הדיגיטלי שלו, ושמוליק מאשר כל שהייה ביומן הריזורט בלחיצת כפתור אחת.'
                          : 'הלקוח מקבל שובר דיגיטלי ומחויב לתאם מראש כל יום הגעה בנפרד למניעת עומס בריזורט.'}
                      </p>
                    </div>
                  </div>

                  {/* Dual Action Buttons: Generate & Send Grow Link VS Instant Issue */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      disabled={isGeneratingGrowLink}
                      onClick={handleGenerateAndSendGrowLink}
                      className="w-full py-3.5 bg-gradient-to-r from-purple-700 via-indigo-700 to-emerald-700 hover:from-purple-800 hover:to-emerald-800 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingGrowLink ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>מפיק קישור לתשלום מאובטח...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5 text-yellow-300" />
                          <span>שלח קישור לתשלום ב-Grow (₪{numericPricePaid.toLocaleString()} / Bit / אשראי) בוואטסאפ 📲</span>
                        </>
                      )}
                    </button>

                    <button
                      type="submit"
                      className="w-full py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm rounded-2xl border-2 border-slate-200 hover:border-emerald-500 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>הנפק כרטיסייה מיידית (₪{numericPricePaid.toLocaleString()} - שולם במזומן / ביט ישיר) ✨</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: ACTIVE PASSES LIST */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              
              {/* Search input & Quick KPIs */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="חיפוש לפי שם כלב, בעלים, טלפון, אסמכתא או קוד שובר (PASS-XXXX)..."
                    className="w-full bg-slate-50 text-slate-900 text-xs pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Filter Pills & Revenue Summary */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 pb-1">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setListFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                        listFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      הכל ({passesList.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setListFilter('paid')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        listFilter === 'paid'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100'
                      }`}
                    >
                      <span>🟢 שולמו ({paidPasses.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setListFilter('pending')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        listFilter === 'pending'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-sky-50 text-sky-800 border border-sky-200/80 hover:bg-sky-100'
                      }`}
                    >
                      <span>🔵 נשלחו וממתינים ({pendingPasses.length})</span>
                    </button>

                    {unsentPasses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setListFilter('unsent')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                          listFilter === 'unsent'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100'
                        }`}
                      >
                        <span>🟠 טרם נשלחו ({unsentPasses.length})</span>
                      </button>
                    )}

                    {/* Transfer Days Between Passes / Dogs Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenTransferModal()}
                      className="px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 bg-gradient-to-r from-indigo-50 to-indigo-100/80 text-indigo-900 border border-indigo-200 hover:border-indigo-400 hover:shadow-xs shadow-2xs"
                      title="ניוד והעברת ימים בין כרטיסיות ומכלב לכלב (עבור לקוחות עם מספר כלבים)"
                    >
                      <Repeat className="w-3.5 h-3.5 text-indigo-600" />
                      <span>ניוד ימים בין כרטיסיות / כלבים 🔄</span>
                    </button>
                  </div>

                  {/* Financial summary KPIs */}
                  <div className="flex items-center gap-2 text-[11px] self-end sm:self-auto shrink-0">
                    <span className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-2.5 py-1 rounded-lg font-black shadow-2xs">
                      נגבה: ₪{totalPaidRevenue.toLocaleString('he-IL')}
                    </span>
                    {totalPendingRevenue > 0 && (
                      <span className="bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-lg font-black shadow-2xs">
                        ממתין: ₪{totalPendingRevenue.toLocaleString('he-IL')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {filteredPasses.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-3">
                  <Ticket className="w-10 h-10 mx-auto stroke-1" />
                  <p className="text-sm font-bold">לא נמצאו כרטיסיות מתאימות</p>
                  {searchQuery ? (
                    <div>
                      <p className="text-xs mb-2">לא נמצאה כרטיסייה עבור "{searchQuery}"</p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('create');
                          setCustomerSearchQuery(searchQuery);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>הנפק כרטיסייה חדשה עבור חיפוש זה</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs">הנפק כרטיסייה חדשה בלשונית למעלה</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPasses.map(pass => {
                    const isBoarding = pass.serviceType === 'boarding';
                    const remaining = Math.max(0, pass.totalDays - pass.usedDays);
                    const isCompleted = pass.usedDays >= pass.totalDays;
                    const isDaysExpanded = expandedDaysPassIds.has(pass.id);
                    const isFullyPaid = pass.paymentStatus === 'fully_paid';
                    const isSent = pass.status === 'sent' || Boolean(pass.sentAt);

                    return (
                      <div 
                        key={pass.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-xs ${
                          isCompleted 
                            ? 'bg-slate-50 border-slate-200 opacity-75' 
                            : isBoarding
                            ? 'bg-gradient-to-br from-indigo-50/30 via-white to-teal-50/20 border-indigo-200/90 hover:border-indigo-400'
                            : pass.serviceType === 'day_training'
                            ? 'bg-gradient-to-br from-amber-50/30 via-white to-orange-50/20 border-amber-200/90 hover:border-amber-400'
                            : 'bg-white border-slate-200 hover:border-cyan-300'
                        }`}
                      >
                        {/* 1. Header Row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                              isBoarding
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                : pass.serviceType === 'day_training' 
                                ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                                : 'bg-cyan-100 text-cyan-900 border border-cyan-200'
                            }`}>
                              {isBoarding ? '🌙' : pass.serviceType === 'day_training' ? '🦮' : '☀️'}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-black text-base text-slate-900">{pass.dogName}</h4>
                                <span className="text-xs text-slate-500 font-bold">({pass.ownerName})</span>
                                <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md font-black border border-slate-200">
                                  #{pass.passCode}
                                </span>
                                {isBoarding && (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full font-black">
                                    בנק 21 יממות VIP ⭐
                                  </span>
                                )}
                                {pass.serviceType === 'day_training' && (
                                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-black">
                                    אילוף ביומיות 🦮
                                  </span>
                                )}
                                {pass.serviceType === 'daycare' && (
                                  <span className="text-[10px] bg-cyan-100 text-cyan-900 border border-cyan-200 px-2 py-0.5 rounded-full font-black">
                                    מעון יום ☀️
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                                <span className="font-medium">📞 {pass.ownerPhone}</span>
                                <span>•</span>
                                <span>תוקף עד: <strong className="text-slate-700">{formatDateIL(pass.validUntil)}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Remaining Badge */}
                          <div className="text-left shrink-0">
                            <span className={`text-xs px-3 py-1 rounded-full font-black inline-block shadow-2xs ${
                              isCompleted 
                                ? 'bg-slate-200 text-slate-600'
                                : isBoarding
                                ? 'bg-teal-100 text-teal-950 border border-teal-400'
                                : pass.serviceType === 'day_training'
                                ? 'bg-amber-100 text-amber-950 border border-amber-400'
                                : 'bg-cyan-100 text-cyan-950 border border-cyan-400'
                            }`}>
                              {remaining} / {pass.totalDays} {isBoarding ? 'יממות נותרו' : 'ימים נותרו'}
                            </span>
                            <span className="block text-[11px] text-slate-500 font-bold mt-1 text-left">
                              ₪{pass.pricePaid} (₪{pass.dailyRate}/{isBoarding ? 'יממה' : 'יום'})
                            </span>
                          </div>
                        </div>

                        {/* 2. Management Grid: Delivery Tracking & Payment/Reference Tracking */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-3.5">
                          
                          {/* Panel A: 📲 מעקב משלוח לוואטסאפ */}
                          <div className="bg-sky-50/70 border border-sky-200/90 rounded-2xl p-3.5 flex flex-col justify-between space-y-2.5">
                            <div>
                              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-sky-200/50">
                                <span className="text-xs font-black text-sky-950 flex items-center gap-1.5">
                                  <Send className="w-3.5 h-3.5 text-sky-600" />
                                  <span>מעקב משלוח ללקוח:</span>
                                </span>
                                {isSent ? (
                                  <span className="text-[10px] bg-sky-200/80 text-sky-950 border border-sky-300 px-2 py-0.5 rounded-full font-black flex items-center gap-1 shadow-2xs">
                                    <Check className="w-3 h-3 text-sky-700" />
                                    <span>נשלח לוואטסאפ</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                                    ⏳ טרם נשלח ללקוח
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 text-xs space-y-1.5 text-slate-600">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-slate-400">נמען:</span>
                                  <span className="font-bold text-slate-800 truncate max-w-[170px]">{pass.ownerName}</span>
                                  <span className="text-slate-500 font-mono text-[11px]">({pass.sentToPhone || pass.ownerPhone})</span>
                                </div>

                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-slate-400">מועד משלוח:</span>
                                  {pass.sentAt ? (
                                    <span className="font-bold text-slate-800">
                                      {formatDateIL(pass.sentAt.slice(0, 10))} {pass.sentAt.includes('T') ? pass.sentAt.slice(11, 16) : ''}
                                    </span>
                                  ) : (
                                    <span className="text-amber-800 font-bold italic text-[11px]">לא תועד משלוח</span>
                                  )}
                                </div>

                                {pass.paymentUrl && (
                                  <div className="pt-1 flex items-center justify-between gap-1 bg-white/70 p-1.5 rounded-lg border border-sky-100">
                                    <span className="text-[11px] text-slate-500 font-bold shrink-0">קישור Grow:</span>
                                    <a 
                                      href={pass.paymentUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-[11px] text-sky-700 hover:text-sky-900 underline truncate font-mono max-w-[150px] font-bold"
                                      title={pass.paymentUrl}
                                    >
                                      קישור תשלום מאובטח
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(pass.paymentUrl!);
                                        alert('קישור התשלום הועתק בהצלחה! 📋');
                                      }}
                                      className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 cursor-pointer"
                                      title="העתק קישור תשלום"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-sky-200/50">
                              <button
                                type="button"
                                onClick={() => handleSendWhatsAppToCustomer(pass)}
                                className="flex-1 py-1.5 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                                title="שלח שובר דיגיטלי וקישור אישי בוואטסאפ ללקוח"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>{isSent ? 'שלח שוב בוואטסאפ 📲' : 'שלח שובר בוואטסאפ 📲'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyPassLink(pass)}
                                className="py-1.5 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="העתק קישור שובר דיגיטלי ללקוח"
                              >
                                <Link2 className="w-3.5 h-3.5 text-slate-500" />
                                <span>העתק קישור</span>
                              </button>
                            </div>
                          </div>

                          {/* Panel B: 🧾 מעקב תשלום ואסמכתא */}
                          <div className={`border rounded-2xl p-3.5 flex flex-col justify-between space-y-2.5 transition-all ${
                            isFullyPaid
                              ? 'bg-emerald-50/70 border-emerald-200/90'
                              : 'bg-amber-50/70 border-amber-200/90'
                          }`}>
                            <div>
                              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/50">
                                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                  <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>מעמד תשלום ואסמכתא:</span>
                                </span>
                                {isFullyPaid ? (
                                  <span className="text-[10px] bg-emerald-200/80 text-emerald-950 border border-emerald-300 px-2 py-0.5 rounded-full font-black flex items-center gap-1 shadow-2xs">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-800" />
                                    <span>שולם במלואו (₪{pass.pricePaid})</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-amber-200/80 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-full font-black flex items-center gap-1 shadow-2xs">
                                    <AlertCircle className="w-3 h-3 text-amber-800" />
                                    <span>ממתין לתשלום (חוב ₪{pass.pricePaid})</span>
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 text-xs space-y-1.5 text-slate-600">
                                {/* Reference Number Row */}
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-slate-500 font-bold shrink-0">מספר אסמכתא:</span>
                                  {pass.paymentReference ? (
                                    <div className="inline-flex items-center gap-1.5 bg-white border border-emerald-300/80 px-2.5 py-0.5 rounded-lg shadow-2xs">
                                      <span className="font-mono font-black text-xs text-emerald-900">
                                        #{pass.paymentReference}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(pass.paymentReference!);
                                          alert(`אסמכתא #${pass.paymentReference} הועתקה! 📋`);
                                        }}
                                        className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                        title="העתק אסמכתא"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPaymentReferenceModal(pass)}
                                      className="text-amber-900 hover:text-amber-950 font-bold bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-md text-[11px] cursor-pointer inline-flex items-center gap-1"
                                      title="הזן כעת מספר אסמכתא"
                                    >
                                      <span>⚠️ טרם הוזנה אסמכתא [+ הזן כעת]</span>
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                                  <div>
                                    <span className="text-slate-400 block">אמצעי תשלום:</span>
                                    <span className="font-bold text-slate-800">
                                      {pass.paymentMethod || 'Grow (אשראי / Bit)'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block">מועד תשלום:</span>
                                    <span className="font-bold text-slate-800">
                                      {pass.paidAt ? formatDateIL(pass.paidAt.slice(0, 10)) : (isFullyPaid ? 'הוסדר' : 'ממתין')}
                                    </span>
                                  </div>
                                </div>

                                {pass.paymentNotes && (
                                  <div className="text-[11px] text-slate-500 bg-white/70 p-1 rounded border border-slate-200 truncate" title={pass.paymentNotes}>
                                    📝 {pass.paymentNotes}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/50">
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentReferenceModal(pass)}
                                className="flex-1 py-1.5 px-3 bg-white hover:bg-emerald-50 text-emerald-950 border border-emerald-300 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                                title="עדכן מספר אסמכתא, אמצעי תשלום ופרטי גבייה"
                              >
                                <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                                <span>{pass.paymentReference ? 'ערוך אסמכתא ✏️' : 'הזן אסמכתא 🧾'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleTogglePassPaid(pass)}
                                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                  isFullyPaid
                                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                }`}
                                title={isFullyPaid ? 'לחץ לשינוי סטטוס תשלום' : 'אשר קבלת תשלום והזן אסמכתא'}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{isFullyPaid ? 'שולם ✓' : 'אשר תשלום 💳'}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 3. Visual Punch Circles & Stay Usage History (Collapsible / Clean) */}
                        <div className="my-2 pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 font-bold">
                            <span className="flex items-center gap-1.5">
                              <span>{isBoarding ? 'ניצול יממות הפנסיון בבנק:' : 'ניצול ימי הכרטיסייה:'}</span>
                              <span className="font-black text-slate-800">
                                {pass.usedDays || 0} נוצלו מתוך {pass.totalDays} ({remaining} פנויות)
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleDaysExpanded(pass.id)}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer flex items-center gap-0.5"
                            >
                              <span>{isDaysExpanded ? 'הסתר עיגולים' : 'הצג עיגולים (1-21)'}</span>
                              {isDaysExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>
                          
                          {/* Punch circles shown if expanded */}
                          {isDaysExpanded && (
                            <div className="flex flex-wrap gap-1.5 my-2 p-2 bg-slate-50/70 rounded-xl border border-slate-100 animate-in fade-in">
                              {Array.from({ length: pass.totalDays }).map((_, idx) => {
                                const isUsed = idx < pass.usedDays;
                                return (
                                  <div
                                    key={idx}
                                    className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center transition-all ${
                                      isUsed
                                        ? isBoarding ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-emerald-500 text-white shadow-2xs'
                                        : 'bg-white text-slate-400 border border-slate-200 border-dashed'
                                    }`}
                                    title={isUsed ? `${isBoarding ? 'יממה' : 'יום'} ${idx + 1} נוצלה` : `${isBoarding ? 'יממה' : 'יום'} ${idx + 1} פנויה`}
                                  >
                                    {idx + 1}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Usage history preview if any */}
                          {pass.usageHistory && pass.usageHistory.length > 0 && (
                            <div className="bg-slate-50 p-2.5 rounded-xl text-[11px] text-slate-600 space-y-1 mt-2">
                              <span className="font-bold text-slate-700 block">היסטוריית שהיות ומימושים:</span>
                              {pass.usageHistory.map((u, uIdx) => (
                                <div key={uIdx} className="flex items-center justify-between">
                                  <span>
                                    📅 {formatDateIL(u.date)}
                                    {u.endDate && u.endDate !== u.date && ` עד ${formatDateIL(u.endDate)} (${u.daysCount || 1} יממות)`}
                                  </span>
                                  <span className="text-slate-400">{u.notes || 'שריון רגיל'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 4. Bottom Action Bar: שריין ביומן, ערוך, מחק */}
                        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 flex-wrap">
                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPassForBooking(pass);
                                setBookingDate(getTodayStr());
                                setBookingEndDate(getTodayStr());
                              }}
                              className={`flex-1 py-2 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer min-w-[140px] ${
                                isBoarding 
                                  ? 'bg-indigo-600 hover:bg-indigo-700' 
                                  : 'bg-emerald-600 hover:bg-emerald-700'
                              }`}
                            >
                              <CalendarDays className="w-3.5 h-3.5" />
                              <span>{isBoarding ? 'שריין פנסיון ביומן 🌙' : 'שריין יום ביומן ☀️'}</span>
                              {!isFullyPaid && (
                                <span className="text-[10px] bg-amber-950/40 text-amber-100 px-1.5 py-0.2 rounded-md font-normal">בהקפה</span>
                              )}
                            </button>
                          )}

                          {/* Button: ערוך כרטיסייה / כיול ימים */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditPass(pass)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                            title="ערוך פרטי כרטיסייה וכייל ימים שנוצלו"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-600" />
                            <span>ערוך כרטיסייה ✏️</span>
                          </button>

                          {/* Button: ניוד ימים לכרטיסייה/כלב */}
                          <button
                            type="button"
                            onClick={() => handleOpenTransferModal(pass)}
                            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 hover:border-indigo-300 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                            title="ניוד ימים מכרטיסייה זו לכרטיסייה אחרת או לכלב אחר של הלקוח"
                          >
                            <Repeat className="w-3.5 h-3.5 text-indigo-600" />
                            <span>ניוד ימים 🔄</span>
                          </button>

                          {/* Delete pass button */}
                          <button
                            type="button"
                            onClick={() => handleDeletePass(pass)}
                            className="p-2 bg-white hover:bg-red-50 text-slate-400 hover:text-red-700 border border-slate-200 hover:border-red-300 rounded-xl transition-all cursor-pointer"
                            title="מחק כרטיסייה לצמיתות"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SUB-MODAL: BOOK A STAY FROM PASS */}
        {selectedPassForBooking && (() => {
          const isBoarding = selectedPassForBooking.serviceType === 'boarding';
          const calculatedNights = isBoarding 
            ? Math.max(1, calculateDaysCount(bookingDate, bookingEndDate || bookingDate)) 
            : 1;
          const remainingDays = selectedPassForBooking.totalDays - selectedPassForBooking.usedDays;

          return (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full p-5 text-slate-900 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                      isBoarding ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isBoarding ? '🌙' : '📅'}
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-900">
                        {isBoarding ? `שריון פנסיון ל-${selectedPassForBooking.dogName}` : `שריון יום ל-${selectedPassForBooking.dogName}`}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {isBoarding ? 'בנק 21 יממות VIP' : 'כרטיסייה'} {selectedPassForBooking.passCode} (נותרו {remainingDays} {isBoarding ? 'יממות' : 'ימים'})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPassForBooking(null)}
                    className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {isBoarding ? (
                  /* Boarding Multi-Day Range Picker */
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          תאריך כניסה לפנסיון *
                        </label>
                        <input
                          type="date"
                          required
                          value={bookingDate}
                          onChange={(e) => {
                            setBookingDate(e.target.value);
                            if (bookingEndDate < e.target.value) {
                              setBookingEndDate(e.target.value);
                            }
                          }}
                          className="w-full bg-slate-50 text-slate-900 text-sm font-bold px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          תאריך יציאה מהפנסיון *
                        </label>
                        <input
                          type="date"
                          required
                          min={bookingDate}
                          value={bookingEndDate}
                          onChange={(e) => setBookingEndDate(e.target.value)}
                          className="w-full bg-slate-50 text-slate-900 text-sm font-bold px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between text-xs text-indigo-950 font-bold">
                      <span>יממות לקיזוז מהבנק:</span>
                      <span className="text-sm bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg shadow-2xs">
                        {calculatedNights} יממות (נותרו {remainingDays})
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Single Day Picker for Daycare / Training */
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      תאריך ההגעה לריזורט *
                    </label>
                    <input
                      type="date"
                      required
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 text-sm font-bold px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    הערות מיוחדות לשריון (אופציונלי)
                  </label>
                  <input
                    type="text"
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder={isBoarding ? 'למשל: מגיע בשעה 10:00, אוכל מיוחד מהבית' : 'למשל: מגיע ב-08:30, איסוף ע״י האבא'}
                    className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className={`p-3 rounded-xl border text-xs ${
                  isBoarding 
                    ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950' 
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  ✨ <strong>ללא תשלום נוסף:</strong> {isBoarding ? `${calculatedNights} יממות יקוזזו מבנק ה-VIP` : 'יום אחד יקוזז מהכרטיסייה'}, וייווצר אירוע שריון ירוק וסגור ביומן הריזורט לתאריכים שנבחרו.
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isBookingSubmitting || (isBoarding && calculatedNights > remainingDays)}
                    onClick={handleConfirmDeductBooking}
                    className={`flex-1 py-3 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                      isBoarding 
                        ? 'bg-indigo-600 hover:bg-indigo-700' 
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {isBookingSubmitting ? 'משריין ביומן...' : isBoarding ? `אשר שריון ${calculatedNights} יממות וקזז מהבנק 🌙` : 'אשר שריון יום וקזז מהכרטיסייה 🐾'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPassForBooking(null)}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal 3: עריכה וכיול כרטיסייה / בנק ימים */}
        {editingPass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full p-6 text-slate-900 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xl">
                    ✏️
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      כיול ועריכת כרטיסייה #{editingPass.passCode}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {editingPass.dogName} ({editingPass.ownerName} - {editingPass.ownerPhone})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPass(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Dog Name Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">🐶 שם הכלב / הכלבים המשויכים לכרטיסייה</label>
                <input
                  type="text"
                  value={editDogName}
                  onChange={(e) => setEditDogName(e.target.value)}
                  placeholder="למשל: ירדנה וקצח"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block">
                  במידה והכרטיסייה משמשת עבור מספר כלבים של אותו לקוח, רשמו את שמותיהם (למשל: ירדנה וקצח)
                </span>
              </div>

              {/* Days Calibration Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">סה"כ ימים/יממות בכרטיסייה</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editTotalDays}
                    placeholder="1"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setEditTotalDays(e.target.value)}
                    onBlur={() => {
                      if (editTotalDays === '' || Number(editTotalDays) < 1) {
                        setEditTotalDays(1);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">ימים שנוצלו בפועל</label>
                  <input
                    type="number"
                    min="0"
                    max={Number(editTotalDays) || 100}
                    value={editUsedDays}
                    placeholder="0"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setEditUsedDays(e.target.value)}
                    onBlur={() => {
                      if (editUsedDays === '' || Number(editUsedDays) < 0) {
                        setEditUsedDays(0);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Live Remaining Days Preview Banner */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900">יתרה עדכנית למימוש:</span>
                <span className="text-sm font-black text-emerald-800 bg-white px-3 py-1 rounded-lg border border-emerald-300 shadow-xs">
                  🎟️ {Math.max(0, (Number(editTotalDays) || 0) - (Number(editUsedDays) || 0))} מתוך {Number(editTotalDays) || 0} ימים נותרו
                </span>
              </div>

              {/* Financial and Expiry Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">מחיר ששולם (₪)</label>
                  <input
                    type="number"
                    min="0"
                    value={editPricePaid}
                    placeholder="0"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setEditPricePaid(e.target.value)}
                    onBlur={() => {
                      if (editPricePaid === '' || Number(editPricePaid) < 0) {
                        setEditPricePaid(0);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">סטטוס תשלום</label>
                  <select
                    value={editPaymentStatus}
                    onChange={(e) => setEditPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="fully_paid">שולם במלואו ✓</option>
                    <option value="unpaid">טרם שולם (חוב) ⚠️</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">תאריך תוקף</label>
                <input
                  type="date"
                  value={editValidUntil}
                  onChange={(e) => setEditValidUntil(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">הערות / פירוט סופי שבוע ומימושים</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="פירוט תאריכי מימוש, הערות מיוחדות או אסמכתאות..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={handleSaveEditedPass}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>שומר שינויים...</span>
                    </>
                  ) : (
                    <span>שמור שינויים וכייל כרטיסייה ✅</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setEditingPass(null)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Modal 4: ניהול תשלום ואסמכתא מהיר */}
        {paymentModalPass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full p-6 text-slate-900 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl shadow-2xs">
                    🧾
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      ניהול תשלום ואסמכתא #{paymentModalPass.passCode}
                    </h3>
                    <p className="text-xs text-slate-500 font-bold">
                      {paymentModalPass.dogName} ({paymentModalPass.ownerName} - {paymentModalPass.ownerPhone})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentModalPass(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Radio */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">סטטוס תשלום הכרטיסייה:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayModalStatus('fully_paid')}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      payModalStatus === 'fully_paid'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>שולם במלואו 🟢</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayModalStatus('unpaid')}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      payModalStatus === 'unpaid'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>ממתין לתשלום ⏳</span>
                  </button>
                </div>
              </div>

              {/* Reference Number Field */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  מספר אסמכתא (Grow Transaction ID / מספר קבלה / שובר):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={payModalReference}
                    onChange={(e) => setPayModalReference(e.target.value)}
                    placeholder="למשל: 36202567 או grow_saar_6310 או 175543879"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {payModalReference && (
                    <button
                      type="button"
                      onClick={() => setPayModalReference('')}
                      className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block">
                  מופיע במיילי אישור Grow / Bit / קבלה מ-Morning. מקל על איתור מהיר והנהלת חשבונות.
                </span>
              </div>

              {/* Payment Method & Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">אמצעי תשלום:</label>
                  <select
                    value={payModalMethod}
                    onChange={(e) => setPayModalMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Grow (אשראי / Bit)">Grow (אשראי / Bit)</option>
                    <option value="Bit ישיר">Bit ישיר</option>
                    <option value="העברה בנקאית">העברה בנקאית</option>
                    <option value="מזומן">מזומן</option>
                    <option value="אחר">אחר</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">סכום ששולם (₪):</label>
                  <input
                    type="number"
                    value={payModalAmount}
                    onChange={(e) => setPayModalAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Payment Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">תאריך ביצוע התשלום:</label>
                <input
                  type="date"
                  value={payModalDate}
                  onChange={(e) => setPayModalDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">הערות תשלום / גבייה:</label>
                <input
                  type="text"
                  value={payModalNotes}
                  onChange={(e) => setPayModalNotes(e.target.value)}
                  placeholder="הערה חופשית (למשל: שולם מראש בביט, אושר מול הלקוח)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingPaymentModal}
                  onClick={handleSavePaymentReferenceModal}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingPaymentModal ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>שומר נתונים...</span>
                    </>
                  ) : (
                    <span>שמור נתוני אסמכתא ותשלום ✓</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentModalPass(null)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 5: ניוד והעברת ימים בין כרטיסיות ומכלב לכלב */}
        {transferModal && (() => {
          const sourcePass = passesList.find(p => p.id === transferModal.sourcePassId);
          const targetPass = passesList.find(p => p.id === transferModal.targetPassId);

          const sourceRem = sourcePass ? sourcePass.totalDays - sourcePass.usedDays : 0;
          const targetRem = targetPass ? targetPass.totalDays - targetPass.usedDays : 0;
          const targetIsOverdraft = targetRem < 0;
          const targetOverdraftDays = targetIsOverdraft ? Math.abs(targetRem) : 0;

          const numDays = typeof transferModal.daysCount === 'number' 
            ? transferModal.daysCount 
            : (parseInt(String(transferModal.daysCount), 10) || 1);
          const effectiveDays = Math.max(1, numDays);

          // Projected after transfer
          const projectedSourceTotal = sourcePass ? sourcePass.totalDays - effectiveDays : 0;
          const projectedSourceRem = sourcePass ? projectedSourceTotal - sourcePass.usedDays : 0;
          const projectedTargetTotal = targetPass ? targetPass.totalDays + effectiveDays : 0;
          const projectedTargetRem = targetPass ? projectedTargetTotal - targetPass.usedDays : 0;

          // Candidates for target pass
          const targetCandidates = passesList.filter(p => p.id !== transferModal.sourcePassId);

          // Highlight if source and target belong to same customer
          const isSameCustomer = Boolean(
            sourcePass && targetPass && 
            ((cleanPhoneNumber(sourcePass.ownerPhone) && cleanPhoneNumber(sourcePass.ownerPhone) === cleanPhoneNumber(targetPass.ownerPhone)) ||
             sourcePass.ownerName === targetPass.ownerName)
          );

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-xl w-full p-5 sm:p-6 text-slate-900 space-y-4 max-h-[94vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-xl shadow-md">
                      🔄
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        ניוד ימים בין כרטיסיות ומכלב לכלב
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        העברת ימי שהייה ואיזון מכסות בין כרטיסיות הלקוח (הגון והגיוני)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTransferModal(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Info Alert */}
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3 text-xs text-indigo-950 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong>לקוחות עם 2 כלבים ו-2 כרטיסיות:</strong> ניתן להעביר ימי שהייה בקלות בין הכלבים והכרטיסיות. הניוד מעדכן את מכסות שני הכרטיסים במדויק ומתעד היסטוריה מלאה.
                  </div>
                </div>

                {/* Selection Section: Source & Target */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* SOURCE PASS */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                        <span>📤</span>
                        <span>כרטיסיית מקור (תגרע ימים)</span>
                      </span>
                    </div>

                    <select
                      value={transferModal.sourcePassId}
                      onChange={(e) => {
                        const newSourceId = e.target.value;
                        let newTargetId = transferModal.targetPassId;
                        if (newTargetId === newSourceId) {
                          const other = passesList.find(p => p.id !== newSourceId);
                          newTargetId = other?.id || '';
                        }
                        setTransferModal({
                          ...transferModal,
                          sourcePassId: newSourceId,
                          targetPassId: newTargetId
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {passesList.map(p => {
                        const rem = p.totalDays - p.usedDays;
                        return (
                          <option key={p.id} value={p.id}>
                            #{p.passCode} · {p.dogName} ({p.ownerName}) [יתרה: {rem}/{p.totalDays}]
                          </option>
                        );
                      })}
                    </select>

                    {sourcePass && (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 text-[11px] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">כלב ובעלים:</span>
                          <span className="font-bold text-slate-800">{sourcePass.dogName} ({sourcePass.ownerName})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">סוג שירות:</span>
                          <span className="font-bold text-slate-700">{sourcePass.serviceType === 'boarding' ? 'בנק 21 יממות פנסיון 🌙' : 'יומיות ☀️'}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-100">
                          <span className="text-slate-500">מכסה נוכחית:</span>
                          <span className="font-black text-indigo-700">
                            {sourceRem} נותרו מתוך {sourcePass.totalDays} ימ'
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TARGET PASS */}
                  <div className={`p-3.5 rounded-2xl border space-y-2 ${
                    targetIsOverdraft ? 'bg-rose-50/70 border-rose-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                        <span>📥</span>
                        <span>כרטיסיית יעד (תקבל ימים)</span>
                      </span>
                      {targetIsOverdraft && (
                        <span className="text-[10px] bg-rose-200 text-rose-950 font-black px-1.5 py-0.5 rounded-md">
                          חריגה של {targetOverdraftDays} ימים 🚨
                        </span>
                      )}
                    </div>

                    <select
                      value={transferModal.targetPassId}
                      onChange={(e) => {
                        setTransferModal({
                          ...transferModal,
                          targetPassId: e.target.value
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {targetCandidates.map(p => {
                        const rem = p.totalDays - p.usedDays;
                        const isSame = Boolean(
                          sourcePass && (
                            (cleanPhoneNumber(sourcePass.ownerPhone) && cleanPhoneNumber(sourcePass.ownerPhone) === cleanPhoneNumber(p.ownerPhone)) ||
                            sourcePass.ownerName === p.ownerName
                          )
                        );
                        return (
                          <option key={p.id} value={p.id}>
                            {isSame ? '⭐ ' : ''}#{p.passCode} · {p.dogName} ({p.ownerName}) [יתרה: {rem}/{p.totalDays}]{rem < 0 ? ' 🚨 חריגה' : ''}
                          </option>
                        );
                      })}
                    </select>

                    {targetPass && (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 text-[11px] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">כלב ובעלים:</span>
                          <span className="font-bold text-slate-800">{targetPass.dogName} ({targetPass.ownerName})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">סוג שירות:</span>
                          <span className="font-bold text-slate-700">{targetPass.serviceType === 'boarding' ? 'בנק 21 יממות פנסיון 🌙' : 'יומיות ☀️'}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-100">
                          <span className="text-slate-500">מכסה נוכחית:</span>
                          <span className={`font-black ${targetIsOverdraft ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {targetRem} נותרו מתוך {targetPass.totalDays} ימ'
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Same Customer badge */}
                {isSameCustomer && (
                  <div className="bg-emerald-50 text-emerald-950 text-xs font-bold p-2.5 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>🐕🐕</span>
                      <span>זוהו 2 כרטיסיות של אותו הלקוח ({sourcePass?.ownerName}) – ניוד פנים-משפחתי הגון</span>
                    </span>
                    <span className="text-[10px] bg-emerald-200 px-2 py-0.5 rounded-full font-black">
                      תואם 100%
                    </span>
                  </div>
                )}

                {/* Overdraft Quick Balance Action */}
                {targetIsOverdraft && (
                  <div className="p-3 bg-gradient-to-r from-rose-50 to-amber-50 rounded-2xl border border-rose-300 flex items-center justify-between gap-3">
                    <div className="text-xs">
                      <span className="font-black text-rose-950 block">
                        🚨 כרטיסיית {targetPass?.dogName} נמצאת בחריגה של {targetOverdraftDays} ימים!
                      </span>
                      <span className="text-slate-600 text-[11px]">
                        בלחיצה אחת תוכל להגדיר ניוד של {targetOverdraftDays} ימים כדי לאפס את החריגה.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTransferModal({
                          ...transferModal,
                          daysCount: targetOverdraftDays
                        });
                      }}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer shadow-xs flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>כסה חריגה ({targetOverdraftDays} ימ') ⚡</span>
                    </button>
                  </div>
                )}

                {/* Quantity Input & Quick Chips */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">
                    כמות ימים / יממות להעברה מכרטיסיית המקור ליעד:
                  </label>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.max(1, effectiveDays - 1);
                          setTransferModal({ ...transferModal, daysCount: val });
                        }}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={sourcePass ? sourcePass.totalDays : 100}
                        value={transferModal.daysCount}
                        onChange={(e) => setTransferModal({ ...transferModal, daysCount: e.target.value })}
                        className="w-16 text-center font-black text-base text-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = effectiveDays + 1;
                          setTransferModal({ ...transferModal, daysCount: val });
                        }}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    {/* Quick selection chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[1, 2, 3, 5, 7].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setTransferModal({ ...transferModal, daysCount: num })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                            effectiveDays === num
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          +{num} {num === 1 ? 'יום' : 'ימים'}
                        </button>
                      ))}

                      {sourceRem > 0 && (
                        <button
                          type="button"
                          onClick={() => setTransferModal({ ...transferModal, daysCount: sourceRem })}
                          className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 cursor-pointer"
                        >
                          כל היתרה ({sourceRem})
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* LIVE BEFORE & AFTER PREVIEW */}
                {sourcePass && targetPass && (
                  <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-2 shadow-md">
                    <span className="text-[11px] font-black text-slate-300 block flex items-center gap-1">
                      <span>📊</span>
                      <span>תצוגה מקדימה של השינוי במכסות:</span>
                    </span>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Source after */}
                      <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
                        <div className="font-bold text-slate-300 text-[11px] truncate">{sourcePass.dogName} (מקור):</div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-slate-400 line-through text-[11px]">{sourcePass.totalDays} ימ'</span>
                          <span className="text-amber-400 font-black text-sm">➔ {projectedSourceTotal} ימ'</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          יתרה: {projectedSourceRem} פנויות
                        </div>
                      </div>

                      {/* Target after */}
                      <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
                        <div className="font-bold text-slate-300 text-[11px] truncate">{targetPass.dogName} (יעד):</div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-slate-400 line-through text-[11px]">{targetPass.totalDays} ימ'</span>
                          <span className="text-emerald-400 font-black text-sm">➔ {projectedTargetTotal} ימ'</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          יתרה: {projectedTargetRem} פנויות {projectedTargetRem >= 0 ? '✓ מאוזן!' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reason / Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    סיבת הניוד (תתועד בהיסטוריית הכרטיסיות):
                  </label>
                  <input
                    type="text"
                    value={transferModal.reason}
                    onChange={(e) => setTransferModal({ ...transferModal, reason: e.target.value })}
                    placeholder="למשל: ניוד ימים מקצח לירדנה לבקשת הלקוח"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isSavingTransfer || !sourcePass || !targetPass || effectiveDays <= 0}
                    onClick={handleExecuteTransfer}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-700 hover:to-teal-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingTransfer ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>מבצע ניוד ימים...</span>
                      </>
                    ) : (
                      <>
                        <Repeat className="w-4 h-4" />
                        <span>אשר ניוד {effectiveDays} ימים מ-{sourcePass?.dogName || 'מקור'} ל-{targetPass?.dogName || 'יעד'} 🔄</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferModal(null)}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
