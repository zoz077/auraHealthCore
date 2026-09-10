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
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none';

  const variants = {
    primary: 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-[0_4px_14px_rgba(13,148,136,0.25),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_6px_18px_rgba(13,148,136,0.35)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] focus:ring-teal-500',
    secondary: 'bg-[#f0f4f8] hover:bg-[#e8eff6] text-slate-700 border border-white/90 shadow-[3px_3px_8px_rgba(166,180,200,0.4),-3px_-3px_8px_rgba(255,255,255,0.95),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[4px_4px_12px_rgba(166,180,200,0.5),-4px_-4px_12px_rgba(255,255,255,1)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[inset_2px_2px_5px_rgba(166,180,200,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] focus:ring-slate-400',
    outline: 'bg-white/95 hover:bg-slate-50 text-slate-700 border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.9)] hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-inner focus:ring-slate-400',
    ghost: 'bg-transparent hover:bg-slate-100/80 text-slate-600 hover:text-slate-900 active:translate-y-0.5 focus:ring-slate-400',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_4px_14px_rgba(244,63,94,0.25),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_6px_18px_rgba(244,63,94,0.35)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] focus:ring-rose-500',
    dangerOutline: 'bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200 shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-inner focus:ring-rose-500',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_4px_14px_rgba(16,185,129,0.25),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_6px_18px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] focus:ring-emerald-500',
    successOutline: 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200 shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-inner focus:ring-emerald-500',
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
