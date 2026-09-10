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
      border: 'border-cyan-500/25 bg-cyan-950/20 text-cyan-200',
      iconColor: 'text-cyan-400',
      icon: Info,
    },
    success: {
      border: 'border-emerald-500/25 bg-emerald-950/20 text-emerald-200',
      iconColor: 'text-emerald-400',
      icon: CheckCircle2,
    },
    warning: {
      border: 'border-amber-500/25 bg-amber-950/20 text-amber-200',
      iconColor: 'text-amber-400',
      icon: AlertTriangle,
    },
    error: {
      border: 'border-rose-500/25 bg-rose-950/20 text-rose-200',
      iconColor: 'text-rose-400',
      icon: AlertCircle,
    },
  };

  const config = configs[variant] || configs.info;
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={`relative p-3.5 rounded-xl border text-xs flex items-start gap-3 ${config.border} ${className}`}
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${config.iconColor}`} />
      <div className="flex-1 space-y-0.5">
        {title && <h5 className="font-semibold text-slate-100">{title}</h5>}
        <div className="text-slate-300 leading-relaxed">{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
