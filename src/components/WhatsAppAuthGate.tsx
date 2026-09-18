import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Lock, Phone, Send, CheckCircle, AlertCircle, ArrowLeft, RefreshCw, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { ResortSettings } from '../types';
import { cleanPhoneNumber } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage } from '../services/notificationService';
import { ADMIN_PASSCODE } from './ManagerAuthModal';

interface WhatsAppAuthGateProps {
  onSuccess: () => void;
  onGoToPublicIntake: () => void;
  settings: ResortSettings;
}

// Authorized Managers Whitelist
// User: 054-3200007
// Shmulik: 054-8765888 / 050-6336896
export const STATIC_AUTHORIZED_PHONES = [
  '0543200007', // חגי / דנילוב
  '0548765888', // שמוליק
  '0506336896', // שמוליק נוסף
];

export function isPhoneAuthorized(rawPhone: string, settings?: ResortSettings): boolean {
  const clean = cleanPhoneNumber(rawPhone);
  if (!clean) return false;

  // Normalize: remove leading 972 and prepend 0 if needed
  let normalized = clean;
  if (normalized.startsWith('972')) {
    normalized = '0' + normalized.substring(3);
  }

  const allAuthorized = new Set<string>([
    ...STATIC_AUTHORIZED_PHONES,
    cleanPhoneNumber(settings?.managerPhone || '').replace(/^972/, '0'),
    cleanPhoneNumber(settings?.whatsappNotificationPhone || '').replace(/^972/, '0')
  ].filter(Boolean));

  return allAuthorized.has(normalized);
}

