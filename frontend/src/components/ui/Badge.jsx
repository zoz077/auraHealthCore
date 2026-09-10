import React from 'react';

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  pulse = false,
  className = '',
}) {
  const base = 'inline-flex items-center font-medium tracking-wide rounded-full border transition-colors';

  const variants = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
    info: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
    purple: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200/80',
  };

  const dotColors = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-cyan-500',
    purple: 'bg-indigo-500',
    neutral: 'bg-slate-400',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-[11px] px-2.5 py-0.5 gap-1.5',
    lg: 'text-xs px-3 py-1 gap-1.5',
  };

  return (
    <span className={`${base} ${variants[variant] || variants.neutral} ${sizes[size] || sizes.md} ${className}`}>
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColors[variant] || dotColors.neutral} ${
            pulse ? 'animate-pulse' : ''
          }`}
        />
      )}
      <span>{children}</span>
    </span>
  );
}
