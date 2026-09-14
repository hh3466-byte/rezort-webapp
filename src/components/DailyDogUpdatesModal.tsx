import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Send, 
  Shuffle, 
  CheckCircle2, 
  ShieldAlert, 
  Sparkles, 
  Moon, 
  Dog, 
  Trees, 
  Users, 
  Copy, 
  ExternalLink,
  Clock,
  Loader2,
  Edit3
} from 'lucide-react';
import { Booking, ResortSettings, IntakeRequest } from '../types';
import { getTodayStr, formatDateIL } from '../utils/dateUtils';
import { cleanPhoneNumber, getFirstName } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage } from '../services/notificationService';
import { 
  DAILY_DOG_TEMPLATES, 
  isDogIsolationRequired, 
  pickDailyDogTemplate, 
  DailyDogTemplate 
} from '../data/dailyDogTemplates';
import { isYomKippurActiveNow } from '../utils/jewishCalendar';

interface DailyDogUpdatesModalProps {
  bookings: Booking[];
  settings: ResortSettings;
  intakeRequests: IntakeRequest[];
  onClose: () => void;
  showToast: (msg: string) => void;
}

interface DogEveningState {
  booking: Booking;
  isIsolation: boolean;
  intakeMatch?: IntakeRequest;
  currentTemplate: DailyDogTemplate;
  formattedText: string;
  isCustomEdited: boolean;
  isSent: boolean;
  isSending: boolean;
  usedTemplateIds: number[];
}

