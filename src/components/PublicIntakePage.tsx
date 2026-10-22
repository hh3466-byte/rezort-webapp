import React, { useState, useMemo, useEffect } from 'react';
import { ResortSettings, ServiceType, IntakeRequest, IntakeMediaItem, AdditionalDogIntake, RESORT_BENEFIT_OPTIONS } from '../types';
import { addDays, getTodayStr, calculateDaysCount, getDayNameHebrew, formatDateIL } from '../utils/dateUtils';
import { cleanPhoneNumber, isValidIsraeliPhone, formatIsraeliPhoneDisplay } from '../utils/whatsappUtils';
import { saveIntakeRequestToDb, findVoucherByCode, findDaycarePassByCode, findActiveDaycarePassByPhone, findActiveDaycarePassByPhoneAsync, verifyCustomerByPhone, PhoneVerificationResult } from '../services/dbService';
import { sendResortEmailNotification, sendResortWhatsAppNotification, formatIntakeNotification, saveOrUpdateGreenApiContact } from '../services/notificationService';
import { supabase } from '../utils/supabase';
import { 
  CheckCircle2, 
  Send, 
  Calendar, 
  User, 
  Phone, 
  Heart, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  MessageSquare,
  PhoneCall,
  AlertCircle,
  Plus,
  Minus,
  Clock,
  MessageCircle,
  Copy,
  Check,
  Gift,
  Users,
  Tag,
  FileText,
  X,
  Shield,
  Search,
  MapPin,
  Navigation,
  Loader2,
  Dog,
  Trash2,
  Ticket,
  Camera,
  Video,
  Play,
  ExternalLink
} from 'lucide-react';
import { SendIntakeModal } from './SendIntakeModal';
import { getCurrentCoordinates, reverseGeocodeCoordinates } from '../utils/geolocationUtils';
import { ISRAELI_CITIES_LIST } from '../utils/israeliCities';

// 7 Clauses of Resort By-Laws (תקנון הריזורט לכלב)
const RESORT_BYLAWS_SECTIONS = [
  {
    num: 1,
    title: '1. תשלום ושחרור הכלב בתום השהייה',
    icon: '💳',
    content: 'תנאי לשחרור הכלב בתום תקופת השהייה הוא תשלום מלא בגין כל שירות נוסף שניתן לכלב במהלך שהייתו, מעבר לשירותים שסוכמו מראש בין הצדדים. הריזורט רשאי לעכב את מסירת הכלב עד להסדרת מלוא התשלום כאמור. הלקוח יחוייב על העלויות הנוספות בגין זה.'
  },
  {
    num: 2,
    title: '2. אספקת מזון',
    icon: '🥣',
    content: 'מזון הכלב יסופק על ידי בעל הכלב עבור כל תקופת השהייה. במידה ומזון זה ייגמר במהלך השהייה, הריזורט יהא רשאי לרכוש עבור הכלב מזון חלופי, ועלות הרכישה תחול במלואה על בעל הכלב.'
  },
  {
    num: 3,
    title: '3. קולר הכלב',
    icon: '🐕',
    content: 'ככל שיימצא כי קולר הכלב אינו תקין או אינו בטוח לשימוש, הריזורט יהא רשאי לרכוש עבור הכלב קולר חלופי, ועלות הרכישה תחויב לבעל הכלב.'
  },
  {
    num: 4,
    title: '4. פטור מאחריות – אירועים עם כלבים אחרים או חיות בר',
    icon: '🛡️',
    content: 'הריזורט פועל במיטב יכולתו לשמירה על שלומם וביטחונם של הכלבים השוהים במתקן. עם זאת, בעל הכלב מצהיר כי ידוע לו שמדובר בבעלי חיים, ולא ניתן להבטיח מניעה מוחלטת של אירועים בלתי צפויים. הריזורט לא יישא באחריות לכל נזק, פציעה או תקיפה שייגרמו לכלב כתוצאה מתקיפת כלב אחר, בין אם במתקן ובין אם במהלך פעילות מחוצה לו, וכן לא יישא באחריות לכל נזק שייגרם לכלב כתוצאה מתקיפה או נשיכה של חיית בר.'
  },
  {
    num: 5,
    title: '5. הצהרת בריאות וגילוי נאות',
    icon: '🩺',
    content: 'בעל הכלב מצהיר ומאשר כי הכלב מחוסן כדין בהתאם לדרישות החוק. בעל הכלב מתחייב לגלות לריזורט, טרם מסירת הכלב, כל מידע רלוונטי לגביו, לרבות: מקרי תקיפה או נשיכה שביצע הכלב בעבר; צורך בנטילת תרופות קבועות; מצב רפואי המצריך התייחסות או תשומת לב מיוחדת; ורגישות לתנאי מזג אוויר. האחריות למסירת מידע מלא ומדויק כאמור חלה במלואה על בעל הכלב.'
  },
  {
    num: 6,
    title: '6. טיפול מונע והרשאה לטיפול וטרינרי',
    icon: '💉',
    content: 'בעל הכלב מתחייב למסור את הכלב לריזורט רק לאחר שעבר טיפול מונע נגד פרעושים וקרציות בסמוך למועד מסירתו. בעל הכלב מתיר בזאת לריזורט להזעיק וטרינר ו/או לספק לכלב כל טיפול רפואי דחוף אחר, ככל שיתעורר צורך בכך במהלך השהייה, ומתחייב לשאת במלוא העלויות הכרוכות בטיפול כאמור.'
  },
  {
    num: 7,
    title: '7. שעות פעילות',
    icon: '⏰',
    content: 'שעות פעילות המתקן הן בימים א׳–ה׳ בין השעות 09:30–18:30, ובימי שישי עד השעה 14:00. בשבתות המתקן סגור למעט מקרה חירום. מסירה או איסוף של הכלב מחוץ לשעות אלה, ככל שתואמו מראש, יחויבו בתשלום נוסף.'
  },
  {
    num: 8,
    title: '8. מדיניות ביטולים ושמירת מקום',
    icon: '🚫',
    content: 'ביטול שהייה/הגעה יתאפשר עד 24 שעות לפני מועד ההגעה שנקבע. אין אפשרות לביטול שהייה בפחות מ-24 שעות ממועד הקבלה/ההגעה שסוכם, היות ונשמר עבור הכלב מקום ייעודי ומאובטח במתקן שנמנע מלקוחות אחרים.'
  }
];

interface PublicIntakePageProps {
  settings: ResortSettings;
  onBackToApp?: () => void;
  isStaffPreview?: boolean;
  onStaffLoginClick?: () => void;
}

