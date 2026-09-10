import React from 'react';

export function Card({ children, className = '', hover = false, variant = 'default', ...props }) {
  const variantStyles = {
    default: 'bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-card',
    elevated: 'bg-white/98 backdrop-blur-lg border border-slate-200/90 shadow-card-hover',
    neu: 'bg-[#f4f7fa] border border-white/90 shadow-neu-panel',
    flat: 'bg-white border border-slate-200 shadow-sm',
  };

  return (
    <div
      className={`${variantStyles[variant] || variantStyles.default} rounded-2xl transition-all duration-200 ease-out ${
        hover ? 'hover:-translate-y-1 hover:shadow-card-hover hover:border-slate-300/90 cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', border = true, ...props }) {
  return (
    <div
      className={`p-5 flex items-center justify-between ${
        border ? 'border-b border-slate-100/90' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', icon: Icon, ...props }) {
  return (
    <h3 className={`text-sm font-semibold text-slate-800 flex items-center gap-2.5 ${className}`} {...props}>
      {Icon && (
        <div className="w-7 h-7 rounded-xl bg-cyan-50/80 border border-cyan-100/80 flex items-center justify-center shadow-neu-sm shrink-0">
          <Icon className="w-3.5 h-3.5 text-cyan-700" />
        </div>
      )}
      <span>{children}</span>
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={`text-xs text-slate-500 mt-0.5 ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', border = true, ...props }) {
  return (
    <div
      className={`p-4 bg-slate-50/70 flex items-center justify-between rounded-b-2xl ${
        border ? 'border-t border-slate-100/90' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
