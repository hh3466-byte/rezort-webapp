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
  Loader2
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
  deductDayFromPassInDb,
  subscribeToDaycarePasses 
} from '../services/dbService';
import { createGrowDynamicPaymentLink } from '../services/growPaymentService';
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
  const [totalDays, setTotalDays] = useState<number>(initialDays);
  const [dailyRate, setDailyRate] = useState<number>(initialRates.dailyRate);
  const [pricePaid, setPricePaid] = useState<number>(initialRates.totalPrice);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('fully_paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bit');
  const [customNotes, setCustomNotes] = useState<string>('');

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
            dogName: req.dogName || '',
            dogBreed: req.dogBreed || enriched.breed || '',
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
      // Boarding pass is strictly locked to 21 days at 100 NIS/day = 2,100 NIS
      setTotalDays(21);
      setDailyRate(100);
      setPricePaid(2100);
    } else if (type === 'day_training') {
      const targetDays = totalDays === 21 ? 10 : totalDays;
      if (totalDays === 21) setTotalDays(10);
      const rate = settings.defaultDailyRateDayTraining || 250;
      setDailyRate(rate);
      setPricePaid(rate * targetDays);
    } else {
      const targetDays = totalDays === 21 ? 10 : totalDays;
      if (totalDays === 21) setTotalDays(10);
      const calc = getDaycareProgressiveRate(targetDays, settings.defaultDailyRateDaycare || 90);
      setDailyRate(calc.dailyRate);
      setPricePaid(calc.totalPrice);
    }
  };

  const handleTotalDaysChange = (days: number) => {
    if (serviceType === 'boarding') {
      // Locked to 21 days
      setTotalDays(21);
      setDailyRate(100);
      setPricePaid(2100);
      return;
    }
    const d = Math.max(1, days);
    setTotalDays(d);
    if (serviceType === 'daycare') {
      const calc = getDaycareProgressiveRate(d, settings.defaultDailyRateDaycare || 90);
      setDailyRate(calc.dailyRate);
      setPricePaid(calc.totalPrice);
    } else {
      const rate = settings.defaultDailyRateDayTraining || 250;
      setDailyRate(rate);
      setPricePaid(rate * d);
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

  // Build direct digital questionnaire link for this pass
  const getPassBookingLink = (pass: DaycarePass) => {
    const cleanP = cleanPhoneNumber(pass.ownerPhone);
    return `https://rezort-webapp.vercel.app/?request=true&pass=${pass.passCode}&phone=${encodeURIComponent(cleanP)}&name=${encodeURIComponent(pass.ownerName)}&dog=${encodeURIComponent(pass.dogName)}`;
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
      totalDays: serviceType === 'boarding' ? 21 : totalDays,
      usedDays: 0,
      pricePaid: serviceType === 'boarding' ? 2100 : pricePaid,
      dailyRate: serviceType === 'boarding' ? 100 : dailyRate,
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

    await saveDaycarePassToDb(newPass);
    setCreatedPassResult(newPass);

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
      const desc = isBoarding
        ? `חבילת 21 יממות פנסיון VIP - ${dogName.trim()}`
        : serviceType === 'day_training'
        ? `כרטיסיית ${totalDays} אילוף ביומיות - ${dogName.trim()}`
        : `כרטיסיית ${totalDays} יומיות (מעון יום) - ${dogName.trim()}`;

      const finalPrice = isBoarding ? 2100 : pricePaid;
      const finalDays = isBoarding ? 21 : totalDays;

      const growRes = await createGrowDynamicPaymentLink({
        amount: finalPrice,
        dogName: dogName.trim(),
        ownerName: ownerName.trim(),
        ownerPhone: ownerPhone.trim(),
        ownerEmail: ownerEmail.trim() || undefined,
        description: desc
      });

      const paymentUrl = growRes.paymentUrl;
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
        totalDays: finalDays,
        usedDays: 0,
        pricePaid: finalPrice,
        dailyRate: isBoarding ? 100 : dailyRate,
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

      const progressiveNote = serviceType === 'daycare' && totalDays >= 5
        ? ` (מחיר מוזל בטור יורד: ₪${dailyRate} ליום במקום ₪90! חיסכון של ₪${((settings.defaultDailyRateDaycare || 90) * totalDays - pricePaid).toFixed(0)} 🎉)`
        : '';

      const msg = isBoarding ? `שלום ${ownerName.trim()}! 🐾🐶
שמחים לצרף אתכם למועדון ה-VIP של הריזורט לכלב! 🌟
לבקשתך, מצורף קישור לרכישה מאובטחת של *חבילת 21 יממות פנסיון מלא (VIP)* עבור *${dogName.trim()}*:

🌙 *חבילה:* 21 יממות פנסיון ואירוח מלא (לינה, חצרות, השגחה ואהבה ❤️)
💰 *סכום לתשלום:* ₪2,100 בלבד (₪100 ליממה במקום ₪180 – חיסכון ענק של ₪1,680! 🎉)
⏳ *תוקף החבילה:* שנה מלאה (עד ${formatDateIL(expiry)})
🎟️ *מספר כרטיסייה שמור עבורכם:* *${passCode}*
💡 *אופן הניצול:* גמיש וחופשי לחלוטין – משריינים ימים מתי שרוצים לאורך השנה עד לגמר היתרה!

💳 *לתשלום מאובטח בלחיצה (כולל Bit, Apple Pay, Google Pay, PayBox וכרטיסי אשראי):*
👉 \u200E${paymentUrl}

לאחר ביצוע התשלום המערכת מפעילה את הכרטיסייה אוטומטית ותוכלו להתחיל לשריין מועדים לכל השנה! מחכים לראותכם 🐶✨
שמוליק וכל צוות הריזורט לכלב 🐾` : `שלום ${ownerName.trim()}! 🐾
לבקשתך, מצורף קישור לרכישה מאובטחת של *כרטיסיית ${totalDays} יומיות* עבור *${dogName.trim()}* בריזורט לכלב:

🎟️ *חבילה:* ${totalDays} ימי שהייה ביומיות (${serviceType === 'day_training' ? 'אילוף ביומיות' : 'מעון יום'})
💰 *סכום לתשלום:* ₪${pricePaid}${progressiveNote}
⏳ *תוקף הכרטיסייה:* חצי שנה (עד ${formatDateIL(expiry)})
🎟️ *מספר כרטיסייה שמור עבורכם:* *${passCode}*

💳 *לתשלום מאובטח בלחיצה (כולל Bit, Apple Pay, Google Pay, PayBox וכרטיסי אשראי):*
👉 \u200E${paymentUrl}

לאחר ביצוע התשלום המערכת מאשרת את הכרטיסייה אוטומטית וניתן לתאם ימי הגעה לריזורט! מחכים לראותכם 🐶✨
שמוליק וכל צוות הריזורט לכלב 🐾`;

      openWhatsAppMessage(ownerPhone, msg);
    } catch (err: any) {
      alert(`שגיאה בהפקת קישור תשלום: ${err?.message || 'נסה שוב'}`);
    } finally {
      setIsGeneratingGrowLink(false);
    }
  };

  // Send WhatsApp to Customer with instructions and direct digital questionnaire link
  const handleSendWhatsAppToCustomer = (pass: DaycarePass) => {
    const remainingDays = pass.totalDays - pass.usedDays;
    const isBoarding = pass.serviceType === 'boarding';
    const serviceName = isBoarding 
      ? 'בנק 21 יממות פנסיון מלא (VIP)'
      : pass.serviceType === 'day_training' 
      ? 'אילוף ביומיות (ללא לינה)' 
      : 'שהייה יומית בריזורט לכלב (מעון יום)';

    const link = getPassBookingLink(pass);

    const msg = isBoarding ? `שלום ${pass.ownerName}! 🐾🐶
הונפקה עבורכם בהצלחה *כרטיסיית בנק 21 יממות פנסיון VIP* עבור *${pass.dogName}* בריזורט לכלב! 🌟

🎟️ *מספר הכרטיסייה שלכם:* *${pass.passCode}*
📅 *כמות ימים בחבילה:* *21 יממות פנסיון מלא* (יתרה נוכחית: *${remainingDays} יממות*)
⏳ *תוקף הכרטיסייה:* עד לתאריך *${formatDateIL(pass.validUntil)}* (שנה מלאה)
💰 *סכום ששולם:* ₪${pass.pricePaid} (₪100 ליממה)

💡 *איך משריינים מועדי אירוח מהבנק שלכם?*
בכל פעם שתרצו להביא את ${pass.dogName} לפנסיון (סופ"ש, חגים, חופשות וכו'), פשוט נכנסים לקישור הבא, בוחרים את תאריכי הכניסה והיציאה ומגישים בקשת שריון לשמוליק:
👉 \u200E${link}

שמוליק יקבל את הבקשה ישירות במערכת ויאשר את המקום ביומן הריזורט (היממות יקוזזו אוטומטית מהבנק שלכם ללא כל תשלום נוסף)! 🐕🤍
שמוליק וכל צוות הריזורט לכלב 🐾` : `שלום ${pass.ownerName}! 🐾🐶
הונפקה עבורכם בהצלחה *כרטיסיית ${serviceName}* בריזורט לכלב!

🎟️ *מספר הכרטיסייה שלכם:* *${pass.passCode}*
📅 *כמות ימים:* *${pass.totalDays} ימים* (יתרה נוכחית: *${remainingDays} ימים*)
⏳ *תוקף הכרטיסייה:* עד לתאריך *${formatDateIL(pass.validUntil)}* (תוקף לחצי שנה)
💰 *סכום ששולם:* ₪${pass.pricePaid}

💡 *איך משריינים יום הגעה לריזורט?*
על מנת להבטיח שריון מקום ולוודא שאין עומס במתחם, *חובה להגיש בקשת שריון קצרה מראש לכל יום הגעה בנפרד*.
בכל פעם שתרצו להביא את ${pass.dogName}, פשוט נכנסים לקישור הבא ובוחרים את תאריך ההגעה:
👉 \u200E${link}

שמוליק יקבל את הבקשה ישירות במערכת ויאשר את שריון המקום ביומן הריזורט (ללא כל תשלום נוסף)! 🐕🤍
שמוליק וכל צוות הריזורט לכלב 🐾`;

    openWhatsAppMessage(pass.ownerPhone, msg);
  };

  // Copy booking link to clipboard
  const handleCopyPassLink = (pass: DaycarePass) => {
    const link = getPassBookingLink(pass);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Deduct a day and create a real booking in Calendar
  // Deduct a day (or multi-day boarding stay) and create a real booking in Calendar
  const handleConfirmDeductBooking = async () => {
    if (!selectedPassForBooking) return;
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
        totalPrice: 0, // Already prepaid via pass
        depositAmount: 0,
        paymentStatus: 'fully_paid',
        paymentMethod: selectedPassForBooking.paymentMethod || 'bit',
        stayStatus: 'booked',
        vaccinationValid: true,
        daycarePassId: selectedPassForBooking.id,
        daycarePassCode: selectedPassForBooking.passCode,
        notes: `מימוש מתוך ${isBoardingBooking ? 'בנק 21 יממות פנסיון VIP' : 'כרטיסייה'} ${selectedPassForBooking.passCode} (${daysToDeduct} ${isBoardingBooking ? 'יממות' : 'ימים'}, נותרו ${res.pass.totalDays - res.pass.usedDays} ימים)${bookingNotes ? ` | ${bookingNotes}` : ''}`,
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

  // Filtered list of passes for search
  const filteredPasses = passesList.filter(p => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const cleanNum = q.replace(/\D/g, '');
    return (
      p.passCode.toLowerCase().includes(q) ||
      p.dogName.toLowerCase().includes(q) ||
      p.ownerName.toLowerCase().includes(q) ||
      (cleanNum && p.ownerPhone.replace(/\D/g, '').includes(cleanNum)) ||
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
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                      הכרטיסייה הונפקה ונשמרה בהצלחה!
                    </span>
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
                      <span>שלח שובר והסבר בוואטסאפ ללקוח 📲</span>
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
                                <span>🌙 בנק 21 יממות פנסיון מלא</span>
                              </h3>
                              <p className="text-xs text-indigo-200/90 mt-1 max-w-md">
                                התחייבות מראש על 21 יממות פנסיון בריזורט לכלב. הלקוח בוחר ומושך ימי שהייה באופן גמיש לאורך שנה שלמה.
                              </p>
                            </div>
                            <div className="text-left shrink-0 bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/15">
                              <span className="text-[11px] text-indigo-200 block">מחיר חבילה סגור:</span>
                              <span className="text-2xl font-black text-amber-300">₪2,100</span>
                              <span className="text-[10px] text-indigo-200 block">(₪100 בלבד ליממה!)</span>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs relative z-10">
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-indigo-300 block text-[10px]">כמות יממות (נעול):</span>
                              <span className="font-bold text-white">🔒 21 יממות (ללא שינוי)</span>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-indigo-300 block text-[10px]">תעריף ליממה:</span>
                              <span className="font-bold text-amber-300">₪100 (במקום ₪180)</span>
                            </div>
                            <div className="bg-emerald-500/20 border border-emerald-400/30 p-2 rounded-lg text-emerald-200 font-bold">
                              <span>חיסכון כולל של ₪1,680! 🎉</span>
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
                              onChange={(e) => setPricePaid(Number(e.target.value) || 0)}
                              className="w-full bg-slate-50 font-black text-lg text-indigo-900 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none"
                            />
                            <span className="text-[11px] text-slate-400 mt-1 block">
                              21 יממות @ ₪{(pricePaid / 21).toFixed(1)} ליממה
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
                            <label className="text-xs font-bold text-slate-700">כמות ימים בכרטיסייה:</label>
                            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {totalDays} ימי פעילות
                            </span>
                          </div>

                          {/* Quick chip buttons with progressive rates */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                            {[5, 10, 15, 20].map(cnt => {
                              const isSelected = totalDays === cnt;
                              const chipCalc = serviceType === 'daycare' 
                                ? getDaycareProgressiveRate(cnt, settings.defaultDailyRateDaycare || 90)
                                : null;
                              return (
                                <button
                                  key={cnt}
                                  type="button"
                                  onClick={() => handleTotalDaysChange(cnt)}
                                  className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 text-center ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  <span className="font-black text-sm">
                                    {cnt} ימים {cnt === 10 ? '⭐' : ''}
                                  </span>
                                  {chipCalc && (
                                    <span className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                                      ₪{chipCalc.dailyRate}/יום (₪{chipCalc.totalPrice})
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={totalDays}
                              onChange={(e) => handleTotalDaysChange(Number(e.target.value) || 1)}
                              className="w-24 bg-slate-50 font-black text-center text-base py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                            />
                            <span className="text-xs text-slate-500">ימים שנרכשים מראש</span>
                          </div>
                        </div>

                        {/* Progressive Rate Banner */}
                        {serviceType === 'daycare' && (
                          <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🏷️</span>
                              <div>
                                <span className="font-extrabold">תמחור מוזל בטור יורד: </span>
                                <span>₪{dailyRate} ליום (במקום ₪{settings.defaultDailyRateDaycare || 90})</span>
                              </div>
                            </div>
                            {pricePaid < (settings.defaultDailyRateDaycare || 90) * totalDays && (
                              <span className="bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-full text-[11px] shadow-xs">
                                חיסכון של ₪{((settings.defaultDailyRateDaycare || 90) * totalDays - pricePaid).toFixed(0)} 🎉
                              </span>
                            )}
                          </div>
                        )}

                        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-slate-700 font-bold block mb-1">
                              מחיר כולל לעסקה (₪) - <span className="text-emerald-700 font-normal">ניתן לעריכה חופשית ע״י שמוליק</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={pricePaid}
                              onChange={(e) => setPricePaid(Number(e.target.value) || 0)}
                              className="w-full bg-slate-50 font-black text-lg text-emerald-700 px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                            />
                            <span className="text-[11px] text-slate-400 mt-1 block">
                              מחושב: ₪{(pricePaid / (totalDays || 1)).toFixed(1)} ליום
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
                          <span>שלח קישור לתשלום ב-Grow (₪{pricePaid} / Bit / אשראי) בוואטסאפ 📲</span>
                        </>
                      )}
                    </button>

                    <button
                      type="submit"
                      className="w-full py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm rounded-2xl border-2 border-slate-200 hover:border-emerald-500 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>הנפק כרטיסייה מיידית (שולם במזומן / ביט ישיר) ✨</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: ACTIVE PASSES LIST */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              
              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חיפוש לפי שם כלב, בעלים, טלפון או קוד שובר (PASS-XXXX)..."
                  className="w-full bg-slate-50 text-slate-900 text-xs pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {filteredPasses.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-3">
                  <Ticket className="w-10 h-10 mx-auto stroke-1" />
                  <p className="text-sm font-bold">לא נמצאו כרטיסיות פעילות</p>
                  {searchQuery ? (
                    <div>
                      <p className="text-xs mb-2">לא נמצאה כרטיסייה עבור "{searchQuery}"</p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('create');
                          setCustomerSearchQuery(searchQuery);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5"
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
                <div className="space-y-3">
                  {filteredPasses.map(pass => {
                    const isBoarding = pass.serviceType === 'boarding';
                    const remaining = Math.max(0, pass.totalDays - pass.usedDays);
                    const isCompleted = pass.usedDays >= pass.totalDays;

                    return (
                      <div 
                        key={pass.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isCompleted 
                            ? 'bg-slate-50 border-slate-200 opacity-75' 
                            : isBoarding
                            ? 'bg-gradient-to-br from-indigo-50/40 via-white to-amber-50/20 border-indigo-200 shadow-2xs hover:border-indigo-400'
                            : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                              isBoarding
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                : pass.serviceType === 'day_training' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isBoarding ? '🌙' : pass.serviceType === 'day_training' ? '🦮' : '🐾'}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-extrabold text-sm text-slate-900">{pass.dogName}</h4>
                                <span className="text-xs text-slate-500 font-medium">({pass.ownerName})</span>
                                <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md font-bold">
                                  {pass.passCode}
                                </span>
                                {isBoarding && (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full font-black">
                                    בנק 21 יממות VIP ⭐
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                <span>📞 {pass.ownerPhone}</span>
                                <span>•</span>
                                <span>תוקף עד: {formatDateIL(pass.validUntil)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Remaining Badge */}
                          <div className="text-left">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-black inline-block ${
                              isCompleted 
                                ? 'bg-slate-200 text-slate-600'
                                : isBoarding
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {remaining} / {pass.totalDays} {isBoarding ? 'יממות נותרו' : 'ימים נותרו'}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              ₪{pass.pricePaid} (₪{pass.dailyRate}/{isBoarding ? 'יממה' : 'יום'})
                            </span>
                          </div>
                        </div>

                        {/* Visual Punch Circles */}
                        <div className="my-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 font-bold">
                            <span>{isBoarding ? 'ניצול יממות הפנסיון בבנק:' : 'ניצול ימי הכרטיסייה:'}</span>
                            <span>{pass.usedDays} נוצלו מתוך {pass.totalDays} {isBoarding ? 'יממות' : 'ימים'}</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: pass.totalDays }).map((_, idx) => {
                              const isUsed = idx < pass.usedDays;
                              return (
                                <div
                                  key={idx}
                                  className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center transition-all ${
                                    isUsed
                                      ? isBoarding ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-emerald-500 text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-400 border border-slate-200 border-dashed'
                                  }`}
                                  title={isUsed ? `${isBoarding ? 'יממה' : 'יום'} ${idx + 1} נוצלה` : `${isBoarding ? 'יממה' : 'יום'} ${idx + 1} פנויה`}
                                >
                                  {idx + 1}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Usage history preview if any */}
                        {pass.usageHistory && pass.usageHistory.length > 0 && (
                          <div className="bg-slate-50 p-2.5 rounded-xl text-[11px] text-slate-600 space-y-1 mb-3">
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

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPassForBooking(pass);
                                setBookingDate(getTodayStr());
                                setBookingEndDate(getTodayStr());
                              }}
                              className={`flex-1 py-2 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer min-w-[140px] ${
                                isBoarding 
                                  ? 'bg-indigo-600 hover:bg-indigo-700' 
                                  : 'bg-emerald-600 hover:bg-emerald-700'
                              }`}
                            >
                              <CalendarDays className="w-3.5 h-3.5" />
                              <span>{isBoarding ? 'שריין פנסיון ביומן 🌙' : 'שריין יום ביומן 📅'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppToCustomer(pass)}
                            className="p-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                            title="שלח שובר / תזכורת בוואטסאפ ללקוח"
                          >
                            <Share2 className="w-4 h-4 text-emerald-600" />
                            <span className="hidden sm:inline">שלח שובר</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyPassLink(pass)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                            title="העתק קישור ישיר ללקוח"
                          >
                            <Link2 className="w-4 h-4 text-slate-600" />
                            <span className="hidden sm:inline">העתק קישור</span>
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

      </div>
    </div>
  );
};
