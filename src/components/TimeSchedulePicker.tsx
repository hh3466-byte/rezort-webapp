import React, { useState } from 'react';
import { Clock, Plus, X, Trash2, Check, Sparkles, Edit3 } from 'lucide-react';

interface TimeSchedulePickerProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  isMedication?: boolean;
}

// Extracts valid HH:MM times from a free text string
export const extractTimesFromSchedule = (text: string): string[] => {
  if (!text) return [];
  const regex = /\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/g;
  const matches = text.match(regex) || [];
  // Standardize to HH:MM format (pad single digit hours)
  const formatted = matches.map(t => {
    const [h, m] = t.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  });
  // Return deduplicated
  return Array.from(new Set(formatted)).sort();
};

const COMMON_FEEDING_PRESETS = [
  { time: '07:00', label: '07:00 🌅' },
  { time: '08:00', label: '08:00 ☀️' },
  { time: '12:00', label: '12:00 🕛' },
  { time: '13:00', label: '13:00 🍽️' },
  { time: '18:00', label: '18:00 🌇' },
  { time: '19:00', label: '19:00 🌆' },
  { time: '20:00', label: '20:00 🌙' },
];

const ROUTINE_PRESETS = [
  { label: '☀️ 2 ארוחות (08:00, 18:00)', times: ['08:00', '18:00'] },
  { label: '🍽️ 3 ארוחות (08:00, 13:00, 19:00)', times: ['08:00', '13:00', '19:00'] },
  { label: '🌅 ארוחה אחת (18:00)', times: ['18:00'] },
  { label: '🌙 בוקר ולילה (08:00, 20:00)', times: ['08:00', '20:00'] },
];

export const TimeSchedulePicker: React.FC<TimeSchedulePickerProps> = ({
  value,
  onChange,
  label = '⏰ שעות האכלה:',
  placeholder = 'למשל: 08:00, 18:00',
  isMedication = false,
}) => {
  const [customTime, setCustomTime] = useState<string>('08:00');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  const selectedTimes = extractTimesFromSchedule(value);

  // Checks if a specific time is already included
  const isTimeSelected = (timeStr: string) => {
    const padded = timeStr.length === 4 ? `0${timeStr}` : timeStr;
    return selectedTimes.includes(padded);
  };

  // Toggle single time
  const handleToggleTime = (timeStr: string) => {
    const padded = timeStr.length === 4 ? `0${timeStr}` : timeStr;
    let newTimes: string[];
    if (selectedTimes.includes(padded)) {
      newTimes = selectedTimes.filter(t => t !== padded);
    } else {
      newTimes = [...selectedTimes, padded].sort();
    }
    
    // Check if there was other non-time text in the original value
    const nonTimeText = value
      .replace(/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/g, '')
      .replace(/^[,\s]+|[,\s]+$/g, '')
      .replace(/,\s*,/g, ',')
      .trim();

    if (newTimes.length === 0 && !nonTimeText) {
      onChange('');
    } else if (nonTimeText) {
      onChange(`${newTimes.join(', ')} (${nonTimeText})`);
    } else {
      onChange(newTimes.join(', '));
    }
  };

  // Apply complete routine
  const handleApplyRoutine = (times: string[]) => {
    onChange(times.join(', '));
  };

  // Add custom time from time picker
  const handleAddCustomTime = () => {
    if (!customTime) return;
    handleToggleTime(customTime);
  };

  // Clear all
  const handleClearAll = () => {
    onChange('');
  };

  return (
    <div className="space-y-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-200">
      {/* Header with Title & Action */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
          <Clock className={`w-3.5 h-3.5 ${isMedication ? 'text-rose-500' : 'text-indigo-600'}`} />
          <span>{label}</span>
          {selectedTimes.length > 0 && (
            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.2 rounded-full font-bold">
              {selectedTimes.length} זמנים
            </span>
          )}
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-[11px] font-bold text-slate-500 hover:text-indigo-700 flex items-center gap-1 cursor-pointer transition-colors"
            title="עריכת טקסט ידנית חופשית"
          >
            <Edit3 className="w-3 h-3" />
            <span>{showManualInput ? 'הסתר טקסט' : 'עריכה ידנית'}</span>
          </button>

          {value && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer transition-colors"
              title="נקה הכל"
            >
              <Trash2 className="w-3 h-3" />
              <span>נקה</span>
            </button>
          )}
        </div>
      </div>

      {/* Selected Times Badges (Visual Chips with Remove X) */}
      {selectedTimes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 ml-1">זמנים שנקבעו:</span>
          {selectedTimes.map(time => (
            <span
              key={time}
              className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-2xs transition-all animate-in zoom-in-95"
            >
              <span>⏰ {time}</span>
              <button
                type="button"
                onClick={() => handleToggleTime(time)}
                className="w-4 h-4 rounded-full bg-indigo-800/80 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                title={`הסר ${time}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-slate-500 italic bg-white/60 px-2.5 py-1.5 rounded-xl border border-dashed border-slate-200 text-center">
          טרם נבחרו שעות. לחץ על שעה או בחר מהשעון למטה:
        </div>
      )}

      {/* Quick Common Hour Chips */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold text-slate-500">בחירה מהירה של שעות:</div>
        <div className="flex flex-wrap items-center gap-1">
          {COMMON_FEEDING_PRESETS.map(item => {
            const isSelected = isTimeSelected(item.time);
            return (
              <button
                key={item.time}
                type="button"
                onClick={() => handleToggleTime(item.time)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
                }`}
              >
                {isSelected && <span className="ml-1">✓</span>}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clock Time Picker (Input type="time" + Add Button) */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-200/80">
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs flex-1">
          <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className="w-full bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer"
          />
        </div>

        <button
          type="button"
          onClick={handleAddCustomTime}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs active:scale-95"
          title="הוסף שעה זו ללוח הזמנים"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>הוסף שעה</span>
        </button>
      </div>

      {/* Quick Combination Routines */}
      {!isMedication && (
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <span className="text-[10px] font-bold text-slate-400">שבלונות:</span>
          {ROUTINE_PRESETS.map((routine, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyRoutine(routine.times)}
              className="text-[10px] font-bold bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-950 border border-slate-200 hover:border-amber-300 px-2 py-0.8 rounded-md transition-colors cursor-pointer"
            >
              {routine.label}
            </button>
          ))}
        </div>
      )}

      {/* Manual Free-Text Input (Shown when user wants custom instructions or clicked manual edit) */}
      {showManualInput && (
        <div className="pt-2 border-t border-slate-200 animate-in fade-in space-y-1">
          <label className="text-[10px] font-bold text-slate-600 block">
            טקסט מלא והנחיות משלימות:
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-white text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none font-medium"
          />
        </div>
      )}
    </div>
  );
};
