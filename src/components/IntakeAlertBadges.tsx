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
            className={`text-[11px] font-black px-2.5 py-0.5 rounded-lg border shadow-md flex items-center gap-1 transition-all ${
              a.severity === 'danger'
                ? 'bg-red-600 text-white border-red-700 animate-pulse ring-2 ring-red-400/50'
                : a.severity === 'warning'
                ? 'bg-amber-500 text-white border-amber-600 animate-pulse ring-2 ring-amber-300/50'
                : 'bg-indigo-600 text-white border-indigo-700'
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
      className={`rounded-2xl border-2 p-3.5 sm:p-4 text-right shadow-xl transition-all ${
        hasDanger
          ? 'alert-pulse-danger bg-gradient-to-r from-red-100 via-rose-100 to-amber-100 border-red-500 ring-4 ring-red-400/40'
          : hasWarning
          ? 'alert-pulse-warning bg-gradient-to-r from-amber-200 via-yellow-100 to-orange-200 border-amber-500 ring-4 ring-amber-400/50'
          : 'bg-gradient-to-r from-indigo-100 via-blue-100 to-indigo-100 border-indigo-400 ring-2 ring-indigo-300/40'
      } ${className}`}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-black/15">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg shrink-0 shadow-md ${
            hasDanger
              ? 'bg-red-600 text-white animate-bounce ring-2 ring-white'
              : hasWarning
              ? 'bg-amber-600 text-white animate-pulse ring-2 ring-white'
              : 'bg-indigo-600 text-white'
          }`}>
            {hasDanger ? '🚨' : hasWarning ? '⚠️' : '🩺'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className={`text-sm sm:text-base font-black ${
                hasDanger ? 'text-red-950' : hasWarning ? 'text-amber-950' : 'text-indigo-950'
              }`}>
                דגשים מיוחדים וחריגות לשמוליק ({alerts.length} דגשים):
              </h4>
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  hasDanger ? 'bg-red-500' : 'bg-amber-500'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  hasDanger ? 'bg-red-600' : 'bg-amber-600'
                }`}></span>
              </span>
            </div>
            <span className={`text-xs font-bold ${
              hasDanger ? 'text-red-900' : hasWarning ? 'text-amber-900' : 'text-slate-700'
            }`}>
              שים לב לתשובות החריגות שנמסרו בשאלון הקליטה
            </span>
          </div>
        </div>

        <span className={`text-[11px] sm:text-xs font-black px-3 py-1.5 rounded-xl shadow-md border shrink-0 animate-pulse ${
          hasDanger
            ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-300'
            : hasWarning
            ? 'bg-amber-600 text-white border-amber-700 ring-2 ring-amber-200'
            : 'bg-indigo-600 text-white border-indigo-700'
        }`}>
          {hasDanger ? '🚨 חובה לשים לב' : '⚠️ דגש טיפולי מהבהב'}
        </span>
      </div>

      {/* Badges / Items List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-3 rounded-xl border-2 flex flex-col gap-1.5 text-xs shadow-md transition-all hover:shadow-lg ${
              alert.severity === 'danger'
                ? 'bg-white border-red-400 text-red-950 ring-1 ring-red-200'
                : alert.severity === 'warning'
                ? 'bg-white border-amber-400 text-amber-950 ring-1 ring-amber-200'
                : 'bg-white border-indigo-300 text-indigo-950'
            }`}
          >
            <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm">
              <span className="shrink-0 text-sm">{alert.severity === 'danger' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}</span>
              <span className="font-extrabold">{alert.title}</span>
            </div>
            <p className="text-xs text-slate-700 font-bold pr-5 leading-relaxed">
              {alert.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
