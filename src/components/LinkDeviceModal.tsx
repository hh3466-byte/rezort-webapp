import React, { useState, useEffect } from 'react';
import { 
  X, 
  QrCode, 
  Smartphone, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  Copy, 
  Check, 
  Info, 
  BatteryCharging, 
  Zap,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { ResortSettings } from '../types';

interface LinkDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: ResortSettings;
  onReconnected?: () => void;
}

export const LinkDeviceModal: React.FC<LinkDeviceModalProps> = ({
  isOpen,
  onClose,
  onReconnected,
}) => {
  const [state, setState] = useState<'authorized' | 'notAuthorized' | 'loading'>('loading');
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState('0548765888');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'qr'>('code'); // Default to code for easiest mobile reconnect
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/link-device?json=true');
      if (res.ok) {
        const data = await res.json();
        const isAuth = data.state === 'authorized';
        setState(prev => {
          if (prev === 'notAuthorized' && isAuth) {
            onReconnected?.();
          }
          return isAuth ? 'authorized' : 'notAuthorized';
        });
        if (data.qrBase64) {
          setQrBase64(data.qrBase64);
        }
      }
    } catch (e) {
      console.warn('Could not fetch link-device status', e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchStatus();
    // Auto request phone code on modal open if not generated yet
    handleRequestPhoneCode();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleRequestPhoneCode = async () => {
    setErrorMsg(null);
    setIsGeneratingCode(true);
    try {
      const clean = (phoneInput || '0548765888').replace(/\D/g, '');
      const fullPhone = clean.startsWith('972') ? clean : '972' + (clean.startsWith('0') ? clean.slice(1) : clean);
      
      const cluster = '7107';
      const idInstance = '710722735421';
      const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

      const res = await fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/getAuthorizationCode/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: Number(fullPhone) })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.code) {
          setPhoneCode(data.code);
        } else {
          setErrorMsg('לא התקבל קוד, ניתן לסרוק את הברקוד בלשונית סריקה.');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.message || 'שגיאה בקבלת קוד אימות.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'שגיאת תקשורת עם שרת הוואטסאפ.');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (!phoneCode) return;
    navigator.clipboard.writeText(phoneCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner ${
              state === 'authorized' 
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                : 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse'
            }`}>
              {state === 'authorized' ? <ShieldCheck className="w-7 h-7" /> : <Smartphone className="w-7 h-7" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                  state === 'authorized' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {state === 'authorized' ? 'מחובר ותקין' : 'דרוש חיבור מחדש'}
                </span>
                <h3 className="font-black text-lg text-white">חיבור וואטסאפ הריזורט 🐾</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                טלפון הריזורט לחיבור: <strong className="text-white font-mono">054-8765888</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="סגור חלון"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          
          {/* Live Status Pill */}
          <div className={`flex items-center justify-between p-3.5 rounded-2xl border text-xs font-bold ${
            state === 'authorized'
              ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
              : 'bg-rose-950/40 border-rose-600/50 text-rose-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full shrink-0 ${state === 'authorized' ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'}`} />
              <span>
                {state === 'authorized' 
                  ? 'הוואטסאפ מחובר ופעיל! כל ההודעות והדוחות יוצאים כסדרם 🚀' 
                  : 'הוואטסאפ מנותק כרגע – בצע חיבור מהיר לפי ההוראות למטה'}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchStatus}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="בדוק סטטוס כעת"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {state === 'authorized' ? (
            /* Connected Celebration View */
            <div className="text-center py-6 space-y-3 bg-slate-950/50 border border-slate-800 rounded-3xl p-6">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-950">
                <CheckCircle className="w-9 h-9" />
              </div>
              <h4 className="font-black text-xl text-emerald-400">החיבור הושלם בהצלחה! 🎉</h4>
              <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                וואטסאפ הריזורט מקושר ומסונכרן. דוחות שפיות יומית (18:30), סקירת מחר (19:00) וד״ש להורים (20:00) יישלחו אוטומטית.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-sm py-3 px-8 rounded-2xl transition-all cursor-pointer shadow-lg shadow-emerald-900/40"
              >
                סגור וחזור למערכת
              </button>
            </div>
          ) : (
            /* Disconnected Reconnect Steps */
            <>
              {/* Tab Selector: 8-Digit Phone Code vs QR Barcode */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('code')}
                  className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'code' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>קוד 8 ספרות (הכי קל בנייד!)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('qr')}
                  className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'qr' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>סריקת ברקוד QR (ממחשב)</span>
                </button>
              </div>

              {activeTab === 'code' ? (
                /* OPTION 1: 8-DIGIT CODE INSTRUCTIONS */
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  
                  {/* Generated Code Display Box */}
                  <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 border-2 border-indigo-500/50 rounded-2xl p-4 text-center space-y-2 shadow-lg">
                    <div className="flex items-center justify-between text-xs text-indigo-300 font-bold px-1">
                      <span>🔑 קוד האימות של הריזורט:</span>
                      <button
                        type="button"
                        onClick={handleRequestPhoneCode}
                        disabled={isGeneratingCode}
                        className="text-[11px] text-indigo-400 hover:text-indigo-200 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isGeneratingCode ? 'animate-spin' : ''}`} />
                        <span>רענן קוד חדש</span>
                      </button>
                    </div>

                    {isGeneratingCode ? (
                      <div className="py-4 flex items-center justify-center gap-2 text-indigo-300 text-sm">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>יוצר קוד אימות חדש מוואטסאפ...</span>
                      </div>
                    ) : phoneCode ? (
                      <div className="space-y-2">
                        <div 
                          onClick={handleCopyCode}
                          className="font-mono text-3xl sm:text-4xl font-black text-amber-300 tracking-widest bg-black/40 py-2.5 px-4 rounded-xl border border-white/10 select-all cursor-pointer hover:border-amber-400/50 transition-colors flex items-center justify-center gap-3"
                          dir="ltr"
                        >
                          <span>{phoneCode}</span>
                          {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {copiedCode ? '✅ הקוד הועתק!' : '💡 לחץ על הקוד להעתקה מהירה'}
                        </p>
                      </div>
                    ) : (
                      <div className="py-3 text-xs text-slate-400">
                        {errorMsg || 'לחץ על "רענן קוד חדש" לקבלת קוד'}
                      </div>
                    )}
                  </div>

                  {/* 4 Step Visual Guide for Shmulik */}
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs text-slate-200">
                    <div className="font-black text-sm text-indigo-400 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>איך מחברים בטלפון של שמוליק (4 צעדים פשוטים):</span>
                    </div>

                    <ol className="space-y-2 pr-4 list-decimal marker:text-indigo-400 marker:font-black leading-relaxed">
                      <li>
                        פותחים <strong>WhatsApp</strong> בטלפון הריזורט (<strong>054-8765888</strong>).
                      </li>
                      <li>
                        לוחצים על <strong>3 נקודות</strong> (למעלה בצד) ➔ <strong>מכשירים מקושרים</strong> (Linked Devices).
                      </li>
                      <li>
                        לוחצים על הכפתור הירוק <strong>"קשר מכשיר"</strong> ➔ ואז למטה על <strong>"קישור באמצעות מספר טלפון"</strong> (Link with phone number instead).
                      </li>
                      <li>
                        מקלידים את <strong className="text-amber-300 font-mono">{phoneCode || '8 הספרות שלמעלה'}</strong> – וזהו, מחובר מיד!
                      </li>
                    </ol>
                  </div>

                </div>
              ) : (
                /* OPTION 2: QR BARCODE SCANNING */
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div className="bg-white p-3.5 rounded-2xl inline-block shadow-xl mx-auto min-w-[220px] min-h-[220px] flex items-center justify-center">
                    {qrBase64 ? (
                      <img
                        src={`data:image/png;base64,${qrBase64}`}
                        alt="WhatsApp QR Code"
                        className="w-52 h-52 rounded-lg block"
                      />
                    ) : (
                      <div className="text-slate-500 text-xs flex flex-col items-center gap-2 p-6">
                        <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
                        <span className="font-bold">טוען ברקוד QR עדכני...</span>
                      </div>
                    )}
                  </div>

                  {/* 3 Step QR Guide */}
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs text-slate-200 text-right">
                    <div className="font-black text-sm text-emerald-400 flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-emerald-400" />
                      <span>סריקה במצלמת הטלפון:</span>
                    </div>
                    <ol className="space-y-1.5 pr-4 list-decimal marker:text-emerald-400 marker:font-black">
                      <li>פותחים וואטסאפ בטלפון <strong>054-8765888</strong>.</li>
                      <li>לוחצים <strong>3 נקודות</strong> ➔ <strong>מכשירים מקושרים</strong> ➔ <strong>קשר מכשיר</strong>.</li>
                      <li>מכוונים את מצלמת הטלפון לברקוד שלמעלה!</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* BATTERY OPTIMIZATION TIP (Crucial for Shmulik) */}
              <div className="bg-amber-950/30 border border-amber-600/40 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-amber-200">
                <BatteryCharging className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 block mb-0.5">💡 טיפ זהב למניעת ניתוקים בעתיד בטלפון של שמוליק:</strong>
                  <span>
                    כדי שהוואטסאפ לא יתנתק שוב כשהטלפון ננעל: היכנס בטלפון ל-<strong>הגדרות ➔ יישומים (Apps) ➔ WhatsApp ➔ סוללה ➔ בחר 'ללא הגבלה' (Unrestricted)</strong>.
                  </span>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
