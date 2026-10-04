import React, { useState, useEffect } from 'react';
import { X, QrCode, Smartphone, RefreshCw, CheckCircle, AlertCircle, ShieldAlert, Sparkles, ExternalLink } from 'lucide-react';
import { ResortSettings } from '../types';

interface LinkDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: ResortSettings;
}

export const LinkDeviceModal: React.FC<LinkDeviceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [state, setState] = useState<'authorized' | 'notAuthorized' | 'loading'>('loading');
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState('0548765888');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'code'>('qr');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/link-device?json=true');
      if (res.ok) {
        const data = await res.json();
        setState(data.state === 'authorized' ? 'authorized' : 'notAuthorized');
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
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleRequestPhoneCode = async () => {
    setErrorMsg(null);
    setIsGeneratingCode(true);
    try {
      const clean = phoneInput.replace(/\D/g, '');
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
          setErrorMsg('לא התקבל קוד, נסה שוב או סרוק ברקוד.');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white">חיבור וואטסאפ הריזורט 🐾</h3>
              <p className="text-xs text-slate-400">מספר המכשיר: <strong className="text-white font-mono">054-8765888</strong></p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          
          {/* Status Pill */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${state === 'authorized' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-ping'}`} />
              <span className="font-bold">
                {state === 'authorized' ? 'הוואטסאפ מחובר ופעיל! 🎉' : 'הוואטסאפ מנותק כרגע – נדרש חיבור'}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchStatus}
              className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="רענן מצב חיבור"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {state === 'authorized' ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle className="w-9 h-9" />
              </div>
              <h4 className="font-black text-lg text-emerald-400">חיבור הוואטסאפ תקין ומאומת!</h4>
              <p className="text-xs text-slate-300 max-w-xs mx-auto">
                כל ההודעות האוטומטיות, דוחות השפיות (18:30) ועדכוני ההורים (20:00) יוצאים כסדרם.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all cursor-pointer shadow-md"
              >
                סגור חלון
              </button>
            </div>
          ) : (
            <>
              {/* Tab Selector: QR Scan vs 8-digit Code */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('qr')}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'qr' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>סריקת ברקוד QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('code')}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'code' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>חיבור עם קוד 8 ספרות</span>
                </button>
              </div>

              {activeTab === 'qr' ? (
                <div className="text-center space-y-3">
                  <div className="bg-white p-3 rounded-2xl inline-block shadow-lg mx-auto min-w-[210px] min-h-[210px] flex items-center justify-center">
                    {qrBase64 ? (
                      <img
                        src={`data:image/png;base64,${qrBase64}`}
                        alt="WhatsApp QR Code"
                        className="w-48 h-48 rounded-lg block"
                      />
                    ) : (
                      <div className="text-slate-400 text-xs flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                        <span>טוען ברקוד עדכני...</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right text-xs bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-slate-300 space-y-1">
                    <div className="font-bold text-emerald-400">איך מחברים ב-10 שניות:</div>
                    <div>1. פותחים וואטסאפ בטלפון <strong>054-8765888</strong></div>
                    <div>2. לוחצים על <strong>3 נקודות</strong> ➔ <strong>מכשירים מקושרים</strong></div>
                    <div>3. לוחצים <strong>"קשר מכשיר"</strong> ומכוונים לברקוד למעלה!</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 space-y-2 text-xs">
                    <label className="font-bold text-indigo-300 block">מספר הטלפון של הריזורט לחיבור:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={phoneInput}
                        onChange={e => setPhoneInput(e.target.value)}
                        placeholder="0548765888"
                        className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm font-mono flex-1 outline-hidden focus:border-indigo-500"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={handleRequestPhoneCode}
                        disabled={isGeneratingCode}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-3 py-2 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                      >
                        {isGeneratingCode ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>קבל קוד</span>
                      </button>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {phoneCode && (
                    <div className="bg-gradient-to-br from-indigo-950/80 to-purple-950/80 border border-indigo-700/60 rounded-2xl p-4 text-center space-y-2 animate-in zoom-in-95 duration-150">
                      <div className="text-xs text-indigo-200 font-bold">הקוד להזנה בוואטסאפ:</div>
                      <div className="font-mono text-3xl sm:text-4xl font-black text-amber-300 tracking-wider select-all" dir="ltr">
                        {phoneCode}
                      </div>
                      <p className="text-[11px] text-slate-300">
                        בוואטסאפ של שמוליק: <strong>מכשירים מקושרים ➔ קשר מכשיר ➔ קישור באמצעות מספר טלפון</strong> והזן את הקוד הנ"ל.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};
