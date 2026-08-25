import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Save, 
  Building, 
  Phone, 
  DollarSign, 
  MessageSquare, 
  ShieldAlert, 
  Download, 
  Upload, 
  RotateCcw,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { ResortSettings, Booking } from '../types';
import { exportDataAsJSON, importDataFromJSON } from '../utils/exportUtils';
import { ExtremeChangeModal, ExtremeChangeImpact } from './ExtremeChangeModal';
import { ManagerAuthModal } from './ManagerAuthModal';

interface SettingsModalProps {
  settings: ResortSettings;
  bookings: Booking[];
  onClose: () => void;
  onSaveSettings: (newSettings: ResortSettings) => void;
  onRestoreBookings: (importedBookings: Booking[]) => void;
  onClearAllData?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  bookings,
  onClose,
  onSaveSettings,
  onRestoreBookings,
  onClearAllData,
}) => {
  const [formData, setFormData] = useState<ResortSettings>(() => {
    const s = { ...settings };
    if (!s.defaultDailyRateTraining || Number(s.defaultDailyRateTraining) < 1000) {
      s.defaultDailyRateTraining = 6500;
    }
    if (!s.defaultDailyRateDayTraining || Number(s.defaultDailyRateDayTraining) <= 0) {
      s.defaultDailyRateDayTraining = 250;
    }
    return s;
  });

  useEffect(() => {
    setFormData(prev => {
      const s = { ...prev, ...settings };
      if (!s.defaultDailyRateTraining || Number(s.defaultDailyRateTraining) < 1000) {
        s.defaultDailyRateTraining = 6500;
      }
      if (!s.defaultDailyRateDayTraining || Number(s.defaultDailyRateDayTraining) <= 0) {
        s.defaultDailyRateDayTraining = 250;
      }
      return s;
    });
  }, [settings]);
  const [activeTab, setActiveTab] = useState<'general' | 'rates' | 'whatsapp' | 'backup'>('general');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [extremeAlert, setExtremeAlert] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    impacts: ExtremeChangeImpact[];
    severity?: 'warning' | 'danger';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    impacts: [],
    onConfirm: () => {}
  });

  const [managerAuthAction, setManagerAuthAction] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onSuccess: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onSuccess: () => {}
  });

  const executeSave = (newSettings: ResortSettings) => {
    onSaveSettings(newSettings);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const impacts: ExtremeChangeImpact[] = [];

    // 1. Training rate change
    const oldTraining = settings.defaultDailyRateTraining || 6500;
    const newTraining = Number(formData.defaultDailyRateTraining) || 6500;
    if (newTraining !== oldTraining && (newTraining < 2000 || newTraining > 20000 || Math.abs(newTraining - oldTraining) >= 2000)) {
      impacts.push({
        label: '🎓 מחיר תהליך אילוף (70 יום)',
        oldValue: `₪${oldTraining.toLocaleString()}`,
        newValue: `₪${newTraining.toLocaleString()}`
      });
    }

    // 2. Boarding rate change (> 50% change or < 50 or > 1000)
    const oldBoarding = settings.defaultDailyRateBoarding || 180;
    const newBoarding = Number(formData.defaultDailyRateBoarding) || 180;
    if (newBoarding !== oldBoarding && (newBoarding < 50 || newBoarding > 1000 || Math.abs(newBoarding - oldBoarding) >= 70)) {
      impacts.push({
        label: '🏨 מחיר יומי לפנסיון לינה',
        oldValue: `₪${oldBoarding}`,
        newValue: `₪${newBoarding}`
      });
    }

    // 3. Day Training rate change
    const oldDayTraining = settings.defaultDailyRateDayTraining || 250;
    const newDayTraining = Number(formData.defaultDailyRateDayTraining) || 250;
    if (newDayTraining !== oldDayTraining && (newDayTraining < 50 || newDayTraining > 1500 || Math.abs(newDayTraining - oldDayTraining) >= 100)) {
      impacts.push({
        label: '🦮 מחיר אילוף ביומיות (ללא לינה)',
        oldValue: `₪${oldDayTraining}`,
        newValue: `₪${newDayTraining}`
      });
    }

    // 4. Capacity change
    const oldCapacity = settings.maxCapacity || 12;
    const newCapacity = Number(formData.maxCapacity) || 12;
    if (newCapacity !== oldCapacity && (newCapacity < 4 || newCapacity > 60 || Math.abs(newCapacity - oldCapacity) >= 6)) {
      impacts.push({
        label: '🏢 תפוסת שיא בריזורט (מספר כלבים מקסימלי)',
        oldValue: `${oldCapacity} כלבים`,
        newValue: `${newCapacity} כלבים`
      });
    }

    if (impacts.length > 0) {
      setExtremeAlert({
        isOpen: true,
        title: '⚠️ שים לב: זוהה שינוי תעריפים / הגדרות משמעותי',
        description: 'המערכת זיהתה שהערכים שהזנת שונים באופן ניכר מתעריפי ברירת המחדל הקודמים. אנא ודא שהמספרים מדויקים לפני השמירה.',
        impacts,
        severity: 'warning',
        onConfirm: () => {
          setExtremeAlert(prev => ({ ...prev, isOpen: false }));
          executeSave(formData);
        }
      });
      return;
    }

    executeSave(formData);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await importDataFromJSON(file);
      if (data.bookings && Array.isArray(data.bookings)) {
        onRestoreBookings(data.bookings);
      }
      if (data.settings) {
        setFormData(data.settings);
        onSaveSettings(data.settings);
      }
      alert('הנתונים שוחזרו בהצלחה מתוך הקובץ!');
    } catch (err: any) {
      alert('שגיאה בקריאת קובץ הגיבוי: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full p-5 sm:p-6 text-slate-900 max-h-[92vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg sm:text-xl text-slate-900">
                הגדרות ריזורט ויומן
              </h3>
              <p className="text-xs text-slate-500">
                התאמת קיבולת, תעריפים, הודעות וואטסאפ וגיבוי נתונים
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="my-4 flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'general' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            🏢 כללי וקיבולת
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rates')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'rates' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            💰 תעריפי שירות
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'whatsapp' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            💬 תבניות וואטסאפ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'backup' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            💾 גיבוי ושחזור
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Tab 1: General & Capacity */}
          {activeTab === 'general' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-700 font-bold block mb-1">
                    שם הריזורט / הפנסיון
                  </label>
                  <input
                    type="text"
                    value={formData.resortName}
                    onChange={(e) => setFormData({ ...formData, resortName: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-700 font-bold block mb-1">
                    שם מנהל / מאלף (שמוליק)
                  </label>
                  <input
                    type="text"
                    value={formData.managerName}
                    onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Max Capacity Setting */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-emerald-950 font-extrabold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-emerald-600" />
                    קיבולת מקסימלית (מספר כלבים בו-זמנית בריזורט)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="2"
                      max="60"
                      value={formData.maxCapacity}
                      onChange={(e) => setFormData({ ...formData, maxCapacity: Math.max(1, Number(e.target.value)) })}
                      className="w-16 text-center font-black text-emerald-950 bg-white border-2 border-emerald-500 rounded-xl py-1 text-base shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <span className="text-xs font-bold text-emerald-900">כלבים</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-emerald-800 font-semibold ml-1">בחירה מהירה:</span>
                  {[10, 12, 14, 16, 18, 20, 25].map(cap => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setFormData({ ...formData, maxCapacity: cap })}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        formData.maxCapacity === cap
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="2"
                  max="40"
                  value={formData.maxCapacity}
                  onChange={(e) => setFormData({ ...formData, maxCapacity: Number(e.target.value) })}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <p className="text-[11px] text-emerald-800">
                  כל ניסיון שריון מעבר למספר זה יציג התראת אובר-בוקינג אדומה ביומן ובתחזית.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-700 font-bold block mb-1">
                    קישור לתשלום בביט (Bit)
                  </label>
                  <input
                    type="text"
                    value={formData.bitPaymentLink || ''}
                    onChange={(e) => setFormData({ ...formData, bitPaymentLink: e.target.value })}
                    placeholder="https://bit.pay/..."
                    className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-700 font-bold block mb-1">
                    קישור לתשלום בפייבוקס (PayBox)
                  </label>
                  <input
                    type="text"
                    value={formData.payboxPaymentLink || ''}
                    onChange={(e) => setFormData({ ...formData, payboxPaymentLink: e.target.value })}
                    placeholder="https://payboxapp.page.link/..."
                    className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Service Rates */}
          {activeTab === 'rates' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 font-medium">
                תעריפי ברירת מחדל לחישוב אוטומטי בעת יצירת שריון:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <label className="text-xs text-sky-700 font-bold block mb-1">
                    🏨 פנסיון (מחיר ליום)
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-slate-500">₪</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.defaultDailyRateBoarding}
                      onChange={(e) => setFormData({ ...formData, defaultDailyRateBoarding: Number(e.target.value) })}
                      className="w-full bg-white text-slate-900 font-black text-sm p-2 rounded-lg border border-slate-200"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">אירוח מלא ולינה לפי מספר ימים</span>
                </div>

                <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                  <label className="text-xs text-amber-900 font-bold block mb-1">
                    🎓 תהליך אילוף (70 יום)
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-amber-600">₪</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.defaultDailyRateTraining}
                      onChange={(e) => setFormData({ ...formData, defaultDailyRateTraining: Number(e.target.value) })}
                      className="w-full bg-white text-slate-900 font-black text-sm p-2 rounded-lg border border-amber-300 focus:border-amber-500"
                    />
                  </div>
                  <span className="text-[10px] text-amber-800 font-semibold mt-1 block">מחיר קבוע לתהליך מלא (70 יום)</span>
                </div>

                <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200">
                  <label className="text-xs text-purple-900 font-bold block mb-1">
                    🦮 אילוף ביומיות (ללא לינה)
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-purple-600">₪</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.defaultDailyRateDayTraining || 250}
                      onChange={(e) => setFormData({ ...formData, defaultDailyRateDayTraining: Number(e.target.value) })}
                      className="w-full bg-white text-slate-900 font-black text-sm p-2 rounded-lg border border-purple-300 focus:border-purple-500"
                    />
                  </div>
                  <span className="text-[10px] text-purple-800 font-semibold mt-1 block">מחיר ליום אילוף (הגעה בבוקר וחזרה)</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <label className="text-xs text-green-700 font-bold block mb-1">
                    ✂️ יום כיף / שהות יומית
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-slate-500">₪</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.defaultDailyRateDaycare}
                      onChange={(e) => setFormData({ ...formData, defaultDailyRateDaycare: Number(e.target.value) })}
                      className="w-full bg-white text-slate-900 font-black text-sm p-2 rounded-lg border border-slate-200"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">מחיר ליום ללא לינה</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: WhatsApp Templates */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800 block mb-0.5">משתנים דינמיים שניתן לשלב:</span>
                <span className="font-mono text-green-700">
                  {'{שם_לקוח}'}, {'{שם_הכלב}'}, {'{סוג_שירות}'}, {'{תאריך_התחלה}'}, {'{תאריך_סיום}'}, {'{סכום_כולל}'}, {'{מקדמה}'}, {'{יתרה_לתשלום}'}, {'{שם_ריזורט}'}
                </span>
              </div>

              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  תבנית אישור הזמנה ושריון מקום
                </label>
                <textarea
                  rows={4}
                  value={formData.whatsappBookingConfirmationTemplate}
                  onChange={(e) => setFormData({ ...formData, whatsappBookingConfirmationTemplate: e.target.value })}
                  className="w-full bg-slate-50 text-slate-900 text-xs p-2.5 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none resize-none font-sans"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  תבנית תזכורת תשלום / גביית מקדמה ויתרה
                </label>
                <textarea
                  rows={4}
                  value={formData.whatsappPaymentReminderTemplate}
                  onChange={(e) => setFormData({ ...formData, whatsappPaymentReminderTemplate: e.target.value })}
                  className="w-full bg-slate-50 text-slate-900 text-xs p-2.5 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none resize-none font-sans"
                />
              </div>
            </div>
          )}

          {/* Tab 4: Backup & Restore */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Download className="w-4 h-4 text-green-600" />
                  גיבוי מלא של הנתונים (JSON)
                </h4>
                <p className="text-xs text-slate-500">
                  הורד קובץ גיבוי המכיל את כל ההזמנות, כרטיסי הלקוח וההגדרות של הריזורט.
                </p>
                <button
                  type="button"
                  onClick={() => exportDataAsJSON(bookings, formData)}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>הורד קובץ גיבוי למחשב/טלפון</span>
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  שחזור נתונים מקובץ גיבוי
                </h4>
                <p className="text-xs text-slate-500">
                  טען קובץ גיבוי קודם לשחזור מלא של היומן.
                </p>
                <label className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl border border-slate-200 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>בחר קובץ גיבוי (JSON)</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  ניקוי כל הנתונים (יומן נקי לגמרי)
                </h4>
                <p className="text-xs text-amber-700">
                  מחיקת כל ההזמנות הקיימות והתחלת יומן נקי לחלוטין לקראת הרצה אמיתית.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setExtremeAlert({
                      isOpen: true,
                      title: '🚨 אזהרה: מחיקת כל הנתונים ביומן',
                      description: 'פעולה זו תמחק לצמיתות את כל ההזמנות הקיימות בריזורט. פעולה זו אינה ניתנת לביטול לאחר ביצועה.',
                      impacts: [
                        {
                          label: 'הזמנות קיימות ביומן',
                          oldValue: `${bookings.length} הזמנות פעילות`,
                          newValue: '0 (יומן ריק ונקי)'
                        }
                      ],
                      severity: 'danger',
                      confirmText: 'המשך לאישור מנהל',
                      onConfirm: () => {
                        setExtremeAlert(prev => ({ ...prev, isOpen: false }));
                        setManagerAuthAction({
                          isOpen: true,
                          title: 'אישור מנהל למחיקת היומן 🔒',
                          description: 'פעולה רגישה: אנא הזן קוד מנהל לאישור מחיקה מלאה של היומן:',
                          onSuccess: () => {
                            setManagerAuthAction(prev => ({ ...prev, isOpen: false }));
                            if (onClearAllData) onClearAllData();
                            onClose();
                          }
                        });
                      }
                    });
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  נקה את כל היומן עכשיו
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
            >
              סגור
            </button>

            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>נשמר בהצלחה!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>שמור הגדרות</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>

      {/* Extreme Change Confirmation Dialog */}
      <ExtremeChangeModal
        isOpen={extremeAlert.isOpen}
        title={extremeAlert.title}
        description={extremeAlert.description}
        impacts={extremeAlert.impacts}
        severity={extremeAlert.severity}
        confirmText={extremeAlert.confirmText}
        cancelText={extremeAlert.cancelText}
        onConfirm={extremeAlert.onConfirm}
        onCancel={() => setExtremeAlert(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Manager Authentication Modal for Critical Actions */}
      <ManagerAuthModal
        isOpen={managerAuthAction.isOpen}
        title={managerAuthAction.title}
        description={managerAuthAction.description}
        onSuccess={managerAuthAction.onSuccess}
        onClose={() => setManagerAuthAction(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
