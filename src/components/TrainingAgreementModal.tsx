import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Share2, 
  Send, 
  Copy, 
  Check, 
  RotateCcw, 
  PenTool, 
  Sparkles, 
  ShieldAlert, 
  Dog, 
  User, 
  Phone, 
  Calendar, 
  Lock,
  ExternalLink,
  CreditCard
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Booking, IntakeRequest, ResortSettings, TrainingAgreementData } from '../types';
import { formatDateIL, getTodayStr } from '../utils/dateUtils';
import { cleanPhoneNumber, formatIsraeliPhoneDisplay } from '../utils/whatsappUtils';
import { saveBookingToDb, saveIntakeRequestToDb } from '../services/dbService';
import { createGrowDynamicPaymentLink } from '../services/growPaymentService';

interface TrainingAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: Booking | null;
  intakeRequest?: IntakeRequest | null;
  settings: ResortSettings;
  isPublicClientView?: boolean;
  onAgreementSigned?: (agreementData: TrainingAgreementData) => void;
}

const HEBREW_MONTHS_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export const TrainingAgreementModal: React.FC<TrainingAgreementModalProps> = ({
  isOpen,
  onClose,
  booking,
  intakeRequest,
  settings,
  isPublicClientView = false,
  onAgreementSigned,
}) => {
  const today = getTodayStr();
  const todayDateObj = new Date();
  const currentDay = todayDateObj.getDate();
  const currentMonthName = HEBREW_MONTHS_NAMES[todayDateObj.getMonth()];
  const currentYear = todayDateObj.getFullYear();

  // Existing agreement data if previously signed
  const existingAgreement: TrainingAgreementData | undefined = 
    booking?.trainingAgreement || intakeRequest?.trainingAgreement;

  // 1. Owner Details State
  const [ownerFullName, setOwnerFullName] = useState(
    existingAgreement?.ownerFullName || booking?.ownerName || intakeRequest?.ownerName || ''
  );
  const [ownerIdNumber, setOwnerIdNumber] = useState(
    existingAgreement?.ownerIdNumber || ''
  );
  const [ownerAddress, setOwnerAddress] = useState(
    existingAgreement?.ownerAddress || booking?.ownerAddress || intakeRequest?.ownerAddress || ''
  );
  const [ownerPhone, setOwnerPhone] = useState(
    existingAgreement?.ownerPhone || booking?.ownerPhone || intakeRequest?.ownerPhone || ''
  );
  const [ownerEmail, setOwnerEmail] = useState(
    existingAgreement?.ownerEmail || booking?.ownerEmail || intakeRequest?.ownerEmail || ''
  );
  const [emergencyContact, setEmergencyContact] = useState(
    existingAgreement?.emergencyContact || booking?.emergencyContact || ''
  );

  // 1. Dog Details State
  const [dogName, setDogName] = useState(
    existingAgreement?.dogName || booking?.dogName || intakeRequest?.dogName || ''
  );
  const [dogBreed, setDogBreed] = useState(
    existingAgreement?.dogBreed || booking?.dogBreed || intakeRequest?.dogBreed || ''
  );
  const [dogAge, setDogAge] = useState(
    existingAgreement?.dogAge || booking?.dogAgeGroup || intakeRequest?.dogAge || ''
  );

  const getComputedGender = () => {
    if (existingAgreement?.dogGenderAndNeutered) return existingAgreement.dogGenderAndNeutered;
    const g = booking?.dogGender || (intakeRequest?.dogGender === 'female' ? 'female_spayed' : 'male_neutered');
    if (g === 'female_spayed') return 'נקבה, מעוקרת';
    if (g === 'female_intact') return 'נקבה, לא מעוקרת';
    if (g === 'male_neutered') return 'זכר, מסורס';
    if (g === 'male_intact') return 'זכר, לא מסורס';
    return intakeRequest?.dogGender === 'female' ? 'נקבה' : 'זכר';
  };

  const [dogGenderAndNeutered, setDogGenderAndNeutered] = useState(getComputedGender());
  const [dogWeightKg, setDogWeightKg] = useState(
    existingAgreement?.dogWeightKg || (intakeRequest?.dogSize ? `קטגוריית ${intakeRequest.dogSize}` : '')
  );
  const [dogChipNumber, setDogChipNumber] = useState(
    existingAgreement?.dogChipNumber || ''
  );
  const [vetNameAndPhone, setVetNameAndPhone] = useState(
    existingAgreement?.vetNameAndPhone || ''
  );

  // 2. Training Program State
  const [programType, setProgramType] = useState<'boarding_training' | 'behavioral_rehab' | 'other'>(
    existingAgreement?.programType || 'boarding_training'
  );
  const [programTypeOther, setProgramTypeOther] = useState(
    existingAgreement?.programTypeOther || ''
  );
  const [trainingGoals, setTrainingGoals] = useState(
    existingAgreement?.trainingGoals || booking?.behaviorNotes || intakeRequest?.specialNeeds || ''
  );
  const [startDate, setStartDate] = useState(
    existingAgreement?.startDate || booking?.startDate || intakeRequest?.startDate || today
  );
  const [endDate, setEndDate] = useState(
    existingAgreement?.endDate || booking?.endDate || intakeRequest?.endDate || ''
  );
  const [trainerName, setTrainerName] = useState(
    existingAgreement?.trainerName || 'הילה קירזנר (Halodog) / צוות הריזורט'
  );

  // 5. Pricing & Payment State
  const [totalPrice, setTotalPrice] = useState<number>(
    existingAgreement?.totalPrice || booking?.totalPrice || 6500
  );
  const [paymentMethod, setPaymentMethod] = useState(
    existingAgreement?.paymentMethod || booking?.paymentMethod || 'אשראי / ביט'
  );

  // 7.4 Medical Emergency Limit
  const [emergencyMedicalLimit, setEmergencyMedicalLimit] = useState<number>(
    existingAgreement?.emergencyMedicalLimit || 1000
  );

  // 9. Signatures
  const [ownerSignatureDataUrl, setOwnerSignatureDataUrl] = useState<string>(
    existingAgreement?.ownerSignatureDataUrl || booking?.signatureDataUrl || ''
  );
  const [isSigned, setIsSigned] = useState<boolean>(
    Boolean(existingAgreement?.ownerSignatureDataUrl || booking?.isTrainingAgreementSigned)
  );

  // Signature Canvas Handling
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasCanvasStroke, setHasCanvasStroke] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Keep form updated when props change
  useEffect(() => {
    if (booking || intakeRequest) {
      const agr = booking?.trainingAgreement || intakeRequest?.trainingAgreement;
      if (agr) {
        setOwnerFullName(agr.ownerFullName);
        setOwnerIdNumber(agr.ownerIdNumber);
        setOwnerAddress(agr.ownerAddress);
        setOwnerPhone(agr.ownerPhone);
        setOwnerEmail(agr.ownerEmail);
        setEmergencyContact(agr.emergencyContact);
        setDogName(agr.dogName);
        setDogBreed(agr.dogBreed);
        setDogAge(agr.dogAge);
        setDogGenderAndNeutered(agr.dogGenderAndNeutered);
        setDogWeightKg(agr.dogWeightKg);
        setDogChipNumber(agr.dogChipNumber);
        setVetNameAndPhone(agr.vetNameAndPhone);
        setProgramType(agr.programType);
        setProgramTypeOther(agr.programTypeOther || '');
        setTrainingGoals(agr.trainingGoals);
        setStartDate(agr.startDate);
        setEndDate(agr.endDate);
        setTrainerName(agr.trainerName);
        setTotalPrice(agr.totalPrice);
        setPaymentMethod(agr.paymentMethod);
        setEmergencyMedicalLimit(agr.emergencyMedicalLimit);
        setOwnerSignatureDataUrl(agr.ownerSignatureDataUrl || '');
        setIsSigned(Boolean(agr.ownerSignatureDataUrl));
      }
    }
  }, [booking, intakeRequest]);

  // Canvas helper functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f4c3a';
    setIsDrawing(true);
    setHasCanvasStroke(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    if ('touches' in e) {
      e.preventDefault();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasCanvasStroke(false);
    setOwnerSignatureDataUrl('');
  };

  if (!isOpen) return null;

  // Validation before submission
  const validateForm = (): boolean => {
    if (!ownerFullName.trim()) {
      setValidationError('אנא מלא את שם הבעלים המלא');
      return false;
    }
    if (!ownerIdNumber.trim()) {
      setValidationError('אנא מלא מספר תעודת זהות של הבעלים (שדה חובה בהסכם משפטי)');
      return false;
    }
    if (!ownerPhone.trim()) {
      setValidationError('אנא מלא מספר טלפון נייד');
      return false;
    }
    if (!dogName.trim()) {
      setValidationError('אנא מלא את שם הכלב');
      return false;
    }
    if (!dogChipNumber.trim()) {
      setValidationError('אנא מלא את מספר השבב של הכלב (שדה חובה לאילוף ושהייה בריזורט)');
      return false;
    }
    if (!vetNameAndPhone.trim()) {
      setValidationError('אנא ציין שם וטלפון של הווטרינר המטפל למקרה חירום');
      return false;
    }
    if (!emergencyContact.trim()) {
      setValidationError('אנא ציין איש קשר נוסף לחירום (שם וטלפון)');
      return false;
    }
    if (!ownerSignatureDataUrl && !hasCanvasStroke) {
      setValidationError('אנא חתום על ההסכם במשבצת החתימה הדיגיטלית');
      return false;
    }
    setValidationError(null);
    return true;
  };

  // Confirm and Sign
  const handleSaveAndSign = async () => {
    if (!validateForm()) return;

    let finalSig = ownerSignatureDataUrl;
    if (canvasRef.current && hasCanvasStroke) {
      finalSig = canvasRef.current.toDataURL('image/png');
    }

    setIsSaving(true);

    const agreementData: TrainingAgreementData = {
      signedDate: today,
      signedDateHebrew: `יום ${currentDay} בחודש ${currentMonthName} בשנת ${currentYear}`,
      ownerFullName: ownerFullName.trim(),
      ownerIdNumber: ownerIdNumber.trim(),
      ownerAddress: ownerAddress.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerEmail: ownerEmail.trim(),
      emergencyContact: emergencyContact.trim(),

      dogName: dogName.trim(),
      dogBreed: dogBreed.trim(),
      dogAge: dogAge.trim(),
      dogGenderAndNeutered,
      dogWeightKg: dogWeightKg.trim(),
      dogChipNumber: dogChipNumber.trim(),
      vetNameAndPhone: vetNameAndPhone.trim(),

      programType,
      programTypeOther: programType === 'other' ? programTypeOther.trim() : undefined,
      trainingGoals: trainingGoals.trim(),
      startDate,
      endDate,
      trainerName: trainerName.trim(),

      totalPrice: Number(totalPrice) || 0,
      paymentMethod,
      emergencyMedicalLimit: Number(emergencyMedicalLimit) || 1000,

      ownerSignatureDataUrl: finalSig,
      ownerSignedAt: new Date().toISOString(),

      resortSigned: true,
      resortSignedBy: 'שמוליק – מנהל הריזורט לכלב 🐾',
      resortSignedAt: new Date().toISOString(),
    };

    setOwnerSignatureDataUrl(finalSig);
    setIsSigned(true);

    try {
      // 1. Update Booking if associated
      if (booking) {
        const updatedBooking: Booking = {
          ...booking,
          ownerName: ownerFullName.trim(),
          ownerPhone: ownerPhone.trim(),
          ownerAddress: ownerAddress.trim(),
          emergencyContact: emergencyContact.trim(),
          dogName: dogName.trim(),
          dogBreed: dogBreed.trim(),
          startDate,
          endDate: endDate || booking.endDate,
          totalPrice: Number(totalPrice) || booking.totalPrice,
          behaviorNotes: trainingGoals.trim() || booking.behaviorNotes,
          isTrainingAgreementSigned: true,
          trainingAgreementSignedAt: new Date().toISOString(),
          trainingAgreement: agreementData,
          signatureDataUrl: finalSig,
          updatedAt: new Date().toISOString(),
        };
        await saveBookingToDb(updatedBooking);
      }

      // 2. Update IntakeRequest if associated
      if (intakeRequest) {
        const updatedIntake: IntakeRequest = {
          ...intakeRequest,
          ownerName: ownerFullName.trim(),
          ownerPhone: ownerPhone.trim(),
          ownerAddress: ownerAddress.trim(),
          dogName: dogName.trim(),
          dogBreed: dogBreed.trim(),
          startDate,
          endDate: endDate || intakeRequest.endDate,
          specialNeeds: trainingGoals.trim() || intakeRequest.specialNeeds,
          isTrainingAgreementSigned: true,
          trainingAgreementSignedAt: new Date().toISOString(),
          trainingAgreement: agreementData,
        };
        await saveIntakeRequestToDb(updatedIntake);
      }

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      if (onAgreementSigned) {
        onAgreementSigned(agreementData);
      }

    } catch (err) {
      console.error('Failed to save agreement:', err);
      alert('ההסכם נחתם מקומית אך אירעה שגיאה קלה בשמירה בענן. הנתונים שמורים.');
    } finally {
      setIsSaving(false);
    }
  };

  // Link for direct client WhatsApp sharing
  const generateAgreementLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rezort-webapp.vercel.app';
    const params = new URLSearchParams();
    params.set('agreement', 'training');
    if (booking?.id) params.set('bookingId', booking.id);
    if (intakeRequest?.id) params.set('intakeId', intakeRequest.id);
    if (ownerPhone) params.set('phone', cleanPhoneNumber(ownerPhone));
    if (ownerFullName) params.set('name', ownerFullName);
    if (dogName) params.set('dog', dogName);
    return `${origin}/?${params.toString()}`;
  };

  const handleCopyLink = () => {
    const link = generateAgreementLink();
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendViaWhatsApp = () => {
    const link = generateAgreementLink();
    const clean = cleanPhoneNumber(ownerPhone);
    const intlPhone = clean.startsWith('0') ? '972' + clean.substring(1) : clean;
    const msg = `שלום ${ownerFullName || 'חבר/ה'}! 🐾🐶
בהמשך להזמנת תהליך האילוף עבור *${dogName || 'הכלב/ה'}* בריזורט לכלב, מצורף קישור אישי להסכם האילוף:

👉 ${link}

*שים/י לב:* על פי נהלי הריזורט, לא ניתן לאשר שריון סופי או להסדיר תשלום לפני חתימה על ההסכם. אנא היכנס/י לקישור, השלם/י את הפרטים וחתום/י דיגיטלית.

בברכה חמה,
שמוליק וצוות הריזורט לכלב 🐾`;

    const url = intlPhone ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const [isOpeningPayment, setIsOpeningPayment] = useState(false);
  const handleProceedToPayment = async () => {
    setIsOpeningPayment(true);
    try {
      const amt = Number(totalPrice) || 6500;
      let payUrl = settings.growPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';
      try {
        const dynRes = await createGrowDynamicPaymentLink({
          amount: amt,
          bookingId: booking?.id || intakeRequest?.id || `train-${Date.now()}`,
          dogName: dogName,
          ownerName: ownerFullName,
          ownerPhone: ownerPhone,
          description: `דמי תהליך אילוף בריזורט לכלב - ${dogName}`
        });
        if (dynRes && dynRes.paymentUrl) {
          payUrl = dynRes.paymentUrl;
        }
      } catch (e) {
        console.warn('Failed to get dynamic grow link:', e);
      }
      if (payUrl.startsWith('//')) payUrl = 'https:' + payUrl;
      else if (!payUrl.startsWith('http://') && !payUrl.startsWith('https://')) payUrl = 'https://' + payUrl;
      window.open(payUrl, '_blank');
    } finally {
      setIsOpeningPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in" dir="rtl">
      
      {/* Container */}
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95">
        
        {/* Top Floating Control Bar (Hidden in Print) */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-slate-50 to-teal-50 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  הסכם אילוף כלבים – הריזורט לכלב
                </h3>
                {isSigned ? (
                  <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>נחתם ומאושר ✓</span>
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    <span>ממתין לחתימת לקוח</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                הסכם התקשרות מחייב לקראת תחילת תהליך האילוף והשיקום בריזורט
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="הדפס או שמור כ-PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">הדפס / PDF</span>
            </button>

            {!isPublicClientView && (
              <>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="העתק קישור להסכם"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{copiedLink ? 'הועתק!' : 'העתק קישור'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendViaWhatsApp}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="שלח קישור לחתימת הלקוח בוואטסאפ"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">שלח בוואטסאפ</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Body */}
        <div className="p-4 sm:p-8 overflow-y-auto space-y-6 text-slate-800 text-xs sm:text-sm leading-relaxed printable-document">

          {/* Training Agreement Hard Payment Rule Banner */}
          {!isSigned && (
            <div className="bg-gradient-to-r from-red-50 via-rose-50 to-red-50 border-2 border-red-300 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3 shadow-xs print:hidden animate-in fade-in">
              <div className="w-9 h-9 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xs">
                🛑
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs sm:text-sm font-black text-red-950">
                  נוהל ריזורט מחייב: אין לאפשר תשלום של דמי האילוף למי שלא חתם על ההסכם
                </h4>
                <p className="text-[11px] sm:text-xs text-red-800 font-bold leading-relaxed">
                  השלמת החתימה הדיגיטלית על הסכם זה הינה תנאי מוקדם ומחייב להסדרת התשלום או שריון המקום. אפשרות התשלום תשתחרר אוטומטית מיד לאחר השלמת החתימה בתחתית המסמך.
                </p>
              </div>
            </div>
          )}

          {/* Document Header with Official Logo */}
          <div className="text-center pb-4 border-b-2 border-emerald-800/20 space-y-2">
            <div className="flex items-center justify-center gap-3">
              <img 
                src="/resort-official-logo.jpg" 
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/resort-logo.svg'; }}
                alt="לוגו הריזורט לכלב" 
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-full border border-amber-300 drop-shadow-sm mx-auto" 
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0f4c3a] tracking-tight">
              הסכם אילוף כלבים – הריזורט לכלב
            </h1>
            <p className="text-xs text-slate-500 font-bold">
              הריזורט לכלב (ח.פ. 514942119) · טלפון רשמי: 054-8765888
            </p>
          </div>

          {/* Preamble */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 font-medium text-slate-700 space-y-1">
            <p>
              הסכם זה נערך ונחתם ביום <strong>{currentDay}</strong> בחודש <strong>{currentMonthName}</strong> בשנת <strong>{currentYear}</strong>, בין:
            </p>
            <p className="font-bold text-slate-900">
              <strong>הריזורט לכלב</strong> (להלן: &quot;הריזורט&quot;)
            </p>
            <p>
              לבין: <strong>בעלי הכלב</strong>, כמפורט בטבלה (להלן: &quot;הבעלים&quot;)
            </p>
          </div>

          {/* Validation Notice if any */}
          {validationError && (
            <div className="bg-red-50 border-2 border-red-300 text-red-900 rounded-2xl p-3 flex items-center gap-2 text-xs font-bold animate-in shake duration-200">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* SECTION 1: Parties and Dog Details */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-black text-[#0f4c3a] flex items-center gap-2 pb-1 border-b border-slate-200">
              <span>1. הצדדים ופרטי הכלב</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Owner Details Table */}
              <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100/90 px-3.5 py-2 font-black text-slate-800 text-xs border-b border-slate-200 flex items-center justify-between">
                  <span>פרטי הבעלים</span>
                  <span className="text-[10px] text-slate-500 font-normal">* שדות חובה</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0 w-24">שם מלא:</span>
                    <input
                      type="text"
                      value={ownerFullName}
                      onChange={(e) => setOwnerFullName(e.target.value)}
                      placeholder="שם פרטי ומשפחה"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-2.5 flex items-center justify-between gap-2 bg-amber-50/50">
                    <span className="text-amber-900 font-black shrink-0 w-24 flex items-center gap-1">
                      <span>ת.ז. *</span>
                      {!ownerIdNumber && <span className="text-[10px] text-red-600 font-bold">(נדרש)</span>}
                    </span>
                    <input
                      type="text"
                      value={ownerIdNumber}
                      onChange={(e) => setOwnerIdNumber(e.target.value)}
                      placeholder="הזן 9 ספרות ת.ז."
                      maxLength={9}
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>

                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0 w-24">כתובת מגורים:</span>
                    <input
                      type="text"
                      value={ownerAddress}
                      onChange={(e) => setOwnerAddress(e.target.value)}
                      placeholder="עיר, רחוב ומספר בית"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0 w-24">טלפון נייד:</span>
                    <input
                      type="tel"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="050-0000000"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0 w-24">דוא&quot;ל:</span>
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-2.5 flex items-center justify-between gap-2 bg-amber-50/50">
                    <span className="text-amber-900 font-black shrink-0 w-24 flex items-center gap-1">
                      <span>איש חירום *</span>
                    </span>
                    <input
                      type="text"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      placeholder="שם מלא ומספר טלפון"
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                </div>
              </div>

              {/* Dog Details Table */}
              <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100/90 px-3.5 py-2 font-black text-slate-800 text-xs border-b border-slate-200 flex items-center justify-between">
                  <span>פרטי הכלב (להלן: &quot;הכלב&quot;)</span>
                  <span className="text-[10px] text-slate-500 font-normal">* שדות חובה</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0 w-24">שם הכלב:</span>
                    <input
                      type="text"
                      value={dogName}
                      onChange={(e) => setDogName(e.target.value)}
                      placeholder="שם הכלב/ה"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-black text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0 w-24">גזע / מעורב:</span>
                    <input
                      type="text"
                      value={dogBreed}
                      onChange={(e) => setDogBreed(e.target.value)}
                      placeholder="גולדן / רועה גרמני / מעורב"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0 w-24">גיל הכלב:</span>
                    <input
                      type="text"
                      value={dogAge}
                      onChange={(e) => setDogAge(e.target.value)}
                      placeholder="למשל: שנתיים וחצי"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0 w-24">מין, מעוקר/ת:</span>
                    <input
                      type="text"
                      value={dogGenderAndNeutered}
                      onChange={(e) => setDogGenderAndNeutered(e.target.value)}
                      placeholder="זכר מסורס / נקבה מעוקרת"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0 w-24">משקל משוער:</span>
                    <input
                      type="text"
                      value={dogWeightKg}
                      onChange={(e) => setDogWeightKg(e.target.value)}
                      placeholder="למשל: 18 ק״ג"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-2.5 flex items-center justify-between gap-2 bg-amber-50/50">
                    <span className="text-amber-900 font-black shrink-0 w-24 flex items-center gap-1">
                      <span>מספר שבב *</span>
                      {!dogChipNumber && <span className="text-[10px] text-red-600 font-bold">(נדרש)</span>}
                    </span>
                    <input
                      type="text"
                      value={dogChipNumber}
                      onChange={(e) => setDogChipNumber(e.target.value)}
                      placeholder="15 ספרות שבב"
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-mono"
                    />
                  </div>

                  <div className="p-2.5 flex items-center justify-between gap-2 bg-amber-50/50">
                    <span className="text-amber-900 font-black shrink-0 w-24 flex items-center gap-1">
                      <span>וטרינר מטפל *</span>
                    </span>
                    <input
                      type="text"
                      value={vetNameAndPhone}
                      onChange={(e) => setVetNameAndPhone(e.target.value)}
                      placeholder="שם מרפאה / וטרינר וטלפון"
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* SECTION 2: Training Program */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-black text-[#0f4c3a] flex items-center gap-2 pb-1 border-b border-slate-200">
              <span>2. תוכנית האילוף</span>
            </h2>
            <p className="text-xs text-slate-700">
              הריזורט יעניק לכלב שירותי אילוף לפי התוכנית שנבחרה להלן (להלן: &quot;התוכנית&quot;). האילוף מתבצע כולו בריזורט.
            </p>

            {/* Program Options Grid */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'boarding_training', title: 'אילוף בפנסיון', desc: 'תכנית מלאה בריזורט' },
                  { id: 'behavioral_rehab', title: 'שיקום התנהגותי', desc: 'טיפול בחרדות ותוקפנות' },
                  { id: 'other', title: 'אחר / מותאם אישית', desc: 'פירוט להלן' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setProgramType(item.id as any)}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      programType === item.id
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-600'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">{item.title}</span>
                      <input 
                        type="radio" 
                        name="progType" 
                        checked={programType === item.id} 
                        readOnly 
                        className="accent-emerald-700"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>

              {programType === 'other' && (
                <div className="pt-1">
                  <input
                    type="text"
                    value={programTypeOther}
                    onChange={(e) => setProgramTypeOther(e.target.value)}
                    placeholder="פרט את סוג התוכנית המותאמת..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              )}

              {/* Goals */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">
                  🎯 מטרות האילוף והדגשים:
                </label>
                <textarea
                  rows={2}
                  value={trainingGoals}
                  onChange={(e) => setTrainingGoals(e.target.value)}
                  placeholder="למשל: הליכה רגועה ברצועה, ביטחון מול כלבים אחרים, הפסקת קפיצות, פקודות משמעת בסיסיות ומתקדמות..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Dates and Trainer row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-1">תאריך כניסה לאילוף:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-1">תאריך יציאה משוער:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-1">מאלף/ת אחראי/ת:</span>
                  <input
                    type="text"
                    value={trainerName}
                    onChange={(e) => setTrainerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 text-[11px] text-emerald-950 flex items-center justify-between font-bold">
                <span>מפגשי חפיפה לבעלים:</span>
                <span className="bg-white px-2 py-0.5 rounded-lg border border-emerald-300 text-emerald-900 font-black">
                  כלולים בתוכנית. ההשתתפות בהם חובה (סעיף 2.4)
                </span>
              </div>
            </div>

            {/* Legal clauses 2.1 - 2.4 */}
            <div className="space-y-1.5 text-xs text-slate-700 pr-2">
              <p><strong>2.1.</strong> מועדי מפגשי החפיפה ייקבעו בתיאום בין הצדדים, בהתאם לסעיף 6.2.</p>
              <p><strong>2.2.</strong> הריזורט רשאי להחליף את המאלף/ת במאלף/ת אחר/ת מטעמו.</p>
              <p><strong>2.3.</strong> אם במהלך האילוף יתברר שהכלב זקוק לתוכנית שונה מזו שנבחרה, הריזורט יציע זאת לבעלים. שינוי בתוכנית או במחיר ייעשה רק בהסכמת הבעלים בכתב, לרבות בהודעת וואטסאפ או בדוא&quot;ל.</p>
              <p><strong>2.4. מפגשי חפיפה.</strong> מפגשי החפיפה כלולים בתוכנית, ובהם מקבלים הבעלים את הכלים להמשך העבודה עם הכלב. השתתפות הבעלים בהם היא חובה. אם מפגשי החפיפה לא מתקיימים, תכלית האילוף מסוכלת, והריזורט לא יישא באחריות לתוצאות האילוף.</p>
            </div>
          </section>

          {/* SECTION 3: Resort Obligations */}
          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-[#0f4c3a] pb-1 border-b border-slate-200">
              3. התחייבויות הריזורט
            </h2>
            <div className="space-y-1.5 text-xs text-slate-700 pr-2">
              <p><strong>3.1. שיטת האילוף.</strong> האילוף יבוצע בשיטות אילוף קלאסיות. המאלף/ת רשאי/ת להשתמש בכל אמצעי ואביזר המקובלים בענף האילוף ומותרים לשימוש על פי דין. השימוש בהם נועד ללמד את הכלב ולתקן התנהגויות שאינן מקדמות את האילוף. ההחלטה איזה אמצעי להפעיל, מתי ובאיזו עוצמה, נתונה לשיקול דעתו המקצועי של המאלף/ת, בהתאם לאופי הכלב ולמצבו.</p>
              <p><strong>3.1א. הסכמת הבעלים.</strong> הבעלים מאשרים שהוסבר להם אילו אמצעים עשויים לשמש באילוף הכלב. הם מסכימים שבחירת האמצעים, אופן השימוש בהם ועיתויו נתונים לשיקול דעתו המקצועי הבלעדי של המאלף/ת.</p>
              <p><strong>3.2.</strong> להתאים את קצב האילוף ואת עומסו למצבו הגופני והרגשי של הכלב.</p>
              <p><strong>3.3.</strong> לעדכן את הבעלים מעת לעת בהתקדמות הכלב.</p>
              <p><strong>3.4.</strong> למסור לבעלים בסיום התוכנית הנחיות כתובות להמשך תרגול בבית.</p>
              <p><strong>3.5.</strong> לספק לכלב לינה, האכלה, מים זמינים כל הזמן ופעילות יומית. הכלב יוחזק בתנאים המתאימים לגודלו ולמזגו.</p>
            </div>
          </section>

          {/* SECTION 4: Owner Declarations and Obligations */}
          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-[#0f4c3a] pb-1 border-b border-slate-200">
              4. הצהרות והתחייבויות הבעלים
            </h2>
            <div className="space-y-1.5 text-xs text-slate-700 pr-2">
              <p><strong>4.1. בריאות וחיסונים.</strong> הבעלים מצהירים שהכלב בריא ומחוסן כנדרש בחוק ולפי המלצת הווטרינר, ובכלל זה חיסון כלבת בתוקף ומשושה. כמו כן הכלב מטופל נגד פרעושים, קרציות ותולעים. לפי דרישת הריזורט, הבעלים יציגו פנקס חיסונים. אם יתברר במהלך האילוף שהכלב חולה, הבעלים יאספו אותו מהריזורט ויחזירו אותו לאחר שהחלים. ימי ההיעדרות לא ייספרו בתקופת האילוף.</p>
              <p><strong>4.2. רישוי ושבב.</strong> הכלב רשום ברשות המקומית כנדרש בחוק ומסומן בשבב.</p>
              <p><strong>4.3. גילוי מלא.</strong> הבעלים יגלו לריזורט, לפני תחילת התוכנית ובמהלכה, כל מידע רלוונטי על הכלב, ובכלל זה:</p>
              <ul className="list-disc list-inside pr-4 space-y-0.5 text-slate-600">
                <li>נשיכה או ניסיון נשיכה בעבר, של אדם או של בעל חיים</li>
                <li>תוקפנות, פחדים או תגובתיות</li>
                <li>מחלות, פציעות, ניתוחים ותרופות</li>
                <li>רגישויות ואלרגיות</li>
                <li>נטייה לבריחה</li>
              </ul>
              <p><strong>4.4. שינויים.</strong> הבעלים יעדכנו את הריזורט מיד על כל שינוי במצבו הבריאותי או ההתנהגותי של הכלב.</p>
              <p><strong>4.5. מפגשים, תרגול ותיעוד.</strong> הבעלים יגיעו למפגשים במועד שנקבע, ולאחריהם יתרגלו בבית לפי הנחיות המאלף/ת. בנוסף, הבעלים יתעדו את התרגול בזמן אמת, למשל בסרטונים או בהודעות וואטסאפ, ויעבירו את התיעוד למאלף/ת. ידוע לבעלים שהצלחת האילוף תלויה במידה רבה בהתמדה שלהם.</p>
              <p><strong>4.6. ציוד ומזון.</strong> הבעלים יספקו רצועה וקולר תקינים. בנוסף יספקו מזון בכמות מספקת לכל תקופת השהות, ותרופות אם נדרשות, עם הוראות מתן בכתב.</p>
              <p><strong>4.7. אי התערבות באילוף.</strong> הבעלים לא יתערבו בשיטת האילוף, בבחירת האמצעים ובתוכנית העבודה, שנתונים לשיקול דעתו המקצועי של המאלף/ת לפי סעיף 3.1. שאלות ובקשות יופנו למאלף/ת בוואטסאפ, ולא במהלך עבודה עם הכלב.</p>
            </div>
          </section>

          {/* SECTION 5: Consideration and Payment Terms */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-black text-[#0f4c3a] pb-1 border-b border-slate-200">
              5. תמורה ותנאי תשלום
            </h2>

            {/* Payment Summary Table */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-2xs text-xs">
              <div className="grid grid-cols-2 bg-slate-100/90 font-black text-slate-800 p-2.5 border-b border-slate-200">
                <span>רכיב</span>
                <span>פירוט</span>
              </div>
              <div className="grid grid-cols-2 p-2.5 border-b border-slate-100 items-center">
                <span className="font-bold text-slate-700">מחיר התוכנית (₪, כולל מע&quot;מ):</span>
                <div className="flex items-center gap-1 font-mono font-black text-emerald-800">
                  <span>₪</span>
                  <input
                    type="number"
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(Number(e.target.value) || 0)}
                    className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-black focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 p-2.5 border-b border-slate-100">
                <span className="font-bold text-slate-700">מועד התשלום:</span>
                <span className="font-black text-slate-900">מלוא הסכום, לפני תחילת האילוף</span>
              </div>
              <div className="grid grid-cols-2 p-2.5 items-center">
                <span className="font-bold text-slate-700">אמצעי תשלום:</span>
                <div className="flex flex-wrap gap-2">
                  {['אשראי', 'ביט', 'העברה בנקאית', 'מזומן'].map((m) => (
                    <label key={m} className="flex items-center gap-1 cursor-pointer font-bold text-slate-800">
                      <input
                        type="radio"
                        name="payMethodGroup"
                        checked={paymentMethod.includes(m)}
                        onChange={() => setPaymentMethod(m)}
                        className="accent-emerald-700"
                      />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1 text-xs text-slate-700 pr-2">
              <p><strong>5.1.</strong> האילוף יתחיל רק לאחר תשלום מלוא מחיר התוכנית.</p>
              <p><strong>5.2.</strong> שהייה נוספת בריזורט, מעבר לתקופה הכלולה בתוכנית, תתומחר בנפרד לפי המחירון של הריזורט. זה כולל שהייה שנדרשת בגלל גורמים שתלויים בהטמעת האילוף. התשלום על שהייה נוספת ייעשה לכל המאוחר במועד איסוף הכלב, והכלב יימסר לבעלים לאחר שישולם כל הסכום.</p>
              <p><strong>5.3.</strong> מפגשים נוספים שלא כלולים בתוכנית יתומחרו לפי המחירון של הריזורט באותה עת, ויבוצעו רק בהסכמת הבעלים מראש.</p>
              <p><strong>5.4.</strong> הוצאות חריגות שהוצאו לטובת הכלב, כמו טיפול וטרינרי דחוף לפי סעיף 7.4, יחולו על הבעלים וישולמו בתוך 7 ימים מקבלת הקבלה.</p>
            </div>
          </section>

          {/* SECTION 6: Cancellations and Postponements */}
          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-[#0f4c3a] pb-1 border-b border-slate-200">
              6. ביטולים ודחיות
            </h2>
            <div className="space-y-1.5 text-xs text-slate-700 pr-2">
              <p><strong>6.1. דחיית מפגש.</strong> אפשר לדחות מפגש בהודעה של 24 שעות לפחות מראש. אם הבעלים דחו מפגש בהתראה של פחות מ-24 שעות, או לא הגיעו אליו, הם יחויבו בעלות מפגש משלים בסך 400 ₪ כולל מע&quot;מ. הריזורט רשאי לדחות מפגש מסיבה מוצדקת, ובכלל זה מחלה, מזג אוויר קיצוני או מצב ביטחוני. במקרה כזה ייקבע מפגש חלופי בלי עלות.</p>
              <p><strong>6.2. מועד מפגשי החפיפה.</strong> מפגשי החפיפה יתקיימו בשבועיים האחרונים של תקופת האילוף. אם הבעלים דוחים מפגש אחד או יותר אל מעבר לתקופה זו, הם יחויבו בעלות פנסיון לפי המחירון של הריזורט על כל יום של דחייה.</p>
              <p><strong>6.3. הפסקת האילוף.</strong> הבעלים רשאים להפסיק את האילוף בהודעה בכתב, לרבות בוואטסאפ או בדוא&quot;ל. הריזורט רשאי להפסיק את האילוף רק מהסיבות המפורטות בסעיף 6.5. ההחזר לבעלים ייקבע לפי חישוב הריזורט, כמפורט להלן:</p>
              <ul className="list-disc list-inside pr-4 space-y-0.5 text-slate-600">
                <li>הפסקה בתוך החודש הראשון מתחילת האילוף: יוחזרו 25% ממחיר התוכנית בעבור כל שבוע שלם שלא נוצל, עד תום החודש הראשון.</li>
                <li>הפסקה לאחר חודש מתחילת האילוף: אין החזר.</li>
              </ul>
              <p><strong>6.4. עסקה מרחוק.</strong> אם ההסכם נכרת בעסקת מכר מרחוק, למשל בטלפון, בוואטסאפ או באינטרנט, יחולו על הביטול גם הוראות חוק הגנת הצרכן, התשמ&quot;א-1981. אם יש סתירה, הוראות החוק גוברות.</p>
              <p><strong>6.5. הפסקה על ידי הריזורט.</strong> הריזורט רשאי להפסיק את התוכנית בכל אחד מהמקרים הבאים:</p>
              <ul className="list-disc list-inside pr-4 space-y-0.5 text-slate-600">
                <li>הכלב מסכן אנשים, בעלי חיים אחרים או את עצמו באופן שאינו מאפשר אילוף בטוח</li>
                <li>הבעלים הסתירו מידע מהותי, בניגוד לסעיף 4.3</li>
                <li>הבעלים מתערבים באילוף בניגוד לסעיף 4.7, או נוהגים כלפי צוות הריזורט באופן פוגעני, מטריד או מאיים, ולא חדלו מכך לאחר התראה בכתב, לרבות בוואטסאפ</li>
                <li>הבעלים הפרו הפרה מהותית אחרת של ההסכם</li>
              </ul>
              <p className="text-[11px] text-slate-500">בכל מקרה של הפסקה על ידי הריזורט, ההחזר לבעלים ייקבע לפי סעיף 6.3. כשיש סיכון בטיחותי, אין צורך בהתראה מוקדמת.</p>
            </div>
          </section>

          {/* SECTION 7: Outcomes, Liability and Medical Emergency */}
          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-[#0f4c3a] pb-1 border-b border-slate-200">
              7. תוצאות, אחריות וחירום רפואי
            </h2>
            <div className="space-y-1.5 text-xs text-slate-700 pr-2">
              <p><strong>7.1. אין התחייבות לתוצאה.</strong> כלב הוא בעל חיים, והתנהגותו מושפעת מגורמים רבים שאינם בשליטת הריזורט, ובהם תרגול בבית, סביבה, גנטיקה ומצב בריאותי. לכן הריזורט מתחייב לפעול במקצועיות ובמיטב יכולתו, אבל אינו מתחייב לתוצאה מסוימת או לשינוי התנהגותי מלא וקבוע. הבעלים פוטרים את הריזורט מאחריות לאי השלמת תוכנית האילוף. הם פוטרים אותו גם מאחריות לתוצאה שאינה מושלמת, אם לא תרגלו ותיעדו את התרגול כנדרש בסעיף 4.5.</p>
              <p><strong>7.2. התנהלות הריזורט.</strong> הריזורט ינהג בכלב כיאות ולפי הפרקטיקות המקובלות בענף.</p>
              <p><strong>7.3. סיכונים מוכרים.</strong> ידוע לבעלים שבאילוף ובשהייה בחברת כלבים אחרים קיימים סיכונים שאינם נובעים מרשלנות, כמו שריטות קלות במשחק, מתח, שינוי זמני בתיאבון או שלשול חולף. הריזורט לא יישא באחריות לנזק כזה, ולא לנזק שנובע ממצב רפואי או התנהגותי קודם של הכלב שלא נמסר עליו בהתאם לסעיף 4.3.</p>
              
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-1.5 my-2">
                <p><strong>7.4. חירום רפואי.</strong> אם לכלב נדרש טיפול רפואי דחוף, הריזורט יפנה מיד לבעלים. אם לא יהיה אפשר להשיג אותם או את איש הקשר לחירום, הבעלים מסמיכים בזאת את הריזורט:</p>
                <ul className="list-disc list-inside pr-3 space-y-1 text-slate-700">
                  <li>לפנות עם הכלב לווטרינר המטפל, ואם הוא אינו זמין, לווטרינר או למרפאה הקרובים</li>
                  <li className="flex items-center gap-1.5 flex-wrap">
                    <span>לאשר בדיקות וטיפולים בעלות של עד</span>
                    <input
                      type="number"
                      value={emergencyMedicalLimit}
                      onChange={(e) => setEmergencyMedicalLimit(Number(e.target.value) || 0)}
                      className="w-20 bg-white border border-amber-400 rounded-lg px-2 py-0.5 font-black text-amber-950 font-mono text-center"
                    />
                    <span>₪ בלי אישור נוסף</span>
                  </li>
                </ul>
                <p className="text-[11px] text-slate-600 pt-1">
                  החלטה על טיפול בעלות גבוהה יותר, או על המתת חסד, תתקבל רק על ידי הבעלים, למעט מצב שבו הווטרינר קבע שנדרש טיפול מיידי למניעת סבל קשה.
                </p>
              </div>

              <p><strong>7.5. נזק שגורם הכלב.</strong> הבעלים אחראים לנזק שהכלב גורם לאדם, לבעל חיים או לרכוש, אם הנזק נובע מהתנהגות שהבעלים ידעו עליה ולא גילו לריזורט.</p>
            </div>
          </section>

          {/* SECTION 8: Media, Content and Privacy */}
          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-[#0f4c3a] pb-1 border-b border-slate-200">
              8. צילום, תכנים ופרטיות
            </h2>
            <div className="space-y-1.5 text-xs text-slate-700 pr-2">
              <p><strong>8.1.</strong> הריזורט רשאי לצלם את הכלב במהלך האילוף, כדי לתעד את ההתקדמות ולעדכן את הבעלים.</p>
              <p><strong>8.2.</strong> הבעלים מסכימים שהריזורט ישתמש בתמונות ובסרטונים של הכלב מתהליך האילוף לצורכי שיווק, ובכלל זה ברשתות חברתיות ובפרסום ממומן.</p>
              <p><strong>8.3.</strong> הריזורט לא יפרסם את שם הבעלים, את פניהם או את פרטי הקשר שלהם בלי הסכמה נפרדת בכתב.</p>
              <p><strong>8.4.</strong> פרטי הבעלים והכלב ישמשו את הריזורט לצורך מתן השירות ותפעולו בלבד, ולא יועברו לצד שלישי, למעט ווטרינר בעת הצורך או כפי שהחוק מחייב.</p>
            </div>
          </section>

          {/* SECTION 9: General Provisions and Signatures */}
          <section className="space-y-4 pt-2">
            <h2 className="text-sm sm:text-base font-black text-[#0f4c3a] pb-1 border-b border-slate-200">
              9. הוראות כלליות וחתימות
            </h2>
            <div className="space-y-1.5 text-xs text-slate-700 pr-2">
              <p><strong>9.1.</strong> הסכם זה ממצה את ההסכמות בין הצדדים. שינוי בו ייעשה בכתב, לרבות בהודעת וואטסאפ או בדוא&quot;ל, ששני הצדדים אישרו.</p>
              <p><strong>9.2.</strong> הודעות בין הצדדים יישלחו לטלפון או לכתובת הדוא&quot;ל שמופיעים בהסכם.</p>
              <p><strong>9.3.</strong> על ההסכם יחולו דיני מדינת ישראל.</p>
              <p><strong>9.4.</strong> הבעלים מאשרים שקראו את ההסכם, הבינו אותו ומסכימים לכל תנאיו.</p>
            </div>

            {/* Official Signatures Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              
              {/* 1. Resort Signature Box (Fully Official with Logo) */}
              <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-4 space-y-3 relative overflow-hidden">
                <div className="text-xs font-black text-emerald-950 pb-1 border-b border-emerald-200 flex items-center justify-between">
                  <span>הריזורט לכלב</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded-full">
                    חתום ומאושר דיגיטלית ✓
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="text-slate-500 font-bold block">שם החותם:</span>
                  <p className="font-black text-slate-900 leading-snug">
                    הריזורט לכלב (ח.פ. 514942119), באמצעות: שמוליק מנהל הריזורט 🐾
                  </p>
                </div>

                {/* Official Resort Signature Graphic / Stamp */}
                <div className="space-y-1">
                  <span className="text-slate-500 font-bold block text-xs">חתימת הריזורט:</span>
                  <div className="bg-white border border-emerald-200 rounded-xl p-3 flex items-center justify-center gap-3 shadow-2xs">
                    <img 
                      src="/resort-official-logo.jpg" 
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/resort-logo.svg'; }}
                      alt="חותמת הריזורט" 
                      className="w-12 h-12 object-contain rounded-full border border-amber-300 shrink-0" 
                    />
                    <div className="text-right">
                      <div className="text-xs font-black text-[#0f4c3a]">הריזורט לכלב בע&quot;מ</div>
                      <div className="text-[10px] text-slate-500 font-medium">ח.פ. 514942119 · מאושר דיגיטלית</div>
                      <div className="text-[10px] text-emerald-700 font-bold">שמוליק – מנהל הריזורט לכלב 🐾</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-0.5 text-xs pt-1 border-t border-emerald-200/80">
                  <span className="text-slate-500 font-bold block text-[11px]">תאריך מילוי ההסכם:</span>
                  <p className="font-bold text-slate-900">
                    {currentDay} ב{currentMonthName} {currentYear} ({formatDateIL(today)})
                  </p>
                </div>
              </div>

              {/* 2. Owner Signature Box */}
              <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-black text-slate-800 pb-1 border-b border-slate-200 flex items-center justify-between">
                  <span>הבעלים (הלקוח)</span>
                  {isSigned ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-black">
                      נחתם דיגיטלית ✓
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-black">
                      יש לחתום למטה
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <span className="text-slate-500 font-bold block">שם הבעלים:</span>
                  <p className="font-black text-slate-900">
                    {ownerFullName || 'טרם מולא'} {ownerIdNumber ? `(ת.ז. ${ownerIdNumber})` : ''}
                  </p>
                </div>

                {/* Signature View or Interactive Canvas */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-bold">חתימת הבעלים:</span>
                    {!isSigned && hasCanvasStroke && (
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="text-[11px] text-red-600 hover:text-red-800 underline font-bold cursor-pointer"
                      >
                        נקה חתימה ✕
                      </button>
                    )}
                    {isSigned && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsSigned(false);
                          setOwnerSignatureDataUrl('');
                          setHasCanvasStroke(false);
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 underline font-bold cursor-pointer"
                      >
                        חתום מחדש ✍️
                      </button>
                    )}
                  </div>

                  {isSigned && ownerSignatureDataUrl ? (
                    <div className="bg-slate-50 border-2 border-emerald-300 rounded-xl p-2.5 flex flex-col items-center justify-center min-h-[110px]">
                      <img 
                        src={ownerSignatureDataUrl} 
                        alt="חתימת הבעלים" 
                        className="max-h-20 object-contain" 
                      />
                      <span className="text-[10px] text-emerald-800 font-bold mt-1">
                        נחתם דיגיטלית ומאומת ע״י הלקוח
                      </span>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-emerald-400 rounded-xl bg-emerald-50/20 relative touch-none overflow-hidden">
                      <canvas
                        ref={canvasRef}
                        width={400}
                        height={110}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-[110px] cursor-crosshair"
                      />
                      {!hasCanvasStroke && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-xs">
                          <PenTool className="w-4 h-4 mb-1 text-emerald-600/70" />
                          <span>חתום כאן באצבע או בעכבר</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-0.5 text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-bold block text-[11px]">תאריך חתימת הבעלים:</span>
                  <p className="font-bold text-slate-900">
                    {formatDateIL(today)} ({currentDay} ב{currentMonthName} {currentYear})
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* Hard Rule Notice: Payment Restriction without Agreement */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-xs space-y-1 shadow-2xs">
            <div className="flex items-center gap-2 font-black text-amber-950">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>נוהל תשלום דמי אילוף – הריזורט לכלב:</span>
            </div>
            <p className="text-amber-900 leading-relaxed font-medium">
              על פי נהלי הריזורט, <strong>אין לאפשר תשלום של דמי האילוף למי שלא חתם על ההסכם</strong>. חתימת הלקוח על הסכם זה הינה תנאי סף מקדים ובלתי מתפשר להוצאת קישור תשלום, גבייה וקליטה לאילוף.
            </p>
          </div>

        </div>

        {/* Modal Bottom Sticky Footer (Hidden in Print) */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 print:hidden">
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isSigned ? (
              <div className="flex items-center gap-2 text-xs font-black text-emerald-800 bg-emerald-100/90 px-3 py-1.5 rounded-xl border border-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>הסכם זה חתום ומאושר במלואו ✓</span>
              </div>
            ) : (
              <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-emerald-700" />
                <span>יש למלא את שדות החובה ולחתום דיגיטלית לאישור</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              סגור
            </button>

            {!isSigned ? (
              <button
                type="button"
                onClick={handleSaveAndSign}
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#065f46] hover:bg-[#044e45] active:scale-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <span>שומר חתימה...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>חתום ואשר את הסכם האילוף ✍️</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>ההסכם חתום – סגור</span>
                </button>

                {Number(totalPrice) > 0 && (
                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    disabled={isOpeningPayment}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4 text-emerald-200" />
                    <span>{isOpeningPayment ? 'מכין קישור תשלום...' : `💳 שלם דמי אילוף כעת (₪${Number(totalPrice).toLocaleString()})`}</span>
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
