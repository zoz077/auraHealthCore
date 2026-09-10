import React from 'react';

export function FormField({ label, error, hint, children, className = '', required = false }) {
  return (
    <div className={`space-y-1.5 text-xs ${className}`}>
      {label && (
        <label className="block font-medium text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[11px] text-slate-500">{hint}</p>}
      {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
    </div>
  );
}

export function Input({
  className = '',
  hasError = false,
  icon: Icon,
  type = 'text',
  ...props
}) {
  return (
    <div className="relative flex items-center">
      {Icon && (
        <div className="absolute left-3 pointer-events-none text-slate-400">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <input
        type={type}
        className={`w-full bg-white/95 border rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/15 focus:border-cyan-500 transition-all shadow-[inset_1px_1px_3px_rgba(166,180,200,0.22),inset_0_1px_1px_rgba(0,0,0,0.03)] ${
          Icon ? 'pl-9' : ''
        } ${
          hasError
            ? 'border-rose-300 focus:ring-rose-500/15 focus:border-rose-500'
            : 'border-slate-200/90 hover:border-slate-300'
        } ${className}`}
        {...props}
      />
    </div>
  );
}

export function Select({
  className = '',
  hasError = false,
  children,
  ...props
}) {
  return (
    <select
      className={`w-full bg-white/95 border rounded-xl py-2.5 px-3.5 text-xs text-slate-800 focus:outline-none focus:ring-4 focus:ring-cyan-500/15 focus:border-cyan-500 transition-all shadow-[inset_1px_1px_3px_rgba(166,180,200,0.22),inset_0_1px_1px_rgba(0,0,0,0.03)] ${
        hasError
          ? 'border-rose-300 focus:ring-rose-500/15 focus:border-rose-500'
          : 'border-slate-200/90 hover:border-slate-300'
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className = '',
  hasError = false,
  rows = 3,
  ...props
}) {
  return (
    <textarea
      rows={rows}
      className={`w-full bg-white/95 border rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/15 focus:border-cyan-500 transition-all resize-y shadow-[inset_1px_1px_3px_rgba(166,180,200,0.22),inset_0_1px_1px_rgba(0,0,0,0.03)] ${
        hasError
          ? 'border-rose-300 focus:ring-rose-500/15 focus:border-rose-500'
          : 'border-slate-200/90 hover:border-slate-300'
      } ${className}`}
      {...props}
    />
  );
}