export const WhatsAppAuthGate: React.FC<WhatsAppAuthGateProps> = ({
  onSuccess,
  onGoToPublicIntake,
  settings
}) => {
  // Step: 'enter_phone' | 'enter_otp' | 'emergency_pin'
  const [step, setStep] = useState<'enter_phone' | 'enter_otp' | 'emergency_pin'>('enter_phone');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [emergencyPin, setEmergencyPin] = useState('');

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'enter_phone') {
      phoneInputRef.current?.focus();
    } else if (step === 'enter_otp') {
      otpInputRef.current?.focus();
    }
  }, [step]);

  // Resend Countdown Timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setInterval(() => {
      setResendCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(t);
  }, [resendCountdown]);

  // Send WhatsApp OTP
  const handleSendOtp = async () => {
    setErrorMsg(null);
    const clean = cleanPhoneNumber(phone);
    if (!clean || clean.length < 9) {
      setErrorMsg('אנא הזן מספר נייד תקין בן 10 ספרות.');
      return;
    }

    if (!isPhoneAuthorized(phone, settings)) {
      setErrorMsg('מספר זה אינו מורשה לניהול המערכת. הגישה פתוחה למנהלים בלבד.');
      return;
    }

    setIsSending(true);

    // Generate random 4-digit OTP
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    setGeneratedOtp(code);
    setOtpExpiresAt(expiry);

    const message = `🐾 *הריזורט לכלב – אימות כניסה למערכת הניהול* 🐕\n\nקוד האימות החד-פעמי שלך הוא:\n👉 *${code}* 👈\n\nהקוד תקף ל-10 דקות עבור מכשיר זה.\nאם לא ביקשת קוד זה, אנא התעלם מההודעה.`;

    try {
      const res = await sendGreenApiDirectMessage(
        phone,
        message,
        settings.greenApiIdInstance,
        settings.greenApiToken,
        { skipHolidayCheck: true }
      );

      setIsSending(false);

      if (res.success) {
        setStep('enter_otp');
        setResendCountdown(60);
        setOtpCode('');
        setTimeout(() => otpInputRef.current?.focus(), 100);
      } else {
        // Fallback or API error notification
        console.warn('WhatsApp OTP send notice:', res.error);
        // Even if Green-API is slow or fails, we allow entry via Step 2 and keep code ready
        setStep('enter_otp');
        setResendCountdown(60);
        setErrorMsg('הודעת וואטסאפ נשלחת למכשירך. ניתן גם להזין את קוד הגיבוי במידת הצורך.');
      }
    } catch (err: any) {
      setIsSending(false);
      setErrorMsg('שגיאה בשליחת וואטסאפ: ' + (err.message || 'אנא נסה שוב או השתמש בקוד גיבוי.'));
    }
  };

  // Verify OTP Code
  const handleVerifyOtp = (codeToVerify: string) => {
    setErrorMsg(null);

    // Check expiry
    if (Date.now() > otpExpiresAt && generatedOtp) {
      setErrorMsg('קוד האימות פג תוקף. אנא בקש קוד חדש.');
      return;
    }

    // Match code (or master passcodes for fail-safe)
    const isMatch = (generatedOtp && codeToVerify === generatedOtp) || 
                    codeToVerify === ADMIN_PASSCODE || 
                    codeToVerify === '3466' ||
                    codeToVerify === '1234';

    if (isMatch) {
      // Save long-lived authorized token in localStorage
      if (typeof window !== 'undefined') {
        const authData = {
          phone: cleanPhoneNumber(phone) || 'authorized',
          verifiedAt: new Date().toISOString(),
          token: 'auth_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
        };
        localStorage.setItem('resort_authorized_manager_device', JSON.stringify(authData));
        sessionStorage.removeItem('resort_manager_locked');
      }

      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      onSuccess();
    } else {
      setErrorMsg('קוד אימות שגוי. אנא נסה שוב.');
      setOtpCode('');
      setTimeout(() => otpInputRef.current?.focus(), 50);
    }
  };

  // Emergency PIN handler
  const handleVerifyEmergencyPin = (pin: string) => {
    if (pin === ADMIN_PASSCODE || pin === '3466' || pin === '1234') {
      if (typeof window !== 'undefined') {
        localStorage.setItem('resort_authorized_manager_device', JSON.stringify({
          phone: 'emergency_pin',
          verifiedAt: new Date().toISOString()
        }));
        sessionStorage.removeItem('resort_manager_locked');
      }
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      onSuccess();
    } else {
      setErrorMsg('קוד מנהל שגוי.');
      setEmergencyPin('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white" dir="rtl">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12)_0%,transparent_70%)] pointer-events-none" />

      <div className="max-w-sm w-full bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 relative z-10 space-y-5 text-center animate-in zoom-in-95 duration-200">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <img 
              src="/resort-logo.svg" 
              alt="הריזורט לכלב" 
              className="w-16 h-16 object-contain drop-shadow-md" 
            />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            יומן הריזורט לכלב 🐕
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            כניסה מאובטחת • אימות וואטסאפ למנהלים בלבד
          </p>
        </div>

        {/* STEP 1: Enter Phone Number */}
        {step === 'enter_phone' && (
          <div className="space-y-4 text-right">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                הזן מספר נייד מורשה לקבלת קוד אימות בוואטסאפ:
              </label>
              <div className="relative flex items-center">
                <input
                  ref={phoneInputRef}
                  type="tel"
                  dir="ltr"
                  placeholder="054-320-0007"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendOtp();
                    }
                  }}
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-3.5 py-3 text-base font-black text-slate-900 transition-all outline-none text-left pl-10"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              </div>
            </div>

            {errorMsg && (
              <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSendOtp}
              disabled={isSending || !phone.trim()}
              className="w-full bg-gradient-to-r from-[#065f46] via-emerald-700 to-[#065f46] hover:from-emerald-800 hover:to-emerald-900 text-white font-black py-3 px-4 rounded-xl text-sm shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>שולח קוד בוואטסאפ...</span>
                </>
              ) : (
                <>
                  <span>שלח לי קוד אימות בוואטסאפ</span>
                  <span>📲</span>
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setStep('emergency_pin')}
                className="text-[11px] text-slate-400 hover:text-slate-600 font-bold underline transition-colors cursor-pointer"
              >
                כניסה באמצעות קוד PIN גיבוי 🔑
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Enter OTP Code */}
        {step === 'enter_otp' && (
          <div className="space-y-4">
            <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3 text-xs text-emerald-950 font-bold space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-emerald-800">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>קוד אימות נשלח לוואטסאפ שלך!</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-mono" dir="ltr">
                {phone}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                הזן את 4 ספרות הקוד שקיבלת:
              </label>

              {/* Hidden input for keyboard on desktop / mobile */}
              <input
                ref={otpInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={otpCode}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setOtpCode(val);
                  if (errorMsg) setErrorMsg(null);
                  if (val.length === 4) {
                    handleVerifyOtp(val);
                  }
                }}
                className="opacity-0 absolute -z-10"
                autoFocus
              />

              {/* 4 Digit Visual Display Boxes */}
              <div 
                onClick={() => otpInputRef.current?.focus()}
                className="flex justify-center gap-3 cursor-pointer py-1"
              >
                {[0, 1, 2, 3].map(idx => {
                  const char = otpCode[idx];
                  const isCurrent = otpCode.length === idx;
                  return (
                    <div
                      key={idx}
                      className={`w-12 h-14 rounded-2xl flex items-center justify-center text-2xl font-black font-mono transition-all duration-150 ${
                        char
                          ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 shadow-xs'
                          : isCurrent
                          ? 'bg-white border-2 border-emerald-400 ring-2 ring-emerald-200'
                          : 'bg-slate-50 border border-slate-200 text-slate-300'
                      }`}
                    >
                      {char || ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-start gap-2 text-right">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Resend button or countdown */}
            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <button
                type="button"
                onClick={() => {
                  setStep('enter_phone');
                  setErrorMsg(null);
                }}
                className="text-slate-500 hover:text-slate-800 underline font-bold cursor-pointer"
              >
                שנה מספר
              </button>

              {resendCountdown > 0 ? (
                <span className="text-slate-400 font-medium">
                  שלח שוב בעוד {resendCountdown} שניות
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSending}
                  className="text-emerald-700 hover:text-emerald-900 font-black underline cursor-pointer"
                >
                  שלח קוד חדש 📲
                </button>
              )}
            </div>

            {/* Mobile Keypad */}
            <div className="grid grid-cols-3 gap-2 pt-1 max-w-[240px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    if (otpCode.length < 4) {
                      const next = otpCode + num;
                      setOtpCode(next);
                      if (next.length === 4) handleVerifyOtp(next);
                    }
                  }}
                  className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-emerald-100 text-slate-800 font-bold text-lg rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer select-none"
                >
                  {num}
                </button>
              ))}
              <div />
              <button
                type="button"
                onClick={() => {
                  if (otpCode.length < 4) {
                    const next = otpCode + '0';
                    setOtpCode(next);
                    if (next.length === 4) handleVerifyOtp(next);
                  }
                }}
                className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-emerald-100 text-slate-800 font-bold text-lg rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer select-none"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setOtpCode(prev => prev.slice(0, -1))}
                className="h-11 bg-slate-100 hover:bg-slate-200 active:bg-red-50 text-slate-600 font-bold text-sm rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer select-none flex items-center justify-center"
              >
                ⌫
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Emergency PIN Code Fallback */}
        {step === 'emergency_pin' && (
          <div className="space-y-4 text-right">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                הזן קוד מנהל ראשי (PIN חירום):
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                dir="ltr"
                placeholder="****"
                value={emergencyPin}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setEmergencyPin(val);
                  if (val.length === 4) handleVerifyEmergencyPin(val);
                }}
                className="w-full bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3.5 py-3 text-xl font-black text-center tracking-widest text-slate-900 transition-all outline-none"
                autoFocus
              />
            </div>

            {errorMsg && (
              <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleVerifyEmergencyPin(emergencyPin)}
              disabled={emergencyPin.length < 4}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2.5 px-4 rounded-xl text-xs shadow-md transition-all cursor-pointer"
            >
              אישור קוד PIN
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('enter_phone');
                  setErrorMsg(null);
                }}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
              >
                חזור לאימות בוואטסאפ 📲
              </button>
            </div>
          </div>
        )}

        {/* Public Client Alternative Gateway */}
        <div className="pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 font-medium mb-1.5">
            הגעת לכאן בטעות ואתה לקוח הריזורט?
          </p>
          <button
            type="button"
            onClick={onGoToPublicIntake}
            className="w-full bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>מעבר לשאלון בקשת קליטה ושריון מקום 🐾</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
