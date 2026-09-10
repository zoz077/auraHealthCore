import React from 'react';

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  pulse = false,
  className = '',
}) {
  const base = 'inline-flex items-center font-mono font-semibold tracking-wider rounded-lg border uppercase transition-colors';

  const variants = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
    info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
    neutral: 'bg-slate-800/80 text-slate-300 border-slate-700/80',
  };

  const dotColors = {
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-cyan-400',
    purple: 'bg-purple-400',
    neutral: 'bg-slate-400',
  };

  const sizes = {
    sm: 'text-[9px] px-2 py-0.5 gap-1',
    md: 'text-[10px] px-2.5 py-1 gap-1.5',
    lg: 'text-xs px-3 py-1.5 gap-1.5',
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
