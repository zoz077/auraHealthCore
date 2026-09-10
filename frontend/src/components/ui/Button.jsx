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
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none';

  const variants = {
    primary: 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-[0_4px_12px_rgba(13,148,136,0.22)] hover:shadow-[0_6px_16px_rgba(13,148,136,0.32)] hover:-translate-y-0.5 active:translate-y-0 focus:ring-teal-500',
    secondary: 'bg-[#f0f4f8] hover:bg-[#e8eff6] text-slate-700 border border-white/80 shadow-[3px_3px_8px_#e2e8f0,-3px_-3px_8px_#ffffff] hover:shadow-[4px_4px_10px_#dbe4ee,-4px_-4px_10px_#ffffff] active:shadow-[inset_2px_2px_4px_#e2e8f0,inset_-2px_-2px_4px_#ffffff] focus:ring-slate-400',
    outline: 'bg-white/90 hover:bg-slate-50 text-slate-700 border border-slate-200/90 shadow-sm hover:border-slate-300 focus:ring-slate-400',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus:ring-slate-400',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_4px_12px_rgba(244,63,94,0.22)] hover:-translate-y-0.5 active:translate-y-0 focus:ring-rose-500',
    dangerOutline: 'bg-rose-50/80 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-sm focus:ring-rose-500',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.22)] hover:-translate-y-0.5 active:translate-y-0 focus:ring-emerald-500',
    successOutline: 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm focus:ring-emerald-500',
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
