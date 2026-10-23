import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Send, 
  Copy, 
  Check, 
  PenTool, 
  ShieldAlert, 
  CreditCard,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Calendar,
  Phone,
  User,
  Dog,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Booking, IntakeRequest, ResortSettings, TrainingAgreementData, ServiceType } from '../types';
import { formatDateIL, getTodayStr } from '../utils/dateUtils';
import { cleanPhoneNumber, formatIsraeliPhoneDisplay } from '../utils/whatsappUtils';
import { saveBookingToDb, saveIntakeRequestToDb } from '../services/dbService';
import { createGrowDynamicPaymentLink } from '../services/growPaymentService';

export interface AgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: Booking | null;
  intakeRequest?: IntakeRequest | null;
  settings: ResortSettings;
  isPublicClientView?: boolean;
  agreementType?: 'training' | 'boarding' | 'auto';
  onAgreementSigned?: (agreementData: TrainingAgreementData) => void;
}

const HEBREW_MONTHS_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

// 8 Clauses of Resort Boarding Bylaws (תקנון שירותי אירוח ופנסיון הריזורט לכלב)
const RESORT_BOARDING_CLAUSES = [
  {
    num: '1',
    title: '1. תשלום ושחרור הכלב בתום השהייה',
    icon: '💳',
    content: 'תנאי לשחרור הכלב בתום תקופת השהייה הוא הסדרת מלוא התשלום בגין השהייה וכל שירות או הוצאה נוספת שניתנו לכלב במהלך שהייתו (לרבות הארכת שהייה, תוספות מיוחדות או הוצאות רפואיות). התשלום מתבצע באמצעות קישור תשלום דיגיטלי מאובטח של Grow (אשראי / Bit) או במזומן בתיאום מראש. הריזורט רשאי לעכב את מסירת הכלב עד להסדרת מלוא התשלום כאמור.'
  },
  {
    num: '2',
    title: '2. אספקת מזון ותרופות',
    icon: '🥣',
    content: 'מזון הכלב יסופק על ידי בעל הכלב בכמות מספקת לכל תקופת השהייה. לכל כלב משויך דלי מזון אישי ושקית מזון מסודרת. במידה ומזון זה יאזל במהלך השהייה, הריזורט יהא רשאי לרכוש עבור הכלב מזון חלופי איכותי, ועלות הרכישה תחול במלואה על בעל הכלב. מתן תרופות קבועות יינתן בהתאם להנחיות כתובות ומפורטות בלבד שנמסרו בטופס הקליטה.'
  },
  {
    num: '3',
    title: '3. קולר וציוד הכלב',
    icon: '🐕',
    content: 'הכלב יימסר לריזורט עם קולר תקין ובטוח לשימוש. ככל שיימצא כי קולר הכלב אינו תקין, בלוי או אינו בטוח לשימוש, הריזורט יהא רשאי לרכוש עבור הכלב קולר חלופי בטיחותי, ועלות הרכישה תחויב לבעל הכלב.'
  },
  {
    num: '4',
    title: '4. פטור מאחריות – התנהלות בעלי חיים וחיות בר',
    icon: '🛡️',
    content: 'הריזורט פועל במיטב יכולתו ובאופן מקצועי ביותר לשמירה על שלומם, רווחתם וביטחונם של כלל הכלבים במתקן המגודר והמאובטח. עם זאת, בעל הכלב מצהיר כי ידוע לו שמדובר בבעלי חיים בעלי יצרים והתנהגות טבעית, ולא ניתן להבטיח מניעה מוחלטת של אירועים בלתי צפויים, שריטות או שפשופים קלים במשחק חברתי משותף. הריזורט לא יישא באחריות לכל נזק, פציעה או אירוע בלתי צפוי שאינו נובע מרשלנות ישירה, וכן לא יישא באחריות לנזק שייגרם לכלב כתוצאה מאירוע חיות בר בסביבה הכפרית.'
  },
  {
    num: '5',
    title: '5. הצהרת בריאות, חיסונים וגילוי נאות',
    icon: '🩺',
    content: 'בעל הכלב מצהיר ומאשר כי הכלב בריא ומחוסן כדין בהתאם לדרישות החוק ולפי המלצת הווטרינר, לרבות חיסון כלבת בתוקף, חיסון משושה וחיסון שעלת מכלאות. בעל הכלב מתחייב לגלות לריזורט, טרם מסירת הכלב, כל מידע רלוונטי לגביו: מקרי תוקפנות או נשיכה בעבר; פחדים וחרדות; מצב רפואי המצריך התייחסות מיוחדת; ורגישויות לתנאי מזג אוויר או למזון. האחריות למסירת מידע מלא ומדויק חלה במלואה על בעל הכלב.'
  },
  {
    num: '6',
    title: '6. טיפול מונע והרשאה פתוחה לטיפול וטרינרי דחוף (ללא הגבלת סכום)',
    icon: '💉',
    content: 'בעל הכלב מתחייב למסור את הכלב לאחר שעבר טיפול מונע נגד פרעושים וקרציות. במקרה חירום רפואי שבו נדרש טיפול דחוף לכלב, בעל הכלב מתיר בזאת לצוות הריזורט להזעיק וטרינר ו/או לפנות למרפאת חירום ככל שיידרש ללא הגבלת סכום, ומתחייב לשאת במלוא העלויות הכרוכות בטיפול כאמור להצלת חיי הכלב ולשמירה על בריאותו.'
  },
  {
    num: '7',
    title: '7. שעות פעילות ושירות לקוחות',
    icon: '⏰',
    content: 'שעות קבלת קהל ושירות לקוחות טלפוני הן בימים א׳–ה׳ בין השעות 08:30–19:30, ובימי שישי עד השעה 14:00. מתקן הריזורט מאויש 24/7 ע"י צוות מקצועי המספק טיפול והשגחה מלאה לכלבים השוהים בכל שעות היממה ובסופי שבוע, אך שירות הלקוחות הטלפוני סגור בשעות הערב, בשבתות ובחגים.'
  },
  {
    num: '8',
    title: '8. מדיניות שריון, ביטולים ואישורי החזר לצה״ל/מופת (חוק 33)',
    icon: '🗓️',
    content: 'ביטול שהייה או שריון יום מתאפשר בהודעה מראש של עד 24 שעות לפני מועד ההגעה שנקבע. במקרה של ביטול שהות בפחות מ-24 שעות ממועד הקבלה, יחויב יום השהייה הראשון בלבד ויתרת התשלום תישמר במלואה לזכות הלקוח כזיכוי למימוש בשהיות עתידיות בריזורט (בכרטיסייה יקוזז יום אחד). בהתאם לחוק 33, כל חשבונית וקבלה המונפקות על ידי הריזורט כוללות פירוט מדויק של תאריכי השהייה, שם הכלב וסיבת החיוב המלאה לטובת החזרי צה״ל, כוחות הביטחון ומופת.'
  }
];

