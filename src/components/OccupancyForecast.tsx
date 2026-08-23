import React, { useState } from 'react';
import { 
  BarChart3, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Plus, 
  Dog, 
  ShieldAlert, 
  Info,
  ChevronLeft,
  Sparkles
} from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { 
  getTodayStr, 
  addDays, 
  formatDateIL, 
  HEBREW_DAYS, 
  getBookingsForDate 
} from '../utils/dateUtils';
import { getServiceTypeHebrew } from '../utils/whatsappUtils';

interface OccupancyForecastProps {
  bookings: Booking[];
  settings: ResortSettings;
  onSelectDate: (dateStr: string) => void;
  onNewBookingForDate: (dateStr: string) => void;
}

export const OccupancyForecast: React.FC<OccupancyForecastProps> = ({
  bookings,
  settings,
  onSelectDate,
  onNewBookingForDate,
}) => {
  const [rangeDays, setRangeDays] = useState<14 | 30 | 60>(14);
  const todayStr = getTodayStr();

  // Generate days timeline
  const timelineDays = Array.from({ length: rangeDays }, (_, i) => {
    const dateStr = addDays(todayStr, i);
    const dayBookings = getBookingsForDate(bookings, dateStr);
    const count = dayBookings.length;
    const isOverbooked = count > settings.maxCapacity;
    const isFull = count === settings.maxCapacity;
    const percentage = Math.min(100, Math.round((count / settings.maxCapacity) * 100));

    const d = new Date(dateStr + 'T00:00:00');
    const dayName = HEBREW_DAYS[d.getDay()];

    return {
      dateStr,
      dayName,
      dayNumber: d.getDate(),
      monthNumber: d.getMonth() + 1,
      count,
      isOverbooked,
      isFull,
      percentage,
      bookings: dayBookings,
    };
  });

  // Calculate summary metrics
  const totalSlotsAvailable = rangeDays * settings.maxCapacity;
  const totalOccupiedSlots = timelineDays.reduce((acc, d) => acc + d.count, 0);
  const averageOccupancyPercent = Math.round((totalOccupiedSlots / totalSlotsAvailable) * 100);

  const overbookedDays = timelineDays.filter(d => d.isOverbooked);
  const fullDays = timelineDays.filter(d => d.isFull);
  const peakDay = [...timelineDays].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="space-y-5">
      
      {/* Top Header & Range Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 border border-green-200 flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                תחזית תפוסה ומניעת אובר-בוקינג
              </h2>
              <p className="text-xs text-slate-500">
                ניתוח עומסים מראש למניעת רישום יתר ושמירה על קיבולת של עד {settings.maxCapacity} כלבים
              </p>
            </div>
          </div>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setRangeDays(14)}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              rangeDays === 14
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            14 ימים קדימה
          </button>
          <button
            onClick={() => setRangeDays(30)}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              rangeDays === 30
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            30 יום
          </button>
          <button
            onClick={() => setRangeDays(60)}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              rangeDays === 60
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            60 יום
          </button>
        </div>
      </div>

      {/* 4 Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Average Occupancy */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>ממוצע תפוסה לתקופה</span>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {averageOccupancyPercent}%
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {totalOccupiedSlots} ימי-כלב מוזמנים
          </p>
        </div>

        {/* Metric 2: Peak Day */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>יום שיא בתקופה</span>
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {peakDay ? `${peakDay.count}/${settings.maxCapacity}` : '0'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {peakDay ? `${formatDateIL(peakDay.dateStr)} (${peakDay.dayName})` : '-'}
          </p>
        </div>

        {/* Metric 3: Full Days */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>ימים בתפוסה מלאה</span>
            <CheckCircle2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {fullDays.length} ימים
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {fullDays.length > 0 ? 'אין מקום פנוי' : 'קיים מקום פנוי בכל הימים'}
          </p>
        </div>

        {/* Metric 4: Overbooking Risk */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>ימי חריגה (אובר-בוקינג)</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className={`text-2xl font-black ${overbookedDays.length > 0 ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
            {overbookedDays.length} ימים
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {overbookedDays.length > 0 ? 'נדרש טיפול ומענה' : 'אין חריגות קיבולת'}
          </p>
        </div>
      </div>

      {/* Critical Overbooking Alert Banner if any */}
      {overbookedDays.length > 0 && (
        <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 text-red-900 flex items-start gap-3 shadow-sm animate-in fade-in">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-red-900 text-sm sm:text-base">
              שים לב: אותרו {overbookedDays.length} ימי חריגת קיבולת בתקופה הנבחרת!
            </h4>
            <p className="text-xs sm:text-sm mt-1">
              התאריכים הבאים חורגים מהקיבולת המקסימלית של {settings.maxCapacity} כלבים:{' '}
              <span className="font-bold text-red-950">
                {overbookedDays.map(d => `${formatDateIL(d.dateStr)} (${d.count} כלבים)`).join(', ')}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Timeline List of Days */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center justify-between">
          <span>פירוט עומס יומי לפי תאריך ({rangeDays} ימים הבאים)</span>
          <span className="text-xs font-normal text-slate-500">
            לחץ על יום לפירוט מלא או הוספת שריון
          </span>
        </h3>

        <div className="space-y-2.5">
          {timelineDays.map((d) => {
            const isToday = d.dateStr === todayStr;
            
            // Bar color logic
            let barBg = 'bg-green-500';
            let badgeBg = 'bg-green-50 text-green-700 border-green-300';
            if (d.isOverbooked) {
              barBg = 'bg-red-500';
              badgeBg = 'bg-red-100 text-red-700 border-red-400 animate-pulse font-bold';
            } else if (d.isFull || d.count >= settings.maxCapacity * 0.8) {
              barBg = 'bg-amber-500';
              badgeBg = 'bg-amber-100 text-amber-800 border-amber-300 font-semibold';
            }

            return (
              <div
                key={d.dateStr}
                onClick={() => onSelectDate(d.dateStr)}
                className={`p-3 rounded-xl border transition-all hover:bg-slate-50 cursor-pointer ${
                  d.isOverbooked 
                    ? 'border-red-400 bg-red-50/40' 
                    : isToday 
                    ? 'border-green-500 bg-green-50/30' 
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  
                  {/* Date & Day Name */}
                  <div className="flex items-center gap-3 sm:w-48">
                    <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-bold text-xs ${
                      isToday ? 'bg-green-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
                    }`}>
                      <span className="text-[10px] uppercase">{d.dayName}</span>
                      <span className="text-sm font-extrabold">{d.dayNumber}/{d.monthNumber}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900">{formatDateIL(d.dateStr)}</span>
                        {isToday && (
                          <span className="bg-green-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded">
                            היום
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 block">
                        יום {d.dayName}
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar & Dogs Count */}
                  <div className="flex-1 max-w-md">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-700 font-semibold">
                        תפוסה: {d.count} / {settings.maxCapacity} כלבים
                      </span>
                      <span className="font-mono text-slate-500">{d.percentage}%</span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barBg}`}
                        style={{ width: `${Math.min(100, d.percentage)}%` }}
                      />
                    </div>
                  </div>

                  {/* Dogs Chips Preview */}
                  <div className="hidden lg:flex items-center gap-1 max-w-xs overflow-hidden">
                    {d.bookings.slice(0, 3).map(b => (
                      <span
                        key={b.id}
                        className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 truncate font-medium"
                      >
                        {b.dogName}
                      </span>
                    ))}
                    {d.bookings.length > 3 && (
                      <span className="text-[10px] text-slate-500 font-bold">
                        +{d.bookings.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Action & Status Badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`text-xs px-2.5 py-1 rounded-lg border ${badgeBg}`}>
                      {d.isOverbooked ? 'חריגה!' : d.isFull ? 'מלא' : `${settings.maxCapacity - d.count} פנויים`}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNewBookingForDate(d.dateStr);
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer border border-slate-200"
                    >
                      <Plus className="w-3.5 h-3.5 text-green-600" />
                      <span>שריון</span>
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
