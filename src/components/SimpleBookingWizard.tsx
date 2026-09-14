import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Dog, 
  Phone, 
  User, 
  Mail,
  Calendar as CalendarIcon, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Sparkles, 
  FileText, 
  PenTool, 
  Send, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  DollarSign, 
  Bath, 
  Footprints, 
  Scissors, 
  Utensils, 
  AlertTriangle,
  RotateCcw,
  MessageCircle,
  Share2,
  ExternalLink,
  Mic,
  Square,
  Loader2,
  Volume2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Booking, ResortSettings, ServiceType, PaymentMethod, StayStatus, AgentActionProposal, IntakeRequest } from '../types';
import { 
  getTodayStr, 
  addDays, 
  calculateDaysCount, 
  checkRangeOccupancy, 
  formatDateIL, 
  formatDateDisplay, 
  getDayNameHebrew, 
  getBookingsForDate 
} from '../utils/dateUtils';
import { generateWhatsAppLink, getBookingConfirmationMessage } from '../utils/whatsappUtils';
import { parseVoiceOrWhatsAppText } from '../services/agentService';

interface SimpleBookingWizardProps {
  isOpen: boolean;
  initialData?: Partial<Booking> | null;
  existingBookings: Booking[];
  intakeRequests?: IntakeRequest[];
  settings: ResortSettings;
  onClose: () => void;
  onSave: (booking: Booking) => void;
}

