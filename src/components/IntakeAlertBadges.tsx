import React from 'react';
import { IntakeAlertItem, detectIntakeAlerts } from '../utils/intakeAlerts';
import { AlertTriangle, ShieldAlert, Sparkles, CheckCircle2, HeartHandshake, Syringe, Ban } from 'lucide-react';

interface IntakeAlertBannerProps {
  data: {
    dogName?: string;
    dogGender?: any;
    isNeutered?: boolean;
    isVaccinated?: boolean;
    vaccinationValid?: boolean;
    isFriendlyWithDogs?: any;
    isHouseTrained?: boolean;
    isTreatedParasites?: boolean;
    specialNeeds?: string;
    specialDiet?: string;
    medications?: string;
    medicationSchedule?: string;
    notes?: string;
    behaviorNotes?: string;
    internalNotes?: string;
    additionalDogs?: any[];
  };
  compact?: boolean;
  className?: string;
}

export const IntakeAlertBanner: React.FC<IntakeAlertBannerProps> = ({ data, compact = false, className = '' }) => {
  const alerts = React.useMemo(() => detectIntakeAlerts(data), [data]);

  if (alerts.length === 0) return null;

  const hasDanger = alerts.some(a => a.severity === 'danger');
  const hasWarning = alerts.some(a => a.severity === 'warning');

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        {alerts.map(a => (
          <span
            key={a.id}
            title={a.description}
            className={`text-[11px] font-black px-2.5 py-0.5 rounded-lg border shadow-2xs flex items-center gap-1 transition-all ${
              a.severity === 'danger'
                ? 'bg-rose-100 text-rose-950 border-rose-400 animate-pulse'
                : a.severity === 'warning'
                ? 'bg-amber-100 text-amber-950 border-amber-300'
                : 'bg-indigo-50 text-indigo-950 border-indigo-200'
            }`}
          >
            <span>{a.badgeLabel}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border-2 p-3 sm:p-4 text-right shadow-md transition-all ${
        hasDanger
          ? 'bg-gradient-to-r from-red-50 via-rose-50 to-amber-50 border-red-400 ring-2 ring-red-400/30'
          : hasWarning
          ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 border-amber-400 ring-1 ring-amber-300/40'
          : 'bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border-indigo-300'
      } ${className}`}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/10">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-base shrink-0 shadow-xs ${
            hasDanger
              ? 'bg-red-600 text-white animate-bounce'
              : hasWarning
              ? 'bg-amber-500 text-white'
              : 'bg-indigo-600 text-white'
          }`}>
            {hasDanger ? '🚨' : hasWarning ? '⚠️' : '🩺'}
          </div>
          <div>
            <h4 className={`text-xs sm:text-sm font-black ${
              hasDanger ? 'text-red-950' : hasWarning ? 'text-amber-950' : 'text-indigo-950'
            }`}>
              דגשים מיוחדים וחריגות לשמוליק ({alerts.length} דגשים):
            </h4>
            <span className="text-[11px] text-slate-600 font-medium">
              שים לב לתשובות החריגות שנמסרו בשאלון הקליטה
            </span>
          </div>
        </div>

        <span className={`text-[10px] sm:text-[11px] font-black px-2.5 py-1 rounded-xl shadow-2xs border shrink-0 ${
          hasDanger
            ? 'bg-red-600 text-white border-red-700'
            : hasWarning
            ? 'bg-amber-500 text-white border-amber-600'
            : 'bg-indigo-600 text-white border-indigo-700'
        }`}>
          {hasDanger ? '🚨 חובה לשים לב' : '⚠️ דגש טיפולי'}
        </span>
      </div>

      {/* Badges / Items List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-2.5 rounded-xl border flex flex-col gap-1 text-xs shadow-2xs ${
              alert.severity === 'danger'
                ? 'bg-white/95 border-red-300 text-red-950'
                : alert.severity === 'warning'
                ? 'bg-white/95 border-amber-300 text-amber-950'
                : 'bg-white/95 border-indigo-200 text-indigo-950'
            }`}
          >
            <div className="flex items-center gap-1.5 font-black text-xs">
              <span className="shrink-0">{alert.severity === 'danger' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}</span>
              <span>{alert.title}</span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium pr-4 leading-relaxed">
              {alert.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
