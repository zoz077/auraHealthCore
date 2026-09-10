import React from 'react';

export function FormField({ label, error, hint, children, className = '', required = false }) {
  return (
    <div className={`space-y-1.5 text-xs ${className}`}>
      {label && (
        <label className="block font-medium text-slate-300">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[11px] text-slate-500">{hint}</p>}
      {error && <p className="text-[11px] text-rose-400 font-medium">{error}</p>}
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
        <div className="absolute left-3 pointer-events-none text-slate-500">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <input
        type={type}
        className={`w-full bg-[#0b0f19] border rounded-xl py-2.5 px-3.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-all ${
          Icon ? 'pl-9' : ''
        } ${
          hasError
            ? 'border-rose-500/80 focus:ring-rose-500/30'
            : 'border-slate-800 hover:border-slate-700'
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
      className={`w-full bg-[#0b0f19] border rounded-xl py-2.5 px-3.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-all ${
        hasError
          ? 'border-rose-500/80 focus:ring-rose-500/30'
          : 'border-slate-800 hover:border-slate-700'
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
      className={`w-full bg-[#0b0f19] border rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-all resize-y ${
        hasError
          ? 'border-rose-500/80 focus:ring-rose-500/30'
          : 'border-slate-800 hover:border-slate-700'
      } ${className}`}
      {...props}
    />
  );
}
