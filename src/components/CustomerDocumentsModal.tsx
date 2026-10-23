import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Signature, 
  ExternalLink, 
  Send, 
  Copy, 
  Check, 
  Printer, 
  Calendar, 
  Phone, 
  User, 
  Dog, 
  CreditCard, 
  Sparkles, 
  ShieldCheck, 
  Ticket,
  Image as ImageIcon
} from 'lucide-react';
import { Booking, IntakeRequest, ResortSettings } from '../types';
import { cleanPhoneNumber, openWhatsAppMessage } from '../utils/whatsappUtils';
import { formatDateIL, calculateDaysCount } from '../utils/dateUtils';
import { TrainingAgreementModal } from './TrainingAgreementModal';
import { findDaycarePassByCode } from '../services/dbService';

interface CustomerDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  allBookings?: Booking[];
  intakeRequests?: IntakeRequest[];
  settings: ResortSettings;
  onOpenSendPaymentLink?: () => void;
  onOpenVoucher?: () => void;
}

export const CustomerDocumentsModal: React.FC<CustomerDocumentsModalProps> = ({
  isOpen,
  onClose,
  booking,
  allBookings = [],
  intakeRequests = [],
  settings,
  onOpenSendPaymentLink,
  onOpenVoucher
}) => {
  const [isAgreementViewerOpen, setIsAgreementViewerOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen || !booking) return null;

  const isTraining = booking.serviceType === 'training';
  const isTrainingSigned = Boolean(
    booking.isTrainingAgreementSigned || 
    booking.trainingAgreement?.ownerSignatureDataUrl || 
    (booking as any).trainingAgreementSignedAt
  );
  const isBoardingSigned = Boolean(
    booking.isBoardingAgreementSigned || 
    (booking as any).boardingAgreement?.ownerSignatureDataUrl ||
    (booking as any).boardingAgreementSignedAt
  );

  const isAgreementSigned = isTraining ? isTrainingSigned : isBoardingSigned;
  const agreementData = isTraining ? booking.trainingAgreement : (booking as any).boardingAgreement;
  const signedAt = isTraining ? booking.trainingAgreementSignedAt : (booking as any).boardingAgreementSignedAt;

  // Matching Intake Request
  const cleanPhone = cleanPhoneNumber(booking.ownerPhone);
  const phoneSuffix = cleanPhone.slice(-7);
  const matchedIntake = (intakeRequests || []).find(r => {
    const rPhone = cleanPhoneNumber(r.ownerPhone);
    return rPhone && phoneSuffix && rPhone.slice(-7) === phoneSuffix;
  });

  // Matching Daycare Pass
  const matchedPass = booking.daycarePassCode 
    ? findDaycarePassByCode(booking.daycarePassCode, settings.daycare_passes)
    : null;

  const daysCount = Math.max(1, calculateDaysCount(booking.startDate, booking.endDate));
  const remainingDebt = Math.max(0, Math.round((booking.totalPrice || 0) - (booking.depositAmount || 0)));

  const handleCopyAgreementLink = () => {
    const url = `${window.location.origin}/?agreement=true&type=${isTraining ? 'training' : 'boarding'}&bookingId=${booking.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendAgreementWhatsApp = () => {
    const url = `${window.location.origin}/?agreement=true&type=${isTraining ? 'training' : 'boarding'}&bookingId=${booking.id}`;
    const text = `שלום ${booking.ownerName}! 🐾\nמצורף קישור ישיר ומאובטח לחתימה דיגיטלית על הסכם הריזורט עבור ${booking.dogName}:\n${url}\n\nנא לחתום במסך הנייד כדי שנוכל להשלים את התיעוד בתיק הלקוח. תודה! שמוליק וצוות הריזורט לכלב 🐶`;
    openWhatsAppMessage(booking.ownerPhone, text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-slate-200 overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-xl shrink-0">
              📁
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black">
                  תיק מסמכים והסכמים – {booking.dogName}
                </h3>
                <span className="text-xs bg-indigo-400/20 text-indigo-200 border border-indigo-300/30 px-2 py-0.5 rounded-full font-bold">
                  {isTraining ? 'אילוף' : 'פנסיון'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <span>בעלים: <strong>{booking.ownerName}</strong></span>
                <span>•</span>
                <span className="font-mono">{booking.ownerPhone}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer"
            title="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60">
          
          {/* Section 1: Digital Agreement */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h4 className="text-sm font-black text-slate-900">
                  הסכם {isTraining ? 'אילוף' : 'אירוח בפנסיון'} חתום דיגיטלית
                </h4>
              </div>

              {isAgreementSigned ? (
                <span className="bg-emerald-100 text-emerald-950 font-black text-xs px-2.5 py-1 rounded-full border border-emerald-300 flex items-center gap-1 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>נחתם דיגיטלית ✓</span>
                </span>
              ) : (
                <span className="bg-rose-100 text-rose-900 font-black text-xs px-2.5 py-1 rounded-full border border-rose-300 flex items-center gap-1 shadow-2xs">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>טרם נחתם הסכם</span>
                </span>
              )}
            </div>

            {isAgreementSigned ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  <div>
                    <span className="text-slate-500 block">מועד חתימה:</span>
                    <strong className="text-slate-900 font-mono">
                      {signedAt ? formatDateIL(signedAt) : 'מאומת בתיק'}
                    </strong>
                  </div>
                  {agreementData?.ownerIdNumber && (
                    <div>
                      <span className="text-slate-500 block">מספר ת.ז. חותם:</span>
                      <strong className="text-slate-900 font-mono">{agreementData.ownerIdNumber}</strong>
                    </div>
                  )}
                </div>

                {agreementData?.ownerSignatureDataUrl && (
                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">
                      חתימת הלקוח המאומתת:
                    </span>
                    <div className="bg-white rounded-lg p-2 border border-slate-200 inline-block">
                      <img
                        src={agreementData.ownerSignatureDataUrl}
                        alt="חתימת לקוח"
                        className="h-12 w-auto object-contain"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAgreementViewerOpen(true)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    <span>צפה בהסכם המלא / הדפס PDF 📄</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyAgreementLink}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-98"
                    title="העתק קישור להסכם"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'הועתק!' : 'העתק קישור'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  לפי נהלי הריזורט, יש לוודא חתימת הסכם שהייה/אילוף לפני קליטת הכלב או הסדרת התשלום הסופי.
                </p>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsAgreementViewerOpen(true)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <Signature className="w-4 h-4" />
                    <span>חתום כעת במקום ✍️</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendAgreementWhatsApp}
                    className="flex-1 bg-[#25D366] hover:bg-[#1EBE5D] active:scale-98 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>שלח קישור לחתימה בוואטסאפ 📲</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Intake Questionnaire & Health Declaration */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Dog className="w-5 h-5 text-amber-600" />
                <h4 className="text-sm font-black text-slate-900">
                  שאלון קליטה, הצהרת בריאות ומדיה
                </h4>
              </div>

              {matchedIntake ? (
                <span className="bg-amber-100 text-amber-950 font-bold text-xs px-2.5 py-0.5 rounded-full border border-amber-300">
                  שאלון מתועד ✓
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-medium">
                  לא אותר שאלון מקושר
                </span>
              )}
            </div>

            {matchedIntake ? (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60">
                  <div>
                    <span className="text-slate-500 block">חיסונים בתוקף:</span>
                    <strong className="text-slate-900 font-bold">
                      {matchedIntake.isVaccinated ? '✓ מחוסן' : 'טרם עודכן'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">סירוס / עיקור:</span>
                    <strong className="text-slate-900 font-bold">
                      {matchedIntake.isNeutered ? '✓ מסורס/מעוקרת' : 'לא'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ידידותי לכלבים:</span>
                    <strong className="text-slate-900 font-bold">
                      {matchedIntake.isFriendlyWithDogs === 'yes' ? '✓ ידידותי' : matchedIntake.isFriendlyWithDogs === 'no' ? '⚠️ לא ידידותי' : 'תלוי בכלב'}
                    </strong>
                  </div>
                </div>

                {(matchedIntake.specialNeeds || matchedIntake.notes) && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800">
                    <span className="font-bold text-slate-900 block mb-0.5">דגשים בריאותיים והערות:</span>
                    <p className="whitespace-pre-wrap">{matchedIntake.specialNeeds || matchedIntake.notes}</p>
                  </div>
                )}

                {/* Media Preview */}
                {(matchedIntake.dogPhotoUrl || (matchedIntake.dogMediaList && matchedIntake.dogMediaList.length > 0)) && (
                  <div className="pt-1">
                    <span className="text-[11px] font-bold text-slate-600 block mb-1.5 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                      <span>תמונות הכלב משאלון הקליטה:</span>
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {matchedIntake.dogPhotoUrl && (
                        <img
                          src={matchedIntake.dogPhotoUrl}
                          alt={booking.dogName}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 hover:scale-105 transition-transform cursor-pointer shadow-2xs"
                          onClick={() => window.open(matchedIntake.dogPhotoUrl, '_blank')}
                        />
                      )}
                      {matchedIntake.dogMediaList?.map((m, idx) => (
                        <img
                          key={idx}
                          src={m.url}
                          alt={`תמונה ${idx + 1}`}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 hover:scale-105 transition-transform cursor-pointer shadow-2xs"
                          onClick={() => window.open(m.url, '_blank')}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-600">שאלון הקליטה טרם מולא במערכת.</span>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/?request=true&phone=${booking.ownerPhone}&name=${encodeURIComponent(booking.ownerName)}`;
                    openWhatsAppMessage(booking.ownerPhone, `שלום ${booking.ownerName}! 🐾\nלקראת השהייה של ${booking.dogName} בריזורט, אנא מלא/י את שאלון הקליטה והצהרת הבריאות בקישור:\n${url}\n\nשמוליק וצוות הריזורט לכלב 🐶`);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer text-[11px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>שלח שאלון בוואטסאפ</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 3: Payments & Invoices */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <h4 className="text-sm font-black text-slate-900">
                  קבלות, תשלומים ואישורי Grow / Bit
                </h4>
              </div>

              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                booking.isFreeStay 
                  ? 'bg-emerald-100 text-emerald-950'
                  : remainingDebt === 0 
                  ? 'bg-green-100 text-green-950' 
                  : 'bg-red-100 text-red-950'
              }`}>
                {booking.isFreeStay ? 'אירוח ללא תשלום (חינם)' : remainingDebt === 0 ? 'שולם במלואו ✓' : `חוב: ₪${remainingDebt}`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block">סך לתשלום:</span>
                <strong className="text-slate-900 font-bold">₪{booking.totalPrice || 0}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">מקדמה ששולמה:</span>
                <strong className="text-emerald-700 font-bold">₪{booking.depositAmount || 0}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">יתרת חוב:</span>
                <strong className={remainingDebt > 0 ? 'text-rose-600 font-black' : 'text-slate-900 font-bold'}>
                  ₪{remainingDebt}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">אמצעי תשלום:</span>
                <strong className="text-slate-900 font-bold">
                  {booking.paymentMethod === 'grow' ? 'Grow / אשראי' : booking.paymentMethod === 'bit' ? 'Bit' : booking.paymentMethod === 'cash' ? 'מזומן' : 'Grow / Bit'}
                </strong>
              </div>
            </div>

            {onOpenSendPaymentLink && (
              <button
                type="button"
                onClick={onOpenSendPaymentLink}
                className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-emerald-700" />
                <span>הפק קישור תשלום Grow / Bit ללקוח 💳</span>
              </button>
            )}
          </div>

          {/* Section 4: Daycare Pass / VIP Vouchers */}
          {(matchedPass || onOpenVoucher) && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-amber-600" />
                  <h4 className="text-sm font-black text-slate-900">
                    מועדון VIP, כרטיסיות ושוברי מתנה
                  </h4>
                </div>
              </div>

              {matchedPass && (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-amber-950 block">כרטיסייה פעילה #{matchedPass.passCode}</span>
                    <span className="text-slate-600 text-[11px]">יתרה לניצול: {matchedPass.totalDays - matchedPass.usedDays} מתוך {matchedPass.totalDays} ימים</span>
                  </div>
                  <span className="font-black text-amber-800 text-xs bg-amber-200/70 px-2 py-0.5 rounded-lg">
                    כרטיסייה בתוקף ✓
                  </span>
                </div>
              )}

              {onOpenVoucher && (
                <button
                  type="button"
                  onClick={onOpenVoucher}
                  className="w-full bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>הפק שובר מתנה / הטבת VIP ללקוח חוזר 🎁</span>
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Embedded Agreement Full Viewer & Signing Modal */}
      {isAgreementViewerOpen && (
        <TrainingAgreementModal
          isOpen={true}
          onClose={() => setIsAgreementViewerOpen(false)}
          booking={booking}
          agreementType={isTraining ? 'training' : 'boarding'}
          settings={settings}
          onAgreementSigned={() => {
            setIsAgreementViewerOpen(false);
          }}
        />
      )}
    </div>
  );
};