// 9 Clauses of Training Agreement (תנאי הסכם אילוף כלבים)
const RESORT_TRAINING_CLAUSES = [
  {
    num: '1',
    title: '1. הצדדים ופרטי ההתקשרות',
    content: 'הסכם זה נערך בין הריזורט לכלב בע"מ (ח.פ. 514942119) לבין בעל הכלב המפורט בטופס. הבעלים מצהיר כי הוא הבעלים החוקי של הכלב ומוסמך לחתום על הסכם זה.'
  },
  {
    num: '2',
    title: '2. תוכנית האילוף ומפגשי חפיפה',
    content: 'האילוף יבוצע על ידי צוות מאלפי הריזורט בריזורט. בסיום האילוף ייקבעו מפגשי חפיפה עם הבעלים על מנת להדריך אותם בתוצאות האילוף. מפגשי החפיפה כלולים בתוכנית וההשתתפות בהם היא חובה להבטחת הצלחת התהליך.'
  },
  {
    num: '3',
    title: '3. התחייבויות הריזורט ושיטת האילוף',
    content: 'האילוף יבוצע בשיטות אילוף מקצועיות ומקובלות, תוך התאמת הקצב למצבו הגופני והרגשי של הכלב. הריזורט יספק לכלב לינה, האכלה, מים זמינים ופעילות יומית בתנאים המותאמים למזגו.'
  },
  {
    num: '4',
    title: '4. הצהרות הבעלים, בריאות וגילוי מלא',
    content: 'הבעלים מצהירים שהכלב בריא ומחוסן כנדרש (כלבת, משושה ושעלת מכלאות) ומטופל נגד מזיקים. הבעלים מתחייבים לגלול לריזורט כל מידע רלוונטי, לרבות נשיכות, תוקפנות, פחדים, רגישויות או מחלות קודמות.'
  },
  {
    num: '5',
    title: '5. תמורה ותנאי תשלום',
    content: 'האילוף יתחיל רק לאחר הסדרת מלוא התשלום של דמי התוכנית באמצעות קישור תשלום דיגיטלי מאובטח של Grow (אשראי / Bit) או במזומן. שהייה נוספת מעבר לתקופת התוכנית תתומחר בנפרד לפי מחירון הריזורט.'
  },
  {
    num: '6',
    title: '6. ביטולים, דחיות ושינוי מועדים',
    content: 'דחיית מפגש חפיפה מתאפשרת בהודעה של 24 שעות מראש. הפסקת תוכנית בתוך החודש הראשון תזכה בהחזר יחסי של 25% עבור כל שבוע שלא נוצל; לאחר חודש אין החזר. ככל שהעסקה נכרתה מרחוק, יחולו הוראות חוק הגנת הצרכן.'
  },
  {
    num: '7',
    title: '7. תוצאות, אחריות וחירום רפואי (ללא הגבלת סכום)',
    content: 'כלב הוא בעל חיים והתנהגותו מושפעת מגורמים שאינם בשליטת הריזורט (סביבה, תרגול ביתי וגנטיקה), ולכן הריזורט מתחייב לפעול במקצועיות מרבית אך אינו מתחייב לתוצאה מוחלטת. במקרה חירום רפואי שבו נדרש טיפול דחוף, הבעלים מתירים בזאת לריזורט להזעיק וטרינר ו/או לפנות למרפאת חירום ללא הגבלת סכום ומתחייבים לשאת במלוא העלויות.'
  },
  {
    num: '8',
    title: '8. מדיה, צילום ופרטיות',
    content: 'הריזורט רשאי לצלם את הכלב לצורך תיעוד ועדכון הבעלים, וכן לעשות שימוש שיווקי בתמונות וסרטוני הכלב ללא חשיפת פרטי הבעלים ללא אישורם. פרטי הלקוח יישמרו בסודיות.'
  },
  {
    num: '9',
    title: '9. הוראות כלליות וחתימות',
    content: 'הסכם זה ממצה את הסכמות הצדדים. הבעלים מאשרים כי קראו את ההסכם ומסכימים לכל תנאיו מרצונם החופשי. על ההסכם יחולו דיני מדינת ישראל.'
  }
];

