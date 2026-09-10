import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function NotificationToast({ notifications = [], onClose }) {
  if (!notifications || notifications.length === 0) return null;

  const typeConfigs = {
    success: {
      border: 'border-emerald-200/80 bg-white/95',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
      tag: 'CONFIRMATION',
      tagColor: 'text-emerald-700 bg-emerald-50',
    },
    error: {
      border: 'border-rose-200/80 bg-white/95',
      icon: AlertCircle,
      iconColor: 'text-rose-600',
      tag: 'ALERT',
      tagColor: 'text-rose-700 bg-rose-50',
    },
    warning: {
      border: 'border-amber-200/80 bg-white/95',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      tag: 'NOTICE',
      tagColor: 'text-amber-700 bg-amber-50',
    },
    info: {
      border: 'border-cyan-200/80 bg-white/95',
      icon: Info,
      iconColor: 'text-cyan-600',
      tag: 'TELEMETRY',
      tagColor: 'text-cyan-700 bg-cyan-50',
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
            className={`pointer-events-auto border rounded-2xl p-4 shadow-[0_12px_36px_-6px_rgba(15,23,42,0.12),0_4px_12px_rgba(0,0,0,0.04)] backdrop-blur-xl flex items-start gap-3 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${config.border}`}
          >
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${config.iconColor}`} />

            <div className="flex-1 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${config.tagColor}`}>
                  {config.tag}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{notif.time}</span>
              </div>
              <p className="text-slate-800 font-medium leading-snug">{notif.text}</p>
            </div>

            {onClose && (
              <button
                onClick={() => onClose(notif.id)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
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