export const SimpleBookingWizard: React.FC<SimpleBookingWizardProps> = ({
  isOpen,
  initialData,
  existingBookings,
  intakeRequests = [],
  settings,
  onClose,
  onSave,
}) => {
  const todayStr = getTodayStr();

  // Current Step: 1 = זיהוי | 2 = פרטי הכלב | 3 = תאריכים ושירות | 4 = סיכום וחתימה | 5 = הושלם בהצלחה
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1 State: Customer & Phone
  const [ownerPhone, setOwnerPhone] = useState(initialData?.ownerPhone || '');
  const [ownerName, setOwnerName] = useState(initialData?.ownerName || '');
  const [ownerEmail, setOwnerEmail] = useState(initialData?.ownerEmail || '');
  const [matchedExistingCustomer, setMatchedExistingCustomer] = useState<{
    name: string;
    dogs: { name: string; breed: string; ageGroup?: any; gender?: any }[];
  } | null>(null);

  // Availability calendar month view
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  // Step 2 State: Dog Details
  const [dogName, setDogName] = useState(initialData?.dogName || '');
  const [dogBreed, setDogBreed] = useState(initialData?.dogBreed || '');
  const [dogAgeGroup, setDogAgeGroup] = useState<'puppy' | 'young' | 'adult' | 'senior'>(
    initialData?.dogAgeGroup || 'adult'
  );
  const [dogGender, setDogGender] = useState<'male_neutered' | 'female_spayed' | 'male_intact' | 'female_intact'>(
    initialData?.dogGender || 'male_neutered'
  );
  const [crateTrained, setCrateTrained] = useState<boolean>(initialData?.crateTrained ?? true);
  const [vaccinationDates, setVaccinationDates] = useState({
    rabies: initialData?.vaccinationDates?.rabies || todayStr,
    combo: initialData?.vaccinationDates?.combo || todayStr,
    cough: initialData?.vaccinationDates?.cough || todayStr,
  });
  const [vaccinationValid, setVaccinationValid] = useState<boolean>(initialData?.vaccinationValid ?? true);
  const [specialDiet, setSpecialDiet] = useState(initialData?.specialDiet || '');
  const [medications, setMedications] = useState(initialData?.medications || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [placementNotes, setPlacementNotes] = useState(initialData?.placementNotes || '');
  const [secondDog, setSecondDog] = useState<{
    hasSecondDog: boolean;
    name: string;
    breed: string;
    gender: 'male_neutered' | 'female_spayed' | 'male_intact' | 'female_intact';
    consolidatePayment: boolean;
  }>({
    hasSecondDog: false,
    name: '',
    breed: '',
    gender: 'male_neutered',
    consolidatePayment: true,
  });

  // Free Stay & Multi-dog Consolidated Payment states
  const [isFreeStay, setIsFreeStay] = useState<boolean>(() => {
    if (initialData?.isFreeStay) return true;
    if (initialData?.totalPrice === 0 && (initialData?.notes?.includes('חינם') || initialData?.notes?.includes('ללא תשלום') || initialData?.notes?.includes('כלב נוסף'))) return true;
    return false;
  });
  const [freeStayReason, setFreeStayReason] = useState<'free' | 'second_dog'>('free');
  const [linkedMainDogName, setLinkedMainDogName] = useState<string>(initialData?.linkedDogName || '');

  // Step 3 State: Service, Dates, Times & Extras
  const [serviceType, setServiceType] = useState<ServiceType>(initialData?.serviceType || 'boarding');
  const [pricingMode, setPricingMode] = useState<'daily' | 'period'>('daily');
  const [startDate, setStartDate] = useState(initialData?.startDate || todayStr);
  const [endDate, setEndDate] = useState(initialData?.endDate || addDays(todayStr, 3));
  const [arrivalTime, setArrivalTime] = useState(initialData?.arrivalTime || '09:00 - 11:00');
  const [pickupTime, setPickupTime] = useState(initialData?.pickupTime || '17:00 - 19:00');
  
  // Daily rate
  const [dailyRate, setDailyRate] = useState<number>(() => {
    if (initialData?.dailyRate && initialData.dailyRate > 0) return initialData.dailyRate;
    if (initialData?.serviceType === 'day_training') return settings.defaultDailyRateDayTraining || 250;
    if (initialData?.serviceType === 'daycare') return settings.defaultDailyRateDaycare;
    if (initialData?.dogGender === 'male_intact') return settings.defaultDailyRateIsolation || 230;
    return settings.defaultDailyRateBoarding;
  });

  // Add-on extra services
  const [extraServices, setExtraServices] = useState<{ id: string; name: string; price: number; selected: boolean }[]>([
    { id: 'bath', name: 'מקלחת וטיפוח לפני יציאה', price: 50, selected: false },
    { id: 'walk', name: 'טיול ארוך יומי בטבע', price: 30, selected: false },
    { id: 'brush', name: 'הברשת פרווה והתרעננות', price: 40, selected: false },
    { id: 'food', name: 'מזון סופר פרמיום מהפנסיון', price: 20, selected: false },
  ]);

  // Step 4 State: Pricing, Deposit, Terms & Signature
  const [totalPrice, setTotalPrice] = useState<number>(initialData?.totalPrice || 0);
  const [depositAmount, setDepositAmount] = useState<number>(initialData?.depositAmount || 0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialData?.paymentMethod || 'bit');
  const [paymentType, setPaymentType] = useState<'full' | 'deposit' | 'unpaid'>(() => {
    if (initialData?.paymentStatus === 'fully_paid') return 'full';
    if (initialData?.depositAmount && initialData?.totalPrice && initialData.depositAmount >= initialData.totalPrice) return 'full';
    if (initialData?.depositAmount && initialData.depositAmount > 0) return 'deposit';
    return 'deposit';
  });
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>(initialData?.signatureDataUrl || '');
  const [savedBookingResult, setSavedBookingResult] = useState<Booking | null>(null);

  // Canvas for digital signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Quick Voice Assistant inside the Wizard
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const wizardRecognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'he-IL';

      recognition.onresult = (event: any) => {
        let current = '';
        for (let i = 0; i < event.results.length; i++) {
          current += event.results[i][0].transcript;
        }
        setVoiceTranscript(current);
      };

      recognition.onerror = (event: any) => {
        console.warn('Wizard speech recognition error:', event.error);
        setIsVoiceRecording(false);
        setVoiceMessage('שגיאת מיקרופון. אנא ודא שההרשאה מאושרת בדפדפן.');
      };

      recognition.onend = () => {
        setIsVoiceRecording(false);
      };

      wizardRecognitionRef.current = recognition;
    }
  }, []);

  const handleStartWizardVoice = () => {
    setVoiceMessage(null);
    setVoiceTranscript('');
    if (wizardRecognitionRef.current) {
      try {
        wizardRecognitionRef.current.start();
        setIsVoiceRecording(true);
      } catch (err) {
        try {
          wizardRecognitionRef.current.stop();
          setTimeout(() => {
            wizardRecognitionRef.current.start();
            setIsVoiceRecording(true);
          }, 200);
        } catch (e) {
          setVoiceMessage('לא ניתן להפעיל מיקרופון. אנא נסה שוב.');
        }
      }
    } else {
      setVoiceMessage('הדפדפן אינו תומך בהקלטה ישירה. הקלד ידנית או השתמש ב-Chrome.');
    }
  };

  const handleStopWizardVoiceAndFill = async () => {
    if (wizardRecognitionRef.current && isVoiceRecording) {
      try {
        wizardRecognitionRef.current.stop();
      } catch (e) {}
    }
    setIsVoiceRecording(false);

    const spokenText = voiceTranscript.trim();
    if (!spokenText) {
      setVoiceMessage('לא נקלט קול. לחץ על המיקרופון ודבר ברור.');
      return;
    }

    setIsVoiceProcessing(true);
    setVoiceMessage('מפענח את ההקלטה וממלא את השדות אוטומטית...');

    try {
      const proposal = await parseVoiceOrWhatsAppText({
        text: spokenText,
        existingBookings,
        settings,
      });

      if (proposal?.parsedBooking) {
        const b = proposal.parsedBooking;
        if (b.ownerName) setOwnerName(b.ownerName);
        if (b.ownerPhone) setOwnerPhone(b.ownerPhone);
        if (b.dogName) setDogName(b.dogName);
        if (b.dogBreed) setDogBreed(b.dogBreed);
        if (b.startDate) setStartDate(b.startDate);
        if (b.endDate) setEndDate(b.endDate);
        if (b.serviceType) {
          setServiceType(b.serviceType);
          let rate = settings.defaultDailyRateBoarding;
          if (b.serviceType === 'training') rate = settings.defaultDailyRateTraining;
          if (b.serviceType === 'combined') rate = settings.defaultDailyRateCombined;
          if (b.serviceType === 'daycare') rate = settings.defaultDailyRateDaycare;
          setDailyRate(rate);
        }
        if (b.totalPrice && b.totalPrice > 0) setTotalPrice(b.totalPrice);
        if (b.depositAmount) setDepositAmount(b.depositAmount);
        if (b.notes) setNotes(prev => prev ? `${prev} | ${b.notes}` : (b.notes || ''));

        setVoiceMessage(`✨ הטופס מולא בהצלחה מתוך ההקלטה: "${spokenText}"`);
        // Auto advance to step 2 or 3 if dog and dates exist
        if (b.dogName && b.startDate) {
          setCurrentStep(3);
        } else if (b.ownerPhone || b.ownerName) {
          setCurrentStep(2);
        }
      } else {
        setVoiceMessage('נקלט טקסט, אך לא זוהו פרטים מלאים. הוכנס להערות.');
        setNotes(prev => prev ? `${prev} | ${spokenText}` : spokenText);
      }
    } catch (err: any) {
      console.error('Wizard speech parsing failed:', err);
      setVoiceMessage('שגיאה בפענוח ההקלטה. ניתן להמשיך ידנית.');
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  // Helper: auto-detect existing customer when typing phone
  useEffect(() => {
    const cleanPhone = ownerPhone.replace(/\D/g, '');
    if (cleanPhone.length >= 7) {
      const match = existingBookings.find(b => b.ownerPhone.replace(/\D/g, '').includes(cleanPhone));
      if (match) {
        // Collect all dogs by this customer
        const customerBookings = existingBookings.filter(b => b.ownerPhone.replace(/\D/g, '').includes(cleanPhone));
        const uniqueDogs = Array.from(new Set(customerBookings.map(b => b.dogName))).map(name => {
          const b = customerBookings.find(x => x.dogName === name)!;
          return {
            name: b.dogName,
            breed: b.dogBreed,
            ageGroup: b.dogAgeGroup,
            gender: b.dogGender,
          };
        });

        setMatchedExistingCustomer({
          name: match.ownerName,
          dogs: uniqueDogs,
        });

        if (!ownerName) {
          setOwnerName(match.ownerName);
        }
      } else {
        setMatchedExistingCustomer(null);
      }
    } else {
      setMatchedExistingCustomer(null);
    }
  }, [ownerPhone, existingBookings]);

  // Helper: auto-detect matching intake questionnaire when typing phone
  const matchedIntakeRequest = React.useMemo(() => {
    const clean = ownerPhone.replace(/\D/g, '');
    if (clean.length < 7 || !intakeRequests || intakeRequests.length === 0) return null;
    return intakeRequests.find(r => {
      const rClean = r.ownerPhone.replace(/\D/g, '');
      return rClean.includes(clean) || clean.includes(rClean);
    }) || null;
  }, [ownerPhone, intakeRequests]);

  const handleApplyIntakeRequest = (req: IntakeRequest) => {
    if (req.ownerName) setOwnerName(req.ownerName);
    if (req.ownerEmail) setOwnerEmail(req.ownerEmail);
    if (req.dogName) setDogName(req.dogName);
    if (req.dogBreed) setDogBreed(req.dogBreed);
    if (req.serviceType) handleServiceTypeSelect(req.serviceType);
    if (req.startDate) setStartDate(req.startDate);
    if (req.endDate) setEndDate(req.endDate);
    if (req.isVaccinated !== undefined) setVaccinationValid(req.isVaccinated);
    const combinedNotes = [
      req.specialNeeds ? `צרכים מיוחדים: ${req.specialNeeds}` : '',
      req.notes ? `הערות משאלון בקשת הקליטה: ${req.notes}` : ''
    ].filter(Boolean).join(' | ');
    if (combinedNotes) setNotes(prev => prev ? `${prev} | ${combinedNotes}` : combinedNotes);
  };

  // Update service type & rate default when service type changes
  const handleServiceTypeSelect = (type: ServiceType) => {
    setServiceType(type);
    if (type === 'training') {
      setPricingMode('period');
      if (!totalPrice || totalPrice === 0) {
        setTotalPrice((settings.defaultDailyRateTraining || 6500) + extrasTotal);
      }
    } else {
      setPricingMode('daily');
      let rate = settings.defaultDailyRateBoarding;
      if (type === 'day_training') rate = settings.defaultDailyRateDayTraining || 250;
      if (type === 'daycare') rate = settings.defaultDailyRateDaycare;
      setDailyRate(rate);
    }
  };

  // Re-calculate Total Price
  const daysCount = Math.max(1, calculateDaysCount(startDate, endDate));
  const extrasTotal = extraServices.filter(s => s.selected).reduce((sum, s) => sum + s.price, 0);

  useEffect(() => {
    if (isFreeStay) {
      setTotalPrice(0);
      setDepositAmount(0);
      return;
    }
    if (serviceType === 'training') {
      if (!totalPrice || totalPrice === 0) {
        setTotalPrice((settings.defaultDailyRateTraining || 6500) + extrasTotal);
      }
    } else if (pricingMode === 'daily') {
      const base = daysCount * dailyRate;
      setTotalPrice(base + extrasTotal);
    }
  }, [startDate, endDate, dailyRate, pricingMode, extraServices, daysCount, extrasTotal, serviceType, settings.defaultDailyRateTraining, isFreeStay]);

  // If initialData exists and has a total price, initialize accordingly
  useEffect(() => {
    if (isFreeStay) {
      setTotalPrice(0);
      setDepositAmount(0);
      return;
    }
    if (initialData?.totalPrice && initialData.totalPrice > 0) {
      setTotalPrice(initialData.totalPrice);
    }
  }, [initialData, isFreeStay]);

  // Synchronize wizard state whenever initialData changes (e.g. from Grow payment or intake request)
  useEffect(() => {
    if (!initialData) return;
    if (initialData.ownerPhone) setOwnerPhone(initialData.ownerPhone);
    if (initialData.ownerName) setOwnerName(initialData.ownerName);
    if (initialData.ownerEmail) setOwnerEmail(initialData.ownerEmail);
    if (initialData.dogName) setDogName(initialData.dogName);
    if (initialData.dogBreed) setDogBreed(initialData.dogBreed);
    if (initialData.dogAgeGroup) setDogAgeGroup(initialData.dogAgeGroup);
    if (initialData.dogGender) setDogGender(initialData.dogGender);
    if (initialData.serviceType) {
      setServiceType(initialData.serviceType);
      if (initialData.serviceType === 'day_training') setDailyRate(settings.defaultDailyRateDayTraining || 250);
      else if (initialData.serviceType === 'daycare') setDailyRate(settings.defaultDailyRateDaycare);
      else if (initialData.serviceType === 'training') setDailyRate(settings.defaultDailyRateTraining || 6500);
      else setDailyRate(settings.defaultDailyRateBoarding);
    }
    if (initialData.startDate) setStartDate(initialData.startDate);
    if (initialData.endDate) setEndDate(initialData.endDate);
    if (initialData.depositAmount !== undefined) setDepositAmount(initialData.depositAmount);
    if (initialData.notes) setNotes(initialData.notes);
    if (initialData.placementNotes !== undefined) setPlacementNotes(initialData.placementNotes);
    if (initialData.vaccinationValid !== undefined) setVaccinationValid(initialData.vaccinationValid);
    if (initialData.paymentMethod) setPaymentMethod(initialData.paymentMethod);
    if (initialData.isFreeStay !== undefined) setIsFreeStay(initialData.isFreeStay);
    if (initialData.linkedDogName) {
      setLinkedMainDogName(initialData.linkedDogName);
      setFreeStayReason('second_dog');
    }
  }, [initialData, settings]);

  // Signature canvas setup
  useEffect(() => {
    if (currentStep === 4 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [currentStep]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      setIsDrawing(false);
      setSignatureDataUrl(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setSignatureDataUrl('');
    }
  };

  // Selection of existing dog in Step 1
  const handleSelectExistingDog = (dog: { name: string; breed: string; ageGroup?: any; gender?: any }) => {
    setDogName(dog.name);
    setDogBreed(dog.breed);
    if (dog.ageGroup) setDogAgeGroup(dog.ageGroup);
    if (dog.gender) setDogGender(dog.gender);
    setCurrentStep(3); // Fast forward to dates & service!
  };

  // Final submission
  const handleFinalSave = () => {
    const finalPaymentStatus: PaymentStatus = isFreeStay 
      ? 'fully_paid' 
      : (depositAmount >= totalPrice && totalPrice > 0 
          ? 'fully_paid' 
          : depositAmount > 0 
          ? 'deposit_paid' 
          : 'unpaid');

    const selectedExtras = extraServices
      .filter(s => s.selected)
      .map(s => ({ id: s.id, name: s.name, price: s.price }));

    let formattedNotes = notes.trim();
    if (isFreeStay) {
      const freeTag = freeStayReason === 'second_dog'
        ? (linkedMainDogName.trim() ? `[כלב נוסף - התשלום נרשם על הכלב ${linkedMainDogName.trim()}]` : '[כלב נוסף - התשלום נרשם על הכלב הראשי]')
        : '[אירוח ללא תשלום (חינם)]';
      if (!formattedNotes.includes('חינם') && !formattedNotes.includes('כלב נוסף') && !formattedNotes.includes('כלב שני') && !formattedNotes.includes('ללא תשלום')) {
        formattedNotes = `${freeTag} ${formattedNotes}`.trim();
      }
    }

    if (secondDog.hasSecondDog && secondDog.name.trim()) {
      formattedNotes = `[אירוח 2 כלבים: ${dogName.trim()} + ${secondDog.name.trim()} - התשלום הכולל נרשם על הזמנה זו] ${formattedNotes}`.trim();
    }

    const newBooking: Booking = {
      id: initialData?.id || `b-${Date.now()}`,
      dogName: dogName.trim() || 'כלב',
      dogBreed: dogBreed.trim() || 'מעורב',
      ownerName: ownerName.trim() || 'לקוח',
      ownerPhone: ownerPhone.trim() || '050-0000000',
      ownerEmail: ownerEmail.trim(),
      serviceType,
      startDate,
      endDate,
      totalPrice: isFreeStay ? 0 : totalPrice,
      depositAmount: isFreeStay ? 0 : depositAmount,
      paymentStatus: finalPaymentStatus,
      paymentMethod,
      stayStatus: initialData?.stayStatus || 'booked',
      placementNotes: placementNotes.trim() || undefined,
      notes: formattedNotes,
      vaccinationValid,
      specialDiet,
      medications,
      dogAgeGroup,
      dogGender,
      crateTrained,
      vaccinationDates,
      arrivalTime,
      pickupTime,
      isFreeStay,
      linkedDogName: isFreeStay && freeStayReason === 'second_dog' ? linkedMainDogName.trim() : undefined,
      extraServices: selectedExtras,
      signatureDataUrl,
      pricingMode,
      dailyRate: isFreeStay ? 0 : dailyRate,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(newBooking);

    // If second dog was entered, also create a booking for the second dog in the calendar!
    if (secondDog.hasSecondDog && secondDog.name.trim()) {
      const secondDogBooking: Booking = {
        id: `b-${Date.now() + 1}`,
        dogName: secondDog.name.trim(),
        dogBreed: secondDog.breed.trim() || 'מעורב',
        ownerName: ownerName.trim() || 'לקוח',
        ownerPhone: ownerPhone.trim() || '050-0000000',
        ownerEmail: ownerEmail.trim(),
        serviceType,
        startDate,
        endDate,
        totalPrice: secondDog.consolidatePayment ? 0 : (isFreeStay ? 0 : totalPrice),
        depositAmount: secondDog.consolidatePayment ? 0 : (isFreeStay ? 0 : depositAmount),
        paymentStatus: 'fully_paid',
        paymentMethod,
        stayStatus: initialData?.stayStatus || 'booked',
        placementNotes: placementNotes.trim() || undefined,
        notes: `[כלב נוסף - התשלום אוחד ונרשם על ${dogName.trim()} (${ownerName.trim()})] ${notes}`.trim(),
        vaccinationValid,
        specialDiet,
        medications,
        dogAgeGroup: 'adult',
        dogGender: secondDog.gender || 'male_neutered',
        crateTrained,
        vaccinationDates,
        arrivalTime,
        pickupTime,
        isFreeStay: secondDog.consolidatePayment ? true : isFreeStay,
        linkedDogName: dogName.trim(),
        extraServices: [],
        signatureDataUrl,
        pricingMode,
        dailyRate: secondDog.consolidatePayment ? 0 : (isFreeStay ? 0 : dailyRate),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onSave(secondDogBooking);
    }

    setSavedBookingResult(newBooking);
    setCurrentStep(5); // Show success celebration screen!
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Auto-sync calendar month when startDate changes
  useEffect(() => {
    if (startDate) {
      const parts = startDate.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          setCalYear(y);
          setCalMonth(m);
        }
      }
    }
  }, [startDate]);

  // Click on calendar day to set dates
  const handleCalendarDayClick = (dateStr: string) => {
    if (dateStr < todayStr) return; // Ignore past dates
    if (!startDate || dateStr < startDate) {
      setStartDate(dateStr);
      if (endDate <= dateStr) {
        setEndDate(addDays(dateStr, serviceType === 'training' ? 50 : 3));
      }
    } else if (dateStr > startDate) {
      setEndDate(dateStr);
    } else {
      setStartDate(dateStr);
    }
  };

  // Month navigation for live occupancy mini-calendar
  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  const handlePrevCalMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(prev => prev - 1);
    } else {
      setCalMonth(prev => prev - 1);
    }
  };

  const handleNextCalMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(prev => prev + 1);
    } else {
      setCalMonth(prev => prev + 1);
    }
  };

  // Generate days for availability calendar
  const daysInCalMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 = Sunday

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[96vh]"
        dir="rtl"
      >
        {/* Header with App Branding & Wizard Stepper */}
        <div className="bg-gradient-to-l from-indigo-700 via-indigo-600 to-indigo-800 text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white p-1 shadow-md border border-amber-300 mb-1">
              <img 
                src="/resort-logo.svg" 
                alt="הריזורט לכלב" 
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold flex items-center justify-center gap-2">
              <span>הזמנת מקום בריזורט</span>
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100 font-medium">
              {settings.resortName || 'הריזורט לכלב'} • מלאו את הפרטים בשלבים פשוטים
            </p>
          </div>

          {/* Wizard Steps Progress Indicator (1 - 2 - 3 - 4) */}
          {currentStep < 5 && (
            <div className="mt-5 max-w-lg mx-auto">
              <div className="flex items-center justify-between relative">
                {/* Connecting Line */}
                <div className="absolute top-4 left-4 right-4 h-0.5 bg-indigo-400/40 -z-0" />

                {/* Step 1 */}
                <div className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                    currentStep === 1 
                      ? 'bg-white text-indigo-700 ring-4 ring-white/30 scale-110' 
                      : currentStep > 1 
                      ? 'bg-emerald-400 text-slate-900' 
                      : 'bg-indigo-400/50 text-white'
                  }`}>
                    {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                  </div>
                  <span className={`text-[11px] mt-1.5 font-semibold ${currentStep === 1 ? 'text-white' : 'text-indigo-200'}`}>
                    זיהוי
                  </span>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                    currentStep === 2 
                      ? 'bg-white text-indigo-700 ring-4 ring-white/30 scale-110' 
                      : currentStep > 2 
                      ? 'bg-emerald-400 text-slate-900' 
                      : 'bg-indigo-400/50 text-white'
                  }`}>
                    {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                  </div>
                  <span className={`text-[11px] mt-1.5 font-semibold ${currentStep === 2 ? 'text-white' : 'text-indigo-200'}`}>
                    פרטי הכלב
                  </span>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                    currentStep === 3 
                      ? 'bg-white text-indigo-700 ring-4 ring-white/30 scale-110' 
                      : currentStep > 3 
                      ? 'bg-emerald-400 text-slate-900' 
                      : 'bg-indigo-400/50 text-white'
                  }`}>
                    {currentStep > 3 ? <Check className="w-4 h-4" /> : '3'}
                  </div>
                  <span className={`text-[11px] mt-1.5 font-semibold ${currentStep === 3 ? 'text-white' : 'text-indigo-200'}`}>
                    תאריכים ותוספות
                  </span>
                </div>

                {/* Step 4 */}
                <div className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                    currentStep === 4 
                      ? 'bg-white text-indigo-700 ring-4 ring-white/30 scale-110' 
                      : 'bg-indigo-400/50 text-white'
                  }`}>
                    4
                  </div>
                  <span className={`text-[11px] mt-1.5 font-semibold ${currentStep === 4 ? 'text-white' : 'text-indigo-200'}`}>
                    סיכום ותשלום
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          {/* Quick Voice Assistant Banner inside Wizard */}
          {currentStep < 5 && (
            <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border-2 border-indigo-200/80 rounded-2xl p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-right w-full sm:w-auto">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isVoiceRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-indigo-600 text-white shadow-xs'
                  }`}>
                    {isVoiceRecording ? <Mic className="w-5 h-5 animate-bounce" /> : <Sparkles className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>הקלטה קולית למילוי מהיר</span>
                      <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">AI קולי</span>
                    </h4>
                    <p className="text-xs text-slate-600">
                      לחצו על המיקרופון, דברו בחופשיות (למשל: "מקס לפנסיון מראשון עד רביעי") והטופס יתמלא מעצמו!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {!isVoiceRecording ? (
                    <button
                      type="button"
                      onClick={handleStartWizardVoice}
                      disabled={isVoiceProcessing}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Mic className="w-4 h-4" />
                      <span>התחל הקלטה</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopWizardVoiceAndFill}
                      className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer animate-pulse"
                    >
                      <Square className="w-4 h-4" />
                      <span>סיום ופענוח</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Live Transcript / Processing Indicator */}
              {isVoiceRecording && (
                <div className="mt-3 bg-white/90 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-950 flex items-center gap-2 animate-in fade-in">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <span className="font-semibold shrink-0">מקליט כעת:</span>
                  <span className="italic font-medium text-slate-700 truncate">
                    {voiceTranscript || 'מדברים עכשיו... (לדוגמה: רקס מגיע ב-20 לאוגוסט לשבוע)'}
                  </span>
                </div>
              )}

              {isVoiceProcessing && (
                <div className="mt-3 bg-indigo-600 text-white rounded-xl p-3 text-xs flex items-center gap-2 animate-in fade-in">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span className="font-medium">מפענח את ההקלטה וממלא את השדות...</span>
                </div>
              )}

              {voiceMessage && !isVoiceProcessing && !isVoiceRecording && (
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
                  <span>{voiceMessage}</span>
                  <button 
                    onClick={() => setVoiceMessage(null)}
                    className="text-emerald-600 hover:text-emerald-900 font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 1: Quick Booking with Immediate Dates & Live Calendar */}
          {/* ======================================================== */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in">

              {/* Top: Customer & Dog Details Card */}
              <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>פרטי לקוח וכלב</span>
                  </span>
                  {depositAmount > 0 && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      💳 שולם: ₪{depositAmount.toLocaleString()} ({paymentMethod.toUpperCase()})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Phone */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">מספר טלפון *</label>
                    <input
                      type="tel"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="050-0000000"
                      className="w-full bg-white text-sm font-semibold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:outline-none"
                      dir="ltr"
                    />
                  </div>

                  {/* Owner Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">שם בעל הכלב *</label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="שם הלקוח"
                      className="w-full bg-white text-sm font-semibold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  {/* Dog Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-indigo-700 flex items-center gap-1 block">
                      <Dog className="w-3.5 h-3.5" />
                      <span>שם הכלב *</span>
                    </label>
                    <input
                      type="text"
                      value={dogName}
                      onChange={(e) => setDogName(e.target.value)}
                      placeholder="שם הכלב (לדוגמה: בלו, מקס, רוקי)"
                      className="w-full bg-indigo-50/50 text-sm font-bold text-indigo-950 px-3.5 py-2.5 rounded-xl border-2 border-indigo-300 focus:border-indigo-600 focus:outline-none placeholder:text-slate-400"
                      autoFocus={!dogName}
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1 block">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>אימייל הלקוח</span>
                    </label>
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="client@gmail.com"
                      className="w-full bg-white text-sm text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:outline-none text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* If intake questionnaire recognized for this phone number */}
                {matchedIntakeRequest && (
                  <div className="mt-2.5 p-3 rounded-xl bg-emerald-50/90 border-2 border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in">
                    <div className="text-xs text-emerald-950">
                      <div className="flex items-center gap-1.5 font-black text-emerald-800">
                        <span className="text-sm">📥</span>
                        <span>זוהה שאלון בקשת קליטה עבור {matchedIntakeRequest.ownerName} ({matchedIntakeRequest.dogName})!</span>
                      </div>
                      <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                        שירות: <strong>{matchedIntakeRequest.serviceType === 'boarding' ? 'פנסיון' : matchedIntakeRequest.serviceType === 'training' ? 'אילוף' : 'יומיות'}</strong> · 
                        תאריכים: <strong className="text-emerald-900 font-bold">{formatDateIL(matchedIntakeRequest.startDate)} עד {formatDateIL(matchedIntakeRequest.endDate)}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyIntakeRequest(matchedIntakeRequest)}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                      title="החל את התאריכים ופרטי הכלב ישירות לתוך ההזמנה"
                    >
                      <span>⚡ טען תאריכים ופרטים מהשאלון</span>
                    </button>
                  </div>
                )}

                {/* If existing customer recognized with dogs */}
                {matchedExistingCustomer && matchedExistingCustomer.dogs.length > 0 && !dogName && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-[11px] font-bold text-indigo-900 block mb-1.5">🐶 כלבים רשומים של הלקוח:</span>
                    <div className="flex flex-wrap gap-2">
                      {matchedExistingCustomer.dogs.map((dog, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectExistingDog(dog)}
                          className="px-3 py-1.5 bg-indigo-100/80 hover:bg-indigo-200 text-indigo-900 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>🐾 {dog.name}</span>
                          <span className="text-[10px] text-indigo-700">({dog.breed || 'מעורב'})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Service Type Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  סוג השירות המבוקש *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleServiceTypeSelect('boarding')}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      serviceType === 'boarding'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">🏨</span>
                      <span className="text-[10px] text-slate-500 font-bold">₪{settings.defaultDailyRateBoarding}/יום</span>
                    </div>
                    <div className="text-xs font-bold mt-1">פנסיון (לינה)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleServiceTypeSelect('training')}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      serviceType === 'training'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">🎓</span>
                      <span className="text-[10px] font-bold text-amber-700">מחיר כולל ₪{settings.defaultDailyRateTraining || 6500}</span>
                    </div>
                    <div className="text-xs font-bold mt-1">תהליך אילוף</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleServiceTypeSelect('day_training')}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      serviceType === 'day_training'
                        ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">🦮</span>
                      <span className="text-[10px] text-purple-700 font-bold">₪{settings.defaultDailyRateDayTraining || 250}/יום</span>
                    </div>
                    <div className="text-xs font-bold mt-1">אילוף ביומיות</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleServiceTypeSelect('daycare')}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      serviceType === 'daycare'
                        ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 text-sky-950 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">✂️</span>
                      <span className="text-[10px] text-slate-500 font-bold">₪{settings.defaultDailyRateDaycare}/יום</span>
                    </div>
                    <div className="text-xs font-bold mt-1">שהות יומית</div>
                  </button>
                </div>
              </div>

              {/* DATES SELECTION BLOCK & DURATION QUICK BUTTONS */}
              <div className="bg-indigo-50/60 border border-indigo-200/80 p-4 sm:p-5 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-black text-indigo-950 flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4 text-indigo-600" />
                    <span>קביעת תאריכי השהות *</span>
                  </label>
                  <span className="text-xs font-extrabold text-indigo-700 bg-white px-3 py-1 rounded-full border border-indigo-200 shadow-2xs">
                    סה״כ {daysCount} {daysCount === 1 ? 'יום' : 'ימים'} ({daysCount > 1 ? `${daysCount - 1} לילות` : 'ללא לינה'})
                  </span>
                </div>

                {/* Date Inputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>תאריך כניסה 🏨</span>
                      <span className="text-[11px] text-indigo-600 font-medium">
                        {startDate ? `${getDayNameHebrew(startDate)}, ${formatDateDisplay(startDate)}` : ''}
                      </span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white text-sm font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-indigo-200 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>תאריך יציאה 🚗</span>
                      <span className="text-[11px] text-indigo-600 font-medium">
                        {endDate ? `${getDayNameHebrew(endDate)}, ${formatDateDisplay(endDate)}` : ''}
                      </span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="w-full bg-white text-sm font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-indigo-200 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Duration Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-500 ml-1">משך מהיר:</span>
                  <button
                    type="button"
                    onClick={() => setEndDate(addDays(startDate, 1))}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-100/50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 transition-colors cursor-pointer"
                  >
                    לילה 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setEndDate(addDays(startDate, 3))}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-100/50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 transition-colors cursor-pointer"
                  >
                    3 לילות
                  </button>
                  <button
                    type="button"
                    onClick={() => setEndDate(addDays(startDate, 7))}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-100/50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 transition-colors cursor-pointer"
                  >
                    שבוע
                  </button>
                  <button
                    type="button"
                    onClick={() => setEndDate(addDays(startDate, 14))}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-100/50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 transition-colors cursor-pointer"
                  >
                    שבועיים
                  </button>
                  {serviceType === 'training' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEndDate(addDays(startDate, 30))}
                        className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg text-xs font-bold text-amber-900 transition-colors cursor-pointer"
                      >
                        חודש (30 יום)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEndDate(addDays(startDate, 45))}
                        className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800 transition-colors cursor-pointer"
                      >
                        45 יום
                      </button>
                      <button
                        type="button"
                        onClick={() => setEndDate(addDays(startDate, 60))}
                        className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800 transition-colors cursor-pointer"
                      >
                        חודשיים (60 יום)
                      </button>
                    </>
                  )}
                </div>

                {/* Flexible Training Period Selector */}
                {serviceType === 'training' && (
                  <div className="w-full bg-amber-50/80 border border-amber-200 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-2 shadow-2xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 font-black text-amber-950 text-xs sm:text-sm">
                        <span>🎓 מספר ימי אילוף משוערים</span>
                        <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          הערכת זמן לפי צורכי הכלב
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800/80">
                        שמוליק קובע את הערכת הימים — תאריך הסיום יתעדכן אוטומטית לפי מספר הימים:
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          const newDays = Math.max(1, daysCount - 5);
                          setEndDate(addDays(startDate, newDays));
                        }}
                        className="w-8 h-8 rounded-xl bg-white hover:bg-amber-100 border border-amber-300 font-black text-amber-900 flex items-center justify-center cursor-pointer shadow-2xs text-xs"
                        title="הפחת 5 ימים"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newDays = Math.max(1, daysCount - 1);
                          setEndDate(addDays(startDate, newDays));
                        }}
                        className="w-8 h-8 rounded-xl bg-white hover:bg-amber-100 border border-amber-300 font-black text-amber-900 flex items-center justify-center cursor-pointer shadow-2xs text-xs"
                        title="הפחת יום 1"
                      >
                        -1
                      </button>
                      <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-amber-300 shadow-2xs">
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={daysCount}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                            setEndDate(addDays(startDate, val));
                          }}
                          className="w-12 text-center font-black text-base text-amber-950 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-amber-800">ימים</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newDays = daysCount + 1;
                          setEndDate(addDays(startDate, newDays));
                        }}
                        className="w-8 h-8 rounded-xl bg-white hover:bg-amber-100 border border-amber-300 font-black text-amber-900 flex items-center justify-center cursor-pointer shadow-2xs text-xs"
                        title="הוסף יום 1"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newDays = daysCount + 5;
                          setEndDate(addDays(startDate, newDays));
                        }}
                        className="w-8 h-8 rounded-xl bg-white hover:bg-amber-100 border border-amber-300 font-black text-amber-900 flex items-center justify-center cursor-pointer shadow-2xs text-xs"
                        title="הוסף 5 ימים"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* LIVE OCCUPANCY CALENDAR - DIRECTLY UNDER DATE SELECTION */}
                {/* ======================================================== */}
                <div className="bg-white border border-indigo-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-2.5 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-indigo-950">לוח תפוסה וזמינות לחודש {monthNames[calMonth]} {calYear}</span>
                      <span className="text-[10px] text-slate-400 font-normal">(לחץ על יום לבחירה מהירה)</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handlePrevCalMonth}
                        className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="חודש קודם"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 min-w-[75px] text-center">
                        {monthNames[calMonth]} {calYear}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextCalMonth}
                        className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="חודש הבא"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Day of week headers */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 pb-1 border-b border-slate-100">
                    <span>א׳</span>
                    <span>ב׳</span>
                    <span>ג׳</span>
                    <span>ד׳</span>
                    <span>ה׳</span>
                    <span>ו׳</span>
                    <span>ש׳</span>
                  </div>

                  {/* Days Grid with Range Highlight & Day Clicks */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {Array.from({ length: firstDayIndex }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-10 rounded-lg bg-slate-50/40" />
                    ))}

                    {Array.from({ length: daysInCalMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                      const dayBookings = getBookingsForDate(existingBookings, dateStr);
                      const occupied = dayBookings.filter(b => b.stayStatus !== 'cancelled').length;
                      const maxCap = settings.maxCapacity || 10;
                      const isFull = occupied >= maxCap;
                      const isAlmostFull = occupied >= maxCap - 2 && !isFull;
                      const isPast = dateStr < todayStr;

                      // Range check
                      const isStart = dateStr === startDate;
                      const isEnd = dateStr === endDate;
                      const isInRange = Boolean(startDate && endDate && dateStr > startDate && dateStr < endDate);

                      let rangeStyle = '';
                      if (isStart) {
                        rangeStyle = 'ring-2 ring-emerald-600 bg-emerald-600 text-white font-extrabold shadow-sm scale-102 z-10';
                      } else if (isEnd) {
                        rangeStyle = 'ring-2 ring-indigo-600 bg-indigo-600 text-white font-extrabold shadow-sm scale-102 z-10';
                      } else if (isInRange) {
                        rangeStyle = 'bg-indigo-100/90 border-indigo-300 text-indigo-950 font-bold';
                      } else if (isPast) {
                        rangeStyle = 'bg-slate-50 border-slate-100 text-slate-300 opacity-60 cursor-not-allowed';
                      } else if (isFull) {
                        rangeStyle = 'bg-red-50 border-red-200 text-red-700 font-bold hover:bg-red-100 cursor-pointer';
                      } else if (isAlmostFull) {
                        rangeStyle = 'bg-amber-50 border-amber-200 text-amber-800 font-bold hover:bg-amber-100 cursor-pointer';
                      } else {
                        rangeStyle = 'bg-emerald-50/60 border-emerald-200 text-emerald-800 hover:bg-emerald-100 cursor-pointer';
                      }

                      return (
                        <button
                          key={dayNum}
                          type="button"
                          onClick={() => handleCalendarDayClick(dateStr)}
                          disabled={isPast}
                          className={`h-10 sm:h-11 rounded-lg p-0.5 sm:p-1 flex flex-col items-center justify-between border text-[10px] transition-all ${rangeStyle}`}
                        >
                          <span className="font-bold text-xs">{dayNum}</span>
                          <span className="text-[8px] font-mono leading-none">
                            {isStart ? 'כניסה' : isEnd ? 'יציאה' : isFull ? 'מלא' : `${occupied}/${maxCap}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Calendar Legend */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        פנוי
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        כמעט מלא
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        מלא
                      </span>
                    </div>
                    <span className="text-indigo-600 font-bold text-[10px]">
                      🎯 ימים נבחרים מסומנים בכחול וירוק
                    </span>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* PRICING & PAYMENT MODE: DAILY RATE CALCULATION & DEPOSIT  */}
              {/* ======================================================== */}
              <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-4">
                
                {/* 1. Daily Rate & Total Price Calculation (or Fixed Training Total Price) */}
                {serviceType === 'training' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-amber-600" />
                        <span>מחיר כולל לתהליך האילוף (ללא מחיר ליום)</span>
                      </span>
                      <span className="text-xs font-bold text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-200">
                        🎓 מחיר כולל בלבד
                      </span>
                    </div>

                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        מחיר סה״כ לתהליך האילוף (₪) *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={totalPrice || ''}
                          onChange={(e) => {
                            const newTotal = Number(e.target.value) || 0;
                            setTotalPrice(newTotal);
                            if (paymentType === 'full') {
                              setDepositAmount(newTotal);
                            }
                          }}
                          placeholder="6500"
                          className="w-full bg-white text-lg font-black text-amber-950 px-3.5 py-2.5 rounded-xl border-2 border-amber-300 focus:border-amber-600 focus:outline-none shadow-xs"
                        />
                        <span className="absolute left-3 top-3 text-xs text-amber-800 font-extrabold">₪ מחיר כולל</span>
                      </div>
                      <p className="text-[10px] text-slate-500 pt-0.5">
                        ברירת מחדל: ₪6,500. ניתן לעריכה חופשית לפי הסיכום עם הלקוח ולינק התשלום.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span>חישוב מחיר ותעריף ליום</span>
                      </span>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                        🧮 {daysCount} {daysCount === 1 ? 'יום' : 'ימים'} × ₪{dailyRate} = ₪{(daysCount * dailyRate).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Daily Rate Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">
                          מחיר ליום (₪)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={dailyRate || ''}
                            onChange={(e) => {
                              const newRate = Number(e.target.value) || 0;
                              setDailyRate(newRate);
                              setPricingMode('daily');
                              setTotalPrice(daysCount * newRate + extrasTotal);
                              if (paymentType === 'full') {
                                setDepositAmount(daysCount * newRate + extrasTotal);
                              }
                            }}
                            placeholder="180"
                            className="w-full bg-white text-sm font-black text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 focus:outline-none"
                          />
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₪ / יום</span>
                        </div>
                      </div>

                      {/* Total Price Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">
                          סה״כ לתשלום (₪)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={totalPrice || ''}
                            onChange={(e) => {
                              const newTotal = Number(e.target.value) || 0;
                              setTotalPrice(newTotal);
                              if (daysCount > 0) {
                                setDailyRate(Math.max(0, Math.round((newTotal - extrasTotal) / daysCount)));
                              }
                              if (paymentType === 'full') {
                                setDepositAmount(newTotal);
                              }
                            }}
                            placeholder="0"
                            className="w-full bg-white text-base font-black text-slate-900 px-3 py-2 rounded-xl border-2 border-indigo-200 focus:border-indigo-600 focus:outline-none"
                          />
                          <span className="absolute left-3 top-2.5 text-xs text-indigo-600 font-extrabold">₪ סה״כ</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Payment Type Selection: Full Payment vs Deposit vs Unpaid */}
                <div className="space-y-2 pt-2 border-t border-slate-200/80">
                  <label className="text-xs font-black text-slate-900 block">
                    מצב תשלום: מקדמה מול תשלום מלא *
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Full Payment Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('full');
                        setDepositAmount(totalPrice);
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        paymentType === 'full'
                          ? 'bg-emerald-600 text-white font-black shadow-sm ring-2 ring-emerald-400/40'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-extrabold">✓ תשלום מלא</div>
                      <div className={`text-[10px] ${paymentType === 'full' ? 'text-emerald-100' : 'text-slate-400'}`}>
                        ₪{totalPrice.toLocaleString()}
                      </div>
                    </button>

                    {/* Deposit Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('deposit');
                        if (depositAmount === 0 || depositAmount === totalPrice) {
                          setDepositAmount(Math.round(totalPrice * 0.3) || 200);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        paymentType === 'deposit'
                          ? 'bg-amber-500 text-white font-black shadow-sm ring-2 ring-amber-400/40'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-extrabold">💳 מקדמה בלבד</div>
                      <div className={`text-[10px] ${paymentType === 'deposit' ? 'text-amber-100' : 'text-slate-400'}`}>
                        שולם חלקית
                      </div>
                    </button>

                    {/* Unpaid Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('unpaid');
                        setDepositAmount(0);
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        paymentType === 'unpaid'
                          ? 'bg-slate-700 text-white font-black shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-extrabold">⏳ טרם שולם</div>
                      <div className={`text-[10px] ${paymentType === 'unpaid' ? 'text-slate-200' : 'text-slate-400'}`}>
                        לתשלום בהגעה
                      </div>
                    </button>
                  </div>

                  {/* Deposit Amount Input (If deposit mode) */}
                  {paymentType === 'deposit' && (
                    <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-amber-950 block">סכום המקדמה ששולם בפועל:</span>
                        <span className="text-[11px] text-amber-800 font-semibold">
                          יתרה לגבייה בצ'ק-אין: <strong>₪{Math.max(0, totalPrice - depositAmount).toLocaleString()}</strong>
                        </span>
                      </div>
                      <div className="relative w-32">
                        <input
                          type="number"
                          value={depositAmount || ''}
                          onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                          placeholder="סכום"
                          className="w-full bg-white text-sm font-black text-amber-900 px-3 py-1.5 rounded-lg border border-amber-300 focus:border-amber-500 focus:outline-none"
                        />
                        <span className="absolute left-2.5 top-1.5 text-xs text-amber-700 font-bold">₪</span>
                      </div>
                    </div>
                  )}

                  {/* Summary row */}
                  <div className="flex items-center justify-between text-xs pt-1 px-1 text-slate-600">
                    <span className="flex items-center gap-1 font-semibold">
                      <span>אמצעי תשלום:</span>
                      <strong className="text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">{paymentMethod.toUpperCase()}</strong>
                    </span>
                    <span className={`font-bold ${paymentType === 'full' ? 'text-emerald-700' : paymentType === 'deposit' ? 'text-amber-700' : 'text-slate-500'}`}>
                      {paymentType === 'full' ? '✓ שולם במלואו (יתרה: ₪0)' : paymentType === 'deposit' ? `יתרה: ₪${Math.max(0, totalPrice - depositAmount)}` : 'ייגבה במלואו בצ\'ק-אין'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Instant Save vs Advanced Details */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!ownerPhone) {
                      alert('אנא הזינו מספר טלפון להמשך');
                      return;
                    }
                    if (!dogName.trim()) {
                      alert('אנא הזינו את שם הכלב');
                      return;
                    }
                    setCurrentStep(2);
                  }}
                  className="w-full sm:w-auto px-5 py-3 border border-indigo-200 hover:bg-indigo-50 text-indigo-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>פרטים נוספים (חיסונים, שעות, חתימה)</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!ownerPhone) {
                      alert('אנא הזינו מספר טלפון להמשך');
                      return;
                    }
                    if (!dogName.trim()) {
                      alert('אנא הזינו את שם הכלב');
                      return;
                    }
                    handleFinalSave();
                  }}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-98"
                >
                  <span>💾 שמור הזמנה עכשיו</span>
                  <Check className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: Dog Details (Intuitive Button Selectors)          */}
          {/* ======================================================== */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dog Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    שם הכלב *
                  </label>
                  <input
                    type="text"
                    value={dogName}
                    onChange={(e) => setDogName(e.target.value)}
                    placeholder="לדוגמה: מקס / בלה"
                    className="w-full bg-slate-50 text-sm font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:bg-white focus:outline-none"
                    autoFocus
                  />
                </div>

                {/* Dog Breed */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    גזע הכלב *
                  </label>
                  <input
                    type="text"
                    value={dogBreed}
                    onChange={(e) => setDogBreed(e.target.value)}
                    placeholder="לדוגמה: גולדן רטריבר / מעורב"
                    className="w-full bg-slate-50 text-sm text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Dog Age Group Buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  גיל הכלב *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setDogAgeGroup('puppy')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      dogAgeGroup === 'puppy'
                        ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600/20 text-indigo-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">גור</div>
                    <div className="text-[10px] text-slate-500">עד שנה</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDogAgeGroup('young')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      dogAgeGroup === 'young'
                        ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600/20 text-indigo-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">צעיר</div>
                    <div className="text-[10px] text-slate-500">1-3 שנים</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDogAgeGroup('adult')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      dogAgeGroup === 'adult'
                        ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600/20 text-indigo-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">בוגר</div>
                    <div className="text-[10px] text-slate-500">4-7 שנים</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDogAgeGroup('senior')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      dogAgeGroup === 'senior'
                        ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600/20 text-indigo-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">מבוגר</div>
                    <div className="text-[10px] text-slate-500">8+ שנים</div>
                  </button>
                </div>
              </div>

              {/* Gender and Spaying/Neutering */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  מין וסירוס / עיקור *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setDogGender('male_neutered')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      dogGender === 'male_neutered'
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold">מסורס</div>
                    <div className="text-[10px] opacity-80">(זכר)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDogGender('female_spayed')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      dogGender === 'female_spayed'
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold">מעוקרת</div>
                    <div className="text-[10px] opacity-80">(נקבה)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDogGender('male_intact')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      dogGender === 'male_intact'
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold">לא מסורס</div>
                    <div className="text-[10px] opacity-80">(זכר)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDogGender('female_intact')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      dogGender === 'female_intact'
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold">לא מעוקרת</div>
                    <div className="text-[10px] opacity-80">(נקבה)</div>
                  </button>
                </div>
              </div>

              {/* Crate trained button */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  האם הכלב מורגל לכלוב אילוף? *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCrateTrained(true)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      crateTrained
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-bold ring-2 ring-indigo-600/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    מורגל
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrateTrained(false)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      !crateTrained
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-bold ring-2 ring-indigo-600/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    לא מורגל
                  </button>
                </div>
              </div>

              {/* Vaccination Dates */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-800 block">
                  תאריכי חיסונים אחרונים *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1">משושה</span>
                    <input
                      type="date"
                      value={vaccinationDates.combo}
                      onChange={(e) => setVaccinationDates(prev => ({ ...prev, combo: e.target.value }))}
                      className="w-full bg-white text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1">כלבת</span>
                    <input
                      type="date"
                      value={vaccinationDates.rabies}
                      onChange={(e) => setVaccinationDates(prev => ({ ...prev, rabies: e.target.value }))}
                      className="w-full bg-white text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1">שעלת</span>
                    <input
                      type="date"
                      value={vaccinationDates.cough}
                      onChange={(e) => setVaccinationDates(prev => ({ ...prev, cough: e.target.value }))}
                      className="w-full bg-white text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Special Requirements / Allergies */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  הערות מיוחדות, מזון או תרופות (אופציונלי)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="אלרגיות, מזון מיוחד, תרופות, התנהגות מול כלבים אחרים וכו'..."
                  className="w-full bg-slate-50 text-xs text-slate-900 p-3 rounded-xl border border-slate-200 focus:border-indigo-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* 🚩 Placement notes & special instructions */}
              <div className="space-y-1.5 bg-amber-50/80 border border-amber-300 rounded-xl p-3 shadow-2xs">
                <label className="text-xs font-black text-amber-950 block">
                  🚩 דגש שיבוץ והוראות מיוחדות (מופיע בראש כרטיסיית הכלב ביומן):
                </label>
                <input
                  type="text"
                  value={placementNotes}
                  onChange={(e) => setPlacementNotes(e.target.value)}
                  placeholder="למשל: שיבוץ אך ורק עם ג'נגו / לא להוציא עם נקבות / תוקפת דרך גדר..."
                  className="w-full bg-white text-xs font-bold text-slate-900 p-2.5 rounded-xl border border-amber-300 focus:border-amber-600 focus:outline-none"
                />
              </div>

              {/* Second Dog Optional Accordion */}
              {!secondDog.hasSecondDog ? (
                <button
                  type="button"
                  onClick={() => setSecondDog({ hasSecondDog: true, name: '', breed: '', gender: 'male_neutered', consolidatePayment: true })}
                  className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 py-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ הוסף כלב נוסף לאותה הזמנה</span>
                </button>
              ) : (
                <div className="bg-indigo-50/70 border-2 border-indigo-200 p-3.5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                    <span className="flex items-center gap-1.5 font-black text-sm">
                      <span>🐕 פרטי כלב שני/נוסף:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSecondDog({ hasSecondDog: false, name: '', breed: '', gender: 'male_neutered', consolidatePayment: true })}
                      className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded-lg hover:bg-red-50 cursor-pointer"
                    >
                      הסר כלב שני ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={secondDog.name}
                      onChange={(e) => setSecondDog(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="שם הכלב השני *"
                      className="bg-white text-xs p-2.5 rounded-xl border border-indigo-300 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={secondDog.breed}
                      onChange={(e) => setSecondDog(prev => ({ ...prev, breed: e.target.value }))}
                      placeholder="גזע"
                      className="bg-white text-xs p-2.5 rounded-xl border border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Gender selection for 2nd dog */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-indigo-950 block">מין הכלב השני:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {[
                        { id: 'male_neutered', label: 'זכר מסורס' },
                        { id: 'female_spayed', label: 'נקבה מעוקרת' },
                        { id: 'male_intact', label: 'זכר לא מסורס' },
                        { id: 'female_intact', label: 'נקבה לא מעוקרת' },
                      ].map(g => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSecondDog(prev => ({ ...prev, gender: g.id as any }))}
                          className={`p-1.5 text-center rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            secondDog.gender === g.id
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50/50'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Consolidation Checkbox */}
                  <label className="flex items-start gap-2 pt-2 border-t border-indigo-200/80 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={secondDog.consolidatePayment}
                      onChange={(e) => setSecondDog(prev => ({ ...prev, consolidatePayment: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-black text-indigo-950 block">
                        רשום את כל התשלום על הכלב הראשון (לינק יחיד ללקוח)
                      </span>
                      <span className="text-[11px] text-indigo-700 block mt-0.5">
                        הכלב השני יירשם ביומן ב-₪0 כמשולם, כך שהלקוח לא יקבל הודעות תשלום כפולות.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {/* Step 2 Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>חזרה</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!dogName.trim()) {
                      alert('אנא הזינו את שם הכלב');
                      return;
                    }
                    setCurrentStep(3);
                  }}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>המשך לתאריכים ושירות</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 3: Dates, Service Type, Pricing & Add-on Extras      */}
          {/* ======================================================== */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in">
              {/* Service Type Buttons (Boarding vs Training vs Combined vs Daycare) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  סוג השירות המבוקש *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleServiceTypeSelect('boarding')}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      serviceType === 'boarding'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg">🏨</span>
                      <span className="text-[10px] text-slate-500 font-bold">₪{settings.defaultDailyRateBoarding}/יום</span>
                    </div>
                    <div className="text-xs font-bold mt-1">פנסיון (לינה)</div>
                    <div className="text-[10px] text-slate-500 font-normal">אירוח וטיפול מלא</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleServiceTypeSelect('training')}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      serviceType === 'training'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg">🎓</span>
                      <span className="text-[10px] font-bold text-amber-700">₪{settings.defaultDailyRateTraining || 6500}</span>
                    </div>
                    <div className="text-xs font-bold mt-1">תהליך אילוף (70 יום)</div>
                    <div className="text-[10px] text-slate-500 font-normal">תכנית מלאה ל-70 יום</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleServiceTypeSelect('day_training')}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      serviceType === 'day_training'
                        ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg">🦮</span>
                      <span className="text-[10px] text-purple-700 font-bold">₪{settings.defaultDailyRateDayTraining || 250}/יום</span>
                    </div>
                    <div className="text-xs font-bold mt-1">אילוף ביומיות</div>
                    <div className="text-[10px] text-slate-500 font-normal">אילוף יומי ללא לינה</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleServiceTypeSelect('daycare')}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      serviceType === 'daycare'
                        ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 text-sky-950 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg">✂️</span>
                      <span className="text-[10px] text-slate-500 font-bold">₪{settings.defaultDailyRateDaycare}/יום</span>
                    </div>
                    <div className="text-xs font-bold mt-1">יום כיף / שהות יומית</div>
                    <div className="text-[10px] text-slate-500 font-normal">ללא לינת לילה</div>
                  </button>
                </div>
              </div>

              {/* Pricing Strategy: Daily Rate vs Period Package */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>אופן התמחור:</span>
                  </span>

                  <div className="inline-flex p-0.5 bg-slate-200 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPricingMode('daily')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        pricingMode === 'daily'
                          ? 'bg-white text-emerald-900 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      📅 תעריף יומי (₪{dailyRate}/יום)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingMode('period')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        pricingMode === 'period'
                          ? 'bg-white text-indigo-900 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🏷️ מחיר קבוע/גלובלי לתקופה
                    </button>
                  </div>
                </div>

                {pricingMode === 'daily' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">מחיר ליום:</span>
                    <input
                      type="number"
                      value={dailyRate === 0 ? '' : dailyRate}
                      onChange={(e) => setDailyRate(e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-24 bg-white text-slate-900 font-bold text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none"
                    />
                    <span className="text-xs font-semibold text-emerald-700">
                      ₪ = {daysCount} ימים × ₪{dailyRate} (סה״כ ₪{daysCount * dailyRate})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">מחיר פיקס לכל התקופה:</span>
                    <input
                      type="number"
                      value={totalPrice === 0 ? '' : totalPrice}
                      onChange={(e) => setTotalPrice(e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                      className="w-28 bg-white text-indigo-950 font-extrabold text-xs px-2.5 py-1.5 rounded-lg border border-indigo-300 focus:outline-none"
                      placeholder="0"
                    />
                    <span className="text-xs text-slate-500">₪ סה״כ לכל השהות</span>
                  </div>
                )}
              </div>

              {/* Booking Dates & Interactive Range Banner */}
              <div className="bg-indigo-50/70 border border-indigo-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-indigo-950 font-extrabold text-sm">
                  <span>📅 תאריכי השהות בפנסיון:</span>
                  <span className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-full shadow-2xs">
                    {daysCount} ימים בפנסיון
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      תאריך כניסה
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (e.target.value > endDate) {
                          setEndDate(e.target.value);
                        }
                      }}
                      className="w-full bg-white text-sm font-bold text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      תאריך יציאה
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-white text-sm font-bold text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Arrival & Pickup Time Slots */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    שעת הגעה
                  </label>
                  <select
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    className="w-full bg-slate-50 text-xs font-medium text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="09:00 - 11:00">09:00 - 11:00 (בוקר)</option>
                    <option value="11:00 - 13:00">11:00 - 13:00 (צהריים מוקדמים)</option>
                    <option value="13:00 - 15:00">13:00 - 15:00 (צהריים)</option>
                    <option value="15:00 - 17:00">15:00 - 17:00 (אחר הצהריים)</option>
                    <option value="17:00 - 19:00">17:00 - 19:00 (ערב)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    שעת איסוף
                  </label>
                  <select
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full bg-slate-50 text-xs font-medium text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="09:00 - 11:00">09:00 - 11:00 (בוקר)</option>
                    <option value="11:00 - 13:00">11:00 - 13:00 (צהריים מוקדמים)</option>
                    <option value="13:00 - 15:00">13:00 - 15:00 (צהריים)</option>
                    <option value="15:00 - 17:00">15:00 - 17:00 (אחר הצהריים)</option>
                    <option value="17:00 - 19:00">17:00 - 19:00 (ערב)</option>
                  </select>
                </div>
              </div>

              {/* Add-on Extra Services */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>תוספות להזמנה (אופציונלי)</span>
                </label>

                <div className="space-y-2">
                  {extraServices.map((extra) => (
                    <div
                      key={extra.id}
                      onClick={() => {
                        setExtraServices(prev =>
                          prev.map(item => item.id === extra.id ? { ...item, selected: !item.selected } : item)
                        );
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        extra.selected
                          ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500/30'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                          extra.selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {extra.selected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900">{extra.name}</span>
                          {extra.id === 'bath' && (
                            <span className="text-[10px] text-emerald-600 block">✨ מומלץ: רוב הלקוחות מוסיפים שירות זה</span>
                          )}
                        </div>
                      </div>

                      <span className="text-xs font-extrabold text-indigo-900 bg-indigo-100/60 px-2.5 py-1 rounded-lg">
                        +₪{extra.price}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 3 Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>חזרה לפרטי הכלב</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>המשך לסיכום ותשלום</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 4: Summary, Pricing & Payment (No Signature Needed)  */}
          {/* ======================================================== */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in">
              {/* Order Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>סיכום ההזמנה</span>
                  </h4>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                    {serviceType === 'training' ? 'תהליך אילוף (70 יום)' : serviceType === 'day_training' ? 'אילוף ביומיות (ללא לינה)' : serviceType === 'daycare' ? 'יום כיף / שהות יומית' : 'פנסיון לינה'}
                  </span>
                </div>

                <div className="text-xs space-y-2 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">שם הבעלים:</span>
                    <span className="font-bold text-slate-900">{ownerName || 'לא צוין'} ({ownerPhone})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">הכלב:</span>
                    <span className="font-bold text-slate-900">
                      🐾 {dogName} {dogBreed ? `(${dogBreed})` : ''}
                      {secondDog.hasSecondDog && secondDog.name ? ` + ${secondDog.name}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">תאריכי שהות:</span>
                    <span className="font-bold text-slate-900">
                      {formatDateDisplay(startDate)} ({getDayNameHebrew(startDate)}) עד {formatDateDisplay(endDate)} ({getDayNameHebrew(endDate)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">מספר ימים:</span>
                    <span className="font-bold text-slate-900">{daysCount} ימים</span>
                  </div>
                  {pricingMode === 'daily' && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">מחיר ליום:</span>
                      <span className="font-semibold text-slate-800">₪{dailyRate}</span>
                    </div>
                  )}
                  {extrasTotal > 0 && (
                    <div className="flex justify-between text-indigo-700">
                      <span>תוספות שנבחרו:</span>
                      <span className="font-bold">+₪{extrasTotal}</span>
                    </div>
                  )}
                </div>

                {/* Total Price & Deposit Split */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-slate-900">סה״כ לתשלום:</span>
                  <span className="text-2xl font-black text-indigo-700">₪{totalPrice}</span>
                </div>
              </div>

              {/* Free Stay / Multi-dog Payment Consolidation Card */}
              <div className={`p-4 rounded-2xl border-2 transition-all ${
                isFreeStay ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400/20' : 'bg-slate-50/80 border-slate-200'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isFreeStay}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsFreeStay(checked);
                        if (checked) {
                          setTotalPrice(0);
                          setDepositAmount(0);
                        } else {
                          const base = daysCount * dailyRate;
                          setTotalPrice(base + extrasTotal);
                        }
                      }}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>🎁 סמן כאירוח ללא תשלום (חינם / כלב נוסף)</span>
                        {isFreeStay && (
                          <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                            פעיל - ₪0
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                        סמן כאן אם השהות היא בחינם, או שמדובר בכלב שני/נוסף שהתשלום נרשם על הכלב הראשי (כדי לשלוח לינק תשלום יחיד ללקוח).
                      </span>
                    </div>
                  </label>
                </div>

                {isFreeStay && (
                  <div className="mt-3 pt-2.5 border-t border-emerald-200/80 space-y-2.5 animate-in fade-in">
                    <span className="text-[11px] font-bold text-emerald-950 block">
                      סיבת הפטור מתשלום:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFreeStayReason('free')}
                        className={`p-2 rounded-xl border text-right text-xs transition-all cursor-pointer ${
                          freeStayReason === 'free'
                            ? 'bg-emerald-100/90 border-emerald-500 text-emerald-950 font-black shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        🎁 שהות בחינם / הטבה / סגירה מיוחדת
                      </button>
                      <button
                        type="button"
                        onClick={() => setFreeStayReason('second_dog')}
                        className={`p-2 rounded-xl border text-right text-xs transition-all cursor-pointer ${
                          freeStayReason === 'second_dog'
                            ? 'bg-emerald-100/90 border-emerald-500 text-emerald-950 font-black shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        🐕 כלב שני/נוסף – התשלום נרשם על הכלב הראשי
                      </button>
                    </div>

                    {freeStayReason === 'second_dog' && (
                      <div className="pt-1">
                        <input
                          type="text"
                          value={linkedMainDogName}
                          onChange={(e) => setLinkedMainDogName(e.target.value)}
                          placeholder="שם הכלב הראשי עליו נרשם התשלום המרוכז (למשל: מקס)"
                          className="w-full bg-white text-slate-900 text-xs px-3 py-2 rounded-xl border border-emerald-300 focus:outline-none font-bold"
                        />
                      </div>
                    )}

                    <div className="bg-emerald-100/80 text-emerald-950 text-[11px] font-semibold p-2.5 rounded-xl flex items-center gap-1.5 border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>ההזמנה מוגדרת ב-₪0, שולמה במלואה, לא תחשב בהכנסות החודש ולא יישלח קישור תשלום כפול.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Deposit, Quick Buttons & Payment Method */}
              <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>תשלום ומקדמה</span>
                  </label>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                    depositAmount >= totalPrice && totalPrice > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : depositAmount > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {depositAmount >= totalPrice && totalPrice > 0 ? '✓ שולם במלואו' : depositAmount > 0 ? `מקדמה ₪${depositAmount}` : 'חוב פתוח'}
                  </span>
                </div>

                {/* 3 Quick Action Buttons */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDepositAmount(totalPrice)}
                    className={`p-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      depositAmount >= totalPrice && totalPrice > 0
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <span>🟢 שולם הכל במלואו</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDepositAmount(depositAmount > 0 ? depositAmount : Math.round(totalPrice / 2) || 150)}
                    className={`p-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      depositAmount > 0 && depositAmount < totalPrice
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-slate-50 hover:bg-amber-50 text-slate-700 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <span>🟡 שולמה מקדמה</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDepositAmount(0)}
                    className={`p-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      depositAmount === 0
                        ? 'bg-red-500 text-white border-red-500 shadow-xs'
                        : 'bg-slate-50 hover:bg-red-50 text-slate-700 border-slate-200 hover:border-red-300'
                    }`}
                  >
                    <span>🔴 טרם שולם</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1">סכום ששולם בפועל כעת (₪)</span>
                    <input
                      type="number"
                      min="0"
                      max={totalPrice}
                      value={depositAmount === 0 ? '' : depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-slate-50 text-emerald-700 font-extrabold text-sm p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1">אמצעי תשלום</span>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-slate-50 text-xs font-semibold text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value="bit">ביט (Bit)</option>
                      <option value="paybox">פייבוקס (PayBox)</option>
                      <option value="cash">מזומן</option>
                      <option value="credit">כרטיס אשראי</option>
                      <option value="bank_transfer">העברה בנקאית</option>
                      <option value="other">אחר</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs flex justify-between pt-1 text-slate-600 font-medium">
                  <span>יתרה לגבייה בעזיבה:</span>
                  <span className={totalPrice - depositAmount > 0 ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>
                    ₪{Math.max(0, totalPrice - depositAmount)} {totalPrice - depositAmount === 0 ? '(שולם במלואו ✓)' : ''}
                  </span>
                </div>
              </div>

              {/* Step 4 Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>חזרה לתאריכים</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinalSave}
                  className="px-9 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>שמור הזמנה ביומן ✓</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 5: Success Celebration & Direct WhatsApp Sharing     */}
          {/* ======================================================== */}
          {currentStep === 5 && savedBookingResult && (
            <div className="space-y-6 py-4 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-slate-900">ההזמנה נשמרה בהצלחה ביומן!</h3>
                <p className="text-xs text-slate-600">
                  כל הפרטים נשמרו בסנכרון מלא. נשלח אישור ללקוח?
                </p>
              </div>

              {/* Summary pill */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right text-xs space-y-1.5 max-w-md mx-auto">
                <div className="font-bold text-slate-900">🐾 {savedBookingResult.dogName} ({savedBookingResult.ownerName})</div>
                <div className="text-slate-600">
                  {formatDateDisplay(savedBookingResult.startDate)} - {formatDateDisplay(savedBookingResult.endDate)} ({calculateDaysCount(savedBookingResult.startDate, savedBookingResult.endDate)} ימים)
                </div>
                <div className="font-bold text-indigo-700">סה״כ: ₪{savedBookingResult.totalPrice}</div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <a
                  href={generateWhatsAppLink(
                    savedBookingResult.ownerPhone,
                    getBookingConfirmationMessage(savedBookingResult, settings)
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>שלח אישור ללקוח בוואטסאפ</span>
                </a>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  חזרה ליומן הראשי
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
