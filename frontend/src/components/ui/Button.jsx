import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled = false,
  type = 'button',
  icon: Icon,
  onClick,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#090d16] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none';

  const variants = {
    primary: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm shadow-cyan-950/40 border border-cyan-500/30 focus:ring-cyan-500',
    secondary: 'bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 focus:ring-slate-400',
    outline: 'bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700 hover:text-white focus:ring-slate-400',
    ghost: 'bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 focus:ring-slate-400',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-950/40 border border-rose-500/30 focus:ring-rose-500',
    dangerOutline: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 focus:ring-rose-500',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-950/40 border border-emerald-500/30 focus:ring-emerald-500',
    successOutline: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 focus:ring-emerald-500',
  };

  const sizes = {
    xs: 'text-[11px] px-2.5 py-1 gap-1',
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-xs px-4 py-2 gap-2',
    lg: 'text-sm px-5 py-2.5 gap-2.5',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5 shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