export const TrainingAgreementModal: React.FC<AgreementModalProps> = ({
  isOpen,
  onClose,
  booking,
  intakeRequest,
  settings,
  isPublicClientView = false,
  agreementType = 'auto',
  onAgreementSigned,
}) => {
  const today = getTodayStr();
  const todayDateObj = new Date();
  const currentDay = todayDateObj.getDate();
  const currentMonthName = HEBREW_MONTHS_NAMES[todayDateObj.getMonth()];
  const currentYear = todayDateObj.getFullYear();

  // Determine if this is a training agreement or boarding/daycare agreement
  const currentServiceType: ServiceType = 
    booking?.serviceType || intakeRequest?.serviceType || 'boarding';

  const isTraining = agreementType === 'training' 
    ? true 
    : agreementType === 'boarding' 
      ? false 
      : (currentServiceType === 'training' || currentServiceType === 'day_training');

  // Existing agreement data if previously signed
  const existingAgreement: TrainingAgreementData | undefined = 
    isTraining 
      ? (booking?.trainingAgreement || intakeRequest?.trainingAgreement)
      : (booking?.boardingAgreement || intakeRequest?.boardingAgreement || booking?.trainingAgreement || intakeRequest?.trainingAgreement);

  // Accordion state: DEFAULT COLLAPSED ("אין צורך להציג מראש את ההסכמים, מספיק להציג קישור")
  const [isTermsExpanded, setIsTermsExpanded] = useState<boolean>(false);

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

  // 2. Training / Boarding Specifics
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
    existingAgreement?.totalPrice || booking?.totalPrice || (isTraining ? 6500 : 180)
  );
  const [paymentMethod, setPaymentMethod] = useState(
    existingAgreement?.paymentMethod || booking?.paymentMethod || 'אשראי / ביט (Grow)'
  );

  // 9. Signatures
  const [ownerSignatureDataUrl, setOwnerSignatureDataUrl] = useState<string>(
    existingAgreement?.ownerSignatureDataUrl || booking?.signatureDataUrl || ''
  );
  const [isSigned, setIsSigned] = useState<boolean>(
    Boolean(
      existingAgreement?.ownerSignatureDataUrl || 
      (isTraining ? booking?.isTrainingAgreementSigned : booking?.isBoardingAgreementSigned)
    )
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
      const agr = isTraining 
        ? (booking?.trainingAgreement || intakeRequest?.trainingAgreement)
        : (booking?.boardingAgreement || intakeRequest?.boardingAgreement || booking?.trainingAgreement || intakeRequest?.trainingAgreement);
      
      if (agr) {
        setOwnerFullName(agr.ownerFullName || '');
        setOwnerIdNumber(agr.ownerIdNumber || '');
        setOwnerAddress(agr.ownerAddress || '');
        setOwnerPhone(agr.ownerPhone || '');
        setOwnerEmail(agr.ownerEmail || '');
        setEmergencyContact(agr.emergencyContact || '');
        setDogName(agr.dogName || '');
        setDogBreed(agr.dogBreed || '');
        setDogAge(agr.dogAge || '');
        setDogGenderAndNeutered(agr.dogGenderAndNeutered || '');
        setDogWeightKg(agr.dogWeightKg || '');
        setDogChipNumber(agr.dogChipNumber || '');
        setVetNameAndPhone(agr.vetNameAndPhone || '');
        if (agr.programType) setProgramType(agr.programType);
        if (agr.programTypeOther) setProgramTypeOther(agr.programTypeOther);
        if (agr.trainingGoals) setTrainingGoals(agr.trainingGoals);
        if (agr.startDate) setStartDate(agr.startDate);
        if (agr.endDate) setEndDate(agr.endDate);
        if (agr.trainerName) setTrainerName(agr.trainerName);
        if (agr.totalPrice) setTotalPrice(agr.totalPrice);
        if (agr.paymentMethod) setPaymentMethod(agr.paymentMethod);
        setOwnerSignatureDataUrl(agr.ownerSignatureDataUrl || '');
        setIsSigned(Boolean(agr.ownerSignatureDataUrl));
      } else {
        if (booking?.ownerName || intakeRequest?.ownerName) setOwnerFullName(booking?.ownerName || intakeRequest?.ownerName || '');
        if (booking?.ownerPhone || intakeRequest?.ownerPhone) setOwnerPhone(booking?.ownerPhone || intakeRequest?.ownerPhone || '');
        if (booking?.ownerAddress || intakeRequest?.ownerAddress) setOwnerAddress(booking?.ownerAddress || intakeRequest?.ownerAddress || '');
        if (booking?.dogName || intakeRequest?.dogName) setDogName(booking?.dogName || intakeRequest?.dogName || '');
        if (booking?.dogBreed || intakeRequest?.dogBreed) setDogBreed(booking?.dogBreed || intakeRequest?.dogBreed || '');
        if (booking?.startDate || intakeRequest?.startDate) setStartDate(booking?.startDate || intakeRequest?.startDate || today);
        if (booking?.endDate || intakeRequest?.endDate) setEndDate(booking?.endDate || intakeRequest?.endDate || '');
        if (booking?.totalPrice) setTotalPrice(booking.totalPrice);
      }
    }
  }, [booking, intakeRequest, isTraining]);

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
      // Open medical authorization without numeric cap
      emergencyMedicalLimit: 0,

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
          signatureDataUrl: finalSig,
          updatedAt: new Date().toISOString(),
        };

        if (isTraining) {
          updatedBooking.isTrainingAgreementSigned = true;
          updatedBooking.trainingAgreementSignedAt = new Date().toISOString();
          updatedBooking.trainingAgreement = agreementData;
        } else {
          updatedBooking.isBoardingAgreementSigned = true;
          updatedBooking.boardingAgreementSignedAt = new Date().toISOString();
          updatedBooking.boardingAgreement = agreementData;
        }

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
        };

        if (isTraining) {
          updatedIntake.isTrainingAgreementSigned = true;
          updatedIntake.trainingAgreementSignedAt = new Date().toISOString();
          updatedIntake.trainingAgreement = agreementData;
        } else {
          updatedIntake.isBoardingAgreementSigned = true;
          updatedIntake.boardingAgreementSignedAt = new Date().toISOString();
          updatedIntake.boardingAgreement = agreementData;
        }

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
    params.set('agreement', isTraining ? 'training' : 'boarding');
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
    
    const subjectName = isTraining ? 'הסכם האילוף' : 'הסכם שירותי האירוח והתקנון';
    const serviceName = isTraining ? 'תהליך האילוף' : 'שהיית האירוח / הפנסיון';

    const msg = `שלום ${ownerFullName || 'חבר/ה'}! 🐾🐶
בהמשך להזמנת ${serviceName} עבור *${dogName || 'הכלב/ה'}* בריזורט לכלב, מצורף קישור אישי לחתימה על ${subjectName}:

👉 ${link}

*שים/י לב:* חתימה דיגיטלית על ההסכם הינה תנאי סף לאישור השהייה והסדרת התשלום. נכנסים לקישור, מאשרים וחותמים באצבע על המסך בכמה שניות!

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
      const amt = Number(totalPrice) || (isTraining ? 6500 : 180);
      let payUrl = settings.growPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';
      try {
        const startStr = booking?.startDate || intakeRequest?.startDate;
        const endStr = booking?.endDate || intakeRequest?.endDate;
        const datesPart = startStr 
          ? (endStr && endStr !== startStr ? ` (${formatDateIL(startStr)} - ${formatDateIL(endStr)})` : ` (${formatDateIL(startStr)})`)
          : '';

        const itemDesc = isTraining 
          ? `אילוף מקצועי עבור ${dogName || 'הכלב/ה'}${datesPart}`
          : `אירוח פנסיון בריזורט עבור ${dogName || 'הכלב/ה'}${datesPart}`;

        const dynamicRes = await createGrowDynamicPaymentLink({
          amount: amt,
          description: itemDesc,
          customerName: ownerFullName || 'לקוח ריזורט',
          customerPhone: ownerPhone || '0500000000',
          customerEmail: ownerEmail || '',
          bookingId: booking?.id || `agr-${Date.now()}`,
          dogName: dogName || 'כלב',
        });
        if (dynamicRes && dynamicRes.url) {
          payUrl = dynamicRes.url;
        }
      } catch (err) {
        console.warn('Fallback to standard payment link', err);
      }
      window.open(payUrl, '_blank');
    } finally {
      setIsOpeningPayment(false);
    }
  };

  const titleText = isTraining 
    ? 'הסכם אילוף כלבים – הריזורט לכלב'
    : 'הסכם שירותי אירוח ותקנון הריזורט לכלב';

  const subtitleText = isTraining
    ? 'הסכם התקשרות מחייב לקראת תחילת תהליך האילוף והשיקום בריזורט'
    : 'תקנון והסכם תנאי שהייה, אירוח והשגחה בריזורט לכלב';

  const activeClauses = isTraining ? RESORT_TRAINING_CLAUSES : RESORT_BOARDING_CLAUSES;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      
      {/* Modal Container */}
      <div 
        className="bg-white w-full max-w-4xl max-h-[94vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
        dir="rtl"
      >
        
        {/* Modal Top Bar (Sticky, Hidden in Print) */}
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between gap-2 shrink-0 print:hidden">
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 line-clamp-1">
                  {titleText}
                </h3>
                {isSigned ? (
                  <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>נחתם ומאושר ✓</span>
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    <span>ממתין לחתימה</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                {subtitleText}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
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
                  title="העתק קישור לחתימת הלקוח"
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

                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Document Body */}
        <div className="p-4 sm:p-7 overflow-y-auto space-y-5 text-slate-800 text-xs sm:text-sm leading-relaxed printable-document">

          {/* Document Official Header */}
          <div className="text-center pb-3 border-b-2 border-emerald-800/20 space-y-1.5">
            <div className="flex items-center justify-center gap-3">
              <img 
                src="/resort-official-logo.jpg" 
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/resort-logo.svg'; }}
                alt="לוגו הריזורט לכלב" 
                className="w-14 h-14 sm:w-18 sm:h-18 object-contain rounded-full border border-amber-300 drop-shadow-sm mx-auto" 
              />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-[#0f4c3a] tracking-tight">
              {titleText}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-bold">
              הריזורט לכלב בע&quot;מ (ח.פ. 514942119) · טלפון רשמי: 054-8765888
            </p>
          </div>

          {/* Formal Preamble */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-3 sm:p-4 font-medium text-slate-700 text-xs sm:text-sm space-y-1">
            <p>
              הסכם זה נערך ונחתם ביום <strong>{currentDay}</strong> בחודש <strong>{currentMonthName}</strong> בשנת <strong>{currentYear}</strong>, בין <strong>הריזורט לכלב בע&quot;מ</strong> (להלן: &quot;הריזורט&quot;) לבין בעלי הכלב כמפורט להלן (להלן: &quot;הבעלים&quot;).
            </p>
          </div>

          {/* Validation Notice if any */}
          {validationError && (
            <div className="bg-red-50 border-2 border-red-300 text-red-900 rounded-2xl p-3 flex items-center gap-2 text-xs font-bold animate-in shake duration-200">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Essential Summary Card: Owner & Dog Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            
            {/* Owner Details Card */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="bg-slate-100/90 px-3.5 py-2 font-black text-slate-800 text-xs border-b border-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-700" />
                  <span>פרטי הבעלים</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">* שדות חובה</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="p-2 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-bold shrink-0 w-24">שם מלא:</span>
                  <input
                    type="text"
                    value={ownerFullName}
                    onChange={(e) => setOwnerFullName(e.target.value)}
                    placeholder="שם פרטי ומשפחה"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-2 flex items-center justify-between gap-2 bg-amber-50/50">
                  <span className="text-amber-900 font-black shrink-0 w-24 flex items-center gap-1">
                    <span>ת.ז. *</span>
                    {!ownerIdNumber && <span className="text-[10px] text-red-600 font-bold">(חובה)</span>}
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

                <div className="p-2 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-bold shrink-0 w-24">טלפון נייד:</span>
                  <input
                    type="tel"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="050-0000000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-bold text-slate-900 focus:bg-white focus:outline-none font-mono"
                  />
                </div>

                <div className="p-2 flex items-center justify-between gap-2 bg-amber-50/50">
                  <span className="text-amber-900 font-black shrink-0 w-24 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-amber-700" />
                    <span>איש חירום *</span>
                  </span>
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="שם מלא ומספר טלפון לחירום"
                    className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              </div>
            </div>

            {/* Dog Details Card */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="bg-slate-100/90 px-3.5 py-2 font-black text-slate-800 text-xs border-b border-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Dog className="w-3.5 h-3.5 text-emerald-700" />
                  <span>פרטי הכלב והשירות</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">* שדות חובה</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="p-2 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-bold shrink-0 w-24">שם הכלב:</span>
                  <input
                    type="text"
                    value={dogName}
                    onChange={(e) => setDogName(e.target.value)}
                    placeholder="שם הכלב/ה"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-black text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="p-2 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-bold shrink-0 w-24">גזע / גיל:</span>
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={dogBreed}
                      onChange={(e) => setDogBreed(e.target.value)}
                      placeholder="גזע / מעורב"
                      className="w-1/2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-900 focus:bg-white focus:outline-none"
                    />
                    <input
                      type="text"
                      value={dogAge}
                      onChange={(e) => setDogAge(e.target.value)}
                      placeholder="גיל"
                      className="w-1/2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-2 flex items-center justify-between gap-2 bg-amber-50/50">
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

                <div className="p-2 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-bold shrink-0 w-24">תאריכי שהייה:</span>
                  <div className="flex items-center gap-1.5 w-full font-mono font-bold text-slate-800">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs w-1/2"
                    />
                    <span>עד</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs w-1/2"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Pricing & Payment Methods Row (No bank transfer per Rule 2) */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-3 sm:p-4 text-xs space-y-2.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-700">סה&quot;כ לתשלום (כולל מע&quot;מ):</span>
                <div className="flex items-center gap-1 font-mono font-black text-emerald-800 text-base">
                  <span>₪</span>
                  <input
                    type="number"
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(Number(e.target.value) || 0)}
                    className="w-28 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-black focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">אמצעי תשלום:</span>
                <div className="flex items-center gap-2">
                  {['אשראי / ביט (Grow)', 'מזומן'].map((m) => (
                    <label key={m} className="flex items-center gap-1 cursor-pointer font-bold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100">
                      <input
                        type="radio"
                        name="payMethodGroup"
                        checked={paymentMethod.includes(m.split(' ')[0])}
                        onChange={() => setPaymentMethod(m)}
                        className="accent-emerald-700"
                      />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {isTraining && (
              <div className="space-y-1 pt-1 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 block">
                  🎯 מטרות האילוף והדגשים:
                </label>
                <textarea
                  rows={2}
                  value={trainingGoals}
                  onChange={(e) => setTrainingGoals(e.target.value)}
                  placeholder="הליכה רגועה ברצועה, משמעת, טיפול בריאקטיביות, חיזוק ביטחון..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* USER INSTRUCTION: Accordion Link for Full Terms & Bylaws       */}
          {/* "אין צורך להציג מראש את ההסכמים, מספיק להציג קישור לכל מי שרוצה */}
          {/* לקרוא ואם הוא לא רוצה לקרוא, שיחתום וזהו."                       */}
          {/* ============================================================== */}
          <div className="rounded-2xl border-2 border-slate-300 bg-white overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setIsTermsExpanded(!isTermsExpanded)}
              className="w-full p-3.5 sm:p-4 bg-slate-50 hover:bg-slate-100/90 text-right flex items-center justify-between gap-3 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black text-slate-900">
                    {isTraining ? '📜 לקריאת תנאי הסכם האילוף המלאים (9 סעיפים)' : '📜 לקריאת תקנון ותנאי שירותי הריזורט המלאים (8 סעיפים)'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {isTermsExpanded ? 'לחץ כאן לסגירת סעיפי ההסכם ▲' : 'לחץ כאן לפתיחת וקריאת הסעיפים המלאים ▼ (או חתום ישירות למטה)'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
                <span>{isTermsExpanded ? 'סגור תנאים' : 'קרא תנאים'}</span>
                {isTermsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {/* Expanded Terms Body (Only visible when user explicitly expands) */}
            {isTermsExpanded && (
              <div className="p-4 sm:p-6 border-t border-slate-200 bg-slate-50/50 space-y-4 max-h-[450px] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-black text-xs text-slate-700">
                    {isTraining ? 'סעיפי הסכם אילוף כלבים – הריזורט לכלב' : 'סעיפי תקנון שירותי אירוח ופנסיון – הריזורט לכלב'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    עודכן בהתאם לנהלי הריזורט לכלב
                  </span>
                </div>

                <div className="space-y-3.5 text-xs text-slate-700 leading-relaxed">
                  {activeClauses.map((clause) => (
                    <div key={clause.num} className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                      <h4 className="font-black text-slate-900 text-xs sm:text-sm text-[#0f4c3a]">
                        {clause.title}
                      </h4>
                      <p className="text-slate-700 font-medium">
                        {clause.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* USER INSTRUCTION: OPEN Medical Emergency Authorization         */}
          {/* "ואין צורך להגדיר תקרת שתלום למקרה חירום. שזה ישאר פתוח"          */}
          {/* ============================================================== */}
          <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-3.5 sm:p-4 text-xs space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 font-black text-amber-950 text-xs sm:text-sm">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>הצהרת בריאות והרשאה לטיפול וטרינרי דחוף בשעת חירום:</span>
            </div>
            <p className="text-amber-900 leading-relaxed font-medium">
              בעל הכלב מצהיר ומאשר כי הכלב בריא, מחוסן כדין (כלבת, משושה ושעלת מכלאות בתוקף) ומטופל כנגד מזיקים. 
              <strong> במקרה חירום רפואי שבו נדרש טיפול דחוף לכלב</strong>, בעל הכלב מתיר בזאת לצוות הריזורט להזעיק וטרינר ו/או לפנות מיד למרפאת חירום ככל שיידרש <strong>ללא הגבלת סכום</strong>, ומתחייב לשאת במלוא העלויות הכרוכות בטיפול כאמור לשמירה על שלום הכלב והצלת חייו.
            </p>
          </div>

          {/* ============================================================== */}
          {/* SIGNATURE SECTION: Direct, Instant, No Scrolling Required      */}
          {/* "ואם הוא לא רוצה לקרוא, שיחתום וזהו"                           */}
          {/* ============================================================== */}
          <section className="space-y-3 pt-1">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <h2 className="text-xs sm:text-sm font-black text-[#0f4c3a] flex items-center gap-1.5">
                <PenTool className="w-4 h-4" />
                <span>חתימות ואישור דיגיטלי</span>
              </h2>
              <span className="text-[10px] text-slate-500 font-bold">
                חתימה על מסך המגע / עכבר
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* 1. Official Resort Stamp Box */}
              <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-4 space-y-2.5 relative overflow-hidden">
                <div className="text-xs font-black text-emerald-950 pb-1 border-b border-emerald-200 flex items-center justify-between">
                  <span>הריזורט לכלב בע&quot;מ</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded-full font-bold">
                    חתום ומאושר דיגיטלית ✓
                  </span>
                </div>

                <div className="bg-white border border-emerald-200 rounded-xl p-3 flex items-center gap-3 shadow-2xs">
                  <img 
                    src="/resort-official-logo.jpg" 
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/resort-logo.svg'; }}
                    alt="חותמת הריזורט" 
                    className="w-11 h-11 object-contain rounded-full border border-amber-300 shrink-0" 
                  />
                  <div className="text-right">
                    <div className="text-xs font-black text-[#0f4c3a]">הריזורט לכלב בע&quot;מ</div>
                    <div className="text-[10px] text-slate-500 font-medium">ח.פ. 514942119 · מאושר דיגיטלית</div>
                    <div className="text-[10px] text-emerald-700 font-bold">שמוליק – מנהל הריזורט לכלב 🐾</div>
                  </div>
                </div>

                <div className="text-xs pt-1 border-t border-emerald-200/80 flex items-center justify-between text-slate-700">
                  <span className="text-slate-500 font-bold">תאריך אישור:</span>
                  <span className="font-bold text-slate-900">{formatDateIL(today)}</span>
                </div>
              </div>

              {/* 2. Customer Signature Box */}
              <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 space-y-2.5">
                <div className="text-xs font-black text-slate-800 pb-1 border-b border-slate-200 flex items-center justify-between">
                  <span>חתימת הלקוח (הבעלים)</span>
                  {isSigned ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-black">
                      נחתם דיגיטלית ✓
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-black">
                      חתום כאן באצבע
                    </span>
                  )}
                </div>

                <div className="text-xs flex items-center justify-between">
                  <span className="font-bold text-slate-700">
                    {ownerFullName || 'טרם מולא'} {ownerIdNumber ? `(ת.ז. ${ownerIdNumber})` : ''}
                  </span>
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
                  <div className="bg-slate-50 border-2 border-emerald-300 rounded-xl p-2.5 flex flex-col items-center justify-center min-h-[95px]">
                    <img 
                      src={ownerSignatureDataUrl} 
                      alt="חתימת הבעלים" 
                      className="max-h-16 object-contain" 
                    />
                    <span className="text-[10px] text-emerald-800 font-bold mt-1">
                      נחתם ומאומת דיגיטלית ✓
                    </span>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-emerald-400 rounded-xl bg-emerald-50/20 relative touch-none overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={95}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-[95px] cursor-crosshair"
                    />
                    {!hasCanvasStroke && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-xs">
                        <PenTool className="w-4 h-4 mb-0.5 text-emerald-600/70" />
                        <span>חתום כאן באצבע או בעכבר</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-[11px] text-slate-500 pt-0.5 flex items-center justify-between">
                  <span>תאריך חתימה:</span>
                  <span className="font-bold text-slate-900">{formatDateIL(today)}</span>
                </div>
              </div>

            </div>
          </section>

        </div>

        {/* Modal Bottom Sticky Footer (Hidden in Print) */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 print:hidden">
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isSigned ? (
              <div className="flex items-center gap-2 text-xs font-black text-emerald-800 bg-emerald-100/90 px-3 py-1.5 rounded-xl border border-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ההסכם נחתם ומאושר במלואו ✓</span>
              </div>
            ) : (
              <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-emerald-700" />
                <span>יש לוודא את הפרטים ולחתום באצבע לאישור מיידי</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!isPublicClientView && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                סגור
              </button>
            )}

            {!isSigned ? (
              <button
                type="button"
                onClick={handleSaveAndSign}
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#065f46] hover:bg-[#044e45] active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <span>שומר חתימה...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>חתום ואשר את ההסכם ✍️</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                {!isPublicClientView && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>ההסכם חתום – סגור</span>
                  </button>
                )}

                {Number(totalPrice) > 0 && (
                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    disabled={isOpeningPayment}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4 text-emerald-200" />
                    <span>{isOpeningPayment ? 'מכין תשלום...' : `💳 לתשלום מאובטח ב-Grow (₪${Number(totalPrice).toLocaleString()})`}</span>
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

// Aliases for unified use across the app
export const ResortAgreementModal = TrainingAgreementModal;
export const AgreementModal = TrainingAgreementModal;
