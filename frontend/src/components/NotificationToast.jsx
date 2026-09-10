import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function NotificationToast({ notifications = [], onClose }) {
  if (!notifications || notifications.length === 0) return null;

  const typeConfigs = {
    success: {
      border: 'border-emerald-500/30 bg-[#0f172a]/95 text-emerald-300',
      icon: CheckCircle2,
      iconColor: 'text-emerald-400',
      tag: 'CONFIRMATION',
    },
    error: {
      border: 'border-rose-500/40 bg-[#0f172a]/95 text-rose-300 shadow-rose-950/20',
      icon: AlertCircle,
      iconColor: 'text-rose-400',
      tag: 'ALERT',
    },
    warning: {
      border: 'border-amber-500/30 bg-[#0f172a]/95 text-amber-300',
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
      tag: 'NOTICE',
    },
    info: {
      border: 'border-cyan-500/30 bg-[#0f172a]/95 text-cyan-300',
      icon: Info,
      iconColor: 'text-cyan-400',
      tag: 'TELEMETRY',
    },
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2.5 max-w-sm w-full pointer-events-none">
      {notifications.map((notif) => {
        const config = typeConfigs[notif.type] || typeConfigs.info;
        const Icon = config.icon;

        return (
          <div
            key={notif.id}
            className={`pointer-events-auto border rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${config.border}`}
          >
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${config.iconColor}`} />

            <div className="flex-1 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                  {config.tag}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">{notif.time}</span>
              </div>
              <p className="text-slate-200 font-medium leading-snug">{notif.text}</p>
            </div>

            {onClose && (
              <button
                onClick={() => onClose(notif.id)}
                className="text-slate-500 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
                aria-label="Dismiss alert"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}