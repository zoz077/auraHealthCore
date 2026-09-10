import React from 'react';

export function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={`bg-[#0f172a]/90 backdrop-blur-sm border border-slate-800/80 rounded-2xl shadow-xl shadow-black/20 transition-all ${
        hover ? 'hover:border-slate-700/80 hover:shadow-2xl' : ''
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
        border ? 'border-b border-slate-800/80' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', icon: Icon, ...props }) {
  return (
    <h3 className={`text-sm font-semibold text-slate-100 flex items-center gap-2 ${className}`} {...props}>
      {Icon && <Icon className="w-4 h-4 text-cyan-400 shrink-0" />}
      <span>{children}</span>
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={`text-xs text-slate-400 mt-0.5 ${className}`} {...props}>
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
      className={`p-4 bg-slate-900/40 flex items-center justify-between rounded-b-2xl ${
        border ? 'border-t border-slate-800/80' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