export const PublicIntakePage: React.FC<PublicIntakePageProps> = ({ 
  settings, 
  onBackToApp, 
  isStaffPreview = false,
  onStaffLoginClick
}) => {
  const today = getTodayStr();

  // Saved profile cache key in localStorage
  const SAVED_PROFILE_KEY = 'resort_intake_saved_profile';

  const initialProfile = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(SAVED_PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const searchParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const paramPhone = (searchParams.get('phone') || searchParams.get('p') || searchParams.get('tel') || '').trim();
  const paramName = (searchParams.get('name') || searchParams.get('owner') || '').trim();
  const paramDog = (searchParams.get('dog') || searchParams.get('dogName') || '').trim();

  // Form State - Initialized from URL params, saved profile, or empty
  const [ownerName, setOwnerName] = useState(paramName || initialProfile?.ownerName || '');
  const [ownerPhone, setOwnerPhone] = useState(paramPhone || initialProfile?.ownerPhone || '');
  const [ownerEmail, setOwnerEmail] = useState(initialProfile?.ownerEmail || '');
  const [ownerAddress, setOwnerAddress] = useState(initialProfile?.ownerAddress || '');
  const [ownerCoordinates, setOwnerCoordinates] = useState<{ lat: number; lng: number } | undefined>(initialProfile?.ownerCoordinates);
  const [isReturningAddress, setIsReturningAddress] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsSuccessNotice, setGpsSuccessNotice] = useState<string | null>(null);

  const [dogName, setDogName] = useState(paramDog || initialProfile?.dogName || '');
  const [dogBreed, setDogBreed] = useState(initialProfile?.dogBreed || '');
  const [dogAge, setDogAge] = useState(initialProfile?.dogAge || '');
  const [dogGender, setDogGender] = useState<'male' | 'female'>(initialProfile?.dogGender || 'male');
  const [dogSize, setDogSize] = useState<'small' | 'medium' | 'large' | 'giant'>(initialProfile?.dogSize || 'medium');
  const [dogPhotoUrl, setDogPhotoUrl] = useState<string>('');
  const [dogMediaList, setDogMediaList] = useState<IntakeMediaItem[]>([]);
  const [isProcessingMedia, setIsProcessingMedia] = useState<boolean>(false);
  const [mediaProcessingMsg, setMediaProcessingMsg] = useState<string>('');
  const [serviceType, setServiceType] = useState<ServiceType>('boarding');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 3));
  const [isFlexibleDates, setIsFlexibleDates] = useState(false);
  
  // Client Relationship & Voucher Code State
  type ClientOriginType = 'new' | 'returning' | 'referral';
  const [clientOrigin, setClientOrigin] = useState<ClientOriginType>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const v = (params.get('voucher') || '').trim();
      const vUpper = v.toUpperCase();
      if (vUpper.startsWith('FRIEND-') || v.startsWith('חבר-')) return 'referral';
      if (vUpper.startsWith('VIP-') || v.startsWith('פינוק-') || v.startsWith('ויאיפי-') || v.startsWith('יום-כיף-')) return 'returning';
    }
    return initialProfile?.clientOrigin || 'new';
  });
  const [referralFriendName, setReferralFriendName] = useState(initialProfile?.referralFriendName || '');
  const [voucherCode, setVoucherCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const v = (params.get('voucher') || '').trim();
      if (v) return v;
    }
    return initialProfile?.voucherCode || '';
  });
  const [selectedBenefitId, setSelectedBenefitId] = useState<string>(initialProfile?.selectedBenefitId || 'discount_100');

  // GPS Auto-Detect Handler
  const handleDetectGpsAddress = async (targetSetter?: (addr: string) => void) => {
    setIsLocatingGps(true);
    setErrorMessage(null);
    setGpsSuccessNotice(null);

    try {
      const coords = await getCurrentCoordinates();
      setOwnerCoordinates(coords);
      const res = await reverseGeocodeCoordinates(coords.lat, coords.lng);
      if (res.address) {
        setOwnerAddress(res.address);
        if (targetSetter) {
          targetSetter(res.address);
        }
        setGpsSuccessNotice(`הכתובת זוהתה בהצלחה: ${res.address}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'לא הצלחנו לזהות את המיקום. אנא הקלד את הכתובת ידנית.');
    } finally {
      setIsLocatingGps(false);
    }
  };

  const matchedVoucher = useMemo(() => {
    if (!voucherCode.trim()) return null;
    return findVoucherByCode(voucherCode.trim());
  }, [voucherCode]);

  // Daycare Pass (כרטיסיית פעילות יומית) State & Auto-Matching
  const [daycarePassCode, setDaycarePassCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = (params.get('pass') || params.get('daycare_pass') || params.get('card') || '').trim();
      if (p) return p;
    }
    return '';
  });

  const matchedDaycarePass = useMemo(() => {
    if (!daycarePassCode.trim()) return null;
    return findDaycarePassByCode(daycarePassCode.trim());
  }, [daycarePassCode]);

  // Auto-fill form fields when Daycare / Boarding Pass is detected
  useEffect(() => {
    if (matchedDaycarePass) {
      if (matchedDaycarePass.dogName && !dogName) setDogName(matchedDaycarePass.dogName);
      if (matchedDaycarePass.dogBreed && !dogBreed) setDogBreed(matchedDaycarePass.dogBreed);
      if (matchedDaycarePass.ownerName && !ownerName) setOwnerName(matchedDaycarePass.ownerName);
      if (matchedDaycarePass.ownerPhone && !ownerPhone) setOwnerPhone(matchedDaycarePass.ownerPhone);
      if (matchedDaycarePass.serviceType) setServiceType(matchedDaycarePass.serviceType);
      if (matchedDaycarePass.serviceType !== 'boarding') {
        setEndDate(startDate); // Daycare/training is single-day arrival
      }
    }
  }, [matchedDaycarePass, startDate]);

  // Mandatory Vetting Questions State (strictly null initially to force conscious choice)
  const [isFriendlyWithDogs, setIsFriendlyWithDogs] = useState<'yes' | 'no' | 'depends' | null>(null);
  const [isNeutered, setIsNeutered] = useState<boolean | null>(null);
  const [isVaccinated, setIsVaccinated] = useState<boolean | null>(null);
  const [isHouseTrained, setIsHouseTrained] = useState<boolean | null>(null);
  const [isTreatedParasites, setIsTreatedParasites] = useState<boolean | null>(null);
  const [specialNeeds, setSpecialNeeds] = useState('');
  const [freeText, setFreeText] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isQuickCallback, setIsQuickCallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invalidFieldId, setInvalidFieldId] = useState<string | null>(null);
  const [saturdayWarning, setSaturdayWarning] = useState<string | null>(null);
  const [isSendIntakeModalOpen, setIsSendIntakeModalOpen] = useState(false);
  const [copiedDirectLink, setCopiedDirectLink] = useState(false);

  // Phone Identification & Verification State
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [phoneCheckResult, setPhoneCheckResult] = useState<PhoneVerificationResult | null>(null);
  const [hasCheckedPhone, setHasCheckedPhone] = useState(false);
  const [showVoucherOrReferralBox, setShowVoucherOrReferralBox] = useState(false);

  // Mandatory Terms & Conditions Acceptance State
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  // Address Second-Chance Reminder Modal State (prompts on submit if address was omitted, without forcing)
  const [showAddressReminderModal, setShowAddressReminderModal] = useState(false);
  const [pendingSubmitCallbackOnly, setPendingSubmitCallbackOnly] = useState(false);
  const [addressReminderInput, setAddressReminderInput] = useState('');
  const [hasConfirmedNoAddress, setHasConfirmedNoAddress] = useState(false);

  // Helper: Read file as Data URL
  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Helper: Compress image to crisp lightweight JPEG (~60-90KB)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            resolve(compressed);
          } else {
            resolve(event.target?.result as string || '');
          }
        };
        img.onerror = () => resolve('');
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Helper: Extract crisp video frame thumbnail and duration
  const generateVideoThumbnail = (videoFile: File): Promise<{ thumbnailUrl: string; duration: number }> => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        const objectUrl = URL.createObjectURL(videoFile);
        video.src = objectUrl;

        video.onloadedmetadata = () => {
          video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 600;
            let w = video.videoWidth || 640;
            let h = video.videoHeight || 480;
            if (w > h && w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0, w, h);
            const thumb = canvas.toDataURL('image/jpeg', 0.75);
            URL.revokeObjectURL(objectUrl);
            resolve({ thumbnailUrl: thumb, duration: Math.round(video.duration || 0) });
          } catch {
            URL.revokeObjectURL(objectUrl);
            resolve({ thumbnailUrl: '', duration: Math.round(video.duration || 0) });
          }
        };

        video.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({ thumbnailUrl: '', duration: 0 });
        };
      } catch {
        resolve({ thumbnailUrl: '', duration: 0 });
      }
    });
  };

  // Handler: Multiple Photos Selection & Compression
  const handlePhotosSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingMedia(true);
    setMediaProcessingMsg('מעבד ומכווץ תמונות...');

    try {
      const newItems: IntakeMediaItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 20 * 1024 * 1024) continue;
        const compressed = await compressImage(file);
        if (compressed) {
          newItems.push({
            id: `img_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'image',
            url: compressed,
            name: file.name,
            size: file.size
          });
        }
      }

      setDogMediaList(prev => {
        const combined = [...prev, ...newItems].slice(0, 6);
        const firstImg = combined.find(m => m.type === 'image');
        if (firstImg) setDogPhotoUrl(firstImg.url);
        return combined;
      });
    } catch (err) {
      console.warn('Error processing photos:', err);
      alert('שגיאה בעיבוד התמונות, אנא נסה שנית.');
    } finally {
      setIsProcessingMedia(false);
      setMediaProcessingMsg('');
      e.target.value = '';
    }
  };

  // Handler: Short Video Selection & Processing
  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('גודל הסרטון גדול מדי (מעל 25MB). אנא בחר סרטון קצר של עד 15 שניות.');
      e.target.value = '';
      return;
    }

    setIsProcessingMedia(true);
    setMediaProcessingMsg('מייצר תצוגה מקדימה ומעבד סרטון...');

    try {
      const { thumbnailUrl, duration } = await generateVideoThumbnail(file);
      const dataUrl = await readFileAsDataUrl(file);

      const newVideoItem: IntakeMediaItem = {
        id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'video',
        url: dataUrl,
        thumbnailUrl: thumbnailUrl || undefined,
        duration: duration || undefined,
        name: file.name,
        size: file.size
      };

      setDogMediaList(prev => {
        const combined = [...prev, newVideoItem].slice(0, 6);
        return combined;
      });
    } catch (err) {
      console.warn('Error processing video:', err);
      alert('שגיאה בטעינת הסרטון. אנא נסה סרטון קצר יותר.');
    } finally {
      setIsProcessingMedia(false);
      setMediaProcessingMsg('');
      e.target.value = '';
    }
  };

  // Handler: Remove a single media item
  const handleRemoveMedia = (index: number) => {
    setDogMediaList(prev => {
      const updated = prev.filter((_, i) => i !== index);
      const firstImg = updated.find(m => m.type === 'image');
      setDogPhotoUrl(firstImg ? firstImg.url : '');
      return updated;
    });
  };

  // Multi-dog support: "+ הוסף עוד אורח לריזורט לכלב"
  const [additionalDogs, setAdditionalDogs] = useState<AdditionalDogIntake[]>([]);

  const handleAddAdditionalDog = () => {
    setAdditionalDogs(prev => [
      ...prev,
      {
        dogName: '',
        dogBreed: '',
        dogAge: '',
        dogGender: 'male',
        dogSize: 'medium',
        serviceType: serviceType || 'boarding',
        sameDatesAsPrimary: true,
        startDate: startDate,
        endDate: endDate,
        isFriendlyWithDogs: 'yes',
        isNeutered: true,
        isVaccinated: true,
        isHouseTrained: true,
        isTreatedParasites: true,
        specialNeeds: '',
        notes: ''
      }
    ]);
  };

  const handleUpdateAdditionalDog = (index: number, fields: Partial<AdditionalDogIntake>) => {
    setAdditionalDogs(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...fields };
      return copy;
    });
  };

  const handleRemoveAdditionalDog = (index: number) => {
    setAdditionalDogs(prev => prev.filter((_, i) => i !== index));
  };


  // Phone number verification hook (debounce 400ms)
  useEffect(() => {
    const clean = (ownerPhone || '').replace(/\D/g, '');
    if (clean.length < 8) {
      setPhoneCheckResult(null);
      setHasCheckedPhone(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingPhone(true);
      try {
        const result = await verifyCustomerByPhone(ownerPhone);
        setPhoneCheckResult(result);
        setHasCheckedPhone(true);
        if (result.isKnown) {
          setClientOrigin('returning');
          // Autofill empty fields if available
          if (result.name && !ownerName.trim()) {
            setOwnerName(result.name);
          }
          if (result.address && !ownerAddress.trim()) {
            setOwnerAddress(result.address);
            if (result.coordinates) setOwnerCoordinates(result.coordinates);
            setIsReturningAddress(true);
          }
          if (result.dogName && !dogName.trim()) {
            setDogName(result.dogName);
          }
          if (result.dogBreed && !dogBreed.trim()) {
            setDogBreed(result.dogBreed);
          }
        } else {
          setClientOrigin('new');
        }

        // Auto-match active Daycare / Boarding VIP Pass by phone if client didn't supply a pass code
        let passByPhone = findActiveDaycarePassByPhone(ownerPhone);
        if (!passByPhone) {
          passByPhone = await findActiveDaycarePassByPhoneAsync(ownerPhone);
        }
        if (passByPhone && !daycarePassCode) {
          setDaycarePassCode(passByPhone.passCode);
          if (passByPhone.dogName && !dogName.trim()) setDogName(passByPhone.dogName);
          if (passByPhone.dogBreed && !dogBreed.trim()) setDogBreed(passByPhone.dogBreed);
          if (passByPhone.ownerName && !ownerName.trim()) setOwnerName(passByPhone.ownerName);
          if (passByPhone.serviceType) setServiceType(passByPhone.serviceType);
        }
      } catch (err) {
        console.warn('Phone check error:', err);
      } finally {
        setIsCheckingPhone(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [ownerPhone]);

  // Benefits are unlocked ONLY if customer has verified past visits (totalVisits > 0) OR an active voucher in system
  const isBenefitsUnlocked = Boolean(
    (phoneCheckResult?.isKnown && (phoneCheckResult.totalVisits || 0) > 0) || 
    (matchedVoucher && matchedVoucher.status === 'active')
  );

  // Auto adjust dates when service is selected
  const handleServiceChange = (st: ServiceType) => {
    setServiceType(st);
    if (st === 'daycare' || st === 'training') {
      setEndDate(startDate);
    }
  };

  const daysCount = Math.max(1, calculateDaysCount(startDate, endDate));
  const nightsCount = Math.max(1, calculateDaysCount(startDate, endDate));

  const handleNightsChange = (delta: number) => {
    let newNights = Math.max(1, nightsCount + delta);
    let targetEnd = addDays(startDate, newNights);
    const endD = new Date(targetEnd + 'T00:00:00');
    if (endD.getDay() === 6 && serviceType === 'boarding') {
      // Cannot check out on Saturday - advance or back to avoid Saturday
      if (delta > 0) {
        newNights += 1;
        targetEnd = addDays(startDate, newNights);
      } else {
        newNights = Math.max(1, newNights - 1);
        targetEnd = addDays(startDate, newNights);
      }
    }
    setEndDate(targetEnd);
    setSaturdayWarning(null);
  };

  const handleStartDateChange = (newStart: string) => {
    if (!newStart) return;
    const currentNights = Math.max(1, calculateDaysCount(startDate, endDate));
    setStartDate(newStart);
    if (serviceType === 'daycare' || serviceType === 'training') {
      setEndDate(newStart);
    } else {
      let targetEnd = addDays(newStart, currentNights);
      const endD = new Date(targetEnd + 'T00:00:00');
      if (endD.getDay() === 6) {
        targetEnd = addDays(targetEnd, 1);
      }
      setEndDate(targetEnd);
    }
    setSaturdayWarning(null);
  };

  const handleEndDateChange = (val: string) => {
    if (!val) return;
    const d = new Date(val + 'T00:00:00');
    if (d.getDay() === 6 && serviceType === 'boarding') {
      const sun = addDays(val, 1);
      setEndDate(sun);
      setSaturdayWarning('⚠️ היציאה אינה יכולה להיות ביום שבת (אין שחרורים בשבת). תאריך היציאה עודכן ליום ראשון בשעה 09:30.');
    } else {
      setEndDate(val);
      setSaturdayWarning(null);
    }
  };

  const applyDatePreset = (preset: 'weekend' | 'next_weekend' | 'midweek' | 'week' | 'twoweeks') => {
    const d = new Date(today + 'T00:00:00');
    const day = d.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat

    if (preset === 'weekend') {
      // Upcoming Friday to Sunday (2 nights)
      let daysToFri = (5 - day + 7) % 7;
      if (day === 6) daysToFri = 6;
      const s = addDays(today, daysToFri);
      setStartDate(s);
      setEndDate(addDays(s, 2)); // Friday + 2 days = Sunday!
      setSaturdayWarning(null);
    } else if (preset === 'next_weekend') {
      // Following Friday to Sunday (2 nights)
      let daysToFri = (5 - day + 7) % 7;
      if (day === 6) daysToFri = 6;
      const s = addDays(today, daysToFri + 7);
      setStartDate(s);
      setEndDate(addDays(s, 2)); // Friday + 2 days = Sunday!
      setSaturdayWarning(null);
    } else if (preset === 'midweek') {
      // Upcoming Sunday to Friday (5 nights: Sunday to Friday morning, including Thursday night)
      let daysToSun = (7 - day) % 7;
      if (day === 0) daysToSun = 7;
      const s = addDays(today, daysToSun);
      setStartDate(s);
      setEndDate(addDays(s, 5)); // Sunday + 5 days = Friday!
      setSaturdayWarning(null);
    } else if (preset === 'week') {
      let targetEnd = addDays(startDate, 7);
      const endD = new Date(targetEnd + 'T00:00:00');
      if (endD.getDay() === 6) targetEnd = addDays(targetEnd, 1); // skip Saturday
      setEndDate(targetEnd);
      setSaturdayWarning(null);
    } else if (preset === 'twoweeks') {
      let targetEnd = addDays(startDate, 14);
      const endD = new Date(targetEnd + 'T00:00:00');
      if (endD.getDay() === 6) targetEnd = addDays(targetEnd, 1); // skip Saturday
      setEndDate(targetEnd);
      setSaturdayWarning(null);
    }
  };

  // Helper to trigger high-visibility flashing validation error and scroll directly to field
  const triggerValidationError = (fieldId: string, message: string): boolean => {
    setErrorMessage(message);
    setInvalidFieldId(fieldId);
    if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
      try { (navigator as any).vibrate([100, 50, 100]); } catch {}
    }
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el : el.querySelector('input, textarea, button');
        (input as HTMLElement)?.focus?.();
      }
    }, 60);
    return false;
  };

  // Strict Validation Function
  const validateForm = (): boolean => {
    setErrorMessage(null);
    setInvalidFieldId(null);

    // 1. Phone check
    if (!ownerPhone.trim()) {
      return triggerValidationError('field_ownerPhone', 'נא למלא מספר טלפון נייד (שדה חובה)');
    }
    if (!isValidIsraeliPhone(ownerPhone)) {
      return triggerValidationError('field_ownerPhone', 'נא להזין מספר טלפון נייד ישראלי תקין (10 ספרות, למשל 054-1234567)');
    }

    // 2. Owner Name
    if (!ownerName.trim()) {
      return triggerValidationError('field_ownerName', 'נא למלא שם בעלים מלא (שדה חובה)');
    }

    // 3. Email
    if (!ownerEmail.trim()) {
      return triggerValidationError('field_ownerEmail', 'חובה למלא כתובת אימייל (שדה חובה)');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail.trim())) {
      return triggerValidationError('field_ownerEmail', 'נא להזין כתובת אימייל תקינה (למשל name@gmail.com)');
    }

    // 4. Address (no hard blocker - if omitted, handleProcessSubmit offers a polite second-chance prompt)

    // 5. Dog Details
    if (!dogName.trim()) {
      return triggerValidationError('field_dogName', 'נא למלא את שם הכלב/ה (שדה חובה)');
    }
    if (!dogBreed.trim()) {
      return triggerValidationError('field_dogBreed', 'נא למלא את גזע הכלב (שדה חובה - אם מעורב כתבו מעורב)');
    }

    // 6. Dates
    if (!startDate) {
      return triggerValidationError('field_startDate', serviceType === 'training' 
        ? 'נא לבחור תאריך כניסה / הגעה לאילוף (שדה חובה)'
        : 'נא לבחור תאריך כניסה / הגעה לריזורט (שדה חובה)');
    }
    if (serviceType !== 'training') {
      if (!endDate) {
        return triggerValidationError('field_endDate', 'נא לבחור תאריך איסוף / יציאה מהריזורט (שדה חובה)');
      }
      if (endDate < startDate) {
        return triggerValidationError('field_endDate', 'תאריך היציאה אינו יכול להיות מוקדם מתאריך הכניסה');
      }
      if (serviceType === 'boarding') {
        const endD = new Date(endDate + 'T00:00:00');
        if (endD.getDay() === 6) {
          return triggerValidationError('field_endDate', 'היציאה לא יכולה להיות ביום שבת (אין שחרורים בשבת). היציאה מסופ״ש הינה ביום ראשון בשעה 09:30.');
        }
      }
    }

    // 7. Mandatory Explicit Vetting Questions (NO silent defaults!)
    if (isFriendlyWithDogs === null) {
      return triggerValidationError('field_isFriendlyWithDogs', 'סעיף 1 הינו חובה: יש לסמן האם הכלב מסתדר עם כלבים אחרים!');
    }
    if (isNeutered === null) {
      return triggerValidationError('field_isNeutered', `סעיף 2 הינו חובה: יש לסמן האם הכלב ${dogGender === 'female' ? 'מעוקרת' : 'מסורס'}!`);
    }
    if (isVaccinated === null) {
      return triggerValidationError('field_isVaccinated', 'סעיף 3 הינו חובה: יש לסמן האם החיסונים בתוקף (משושה וכלבת)!');
    }
    if (isHouseTrained === null) {
      return triggerValidationError('field_isHouseTrained', 'סעיף 4 הינו חובה: יש לסמן האם הכלב מחונך לצרכים!');
    }
    if (isTreatedParasites === null) {
      return triggerValidationError('field_isTreatedParasites', 'סעיף 5 הינו חובה: יש לסמן האם הכלב מטופל נגד קרציות ופשפשים!');
    }

    // 8. Health and Meds
    if (!specialNeeds.trim()) {
      return triggerValidationError('field_specialNeeds', 'סעיף 6 הינו שדה חובה: לחצו על הכפתור "הכלב בריא לחלוטין" או פרטו תרופות/צרכים מיוחדים בתיבה');
    }

    // 9. Terms Acceptance
    if (!termsAccepted) {
      return triggerValidationError('field_termsAccepted', 'יש לקרוא ולאשר את תקנון הריזורט לכלב לצורך שליחת הבקשה (שדה חובה)');
    }

    // Validate additional dogs
    for (let i = 0; i < additionalDogs.length; i++) {
      const ad = additionalDogs[i];
      if (!ad.dogName.trim()) {
        setErrorMessage(`נא למלא את שם הכלב עבור אורח נוסף #${i + 2}`);
        return false;
      }
      if (!ad.dogBreed.trim()) {
        setErrorMessage(`נא למלא את גזע הכלב עבור ${ad.dogName || `אורח נוסף #${i + 2}`}`);
        return false;
      }
      if (!ad.sameDatesAsPrimary && (!ad.startDate || !ad.endDate)) {
        setErrorMessage(`נא לבחור תאריכי הגעה ועזיבה עבור ${ad.dogName}`);
        return false;
      }
      if (!ad.sameDatesAsPrimary && ad.startDate && ad.endDate && ad.startDate > ad.endDate) {
        setErrorMessage(`תאריך עזיבה לא יכול להיות מוקדם מתאריך הגעה עבור ${ad.dogName}`);
        return false;
      }
    }

    return true;
  };

  // Submit Handler
  const handleProcessSubmit = async (isCallbackOnly: boolean, bypassAddressCheck: boolean = false, overrideAddress?: string) => {
    if (!validateForm()) {
      return;
    }

    const effectiveAddress = (overrideAddress !== undefined ? overrideAddress : ownerAddress).trim();

    // If address is omitted and client has not yet confirmed skipping, offer an unforced second chance
    if (!effectiveAddress && !bypassAddressCheck && !hasConfirmedNoAddress) {
      setAddressReminderInput('');
      setPendingSubmitCallbackOnly(isCallbackOnly);
      setShowAddressReminderModal(true);
      return;
    }

    setIsSubmitting(true);
    setIsQuickCallback(isCallbackOnly);

    // Training is an intensive multi-week process (defaults to 30 days if not set)
    const finalEndDate = serviceType === 'training' 
      ? (endDate && endDate > startDate ? endDate : addDays(startDate, 30)) 
      : endDate;
    const formattedPhone = formatIsraeliPhoneDisplay(ownerPhone.trim());
    const requestId = `${isCallbackOnly ? 'call' : 'req'}-${Date.now()}`;

    // Process media list & offload large video payloads to Supabase settings row if > 1MB
    let finalMediaList = [...dogMediaList];
    for (let i = 0; i < finalMediaList.length; i++) {
      const item = finalMediaList[i];
      if (item.type === 'video' && item.url && item.url.length > 1024 * 1024) {
        const mediaSettingsId = `media_${requestId}_${i}`;
        try {
          await supabase.from('settings').insert({
            id: mediaSettingsId,
            data: {
              requestId,
              videoDataUrl: item.url,
              createdAt: new Date().toISOString()
            }
          });
          finalMediaList[i] = {
            ...item,
            mediaSettingsId,
            url: `lazy:${mediaSettingsId}`
          };
        } catch (e) {
          console.warn('Failed to offload video payload to settings:', e);
        }
      }
    }

    const primaryPhoto = finalMediaList.find(m => m.type === 'image')?.url || dogPhotoUrl.trim() || undefined;
    const primaryVideo = finalMediaList.find(m => m.type === 'video')?.url || undefined;

    const chosenBenefit = RESORT_BENEFIT_OPTIONS.find(b => b.id === selectedBenefitId);
    const newRequest: IntakeRequest = {
      id: requestId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      ownerName: ownerName.trim(),
      ownerPhone: formattedPhone,
      ownerEmail: ownerEmail.trim() || undefined,
      ownerAddress: effectiveAddress,
      ownerCoordinates: ownerCoordinates,
      dogName: dogName.trim(),
      dogBreed: dogBreed.trim(),
      dogAge: dogAge.trim() || undefined,
      dogGender,
      dogSize,
      dogPhotoUrl: primaryPhoto,
      dogMediaList: finalMediaList.length > 0 ? finalMediaList : (primaryPhoto ? [{ id: '1', type: 'image', url: primaryPhoto }] : undefined),
      dogVideoUrl: primaryVideo,
      serviceType,
      startDate,
      endDate: finalEndDate,
      isFriendlyWithDogs: isFriendlyWithDogs || 'yes',
      isNeutered: isNeutered === true,
      isVaccinated: isVaccinated === true,
      isHouseTrained: isHouseTrained === true,
      isTreatedParasites: isTreatedParasites === true,
      specialNeeds: specialNeeds.trim(),
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
      isPhoneVerified: Boolean(phoneCheckResult?.isKnown),
      clientOrigin: phoneCheckResult?.isKnown ? 'returning' : (clientOrigin === 'referral' ? 'referral' : 'new'),
      selectedBenefitId: isBenefitsUnlocked ? selectedBenefitId : undefined,
      voucherCode: voucherCode.trim() || undefined,
      additionalDogs: additionalDogs.length > 0 ? additionalDogs.map(ad => ({
        ...ad,
        dogName: ad.dogName.trim(),
        dogBreed: ad.dogBreed.trim(),
        startDate: ad.sameDatesAsPrimary ? startDate : (ad.startDate || startDate),
        endDate: ad.sameDatesAsPrimary ? finalEndDate : (ad.endDate || finalEndDate)
      })) : undefined,
      depositRequested: (matchedDaycarePass || daycarePassCode.trim()) ? 0 : undefined,
      calculatedPrice: (matchedDaycarePass || daycarePassCode.trim()) ? 0 : undefined,
      notes: [
        isCallbackOnly ? '[בקשת שיחה חוזרת טלפונית]' : '',
        matchedDaycarePass 
          ? `[🎟️ שריון מתוך ${matchedDaycarePass.serviceType === 'boarding' ? 'בנק 21 יממות פנסיון מלא VIP' : 'כרטיסייה'}: ${matchedDaycarePass.passCode} (קוד כרטיסייה: ${matchedDaycarePass.passCode} - נותרו ${matchedDaycarePass.totalDays - matchedDaycarePass.usedDays} ימים) | ללא תשלום]` 
          : daycarePassCode.trim() 
          ? `[🎟️ שריון מתוך כרטיסייה: ${daycarePassCode.trim()} (קוד כרטיסייה: ${daycarePassCode.trim()}) | ללא תשלום]` 
          : '',
        isFlexibleDates ? '[תאריכים גמישים / בירור זמינות כללי]' : '',
        additionalDogs.length > 0 ? `[🐾 ${additionalDogs.length + 1} אורחים בטופס: ${dogName} + ${additionalDogs.map(d => `${d.dogName} (${d.dogBreed})`).join(', ')}]` : '',
        (phoneCheckResult?.isKnown && (phoneCheckResult.totalVisits || 0) > 0) ? `[💎 לקוח חוזר מוכר: ${phoneCheckResult.name || ownerName} (${phoneCheckResult.totalVisits} ביקורים)]` : '[🐶 לקוח חדש]',
        clientOrigin === 'referral' ? `[🤝 חבר מביא חבר${referralFriendName.trim() ? `: הופנה ע״י ${referralFriendName.trim()}` : ''}]` : '',
        (isBenefitsUnlocked && chosenBenefit) ? `[🎁 הטבה שנבחרה: ${chosenBenefit.title} (${chosenBenefit.badge})]` : '',
        voucherCode.trim() ? `[🎟️ קוד שובר: ${voucherCode.trim()}]` : '',
        '[📜 תקנון הריזורט אושר כחוק]',
        freeText.trim()
      ].filter(Boolean).join(' | ') || undefined,
    };

    try {
      // Save profile locally so client is remembered on this phone/browser
      try {
        localStorage.setItem(SAVED_PROFILE_KEY, JSON.stringify({
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim(),
          ownerEmail: ownerEmail.trim(),
          ownerAddress: ownerAddress.trim(),
          ownerCoordinates: ownerCoordinates,
          dogName: dogName.trim(),
          dogBreed: dogBreed.trim(),
          dogAge: dogAge.trim(),
          dogGender,
          dogSize
        }));
      } catch (e) {}

      // 1. Save to Supabase and LocalStorage
      await saveIntakeRequestToDb(newRequest);

      // 2. Automatically sync contact to WhatsApp (e.g. "🆕 ישראל ישראלי (רקס)")
      try {
        await saveOrUpdateGreenApiContact(
          ownerPhone.trim(),
          ownerName.trim(),
          dogName.trim(),
          !phoneCheckResult?.isKnown
        );
      } catch (cErr) {
        console.warn('Could not auto-save Green-API contact:', cErr);
      }

      // 3. Send instant email notification to shinshin1964@gmail.com
      const allDogsNames = [dogName, ...additionalDogs.map(d => d.dogName)].filter(Boolean).join(' ו-');
      const emailSubject = isCallbackOnly
        ? `📞 בקשת שיחה חוזרת מלקוח: ${allDogsNames} (${ownerName} - ${ownerPhone})`
        : `🐾 בקשת קליטה חדשה בריזורט לכלב: ${allDogsNames} (${ownerName})`;

      await sendResortEmailNotification(
        emailSubject,
        newRequest,
        freeText.trim()
      );

      // 4. Fallback WhatsApp notification
      sendResortWhatsAppNotification(formatIntakeNotification(newRequest), settings);

      // 5. Track Meta Pixel Conversion Events
      try {
        if (typeof window !== 'undefined' && (window as any).fbq) {
          (window as any).fbq('track', 'CompleteRegistration', {
            content_name: 'Dog Intake Form Submitted',
            status: 'completed',
            currency: 'ILS',
            value: 0
          });
          (window as any).fbq('track', 'Lead', {
            content_name: 'Dog Resort Intake Lead',
            service_type: serviceType
          });
        }
      } catch (fbErr) {
        console.warn('Meta Pixel tracking error:', fbErr);
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error('Error submitting intake request:', err);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Screen
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100 text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-[#0f4c3a] leading-snug">
              תודה על משלוח שאלון בקשת הקליטה! 🐾
            </h2>
            <p className="text-sm font-bold text-slate-700">
              פרטי הבקשה עבור {dogName}{additionalDogs.length > 0 ? ` ו-${additionalDogs.map(d => d.dogName).join(', ')}` : ''} נקלטו בהצלחה בריזורט לכלב.
            </p>
          </div>

          <div className="bg-emerald-50/90 border border-emerald-200 rounded-3xl p-5 text-center space-y-3 text-xs text-slate-700 shadow-sm">
            <div className="text-3xl">🐕🤍</div>
            <p className="text-emerald-950 font-black text-sm sm:text-base leading-relaxed">
              אנחנו כרגע במתחם עם הכלבים ומטפלים בהם במסירות, ולא נשכח אתכם! 🐾
            </p>
            <p className="text-slate-600 font-medium text-xs sm:text-sm leading-relaxed">
              מיד כשנתפנה נעבור ביסודיות על פרטי השאלון ונחזור אליכם לשיחה במספר <span className="font-mono font-black text-emerald-900 dir-ltr inline-block">{ownerPhone}</span> לתיאום סופי.
            </p>
          </div>

          {/* Back to Management App is ONLY allowed for authorized staff during preview */}
          {isStaffPreview && onBackToApp && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onBackToApp}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-2xl text-xs transition-all cursor-pointer border border-slate-200"
              >
                חזרה ליומן הניהול (תצוגת מנהל)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans py-6 px-3 sm:px-6 selection:bg-emerald-200" dir="rtl">
      <div className="max-w-xl mx-auto space-y-5">
        
        {/* Header with Resort Logo */}
        <header className="text-center space-y-2 pt-2">
          {isStaffPreview && onBackToApp && (
            <div className="flex justify-between items-center mb-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-amber-900 font-bold">
              <span>👁️ תצוגה מקדימה למנהל</span>
              <button
                type="button"
                onClick={onBackToApp}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>חזרה ליומן</span>
              </button>
            </div>
          )}

          <div className="inline-flex items-center justify-center p-2 bg-white rounded-3xl shadow-sm border border-amber-300">
            <img 
              src="/resort-official-logo.jpg" 
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/resort-logo.svg'; }}
              alt="לוגו הריזורט לכלב" 
              className="w-16 h-16 object-contain rounded-full drop-shadow-xs" 
            />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-[#0f4c3a] tracking-tight">
            הריזורט לכלב
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-md mx-auto">
            שאלון בקשה לקליטה ושריון מקום 🐾 מלאו את פרטי הבקשה ונחזור אליכם טלפונית לתיאום והסדרת השריון.
          </p>

          {/* Proactive Send Form to Callers Banner (For staff preview only) */}
          {isStaffPreview && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl p-3.5 sm:p-4 text-emerald-950 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-right mt-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-2xs shrink-0">
                  📲
                </div>
                <div>
                  <div className="font-black text-xs sm:text-sm text-emerald-950">
                    לקוח התקשר זה עתה? שלחו לו את השאלון ישירות למילוי
                  </div>
                  <div className="text-[11px] text-emerald-800 font-medium">
                    שליחת הודעת וואטסאפ מנומסת מוכנה מראש עם קישור ישיר לשאלון בקשה לקליטה זה
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSendIntakeModalOpen(true)}
                  className="w-full sm:w-auto bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>שלח שאלון ללקוח בוואטסאפ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?intake=true`);
                    setCopiedDirectLink(true);
                    setTimeout(() => setCopiedDirectLink(false), 2500);
                  }}
                  className="bg-white hover:bg-emerald-100/60 border border-emerald-300 text-emerald-900 font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow-2xs cursor-pointer transition-all shrink-0"
                >
                  {copiedDirectLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDirectLink ? 'הועתק!' : 'העתק קישור'}</span>
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Active Voucher Detected Banner */}
        {voucherCode && (
          <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/25 to-emerald-500/15 border-2 border-amber-400/60 rounded-3xl p-4 sm:p-5 shadow-md flex items-center gap-3.5 animate-in fade-in slide-in-from-top-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shrink-0 shadow-xs text-2xl">
              🎁
            </div>
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-amber-950 uppercase tracking-wide">שובר הטבה מופעל:</span>
                <span className="font-mono font-black text-sm text-amber-950 bg-white/90 px-3 py-1 rounded-xl border border-amber-300 shadow-2xs">
                  {voucherCode}
                </span>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-lg border border-emerald-300">
                  100 ₪ הנחה
                </span>
              </div>
              <p className="text-xs text-amber-950 font-bold mt-1">
                ההטבה תקפה בהזמנת שהות של 3 ימים ומעלה (סופ״ש ארוך) · תוקף השובר הינו ל-3 חודשים בלבד · אין כפל הטבות ומבצעים
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                קוד השובר יישמר בשאלון וצוות הריזורט יעדכן את ההנחה בשריון ההזמנה 🐾
              </p>
            </div>
          </div>
        )}

        {/* Error Alert if validation fails */}
        {errorMessage && (
          <div className="bg-red-50 border-2 border-red-300 text-red-900 rounded-2xl p-4 flex items-center gap-3 text-xs font-black animate-shake">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Intake Form */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleProcessSubmit(false);
          }} 
          className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-5 sm:p-7 space-y-6"
        >
          {/* Daycare / Boarding Pass Digital Punch Card View */}
          {matchedDaycarePass && (() => {
            const isBoarding = matchedDaycarePass.serviceType === 'boarding';
            const remaining = Math.max(0, matchedDaycarePass.totalDays - matchedDaycarePass.usedDays);
            const isUnpaid = matchedDaycarePass.paymentStatus === 'unpaid';
            const growPayUrl = matchedDaycarePass.paymentUrl || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

            return (
              <div className="space-y-4 animate-in zoom-in-95">
                {/* Main Pass Digital Punch Card */}
                <div className={`rounded-3xl p-5 sm:p-6 shadow-xl border-2 space-y-4 text-white relative overflow-hidden ${
                  isBoarding 
                    ? 'bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 border-indigo-400/80 shadow-indigo-950/30' 
                    : 'bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 border-emerald-400/80 shadow-emerald-950/30'
                }`}>
                  {/* Subtle Background Watermark */}
                  <div className="absolute -left-6 -bottom-6 text-white/5 pointer-events-none text-9xl font-black select-none">
                    {isBoarding ? '🌙' : '🐾'}
                  </div>

                  {/* Header Row: Badge, Pass Code, Dog Name & Remaining Days */}
                  <div className="flex items-start justify-between flex-wrap gap-3 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner backdrop-blur-md border ${
                        isBoarding ? 'bg-amber-400/20 border-amber-400/40 text-amber-300' : 'bg-white/10 border-white/20 text-white'
                      }`}>
                        {isBoarding ? '🌙' : '🎟️'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            isBoarding ? 'bg-amber-400 text-slate-950' : 'bg-emerald-400 text-slate-950'
                          }`}>
                            {isBoarding ? 'בנק 21 יממות פנסיון VIP' : 'כרטיסיית יומיות (מעון יום)'}
                          </span>
                          <span className="text-xs font-mono font-bold bg-white/15 px-2 py-0.5 rounded-lg border border-white/20">
                            קוד: {matchedDaycarePass.passCode}
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-2xl font-black mt-1 tracking-tight">
                          כרטיסיית {matchedDaycarePass.dogName}
                          <span className="text-sm font-normal text-slate-200 mr-2">
                            ({matchedDaycarePass.ownerName})
                          </span>
                        </h2>
                      </div>
                    </div>

                    <div className="text-left bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/20">
                      <span className={`text-sm sm:text-base font-black block ${isBoarding ? 'text-amber-300' : 'text-emerald-300'}`}>
                        נותרו {remaining} מתוך {matchedDaycarePass.totalDays} {isBoarding ? 'יממות' : 'ימים'}
                      </span>
                      <span className="text-[11px] text-slate-200 block">
                        תוקף עד: {formatDateIL(matchedDaycarePass.validUntil)}
                      </span>
                    </div>
                  </div>

                  {/* Visual Punch Circles Grid */}
                  <div className="pt-2 relative z-10">
                    <div className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                      <span>🏷️ מצב ניקובים בכרטיסייה:</span>
                      <span className="text-[11px] font-normal text-slate-300">
                        ({matchedDaycarePass.usedDays} נוצלו · {remaining} זמינים לניצול)
                      </span>
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                      {Array.from({ length: matchedDaycarePass.totalDays }).map((_, idx) => {
                        const isUsed = idx < matchedDaycarePass.usedDays;
                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                              isUsed
                                ? 'bg-emerald-500 text-white border-emerald-300 shadow-sm'
                                : 'bg-white/10 border-white/20 text-slate-200 hover:bg-white/15'
                            }`}
                            title={isUsed ? `יום ${idx + 1} נוצל` : `יום ${idx + 1} פנוי לשריון`}
                          >
                            <span className="text-sm">
                              {isUsed ? '🐾' : '⚪'}
                            </span>
                            <span className="text-[10px] font-black mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="text-[9px] opacity-80 leading-none">
                              {isUsed ? 'נוצל' : 'פנוי'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment Alert Banner (If Unpaid) OR Paid Badge (If Paid) */}
                  <div className="pt-2 relative z-10">
                    {isUnpaid ? (
                      <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 p-4 rounded-2xl shadow-lg border-2 border-amber-300 flex items-center justify-between flex-wrap gap-3 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-950/15 flex items-center justify-center text-xl shrink-0">
                            💳
                          </div>
                          <div>
                            <div className="font-black text-sm sm:text-base text-slate-950 flex items-center gap-1.5">
                              <span>הכרטיסייה טרם שולמה (יתרה לתשלום: ₪{matchedDaycarePass.pricePaid})</span>
                            </div>
                            <p className="text-xs font-semibold text-slate-900 mt-0.5">
                              הסדירו כעת בקלות דרך Bit, Apple Pay, Google Pay או כרטיס אשראי
                            </p>
                          </div>
                        </div>

                        <a
                          href={growPayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2.5 bg-slate-950 hover:bg-slate-900 text-amber-300 hover:text-amber-200 font-black text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                        >
                          <span>לתשלום מאובטח בלחיצה (₪{matchedDaycarePass.pricePaid}) 💳</span>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    ) : (
                      <div className="bg-emerald-500/20 border border-emerald-400/50 p-3 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs">
                        <span className="flex items-center gap-1.5 font-bold text-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                          <span>כרטיסייה שולמה במלואה ופעילה ✅ (יתרה מובטחת)</span>
                        </span>
                        <span className="font-mono text-emerald-300 font-bold">
                          ₪0 לתשלום לשריון הבא
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Personal Assistance by Hagai Heilman */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-200 relative z-10">
                    <span className="flex items-center gap-1.5">
                      <span>💬 נתקלתם בקושי? חגי הילמן לשירותכם:</span>
                      <a
                        href="https://wa.me/972543200007?text=%D7%A9%D7%9C%D7%95%D7%9D%20%D7%97%D7%92%D7%99%2C%20%D7%A4%D7%95%D7%A0%D7%94%20%D7%9C%D7%92%D7%91%D7%99%20%D7%94%D7%9B%D7%A8%D7%98%D7%99%D7%A1%D7%99%D7%94%20%D7%A9%D7%9C%D7%99%20%D7%91%D7%A8%D7%99%D7%96%D7%95%D7%A8%D7%98"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold underline text-amber-300 hover:text-white flex items-center gap-1"
                      >
                        <span>054-3200007</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </span>
                    <span className="text-[11px] opacity-80">
                      שמוליק וצוות הריזורט לכלב
                    </span>
                  </div>
                </div>

                {/* Instruction banner for booking the next day */}
                <div className="bg-sky-50 border border-sky-200 text-sky-950 p-4 rounded-2xl flex items-start gap-3 text-xs leading-relaxed">
                  <span className="text-xl shrink-0">💡</span>
                  <div>
                    <span className="font-black text-sky-900 block mb-0.5">
                      איך משריינים את יום ההגעה הבא מתוך הכרטיסייה?
                    </span>
                    <span>
                      הכלב שלכם כבר רשום ומאומת במערכת! כל שנותר ליום הבא הוא רק לבחור את תאריך ההגעה הרצוי למטה וללחוץ על שליחת בקשה לשמוליק – ללא צורך במילוי שאלון רפואי מחדש.
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
          
          {/* Section 0: Phone Identification & VIP Club Benefits */}
          <div className="bg-gradient-to-br from-emerald-50/80 via-slate-50 to-amber-50/60 border-2 border-emerald-200/90 rounded-3xl p-4 sm:p-6 space-y-4 shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="text-base">📱</span>
                  <span>הזדהות לפי מספר טלפון נייד</span>
                  <span className="text-red-500">*</span>
                </label>
                {phoneCheckResult?.isKnown ? (
                  <span className="text-[11px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>לקוח חוזר מאומת</span>
                  </span>
                ) : hasCheckedPhone ? (
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                    לקוח חדש
                  </span>
                ) : null}
              </div>

              <div className="relative">
                <input
                  id="field_ownerPhone"
                  type="tel"
                  required
                  value={ownerPhone}
                  onFocus={() => {
                    if (invalidFieldId === 'field_ownerPhone') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  onChange={(e) => {
                    setOwnerPhone(e.target.value);
                    if (invalidFieldId === 'field_ownerPhone') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  placeholder="הזינו מספר נייד (למשל: 05X-XXXXXXX)"
                  className={`w-full bg-white border-2 rounded-2xl px-4 py-3 text-sm sm:text-base font-black text-slate-900 focus:outline-none transition-all shadow-xs font-mono ${
                    invalidFieldId === 'field_ownerPhone'
                      ? 'border-rose-500 ring-4 ring-rose-400 bg-rose-50/80 animate-pulse shadow-lg'
                      : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'
                  }`}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {isCheckingPhone && (
                    <span className="text-xs text-slate-400 flex items-center gap-1 animate-pulse">
                      <span>בודק...</span>
                    </span>
                  )}
                  {phoneCheckResult?.isKnown && (
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </div>
              {invalidFieldId === 'field_ownerPhone' && (
                <p className="text-xs font-black text-rose-700 flex items-center gap-1 mt-1.5 animate-pulse">
                  <span>🚨</span>
                  <span>נא למלא מספר טלפון נייד תקין</span>
                </p>
              )}

              {/* Status Hints & Identification Feedback */}
              {!ownerPhone || ownerPhone.replace(/\D/g, '').length < 8 ? (
                <p className="text-[11px] text-slate-500 font-medium mt-1.5">
                  הזינו מספר טלפון נייד מלא לצורך זיהוי במערכת ובדיקת זכאות להטבות מועדון הריזורט 🐾
                </p>
              ) : isCheckingPhone ? (
                <p className="text-[11px] text-emerald-800 font-bold mt-1.5 flex items-center gap-1 animate-pulse">
                  <span>⏳</span>
                  <span>בודק זכאות להטבות במאגר הלקוחות...</span>
                </p>
              ) : phoneCheckResult?.isKnown ? (
                <div className="mt-3 p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 border-2 border-emerald-400 rounded-2xl text-xs space-y-1.5 shadow-xs animate-in fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💎</span>
                      <span className="font-black text-emerald-950 text-xs sm:text-sm">
                        שלום {phoneCheckResult.name || 'לקוח יקר'}! זוהית כלקוח חוזר של הריזורט 🐾
                      </span>
                    </div>
                    {phoneCheckResult.isVip && (
                      <span className="bg-amber-400 text-amber-950 font-black text-[10px] px-2 py-0.5 rounded-md shadow-2xs">
                        חבר VIP ותיק ({phoneCheckResult.totalVisits} אירוחים)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-900 font-medium leading-relaxed">
                    {phoneCheckResult.dogName 
                      ? `איזה כיף לפגוש שוב אתכם ואת ${phoneCheckResult.dogName}! פרטי התיק הקודם שלכם נטענו להקלה על המילוי.`
                      : 'איזה כיף לראות אתכם שוב! נשתמש בתיק הקיים שלכם במערכת.'}
                  </p>
                  {phoneCheckResult.isVip && (
                    <div className="pt-1.5 border-t border-emerald-200/80 text-[11px] font-black text-amber-950 flex items-center gap-1.5">
                      <span>🌟</span>
                      <span>זכאות VIP: עומדת לרשותכם גם הטבת יום כיף VIP מלא במתחם הדשא (09:30-18:30) מתנה!</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-2 shadow-2xs animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🐶</span>
                      <span className="font-black text-slate-800">
                        ברוכים הבאים לריזורט לכלב!
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                      אורח חדש
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    מספר הטלפון לא נמצא במאגר לקוחות העבר שלנו, נשמח להכיר אתכם ואת כלבכם לראשונה! הטבות מועדון לקוחות חוזרים מיועדות ללקוחות מוכרים במערכת.
                  </p>
                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowVoucherOrReferralBox(!showVoucherOrReferralBox)}
                      className="text-xs font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1.5 cursor-pointer underline"
                    >
                      <span>🎁</span>
                      <span>{showVoucherOrReferralBox ? 'הסתר הזנת שובר / חבר מביא חבר' : 'יש לכם קוד שובר הטבה או הגעתם דרך ״חבר מביא חבר״? לחצו כאן'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Active Daycare / Boarding Pass Detected Banner */}
              {matchedDaycarePass && (
                <div className="mt-3 p-3.5 bg-gradient-to-r from-emerald-100 via-teal-50 to-indigo-100 border-2 border-emerald-500 rounded-2xl text-xs space-y-2 shadow-xs animate-in fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">🎟️</span>
                      <div>
                        <div className="font-black text-emerald-950 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                          <span>{matchedDaycarePass.serviceType === 'boarding' ? 'בנק 21 יממות VIP פעיל!' : 'כרטיסיית יומיות פעילה זוהתה במערכת!'}</span>
                          <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full text-[10px]">
                            קוד #{matchedDaycarePass.passCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-emerald-900 font-bold mt-0.5">
                          עבור {matchedDaycarePass.dogName} · נותרו <span className="text-emerald-700 font-black text-xs">{Math.max(0, matchedDaycarePass.totalDays - matchedDaycarePass.usedDays)} מתוך {matchedDaycarePass.totalDays} ימים</span>
                        </div>
                      </div>
                    </div>

                    <a
                      href={`/?pass=${matchedDaycarePass.passCode}`}
                      className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>פתח כרטיסייה ושריין יום</span>
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Voucher / Referral Code Section for New Clients or Voucher holders */}
            {(showVoucherOrReferralBox || voucherCode || clientOrigin === 'referral') && (
              <div className="pt-3 border-t border-slate-200/80 space-y-3 animate-in fade-in">
                {/* Referral Friend Note */}
                <div className="p-3 bg-teal-50/90 border border-teal-200 rounded-xl text-xs text-teal-950 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🤝</span>
                    <span className="font-bold leading-snug">
                      הגעתם בהמלצת חבר שהתארח אצלנו? שניכם תיהנו מ-100 ₪ הנחה לשהות של 3 ימים ומעלה (סופ״ש ארוך).
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-teal-900 block mb-1">
                      מי החבר/ה שהמליצו לכם? (שם בעלים או שם כלב):
                    </label>
                    <input
                      type="text"
                      value={referralFriendName}
                      onChange={(e) => {
                        setReferralFriendName(e.target.value);
                        if (e.target.value.trim()) setClientOrigin('referral');
                      }}
                      placeholder="למשל: דנה כהן (הכלב מקס)"
                      className="w-full bg-white border border-teal-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Voucher Code Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-amber-600" />
                      <span>קוד שובר הטבה / קופון (אופציונלי):</span>
                    </label>
                    {voucherCode && (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>הקוד הוזן בהצלחה</span>
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.trim())}
                      placeholder="הזינו קוד שובר (למשל: חבר-מקס-123, VIP-מקס-456, פינוק-789)"
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none tracking-wider font-mono placeholder:font-sans placeholder:font-normal shadow-2xs"
                      dir="auto"
                    />
                    {voucherCode && (
                      <button
                        type="button"
                        onClick={() => setVoucherCode('')}
                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        נקה
                      </button>
                    )}
                  </div>

                  {voucherCode && (
                    matchedVoucher?.status === 'redeemed' ? (
                      <div className="mt-2 p-2.5 bg-red-50 border border-red-300 rounded-xl text-xs text-red-950 flex items-start gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          <span className="font-black text-red-900">קוד שובר זה כבר נוצל בעבר! ⚠️</span>
                          <div className="text-[10px] text-red-800 mt-0.5">
                            השובר מומש {matchedVoucher.redeemedAt ? `בתאריך ${formatDateIL(matchedVoucher.redeemedAt)}` : ''} {matchedVoucher.redeemedByOwner ? `ע״י ${matchedVoucher.redeemedByOwner}` : ''}. שוברי הטבה תקפים לשימוש חד-פעמי בלבד.
                          </div>
                        </div>
                      </div>
                    ) : matchedVoucher && (matchedVoucher.status === 'expired' || (matchedVoucher.expiryDate && matchedVoucher.expiryDate < today)) ? (
                      <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          <span className="font-black text-amber-900">תוקף השובר פג</span>
                          <div className="text-[10px] text-amber-800 mt-0.5">
                            תוקף שובר זה פג בתאריך {formatDateIL(matchedVoucher.expiryDate)}.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-400/90 rounded-xl text-xs text-emerald-950 flex items-start gap-2 animate-in fade-in">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          <span className="font-black text-emerald-900">
                            {matchedVoucher ? '✅ שובר מאומת ופעיל!' : '🎁 קוד שובר זוהה:'}
                          </span>{' '}
                          <span className="font-bold text-emerald-950">
                            {matchedVoucher?.benefitText || 'שובר תקף לבחירת הטבה'}
                          </span>
                          <div className="text-[10px] text-emerald-800 font-medium mt-0.5">
                            * תנאי המבצע: תוקף השובר הינו ל-3 חודשים בלבד · בהזמנת מינימום 3 ימים (סופ״ש ארוך) · אין כפל הטבות ומבצעים · ההטבה תאושר ע״י הריזורט בתיאום ההזמנה.
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* Daycare / Boarding Pass Code Input */}
                <div className="pt-2 border-t border-slate-200/80">
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Ticket className="w-4 h-4 text-emerald-600" />
                      <span>יש לכם כרטיסייה או בנק 21 יממות VIP? הזינו מספר שובר / כרטיסייה:</span>
                    </label>
                    {daycarePassCode && matchedDaycarePass && (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{matchedDaycarePass.serviceType === 'boarding' ? 'בנק 21 יממות זוהה בהצלחה' : 'כרטיסייה זוהתה בהצלחה'}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={daycarePassCode}
                      onChange={(e) => setDaycarePassCode(e.target.value.trim())}
                      placeholder="הזינו מספר כרטיסייה (למשל: 8492)"
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none tracking-wider font-mono placeholder:font-sans placeholder:font-normal shadow-2xs"
                      dir="auto"
                    />
                    {daycarePassCode && (
                      <button
                        type="button"
                        onClick={() => setDaycarePassCode('')}
                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        נקה
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Interactive VIP Benefit Choice Menu - ONLY SHOWN IF PHONE IS VERIFIED IN DB OR AN ACTIVE VOUCHER IS ENTERED */}
            {isBenefitsUnlocked && (
              <div className="space-y-2 pt-3 mt-3 border-t border-emerald-200/90 animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>בחרו את פינוק ה-VIP שלכם לשהות זו (מתנה 1 מתוך התפריט לבחירתכם):</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-lg border border-amber-300">
                    ללא כפל הטבות
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {RESORT_BENEFIT_OPTIONS.map((opt) => {
                    const isSelected = selectedBenefitId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedBenefitId(opt.id)}
                        className={`p-2.5 rounded-xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-amber-50 to-amber-100/80 border-amber-500 ring-2 ring-amber-500/30 text-amber-950 shadow-xs font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-xl shrink-0 mt-0.5">{opt.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-black text-slate-900 leading-snug">{opt.title}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-200/70 text-amber-950 shrink-0">
                              {opt.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{opt.description}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0 mt-1" />}
                      </button>
                    );
                  })}
                </div>

                <div className="text-[10px] text-amber-900 font-medium">
                  * תנאי המבצע: תוקף ההטבה הינו ל-3 חודשים מיום הנפקתה · בהזמנת שהות של 3 ימים ומעלה (סופ״ש ארוך) · אין כפל הטבות ומבצעים · ההטבה שנבחרה תאושר ע״י הריזורט בתיאום ההזמנה.
                </div>
              </div>
            )}
          </div>
          
          {/* Section 1: Owner Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a] pb-1 border-b border-slate-100">
              <User className="w-4 h-4 text-emerald-600" />
              <span>פרטי איש קשר (הבעלים) <span className="text-red-500">*</span></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  שם מלא <span className="text-red-500">*</span>
                </label>
                <input
                  id="field_ownerName"
                  type="text"
                  required
                  value={ownerName}
                  onFocus={() => {
                    if (invalidFieldId === 'field_ownerName') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  onChange={(e) => {
                    setOwnerName(e.target.value);
                    if (invalidFieldId === 'field_ownerName') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  placeholder="למשל: דני לוי"
                  className={`w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none transition-all ${
                    invalidFieldId === 'field_ownerName'
                      ? 'bg-rose-50 border-2 border-rose-500 ring-4 ring-rose-400 animate-pulse shadow-lg'
                      : 'bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  כתובת אימייל <span className="text-red-500">*</span>
                </label>
                <input
                  id="field_ownerEmail"
                  type="email"
                  required
                  value={ownerEmail}
                  onFocus={() => {
                    if (invalidFieldId === 'field_ownerEmail') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  onChange={(e) => {
                    setOwnerEmail(e.target.value);
                    if (invalidFieldId === 'field_ownerEmail') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  placeholder="name@example.com"
                  className={`w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none transition-all ${
                    invalidFieldId === 'field_ownerEmail'
                      ? 'bg-rose-50 border-2 border-rose-500 ring-4 ring-rose-400 animate-pulse shadow-lg'
                      : 'bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                />
              </div>
            </div>

            {/* Mandatory Owner Home Address with GPS Auto-detection & Safety Reassurance */}
            <div 
              id="field_ownerAddress"
              className={`rounded-2xl p-4 sm:p-5 space-y-3 transition-all ${
                invalidFieldId === 'field_ownerAddress'
                  ? 'bg-rose-50/90 border-2 border-rose-500 ring-4 ring-rose-400 shadow-xl animate-pulse'
                  : 'bg-emerald-50/40 border-2 border-emerald-200/80 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>כתובת מגורים מלאה (עיר, רחוב ומספר בית)</span>
                  </label>
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                    🛡️ שדה חיוני לתיק הבטיחות ולמקרה חירום רפואי
                  </span>
                </div>

                {/* GPS Auto-Detect Button - Prominent, One-Click & Highly Recommended */}
                <button
                  type="button"
                  onClick={() => handleDetectGpsAddress()}
                  disabled={isLocatingGps}
                  className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 active:scale-95 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 ring-2 ring-emerald-400/50 hover:ring-emerald-500"
                  title="מומלץ ביותר: זהה את הכתובת הנוכחית שלי באמצעות GPS בלחיצה אחת"
                >
                  {isLocatingGps ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>מאתר כתובת ב-GPS...</span>
                    </>
                  ) : (
                    <>
                      <span className="bg-amber-400 text-amber-950 text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-2xs">
                        מומלץ ⭐
                      </span>
                      <Navigation className="w-4 h-4 text-amber-300" />
                      <span>מלא כתובת מהמיקום הנוכחי (GPS) 📍</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  list="israeli-cities-intake"
                  value={ownerAddress}
                  onFocus={() => {
                    if (invalidFieldId === 'field_ownerAddress') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  onChange={(e) => {
                    setOwnerAddress(e.target.value);
                    if (gpsSuccessNotice) setGpsSuccessNotice(null);
                    if (invalidFieldId === 'field_ownerAddress') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  placeholder="התחל להקליד עיר או רחוב, או לחץ על כפתור ה-GPS למעלה למילוי מהיר 📍"
                  className={`w-full rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none transition-all shadow-inner ${
                    invalidFieldId === 'field_ownerAddress'
                      ? 'bg-white border-2 border-rose-500 ring-2 ring-rose-400'
                      : 'bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                />

                <datalist id="israeli-cities-intake">
                  {ISRAELI_CITIES_LIST.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </div>

              {/* Explanatory Safety Reassurance Note with Strong GPS Recommendation */}
              <div className="text-[11px] text-slate-700 bg-white/95 border border-emerald-200/80 rounded-xl p-3 font-medium space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>💡 מילוי מהיר: מומלץ ללחוץ על כפתור ה-GPS הירוק למעלה!</span>
                </div>
                <p className="text-slate-600 pr-5">
                  לחיצה אחת ממלאת את כתובתכם המדויקת אוטומטית וחוסכת הקלדה.
                </p>
              </div>

              {isReturningAddress && (
                <div className="flex items-center justify-between text-xs text-indigo-950 bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 font-bold animate-in fade-in">
                  <div className="flex items-center gap-1.5">
                    <span>🏠</span>
                    <span>זוהתה כתובת משהות קודמת: <strong>{ownerAddress}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerAddress('');
                      setIsReturningAddress(false);
                      setGpsSuccessNotice(null);
                    }}
                    className="text-indigo-700 hover:text-indigo-900 font-black underline text-[11px] cursor-pointer"
                  >
                    עברתי דירה / עדכן כתובת ✏️
                  </button>
                </div>
              )}

              {gpsSuccessNotice && (
                <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-300 rounded-xl p-2.5 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{gpsSuccessNotice} (ניתן לערוך ידנית במידת הצורך).</span>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-0.5">
                <span>🔄 <strong>עברתם דירה?</strong> ניתן לעדכן כתובת חופשית בכל עת או בלחיצה על כפתור ה-GPS.</span>
                {ownerAddress && (
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerAddress('');
                      setIsReturningAddress(false);
                      setGpsSuccessNotice(null);
                    }}
                    className="text-slate-400 hover:text-red-600 font-bold underline cursor-pointer shrink-0 mr-2"
                  >
                    נקה שדה
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Dog Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a] pb-1 border-b border-slate-100">
              <Heart className="w-4 h-4 text-emerald-600" />
              <span>פרטי הכלב/ה <span className="text-red-500">*</span></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  שם הכלב/ה <span className="text-red-500">*</span>
                </label>
                <input
                  id="field_dogName"
                  type="text"
                  required
                  value={dogName}
                  onFocus={() => {
                    if (invalidFieldId === 'field_dogName') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  onChange={(e) => {
                    setDogName(e.target.value);
                    if (invalidFieldId === 'field_dogName') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  placeholder="למשל: מקס"
                  className={`w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none transition-all ${
                    invalidFieldId === 'field_dogName'
                      ? 'bg-rose-50 border-2 border-rose-500 ring-4 ring-rose-400 animate-pulse shadow-lg'
                      : 'bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  גזע הכלב <span className="text-red-500">*</span>
                </label>
                <input
                  id="field_dogBreed"
                  type="text"
                  required
                  value={dogBreed}
                  onFocus={() => {
                    if (invalidFieldId === 'field_dogBreed') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  onChange={(e) => {
                    setDogBreed(e.target.value);
                    if (invalidFieldId === 'field_dogBreed') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  placeholder="למשל: לברדור / מעורב"
                  className={`w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none transition-all ${
                    invalidFieldId === 'field_dogBreed'
                      ? 'bg-rose-50 border-2 border-rose-500 ring-4 ring-rose-400 animate-pulse shadow-lg'
                      : 'bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  גיל הכלב
                </label>
                <input
                  type="text"
                  value={dogAge}
                  onChange={(e) => setDogAge(e.target.value)}
                  placeholder="למשל: שנתיים / גור"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>
            </div>

            {/* Gender and Size row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Dog Gender */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  מין הכלב/ה <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDogGender('male')}
                    className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      dogGender === 'male'
                        ? 'bg-blue-600 text-white font-extrabold border-blue-600 shadow-xs ring-2 ring-blue-400/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <span className="text-sm">זכר</span>
                    <span>♂️</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDogGender('female')}
                    className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      dogGender === 'female'
                        ? 'bg-pink-600 text-white font-extrabold border-pink-600 shadow-xs ring-2 ring-pink-400/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <span className="text-sm">נקבה</span>
                    <span>♀️</span>
                  </button>
                </div>
              </div>

              {/* Dog Size */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  גודל ומשקל משוער <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'small', label: 'קטן', desc: 'עד 10 ק״ג' },
                    { id: 'medium', label: 'בינוני', desc: '10-25 ק״ג' },
                    { id: 'large', label: 'גדול', desc: '25-45 ק״ג' },
                    { id: 'giant', label: 'ענק', desc: 'מעל 45 ק״ג' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDogSize(s.id as any)}
                      className={`py-2 px-1 rounded-xl border text-center transition-all cursor-pointer ${
                        dogSize === s.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold">{s.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Dog Photo Upload / Camera Capture */}
            {/* Dog Photos & Short Video Section */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 mt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-700" />
                  <span>תמונות וסרטוני וידאו של הכלב/ה (צילום, גלריה או וידאו):</span>
                </label>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300">
                  מומלץ מאוד 📸🎥
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                באפשרותכם לצלם מספר תמונות או להעלות סרטון קצר (עד 15 שניות) כדי ששמוליק והצוות יכירו את הכלב.
              </p>

              {/* Upload Buttons */}
              {dogMediaList.length < 6 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Photo Button */}
                  <label className="bg-white hover:bg-emerald-50/80 active:scale-98 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl p-3 text-center cursor-pointer transition-all shadow-2xs flex items-center justify-center gap-2.5 group">
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple
                      onChange={handlePhotosSelect} 
                      className="hidden" 
                      disabled={isProcessingMedia}
                    />
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg group-hover:scale-110 transition-transform shrink-0">
                      📸
                    </div>
                    <div className="text-right">
                      <span className="block text-xs font-black text-emerald-950">
                        צלם / הוסף תמונות
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        צילום במצלמה או בחירה מהגלריה
                      </span>
                    </div>
                  </label>

                  {/* Video Button */}
                  <label className="bg-white hover:bg-emerald-50/80 active:scale-98 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl p-3 text-center cursor-pointer transition-all shadow-2xs flex items-center justify-center gap-2.5 group">
                    <input 
                      type="file" 
                      accept="video/*" 
                      capture="environment"
                      onChange={handleVideoSelect} 
                      className="hidden" 
                      disabled={isProcessingMedia}
                    />
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg group-hover:scale-110 transition-transform shrink-0">
                      🎥
                    </div>
                    <div className="text-right">
                      <span className="block text-xs font-black text-emerald-950">
                        הסרט / העלה סרטון קצר
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        וידאו קצר של עד 15 שניות
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {/* Processing Loader */}
              {isProcessingMedia && (
                <div className="flex items-center justify-center gap-2 p-3 bg-white/90 rounded-xl border border-emerald-200 text-emerald-900 text-xs font-bold animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>{mediaProcessingMsg || 'מעבד קובץ...'}</span>
                </div>
              )}

              {/* Uploaded Media Items Grid */}
              {dogMediaList.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900">
                    <span>פריטים שצורפו ({dogMediaList.length} מתוך 6):</span>
                    <button
                      type="button"
                      onClick={() => { setDogMediaList([]); setDogPhotoUrl(''); }}
                      className="text-red-600 hover:text-red-800 underline cursor-pointer text-xs"
                    >
                      נקה הכל ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {dogMediaList.map((item, idx) => (
                      <div 
                        key={item.id || idx}
                        className="relative group aspect-square rounded-xl overflow-hidden border-2 border-emerald-300 bg-slate-900 shadow-2xs"
                      >
                        <img 
                          src={item.thumbnailUrl || item.url} 
                          alt={`מדיה ${idx + 1}`} 
                          className="w-full h-full object-cover"
                        />
                        {/* Video badge */}
                        {item.type === 'video' && (
                          <div className="absolute inset-0 bg-black/35 flex items-center justify-center pointer-events-none">
                            <Play className="w-4 h-4 text-white fill-white" />
                            {item.duration && (
                              <span className="absolute bottom-1 right-1 text-[9px] bg-black/75 text-white px-1 rounded font-bold">
                                {item.duration}s
                              </span>
                            )}
                          </div>
                        )}
                        {/* Primary Badge on index 0 */}
                        {idx === 0 && (
                          <div className="absolute top-1 right-1 bg-emerald-600 text-white text-[8px] font-black px-1 rounded shadow-xs pointer-events-none">
                            ראשי
                          </div>
                        )}
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(idx)}
                          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer shadow-xs"
                          title="מחק פריט זה"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Service Type */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a] pb-1 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>השירות המבוקש <span className="text-red-500">*</span></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'boarding', icon: '🏨', title: 'פנסיון לינה', desc: 'אירוח מלא בריזורט' },
                { id: 'training', icon: '🎓', title: 'אילוף', desc: 'תכנית אילוף ושיקום' },
                { id: 'daycare', icon: '✂️', title: 'יום כיף (דייקר)', desc: 'שהות יומית ומשחקים' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleServiceChange(s.id as ServiceType)}
                  className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                    serviceType === s.id
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="text-xs font-bold">{s.title}</div>
                  <div className="text-[10px] text-slate-500 font-normal">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Dates */}
          <div className="space-y-3.5 bg-emerald-50/50 p-4 sm:p-5 rounded-2xl border-2 border-emerald-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-emerald-200/80">
              <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a]">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>תאריכי השהות המבוקשים <span className="text-red-500">*</span></span>
              </div>
              <span className="text-xs font-black text-emerald-800 bg-white px-3 py-1 rounded-full border border-emerald-200 shadow-2xs self-start sm:self-auto">
                {serviceType === 'training' 
                  ? 'תחילת אילוף (משך יקבע בשיחה)' 
                  : serviceType === 'daycare' 
                  ? 'שהות יומית (ללא לינה)' 
                  : `סה״כ ${daysCount} ${daysCount === 1 ? 'יום' : 'ימים'} (${nightsCount} ${nightsCount === 1 ? 'לילה' : 'לילות'})`}
              </span>
            </div>

            {/* DAYCARE SINGLE-DAY MODE */}
            {serviceType === 'daycare' ? (
              <div 
                id="field_startDate"
                className={`rounded-2xl p-4 border transition-all space-y-3 ${
                  invalidFieldId === 'field_startDate'
                    ? 'bg-rose-50/90 border-2 border-rose-500 ring-4 ring-rose-400 shadow-xl animate-pulse'
                    : 'bg-white border-emerald-200 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    ☀️ בחר את תאריך יום הכיף המבוקש *
                  </label>
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                    שעות פעילות: 09:30 - 18:30
                  </span>
                </div>

                {/* Quick Chips for Daycare */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 self-center ml-1">בחירה מהירה:</span>
                  {[
                    { label: 'היום', date: today },
                    { label: 'מחר', date: addDays(today, 1) },
                    { label: 'מחרתיים', date: addDays(today, 2) },
                  ].map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => { 
                        setStartDate(chip.date); 
                        setEndDate(chip.date); 
                        if (invalidFieldId === 'field_startDate') { setInvalidFieldId(null); setErrorMessage(null); }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        startDate === chip.date
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-emerald-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {chip.label} (יום {getDayNameHebrew(chip.date)})
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="date"
                    required
                    min={today}
                    value={startDate}
                    onFocus={() => {
                      if (invalidFieldId === 'field_startDate') { setInvalidFieldId(null); setErrorMessage(null); }
                    }}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setEndDate(e.target.value);
                      if (invalidFieldId === 'field_startDate') { setInvalidFieldId(null); setErrorMessage(null); }
                    }}
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono transition-all"
                  />
                  <div className="mt-1.5 text-xs text-emerald-800 font-black flex items-center gap-1">
                    <span>📅 יום {getDayNameHebrew(startDate)}, {formatDateIL(startDate)}</span>
                  </div>
                </div>
              </div>
            ) : serviceType === 'training' ? (
              /* TRAINING DEDICATED START DATE MODE */
              <div 
                id="field_startDate"
                className={`rounded-2xl p-4 sm:p-5 border transition-all space-y-4 ${
                  invalidFieldId === 'field_startDate'
                    ? 'bg-rose-50/90 border-2 border-rose-500 ring-4 ring-rose-400 shadow-xl animate-pulse'
                    : 'bg-white border-emerald-200 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black text-slate-900 block">
                      🎓 תאריך הגעה / כניסה לאילוף *
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      בחר מתי תרצו להתחיל את תהליך האילוף בריזורט
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    תכנית מותאמת אישית
                  </span>
                </div>

                {/* Quick Start Chips for Training */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 self-center ml-1">התחלה מהירה:</span>
                  {[
                    { label: 'מחר', date: addDays(today, 1) },
                    { 
                      label: 'תחילת שבוע הבא', 
                      date: (() => {
                        const d = new Date(today + 'T00:00:00');
                        const day = d.getDay();
                        let daysToSun = (0 - day + 7) % 7;
                        if (daysToSun === 0) daysToSun = 7;
                        return addDays(today, daysToSun);
                      })() 
                    },
                    { label: 'בעוד שבוע', date: addDays(today, 7) },
                    { label: 'בעוד שבועיים', date: addDays(today, 14) },
                  ].map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => { 
                        setStartDate(chip.date); 
                        setEndDate(addDays(chip.date, 30)); 
                        if (invalidFieldId === 'field_startDate') { setInvalidFieldId(null); setErrorMessage(null); }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        startDate === chip.date
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-emerald-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {chip.label} (יום {getDayNameHebrew(chip.date)})
                    </button>
                  ))}
                </div>

                {/* Date Input */}
                <div className="relative">
                  <input
                    type="date"
                    required
                    min={today}
                    value={startDate}
                    onFocus={() => {
                      if (invalidFieldId === 'field_startDate') { setInvalidFieldId(null); setErrorMessage(null); }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartDate(val);
                      setEndDate(addDays(val, 30));
                      if (invalidFieldId === 'field_startDate') { setInvalidFieldId(null); setErrorMessage(null); }
                    }}
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono transition-all"
                  />
                  <div className="mt-1.5 text-xs text-emerald-800 font-black flex items-center gap-1">
                    <span>📅 יום {getDayNameHebrew(startDate)}, {formatDateIL(startDate)}</span>
                  </div>
                </div>

                {/* Helpful Note */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 flex items-start gap-2">
                  <span className="text-base shrink-0">💡</span>
                  <p className="leading-relaxed">
                    <strong>לידיעתכם:</strong> כל אילוף בריזורט הינו תהליך ייחודי ומותאם אישית. תאריך הסיום ומשך התכנית יסוכמו בשיחה אישית עם שמוליק לאחר אבחון הצרכים.
                  </p>
                </div>
              </div>
            ) : (
              /* BOARDING OVERNIGHT MODE */
              <div className="space-y-3">
                
                {/* 1. Check-in Date */}
                <div 
                  id="field_startDate"
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all space-y-2 ${
                    invalidFieldId === 'field_startDate'
                      ? 'bg-rose-50/90 border-2 border-rose-500 ring-4 ring-rose-400 shadow-xl animate-pulse'
                      : 'bg-white border-emerald-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🏨 1. תאריך הגעה / כניסה לריזורט *</span>
                    </label>
                    <span className="text-xs text-emerald-800 font-black">
                      {startDate ? `יום ${getDayNameHebrew(startDate)}` : ''}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      min={today}
                      value={startDate}
                      onFocus={() => {
                        if (invalidFieldId === 'field_startDate') { setInvalidFieldId(null); setErrorMessage(null); }
                      }}
                      onChange={(e) => {
                        handleStartDateChange(e.target.value);
                        if (invalidFieldId === 'field_startDate') { setInvalidFieldId(null); setErrorMessage(null); }
                      }}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono transition-all"
                    />
                    <div className="mt-1 text-[11px] text-slate-500 font-bold flex items-center justify-between">
                      <span>כניסה: {startDate ? formatDateIL(startDate) : ''}</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            handleStartDateChange(today);
                            if (invalidFieldId === 'field_startDate') { setInvalidFieldId(null); setErrorMessage(null); }
                          }}
                          className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer font-bold"
                        >
                          היום
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleStartDateChange(addDays(today, 1));
                            if (invalidFieldId === 'field_startDate') { setInvalidFieldId(null); setErrorMessage(null); }
                          }}
                          className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer font-bold"
                        >
                          מחר
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. BETWEEN: Popular Presets & Duration Across FULL WIDTH */}
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-emerald-300/80 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⏱️</span>
                      <div>
                        <span className="text-xs font-black text-slate-900 block">
                          תקופות נפוצות ומשך השהות (בחירה מהירה):
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          הקליקו על תקופה מוכנה או כווננו את כמות הלילות
                        </span>
                      </div>
                    </div>

                    {/* Interactive Nights Stepper */}
                    <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-700">לילות:</span>
                      <div className="flex items-center border border-slate-300 rounded-lg bg-white shadow-2xs overflow-hidden">
                        <button
                          type="button"
                          disabled={nightsCount <= 1}
                          onClick={() => handleNightsChange(-1)}
                          className="w-7 h-7 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 flex items-center justify-center font-black text-slate-700 transition-all cursor-pointer border-l border-slate-200"
                          title="הפחת לילה (-1)"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-black text-emerald-950 min-w-[2rem] text-center font-mono">
                          {nightsCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleNightsChange(1)}
                          className="w-7 h-7 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center font-black text-emerald-800 transition-all cursor-pointer border-r border-slate-200"
                          title="הוסף לילה (+1)"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-800">
                        ({daysCount} ימים)
                      </span>
                    </div>
                  </div>

                  {/* 5 Preset Cards Arranged Cleanly Across Full Width */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 w-full">
                    {[
                      { 
                        id: 'weekend', 
                        icon: '🌟', 
                        title: 'סופ״ש הקרוב', 
                        subtitle: 'שישי 14:00 ➔ ראשון 09:30', 
                        detail: '2 לילות',
                        matches: nightsCount === 2 && getDayNameHebrew(startDate) === 'שישי' && getDayNameHebrew(endDate) === 'ראשון'
                      },
                      { 
                        id: 'next_weekend', 
                        icon: '📅', 
                        title: 'סופ״ש הבא', 
                        subtitle: 'שישי הבא ➔ ראשון', 
                        detail: '2 לילות',
                        matches: false
                      },
                      { 
                        id: 'midweek', 
                        icon: '💼', 
                        title: 'אמצע שבוע', 
                        subtitle: 'ראשון ➔ שישי (עד 14:00)', 
                        detail: '5 לילות',
                        matches: nightsCount === 5 && getDayNameHebrew(startDate) === 'ראשון' && getDayNameHebrew(endDate) === 'שישי'
                      },
                      { 
                        id: 'week', 
                        icon: '🏖️', 
                        title: 'שבוע מלא', 
                        subtitle: '7 לילות', 
                        detail: '8 ימים',
                        matches: nightsCount === 7
                      },
                      { 
                        id: 'twoweeks', 
                        icon: '🌴', 
                        title: 'שבועיים', 
                        subtitle: '14 לילות', 
                        detail: '15 ימים',
                        matches: nightsCount === 14
                      },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyDatePreset(preset.id as any)}
                        className={`w-full p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          preset.matches
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-500/30'
                            : 'bg-slate-50 hover:bg-emerald-50/80 text-slate-800 border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="text-base">{preset.icon}</div>
                        <div className={`text-xs font-extrabold ${preset.matches ? 'text-white' : 'text-slate-900'}`}>
                          {preset.title}
                        </div>
                        <div className={`text-[10px] font-medium leading-tight ${preset.matches ? 'text-emerald-100' : 'text-slate-500'}`}>
                          {preset.subtitle}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          preset.matches ? 'bg-white/20 text-white' : 'bg-emerald-100/70 text-emerald-800'
                        }`}>
                          {preset.detail}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold text-center mt-2.5">
                    💡 בחירה בלחצן מהיר מגדירה תאריכים מראש, אך ניתן תמיד לערוך ולשנות את התאריכים באופן חופשי בשדות למטה לפי רצונכם.
                  </p>
                </div>

                {/* 3. Check-out Date */}
                <div 
                  id="field_endDate"
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all space-y-2 ${
                    invalidFieldId === 'field_endDate'
                      ? 'bg-rose-50/90 border-2 border-rose-500 ring-4 ring-rose-400 shadow-xl animate-pulse'
                      : 'bg-white border-emerald-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🚗 2. תאריך איסוף / יציאה מהריזורט *</span>
                    </label>
                    <span className="text-xs text-emerald-800 font-black">
                      {endDate ? `יום ${getDayNameHebrew(endDate)}` : ''}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      min={startDate}
                      value={endDate}
                      onFocus={() => {
                        if (invalidFieldId === 'field_endDate') { setInvalidFieldId(null); setErrorMessage(null); }
                      }}
                      onChange={(e) => {
                        handleEndDateChange(e.target.value);
                        if (invalidFieldId === 'field_endDate') { setInvalidFieldId(null); setErrorMessage(null); }
                      }}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono transition-all"
                    />
                    <div className="mt-1 text-[11px] text-slate-500 font-bold flex items-center justify-between">
                      <span>יציאה: {endDate ? formatDateIL(endDate) : ''}</span>
                      <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        איסוף ביום {getDayNameHebrew(endDate)} (סה״כ {nightsCount} לילות)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Mandatory Operating Hours & Customer Service Policy */}
                <div className="bg-amber-50/95 border-2 border-amber-300/90 rounded-2xl p-3.5 sm:p-4 text-xs text-amber-950 space-y-2.5 shadow-2xs">
                  <div className="font-black text-amber-950 flex items-center gap-2 text-xs sm:text-sm">
                    <span className="text-base">⏰</span>
                    <span>שעות פעילות הריזורט לכלב בימים א-ה הן 09:30 - 18:30</span>
                  </div>
                  <div className="space-y-2 font-bold leading-relaxed pr-1">
                    <p>
                      • <strong>בשישי וערב חג:</strong> עד שעה <strong>14:00</strong>, ובצאת השבת / החג (למחרת השבת / חג) משעה <strong>09:30</strong>.
                    </p>
                    <div className="text-amber-950 bg-amber-100/90 p-2.5 sm:p-3 rounded-xl border border-amber-300/90 font-black leading-relaxed space-y-1 mt-1">
                      <p className="text-[11px] sm:text-xs">
                        מעבר לשעות הפעילות (לפני 09:30 ואחרי 18:30), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾
                      </p>
                    </div>
                  </div>
                </div>

                {saturdayWarning && (
                  <div className="bg-red-50 border-2 border-red-300 text-red-900 rounded-xl p-3 text-xs font-black flex items-center gap-2 animate-shake">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{saturdayWarning}</span>
                  </div>
                )}

              </div>
            )}

            {/* Flexible dates toggle */}
            <label className="flex items-center gap-2 pt-1 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isFlexibleDates}
                onChange={(e) => setIsFlexibleDates(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="font-semibold text-slate-700">התאריכים גמישים / עדיין לא סופיים (בירור זמינות ראשוני)</span>
            </label>
          </div>

          {/* Section 4.5: Multi-dog Guests - "הוסף עוד אורח לריזורט לכלב" */}
          <div className="space-y-4">
            {additionalDogs.map((ad, idx) => (
              <div 
                key={idx} 
                className="bg-gradient-to-br from-amber-50/70 via-orange-50/30 to-white border-2 border-amber-300 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-200"
              >
                {/* Header of additional dog */}
                <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🐕</span>
                    <span className="text-sm sm:text-base font-black text-amber-950">
                      אורח/ת נוסף/ת #{idx + 2} {ad.dogName ? `(${ad.dogName})` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAdditionalDog(idx)}
                    className="text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>הסר אורח זה</span>
                  </button>
                </div>

                {/* Date Choice Question: אותם תאריכים או תאריכים אחרים? */}
                <div className="p-3 bg-white/90 rounded-2xl border border-amber-200/90 space-y-2">
                  <label className="text-xs font-black text-slate-800 block">
                    🗓️ מועדי השהות של {ad.dogName || 'הכלב הנוסף'}: אותם תאריכים או תאריכים אחרים? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateAdditionalDog(idx, { sameDatesAsPrimary: true })}
                      className={`p-2.5 rounded-xl border-2 text-right transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        ad.sameDatesAsPrimary
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">✅</span>
                        <span className="text-xs">אותם תאריכים בדיוק</span>
                      </div>
                      <span className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-200 font-mono text-slate-700">
                        {formatDateIL(startDate)} – {formatDateIL(endDate)}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateAdditionalDog(idx, { 
                        sameDatesAsPrimary: false,
                        startDate: ad.startDate || startDate,
                        endDate: ad.endDate || endDate
                      })}
                      className={`p-2.5 rounded-xl border-2 text-right transition-all cursor-pointer flex items-center gap-2 ${
                        !ad.sameDatesAsPrimary
                          ? 'bg-amber-100/70 border-amber-600 text-amber-950 font-black shadow-xs ring-1 ring-amber-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold'
                      }`}
                    >
                      <span className="text-base">📅</span>
                      <span className="text-xs">תאריכים אחרים (בחר מועדים נפרדים)</span>
                    </button>
                  </div>

                  {/* If custom dates chosen for this dog */}
                  {!ad.sameDatesAsPrimary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-amber-100 animate-in fade-in">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          תאריך כניסה של {ad.dogName || 'הכלב'}:
                        </label>
                        <input
                          type="date"
                          min={today}
                          value={ad.startDate || startDate}
                          onChange={(e) => handleUpdateAdditionalDog(idx, { startDate: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          תאריך איסוף / יציאה:
                        </label>
                        <input
                          type="date"
                          min={ad.startDate || startDate}
                          value={ad.endDate || endDate}
                          onChange={(e) => handleUpdateAdditionalDog(idx, { endDate: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Details of additional dog */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      שם הכלב/ה <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={ad.dogName}
                      onChange={(e) => handleUpdateAdditionalDog(idx, { dogName: e.target.value })}
                      placeholder="למשל: לונה"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      גזע הכלב <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={ad.dogBreed}
                      onChange={(e) => handleUpdateAdditionalDog(idx, { dogBreed: e.target.value })}
                      placeholder="למשל: פודל"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      גיל הכלב
                    </label>
                    <input
                      type="text"
                      value={ad.dogAge || ''}
                      onChange={(e) => handleUpdateAdditionalDog(idx, { dogAge: e.target.value })}
                      placeholder="למשל: 3 שנים"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Gender and Size row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      מין <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateAdditionalDog(idx, { dogGender: 'male' })}
                        className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          ad.dogGender === 'male' ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        זכר ♂️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateAdditionalDog(idx, { dogGender: 'female' })}
                        className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          ad.dogGender === 'female' ? 'bg-pink-600 text-white border-pink-600 shadow-2xs' : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        נקבה ♀️
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      גודל הכלב <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'small', label: 'קטן (עד 10)' },
                        { id: 'medium', label: 'בינוני (10-25)' },
                        { id: 'large', label: 'גדול (25-45)' },
                        { id: 'giant', label: 'ענק (45+)' }
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleUpdateAdditionalDog(idx, { dogSize: s.id as any })}
                          className={`py-1.5 px-1 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                            ad.dogSize === s.id ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Vetting for this dog */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      ✂️ {ad.dogGender === 'female' ? 'מעוקרת?' : 'מסורס?'}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateAdditionalDog(idx, { isNeutered: true })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          ad.isNeutered ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        כן
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateAdditionalDog(idx, { isNeutered: false })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          !ad.isNeutered ? 'bg-amber-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        לא
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      🐕 חברותי עם כלבים?
                    </span>
                    <div className="flex gap-1">
                      {[
                        { id: 'yes', label: 'כן' },
                        { id: 'depends', label: 'תלוי' },
                        { id: 'no', label: 'לא' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleUpdateAdditionalDog(idx, { isFriendlyWithDogs: f.id as any })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                            ad.isFriendlyWithDogs === f.id ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Notes for additional dog */}
                <div>
                  <input
                    type="text"
                    value={ad.notes || ''}
                    onChange={(e) => handleUpdateAdditionalDog(idx, { notes: e.target.value })}
                    placeholder={`הערות מיוחדות, מזון או תרופות עבור ${ad.dogName || 'הכלב'}`}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            ))}

            {/* The "+" Button to Add Another Dog */}
            <button
              type="button"
              onClick={handleAddAdditionalDog}
              className="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-emerald-400 hover:border-emerald-600 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-950 font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
            >
              <Plus className="w-5 h-5 text-emerald-700 stroke-[3]" />
              <span>הוסף עוד אורח לריזורט לכלב 🐾</span>
            </button>
          </div>

          {/* Section 5: Mandatory Vetting Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>שאלות סינון מקצועיות (חובה) <span className="text-red-500">*</span></span>
              </div>
              <span className="text-[10px] bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded-full border border-red-200">
                שדות חובה
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              
              {/* Question 1: Friendly with other dogs */}
              <div 
                id="field_isFriendlyWithDogs" 
                className={`p-3.5 rounded-2xl border-2 space-y-2 transition-all ${
                  invalidFieldId === 'field_isFriendlyWithDogs'
                    ? 'border-rose-500 bg-rose-50/70 ring-4 ring-rose-400 shadow-xl animate-pulse'
                    : 'bg-slate-50 border-emerald-200/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-slate-900 block text-xs">
                    🐕 1. האם הכלב מסתדר עם כלבים אחרים? <span className="text-red-500">*</span>
                  </label>
                  {isFriendlyWithDogs === null && (
                    <span className="text-[10px] bg-rose-100 text-rose-800 font-black px-2 py-0.5 rounded-full">
                      חובה לבחור
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'yes', label: 'כן, חברותי מאוד 🟢' },
                    { id: 'depends', label: 'תלוי בסיטואציה 🟡' },
                    { id: 'no', label: 'לא / תוקפני / לבד / חייב בידוד 🔴' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setIsFriendlyWithDogs(f.id as any);
                        if (invalidFieldId === 'field_isFriendlyWithDogs') setInvalidFieldId(null);
                      }}
                      className={`py-2.5 px-2 rounded-xl border text-center font-black transition-all cursor-pointer ${
                        isFriendlyWithDogs === f.id
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/20'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 2, 3, 4, 5: Yes/No Vetting Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 2. Neutered */}
                <div 
                  id="field_isNeutered" 
                  className={`p-3.5 rounded-2xl border-2 flex flex-col justify-between transition-all ${
                    invalidFieldId === 'field_isNeutered'
                      ? 'border-rose-500 bg-rose-50/70 ring-4 ring-rose-400 shadow-xl animate-pulse'
                      : 'bg-slate-50 border-emerald-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>✂️ 2. {dogGender === 'female' ? 'מעוקרת?' : 'מסורס?'}</span>
                      <span className="text-red-500">*</span>
                      {isNeutered === null && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-black px-1.5 py-0.5 rounded-md">
                          חובה לבחור
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNeutered(true);
                          if (invalidFieldId === 'field_isNeutered') setInvalidFieldId(null);
                        }}
                        className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                          isNeutered === true 
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs' 
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        כן
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNeutered(false);
                          if (invalidFieldId === 'field_isNeutered') setInvalidFieldId(null);
                        }}
                        className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                          isNeutered === false 
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs' 
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        לא
                      </button>
                    </div>
                  </div>
                  {isNeutered === false && (
                    <div className="mt-2.5 p-2 bg-rose-100/90 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-950 flex items-center gap-1.5 animate-pulse">
                      <span className="text-sm shrink-0">⚠️</span>
                      <span>שים לב: זכרים לא מסורסים מחייבים תעריף בידוד של ₪230 ליום והשגחה אישית מופרדת.</span>
                    </div>
                  )}
                </div>

                {/* 3. Vaccinated */}
                <div 
                  id="field_isVaccinated" 
                  className={`p-3.5 rounded-2xl border-2 flex flex-col justify-between transition-all ${
                    invalidFieldId === 'field_isVaccinated'
                      ? 'border-rose-500 bg-rose-50/70 ring-4 ring-rose-400 shadow-xl animate-pulse'
                      : 'bg-slate-50 border-emerald-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>💉 3. חיסונים בתוקף?</span>
                      <span className="text-red-500">*</span>
                      {isVaccinated === null && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-black px-1.5 py-0.5 rounded-md">
                          חובה לבחור
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsVaccinated(true);
                          if (invalidFieldId === 'field_isVaccinated') setInvalidFieldId(null);
                        }}
                        className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                          isVaccinated === true 
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs' 
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        כן בתוקף
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsVaccinated(false);
                          if (invalidFieldId === 'field_isVaccinated') setInvalidFieldId(null);
                        }}
                        className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                          isVaccinated === false 
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs' 
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        לא בתוקף / לא בטוח
                      </button>
                    </div>
                  </div>
                  {isVaccinated === false && (
                    <div className="mt-2.5 p-2 bg-rose-100/90 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-950 flex items-center gap-1.5 animate-pulse">
                      <span className="text-sm shrink-0">🚨</span>
                      <span>שים לב: הריזורט מחייב פנקס חיסונים בתוקף (משושה וכלבת). שמוליק ייצור קשר לבירור הנושא.</span>
                    </div>
                  )}
                </div>

                {/* 4. House / Potty Trained */}
                <div 
                  id="field_isHouseTrained" 
                  className={`p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all ${
                    invalidFieldId === 'field_isHouseTrained'
                      ? 'border-rose-500 bg-rose-50/70 ring-4 ring-rose-400 shadow-xl animate-pulse'
                      : 'bg-slate-50 border-emerald-200/80'
                  }`}
                >
                  <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>🚽 4. מחונך לצרכים?</span>
                    <span className="text-red-500">*</span>
                    {isHouseTrained === null && (
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-black px-1.5 py-0.5 rounded-md">
                        חובה לבחור
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsHouseTrained(true);
                        if (invalidFieldId === 'field_isHouseTrained') setInvalidFieldId(null);
                      }}
                      className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                        isHouseTrained === true ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      כן
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsHouseTrained(false);
                        if (invalidFieldId === 'field_isHouseTrained') setInvalidFieldId(null);
                      }}
                      className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                        isHouseTrained === false ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      לא
                    </button>
                  </div>
                </div>

                {/* 5. Treated against Ticks and Fleas */}
                <div 
                  id="field_isTreatedParasites" 
                  className={`p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all ${
                    invalidFieldId === 'field_isTreatedParasites'
                      ? 'border-rose-500 bg-rose-50/70 ring-4 ring-rose-400 shadow-xl animate-pulse'
                      : 'bg-slate-50 border-emerald-200/80'
                  }`}
                >
                  <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>🛡️ 5. מטופל נגד קרציות ופשפשים?</span>
                    <span className="text-red-500">*</span>
                    {isTreatedParasites === null && (
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-black px-1.5 py-0.5 rounded-md">
                        חובה לבחור
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsTreatedParasites(true);
                        if (invalidFieldId === 'field_isTreatedParasites') setInvalidFieldId(null);
                      }}
                      className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                        isTreatedParasites === true ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      כן
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTreatedParasites(false);
                        if (invalidFieldId === 'field_isTreatedParasites') setInvalidFieldId(null);
                      }}
                      className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                        isTreatedParasites === false ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      לא
                    </button>
                  </div>
                </div>
              </div>

              {/* Question 6: Special needs or medication */}
              <div 
                id="field_specialNeeds"
                className={`p-4 rounded-2xl border-2 space-y-3 transition-all ${
                  invalidFieldId === 'field_specialNeeds'
                    ? 'bg-rose-50/90 border-rose-500 ring-4 ring-rose-400 shadow-xl animate-pulse'
                    : 'bg-slate-50 border-emerald-200/90'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-slate-900 block text-xs">
                    🩺 6. מצב בריאותי, צרכים מיוחדים או תרופות <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    שדה חובה
                  </span>
                </div>

                {/* Dominant "Completely Healthy" Button - Prominent, full box size */}
                <button
                  type="button"
                  onClick={() => {
                    setSpecialNeeds('בריא לחלוטין (אין תרופות או צרכים מיוחדים)');
                    if (invalidFieldId === 'field_specialNeeds') {
                      setInvalidFieldId(null);
                      setErrorMessage(null);
                    }
                  }}
                  className={`w-full py-3.5 px-4 rounded-xl border-2 text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                    specialNeeds === 'בריא לחלוטין (אין תרופות או צרכים מיוחדים)'
                      ? 'bg-[#065f46] text-white border-[#065f46] ring-2 ring-emerald-500/40 shadow-emerald-900/20'
                      : 'bg-emerald-50 hover:bg-emerald-100/90 text-emerald-950 border-emerald-300 hover:border-emerald-400 hover:shadow-md'
                  }`}
                >
                  {specialNeeds === 'בריא לחלוטין (אין תרופות או צרכים מיוחדים)' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                      <span>✅ נבחר: הכלב בריא לחלוטין (אין תרופות או צרכים מיוחדים)</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">🟢</span>
                      <span>לחצו כאן אם הכלב בריא לחלוטין (ללא תרופות או מזון מיוחד)</span>
                    </>
                  )}
                </button>

                {/* Input box for special needs / medication */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-slate-600 block">
                    או הקלידו כאן פירוט אם הכלב נוטל תרופות, מזון רפואי או רגישויות:
                  </label>
                  <input
                    type="text"
                    value={specialNeeds === 'בריא לחלוטין (אין תרופות או צרכים מיוחדים)' ? '' : specialNeeds}
                    onFocus={() => {
                      if (invalidFieldId === 'field_specialNeeds') {
                        setInvalidFieldId(null);
                        setErrorMessage(null);
                      }
                    }}
                    onChange={(e) => {
                      setSpecialNeeds(e.target.value);
                      if (invalidFieldId === 'field_specialNeeds') {
                        setInvalidFieldId(null);
                        setErrorMessage(null);
                      }
                    }}
                    placeholder='למשל: "מקבל חצי כדור בבוקר", "אוכל רפואי בלבד", "רגישות לעוף"...'
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Question 5: Free Text Field */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  💬 שדה טקסט חופשי / מה תרצו לשאול או לספר לנו?
                </label>
                <textarea
                  rows={3}
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="כתבו לנו כאן כל שאלה לגבי השהות, בקשה מיוחדת או פרט שחשוב שנדע..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

            </div>
          </div>

          {/* Mandatory Terms & Conditions Acceptance */}
          <div 
            id="field_termsAccepted"
            className={`border-2 rounded-2xl p-4 space-y-2.5 shadow-2xs transition-all ${
              invalidFieldId === 'field_termsAccepted'
                ? 'bg-rose-50/90 border-rose-500 ring-4 ring-rose-400 shadow-xl animate-pulse'
                : 'bg-slate-50 border-emerald-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="termsAccepted"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  if (e.target.checked && invalidFieldId === 'field_termsAccepted') {
                    setInvalidFieldId(null);
                    setErrorMessage(null);
                  }
                }}
                className="mt-0.5 w-5 h-5 accent-[#065f46] rounded cursor-pointer shrink-0"
              />
              <label htmlFor="termsAccepted" className="text-xs sm:text-sm font-black text-slate-900 cursor-pointer select-none leading-snug">
                קראתי ואישרתי את <button type="button" onClick={() => setIsTermsModalOpen(true)} className="text-emerald-700 hover:text-emerald-900 underline font-black cursor-pointer mx-1">תקנון הריזורט לכלב</button> <span className="text-red-500">*</span>
              </label>
            </div>

            <div className="bg-amber-500/10 border border-amber-400/40 rounded-xl p-2.5 text-xs text-amber-950 flex items-start gap-2">
              <span className="text-base leading-none shrink-0">🚫</span>
              <div>
                <strong className="block font-black text-amber-900">מדיניות ביטולים:</strong>
                <span>אין ביטולים בפחות מ-24 שעות מיום הקבלה, היות ונשמר עבור הכלב מקום ייעודי במתקן.</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-200 flex-wrap gap-1">
              <span className="font-medium text-slate-500">
                אישור התקנון הינו תנאי מחייב להגשת בקשת שהייה בריזורט
              </span>
              <button
                type="button"
                onClick={() => setIsTermsModalOpen(true)}
                className="text-emerald-800 hover:text-emerald-950 font-bold underline flex items-center gap-1 cursor-pointer transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                <span>לקריאת התקנון המלא (8 סעיפים)</span>
              </button>
            </div>
          </div>

          {/* Training Agreement Notice for Training Clients */}
          {serviceType === 'training' && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-xs space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-black text-amber-950">
                <span className="text-base">🎓</span>
                <span>נוהל תשלום אילוף – הריזורט לכלב:</span>
              </div>
              <p className="text-amber-900 leading-relaxed font-medium">
                על פי נהלי הריזורט לכלב: <strong>אין לאפשר תשלום של דמי האילוף למי שלא חתם על ההסכם</strong>. לאחר הגשת השאלון תקבלו קישור אישי להסכם האילוף הרשמי לחתימה דיגיטלית מאובטחת, ורק לאחר חתימתכם ניתן יהיה להסדיר את התשלום.
              </p>
            </div>
          )}

          {/* Floating / Prominent Flashing Validation Error Banner */}
          {errorMessage && (
            <div 
              id="form_error_banner"
              className="bg-rose-50 border-2 border-rose-500 text-rose-950 p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-pulse ring-4 ring-rose-300/60 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl animate-bounce">🚨</span>
                <div>
                  <div className="font-black text-sm text-rose-900">ישנם שדות חובה שטרם מולאו בשאלון!</div>
                  <div className="text-xs text-rose-800 font-bold mt-0.5">{errorMessage}</div>
                </div>
              </div>
              {invalidFieldId && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(invalidFieldId);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      const input = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el : el.querySelector('input, textarea, button');
                      (input as HTMLElement)?.focus?.();
                    }
                  }}
                  className="shrink-0 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow cursor-pointer transition-all flex items-center gap-1"
                >
                  <span>קפוץ לשדה ⬆️</span>
                </button>
              )}
            </div>
          )}

          {/* Action Buttons: Full Submit & Please Call Me */}
          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#065f46] hover:bg-[#044e45] active:scale-[0.99] text-white font-black py-4 rounded-2xl text-base shadow-lg shadow-emerald-950/10 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>שולח שאלון לריזורט...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>שלח שאלון בקשה לקליטה</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleProcessSubmit(true)}
              disabled={isSubmitting}
              className="w-full bg-emerald-50 hover:bg-emerald-100 active:scale-[0.99] text-emerald-900 border-2 border-emerald-400 font-black py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <PhoneCall className="w-4 h-4 text-emerald-700" />
              <span>📞 אנא התקשרו אלי (שיחה טלפונית לתיאום)</span>
            </button>

            {/* Direct WhatsApp Call & Chat Button */}
            <a
              href={`https://wa.me/${(settings.whatsappNotificationPhone || settings.managerPhone || '0548765888').replace(/\D/g, '').replace(/^0/, '972')}?text=${encodeURIComponent('שלום צוות הריזורט לכלב 🐾 רציתי לברר פרטים או לשוחח בוואטסאפ לגבי שהות/קליטה')}`}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-[#25D366] hover:bg-[#1EBE5D] active:scale-[0.99] text-white font-black py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <MessageSquare className="w-4 h-4" />
              <span>שיחה לוואטסאפ של הריזורט</span>
            </a>

            <p className="text-center text-[11px] text-slate-400 font-medium mt-2">
              🔒 הפרטים נשלחים ישירות לצוות הריזורט לכלב לצורך תיאום טלפוני ובדיקת זמינות.
            </p>
          </div>

        </form>

        <footer className="text-center text-xs text-slate-400 font-medium pb-6">
          הריזורט לכלב · פנסיון, אילוף ושיקום התנהגותי 🐾
        </footer>

        {/* Second-Chance Address Reminder Modal */}
        {showAddressReminderModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in" dir="rtl">
            <div className="bg-white rounded-3xl max-w-lg w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-lg shadow-xs shrink-0">
                    🏥
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      בטיחות ובריאות הכלב בריזורט
                    </h3>
                    <p className="text-[11px] text-emerald-800 font-bold">
                      הזדמנות להשלמת פרטי התיק הווטרינרי
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddressReminderModal(false);
                    const el = document.getElementById('field_ownerAddress');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.querySelector('input')?.focus();
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="סגירה"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 space-y-4">
                {/* Highlighted Message Requested by Hagai */}
                <div className="bg-emerald-50/90 border-2 border-emerald-300 rounded-2xl p-4 text-center shadow-xs">
                  <p className="text-base sm:text-lg font-black text-emerald-950 leading-snug">
                    להשלמת התיק הרפואי ובטיחות הכלב, נשמח לעדכון כתובת המגורים שלכם:
                  </p>
                </div>

                {/* Inline Address Entry with GPS and Israeli cities autocomplete */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-xs font-black text-slate-800">
                      כתובת מגורים (עיר, רחוב ומספר בית):
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDetectGpsAddress((detectedAddr) => setAddressReminderInput(detectedAddr))}
                      disabled={isLocatingGps}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isLocatingGps ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>מאתר כתובת...</span>
                        </>
                      ) : (
                        <>
                          <span className="bg-amber-400 text-amber-950 text-[10px] font-black px-1 rounded-sm">מומלץ ⭐</span>
                          <Navigation className="w-3.5 h-3.5 text-amber-200" />
                          <span>מילוי מהיר בלחיצה (GPS) 📍</span>
                        </>
                      )}
                    </button>
                  </div>

                  <input
                    type="text"
                    list="israeli-cities-intake"
                    value={addressReminderInput}
                    onChange={(e) => setAddressReminderInput(e.target.value)}
                    placeholder="לדוגמה: כפר סבא, ויצמן 12"
                    className="w-full bg-white border-2 border-slate-300 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none transition-all shadow-inner"
                    autoFocus
                  />
                </div>

                {/* Modal Action Buttons */}
                <div className="pt-2 space-y-2.5">
                  {/* Save and submit */}
                  <button
                    type="button"
                    onClick={() => {
                      const finalAddr = addressReminderInput.trim();
                      setShowAddressReminderModal(false);
                      if (finalAddr) {
                        setOwnerAddress(finalAddr);
                        handleProcessSubmit(pendingSubmitCallbackOnly, true, finalAddr);
                      } else {
                        setHasConfirmedNoAddress(true);
                        handleProcessSubmit(pendingSubmitCallbackOnly, true, '');
                      }
                    }}
                    className="w-full bg-[#065f46] hover:bg-[#044e45] active:scale-[0.99] text-white font-black py-3.5 rounded-2xl text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {addressReminderInput.trim() ? 'שמירה והמשך בשליחת השאלון ✓' : 'המשך ושליחה ללא כתובת ➔'}
                    </span>
                  </button>

                  {/* Respect choice: Submit without address or return to form */}
                  {addressReminderInput.trim() ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddressReminderModal(false);
                        setHasConfirmedNoAddress(true);
                        handleProcessSubmit(pendingSubmitCallbackOnly, true, '');
                      }}
                      className="w-full text-slate-500 hover:text-slate-800 text-xs font-bold py-2 text-center transition-colors cursor-pointer"
                    >
                      המשך ושליחה ללא ציון כתובת ➔
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddressReminderModal(false);
                        const el = document.getElementById('field_ownerAddress');
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el.querySelector('input')?.focus();
                        }
                      }}
                      className="w-full text-emerald-700 hover:text-emerald-900 text-xs font-bold py-2 text-center transition-colors cursor-pointer"
                    >
                      חזור לטופס כדי למלא בנחת
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Full Terms & Conditions Modal */}
        {isTermsModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in" dir="rtl">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-slate-50 to-emerald-50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-lg shadow-xs shrink-0">
                    📜
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      תקנון הריזורט לכלב
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      התנאים הבאים חלים על שהיית הכלב במתקן הריזורט לכלב
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content: 7 Clauses */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-800 text-xs sm:text-sm leading-relaxed">
                {RESORT_BYLAWS_SECTIONS.map((clause) => (
                  <div key={clause.num} className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 space-y-1.5">
                    <div className="flex items-center gap-2 font-black text-slate-900 text-xs sm:text-sm">
                      <span className="text-base">{clause.icon}</span>
                      <span>{clause.title}</span>
                    </div>
                    <p className="text-slate-700 text-xs leading-normal pr-6">
                      {clause.content}
                    </p>
                  </div>
                ))}

                {/* Summary note */}
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-black text-amber-950 text-center">
                  ביצוע התשלום מהווה אישור מצד הלקוח כי קרא את התנאים לעיל והסכים להם במלואם.
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setTermsAccepted(true);
                    setIsTermsModalOpen(false);
                  }}
                  className="w-full sm:w-auto bg-[#065f46] hover:bg-[#044e45] text-white font-black px-6 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>קראתי ואני מאשר/ת את התקנון</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(false)}
                  className="w-full sm:w-auto bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition-colors"
                >
                  סגור
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Proactive Send Form Modal */}
        <SendIntakeModal
          isOpen={isSendIntakeModalOpen}
          onClose={() => setIsSendIntakeModalOpen(false)}
          settings={settings}
        />



      </div>
    </div>
  );
};
