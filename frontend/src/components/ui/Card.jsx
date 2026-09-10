import React from 'react';

export function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={`bg-white/85 backdrop-blur-md border border-white/90 rounded-2xl shadow-glass transition-all ${
        hover ? 'hover:shadow-glass-lg hover:-translate-y-0.5 hover:border-slate-200/90' : ''
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
    <h3 className={`text-sm font-semibold text-slate-800 flex items-center gap-2 ${className}`} {...props}>
      {Icon && <Icon className="w-4 h-4 text-cyan-600 shrink-0" />}
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
      className={`p-4 bg-slate-50/60 flex items-center justify-between rounded-b-2xl ${
        border ? 'border-t border-slate-100/90' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
