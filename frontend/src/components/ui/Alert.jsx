import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function Alert({
  children,
  variant = 'info', // 'info' | 'success' | 'warning' | 'error'
  title,
  onDismiss,
  className = '',
}) {
  const configs = {
    info: {
      border: 'border-cyan-200/80 bg-cyan-50/80 text-cyan-950',
      iconColor: 'text-cyan-600',
      icon: Info,
    },
    success: {
      border: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-950',
      iconColor: 'text-emerald-600',
      icon: CheckCircle2,
    },
    warning: {
      border: 'border-amber-200/80 bg-amber-50/80 text-amber-950',
      iconColor: 'text-amber-600',
      icon: AlertTriangle,
    },
    error: {
      border: 'border-rose-200/80 bg-rose-50/80 text-rose-950',
      iconColor: 'text-rose-600',
      icon: AlertCircle,
    },
  };

  const config = configs[variant] || configs.info;
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={`relative p-3.5 rounded-xl border text-xs flex items-start gap-3 backdrop-blur-sm ${config.border} ${className}`}
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${config.iconColor}`} />
      <div className="flex-1 space-y-0.5">
        {title && <h5 className="font-semibold text-slate-800">{title}</h5>}
        <div className="leading-relaxed opacity-90">{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