export const DailyDogUpdatesModal: React.FC<DailyDogUpdatesModalProps> = ({
  bookings,
  settings,
  intakeRequests,
  onClose,
  showToast
}) => {
  const todayStr = getTodayStr();
  const isKippur = isYomKippurActiveNow();

  // Active dogs staying tonight at the resort
  const activeTonightBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.stayStatus === 'cancelled') return false;
      return b.startDate <= todayStr && b.endDate > todayStr;
    });
  }, [bookings, todayStr]);

  const [dogStates, setDogStates] = useState<DogEveningState[]>([]);
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [filterType, setFilterType] = useState<'all' | 'friendly' | 'isolation'>('all');
  const [editingDogId, setEditingDogId] = useState<string | null>(null);

  // Initialize state for each dog
  useEffect(() => {
    const initialStates: DogEveningState[] = activeTonightBookings.map(b => {
      const cleanPhone = cleanPhoneNumber(b.ownerPhone);
      const intakeMatch = intakeRequests.find(r => {
        const reqPhone = cleanPhoneNumber(r.ownerPhone);
        return reqPhone.slice(-7) === cleanPhone.slice(-7);
      });

      const isIsolation = isDogIsolationRequired(
        b.notes,
        b.behaviorNotes,
        b.dailyRate,
        intakeMatch?.isFriendlyWithDogs
      );

      const { template, formattedText } = pickDailyDogTemplate(
        b.ownerName,
        b.dogName,
        isIsolation,
        []
      );

      // Check if already sent today in localStorage
      const sentKey = `daily_dog_sent_${b.id}_${todayStr}`;
      const isSent = localStorage.getItem(sentKey) === 'true';

      return {
        booking: b,
        isIsolation,
        intakeMatch,
        currentTemplate: template,
        formattedText,
        isCustomEdited: false,
        isSent,
        isSending: false,
        usedTemplateIds: [template.id]
      };
    });

    setDogStates(initialStates);
  }, [activeTonightBookings, intakeRequests, todayStr]);

  // Handle Shuffle (pick another eligible template for a specific dog)
  const handleShuffle = (bookingId: string) => {
    setDogStates(prev => prev.map(item => {
      if (item.booking.id !== bookingId) return item;

      const { template, formattedText } = pickDailyDogTemplate(
        item.booking.ownerName,
        item.booking.dogName,
        item.isIsolation,
        item.usedTemplateIds
      );

      return {
        ...item,
        currentTemplate: template,
        formattedText,
        isCustomEdited: false,
        usedTemplateIds: [...item.usedTemplateIds, template.id]
      };
    }));
  };

  // Handle custom text change
  const handleTextChange = (bookingId: string, newText: string) => {
    setDogStates(prev => prev.map(item => {
      if (item.booking.id !== bookingId) return item;
      return {
        ...item,
        formattedText: newText,
        isCustomEdited: true
      };
    }));
  };

  // Send single message
  const handleSendSingle = async (bookingId: string) => {
    if (isKippur) {
      showToast('🕯️ יום כיפור חל כעת: שקט מוחלט! לא נשלחות הודעות.');
      return;
    }

    const item = dogStates.find(d => d.booking.id === bookingId);
    if (!item) return;

    setDogStates(prev => prev.map(d => d.booking.id === bookingId ? { ...d, isSending: true } : d));

    const cleanPhone = cleanPhoneNumber(item.booking.ownerPhone);
    const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
    const message = item.formattedText;

    let success = false;
    const greenApiId = settings.greenApiIdInstance;
    const greenApiToken = settings.greenApiToken;

    if (greenApiId && greenApiToken) {
      const res = await sendGreenApiDirectMessage(cleanPhone, message, greenApiId, greenApiToken);
      if (res.success) {
        success = true;
        showToast(`✨ ההודעה היומית נשלחה בהצלחה לבעלים של ${item.booking.dogName}!`);
      } else {
        console.warn('Green-API send failed, falling back to WhatsApp link:', res.error);
      }
    }

    if (!success) {
      // Fallback: Open wa.me link
      const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
      success = true;
      showToast(`פתח וואטסאפ למשלוח ל-${item.booking.dogName} 🐾`);
    }

    if (success) {
      localStorage.setItem(`daily_dog_sent_${item.booking.id}_${todayStr}`, 'true');
      setDogStates(prev => prev.map(d => d.booking.id === bookingId ? { ...d, isSending: false, isSent: true } : d));
    } else {
      setDogStates(prev => prev.map(d => d.booking.id === bookingId ? { ...d, isSending: false } : d));
    }
  };

  // Batch send to all unsent dogs
  const handleBatchSend = async () => {
    if (isKippur) {
      showToast('🕯️ יום כיפור חל כעת: שקט מוחלט! לא נשלחות הודעות.');
      return;
    }

    const unsentDogs = dogStates.filter(d => !d.isSent);
    if (unsentDogs.length === 0) {
      showToast('כל ההודעות כבר נשלחו להערב! 🎉');
      return;
    }

    if (!confirm(`האם לשלוח עכשיו עדכון יומי ל-${unsentDogs.length} כלבים שמתארחים הלילה בריזורט?`)) {
      return;
    }

    setIsBatchSending(true);
    setBatchProgress({ current: 0, total: unsentDogs.length });

    let sentCount = 0;
    for (let i = 0; i < unsentDogs.length; i++) {
      const dog = unsentDogs[i];
      setBatchProgress({ current: i + 1, total: unsentDogs.length });
      
      const cleanPhone = cleanPhoneNumber(dog.booking.ownerPhone);
      const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
      
      if (settings.greenApiIdInstance && settings.greenApiToken) {
        const res = await sendGreenApiDirectMessage(
          cleanPhone, 
          dog.formattedText, 
          settings.greenApiIdInstance, 
          settings.greenApiToken
        );
        if (res.success) {
          localStorage.setItem(`daily_dog_sent_${dog.booking.id}_${todayStr}`, 'true');
          setDogStates(prev => prev.map(d => d.booking.id === dog.booking.id ? { ...d, isSent: true } : d));
          sentCount++;
        }
      } else {
        // Fallback open first one
        if (i === 0) {
          window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(dog.formattedText)}`, '_blank');
        }
      }

      // Small pause between messages to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    setIsBatchSending(false);
    showToast(`🚀 הושלם! נשלחו ${sentCount} הודעות יומיות בהצלחה.`);
  };

  const filteredDogs = dogStates.filter(d => {
    if (filterType === 'friendly') return !d.isIsolation;
    if (filterType === 'isolation') return d.isIsolation;
    return true;
  });

  const isolationCount = dogStates.filter(d => d.isIsolation).length;
  const friendlyCount = dogStates.filter(d => !d.isIsolation).length;
  const sentCount = dogStates.filter(d => d.isSent).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-900 via-[#0f4c3a] to-slate-900 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 text-amber-300 flex items-center justify-center font-black text-2xl shadow-inner">
              🐶👑
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  עדכון יומי לבעלי הכלבים (שעה 20:00)
                </h2>
                <span className="bg-amber-400/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-400/30">
                  100 נוסחים שונים 🎲
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                "אתם מבלים בעניינים שלכם – ואני פה בסבבה ומנהל את שמוליק!" 🐾✨
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all relative z-10 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar / Subheader */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Metrics */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700 shadow-2xs flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
              מתארחים הלילה: <span className="font-black text-slate-900">{activeTonightBookings.length}</span>
            </span>

            <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl font-bold shadow-2xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              חברותיים (מדשאה): <span className="font-black">{friendlyCount}</span>
            </span>

            <span className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-xl font-bold shadow-2xs flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              בידוד/תוקפני (VIP אישי): <span className="font-black">{isolationCount}</span>
            </span>

            <span className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-3 py-1.5 rounded-xl font-bold shadow-2xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              נשלחו להערב: <span className="font-black">{sentCount} מתוך {activeTonightBookings.length}</span>
            </span>
          </div>

          {/* Action Trigger */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchSend}
              disabled={isBatchSending || isKippur || activeTonightBookings.length === 0}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm ${
                isKippur
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white active:scale-95'
              }`}
            >
              {isBatchSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>שולח ({batchProgress.current}/{batchProgress.total})...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>שלח עכשיו לכולם ({activeTonightBookings.length - sentCount})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Yom Kippur Warning (If Active) */}
        {isKippur && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center gap-2 text-amber-900 text-xs font-bold">
            <span>🕯️</span>
            <span>יום כיפור חל כעת: משלוח ההודעות האוטומטיות והידניות חסום לשמירה על קדושת היום. שירות הלקוחות יחזור לפעילות מלאה מחר ב-09:30.</span>
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-emerald-50/70 border-b border-emerald-100 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>משלוח אוטומטי מלא:</strong> בכל ערב בשעה <strong>20:00 בדיוק</strong>, הבוט שולח אוטומטית הודעה יומית ייחודית לכל בעלים, דואג לא לחזור על נוסחים, ומסנן הרמטית אזכורי מדשאה מכלבים בבידוד.
            </span>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-white border border-emerald-200 p-0.5 rounded-lg shrink-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                filterType === 'all' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              הכל ({dogStates.length})
            </button>
            <button
              onClick={() => setFilterType('friendly')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                filterType === 'friendly' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              חברותיים ({friendlyCount})
            </button>
            <button
              onClick={() => setFilterType('isolation')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                filterType === 'isolation' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              בידוד/שקט ({isolationCount})
            </button>
          </div>
        </div>

        {/* Content - Dog List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
          {activeTonightBookings.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-3xl mb-3">
                🐕💤
              </div>
              <h3 className="text-lg font-bold text-slate-700">אין כלבים הלנים הלילה בריזורט</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                ההודעות היומיות מיועדות לכלבים השוהים בלינה בריזורט בתאריכים הנוכחיים.
              </p>
            </div>
          ) : filteredDogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              לא נמצאו כלבים בסינון שנבחר.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredDogs.map(item => {
                const b = item.booking;
                const isEditing = editingDogId === b.id;

                return (
                  <div
                    key={b.id}
                    className={`rounded-2xl border transition-all shadow-xs overflow-hidden flex flex-col justify-between ${
                      item.isSent 
                        ? 'bg-emerald-50/30 border-emerald-200' 
                        : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white font-black flex items-center justify-center shadow-xs text-base">
                          🐾
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                              {b.dogName}
                            </h4>
                            <span className="text-xs text-slate-500">
                              ({b.dogBreed || 'מעורב'})
                            </span>
                            {item.isSent && (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> נשלח
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            בעלים: <strong>{b.ownerName}</strong> ({b.ownerPhone})
                          </p>
                        </div>
                      </div>

                      {/* Temperament Badge */}
                      <div>
                        {item.isIsolation ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-2xs" title="סומן כתוקפני/בידוד: נשלח רק יחס 1-על-1, טיול פרטי בטבע, ללא מדשאה או כלבים אחרים">
                            <ShieldAlert className="w-3 h-3 text-amber-700" />
                            בידוד VIP (פרטי)
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-2xs" title="כלב חברותי: כולל מדשאת משחקים וחברים על 4">
                            <Users className="w-3 h-3 text-emerald-600" />
                            חברותי (מדשאה)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body - Message Preview */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                          <span className="font-semibold flex items-center gap-1">
                            <span>נוסח #{item.currentTemplate.id}</span>
                            {item.currentTemplate.category === 'boss_dog' && '👑 (הכלב הוא המלך)'}
                            {item.currentTemplate.category === 'nature' && '🌲 (טיול בטבע)'}
                            {item.currentTemplate.category === 'gourmet_meal' && '🍲 (ארוחת גורמה)'}
                            {item.currentTemplate.category === 'sweet_longing' && '❤️ (געגוע חמוד)'}
                            {item.currentTemplate.category === 'lawn' && '🌾 (מדשאת משחקים)'}
                            {item.currentTemplate.category === 'isolation_vip' && '💎 (VIP אישי 1-על-1)'}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleShuffle(b.id)}
                              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition-all"
                              title="הגרל נוסח שונה מתוך המאגר המורשה לכלב זה"
                            >
                              <Shuffle className="w-3 h-3" />
                              החלף נוסח
                            </button>
                            <button
                              onClick={() => setEditingDogId(isEditing ? null : b.id)}
                              className="text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-all"
                              title="ערוך נוסח ידנית"
                            >
                              <Edit3 className="w-3 h-3" />
                              {isEditing ? 'סגור עריכה' : 'ערוך'}
                            </button>
                          </div>
                        </div>

                        {/* Text box / Editor */}
                        {isEditing ? (
                          <textarea
                            value={item.formattedText}
                            onChange={(e) => handleTextChange(b.id, e.target.value)}
                            rows={4}
                            className="w-full text-xs sm:text-sm p-3 border border-emerald-300 rounded-xl bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 leading-relaxed font-sans"
                            placeholder="כתוב או ערוך את ההודעה..."
                          />
                        ) : (
                          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs sm:text-sm text-slate-800 leading-relaxed relative group">
                            {item.formattedText}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(item.formattedText);
                                showToast('הנוסח הועתק ללוח! 📋');
                              }}
                              className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 bg-white/90 border border-slate-200 text-slate-600 hover:text-slate-900 p-1.5 rounded-md text-xs shadow-xs transition-all"
                              title="העתק ללוח"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Card Footer - Send Button */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400">
                          {item.isCustomEdited ? '✏️ נערך ידנית' : '✨ נוסח מאושר'}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSendSingle(b.id)}
                            disabled={item.isSending || isKippur}
                            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs ${
                              item.isSent
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {item.isSending ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>שולח...</span>
                              </>
                            ) : item.isSent ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>שלח שוב בוואטסאפ</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                <span>שלח בוואטסאפ עכשיו</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>🛡️</span>
            <span>כלבי בידוד מקבלים רק תכנים אישיים (טיול בטבע, סוויטה שקטה ופינוק VIP אישי). אין אזכור למדשאה.</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition-all"
          >
            סגור
          </button>
        </div>

      </div>
    </div>
  );
};
