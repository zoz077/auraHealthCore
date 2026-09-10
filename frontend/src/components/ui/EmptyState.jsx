import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no active entries or items to display at this time.',
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-slate-300/80 bg-white/70 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-[#f0f4f8] border border-white flex items-center justify-center text-slate-400 mb-3 shadow-[4px_4px_10px_rgba(166,180,200,0.4),-4px_-4px_10px_rgba(255,255,255,0.95)]">
        <Icon className="w-6 h-6 text-cyan-600/70" />
      </div>
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      {description && (
        <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
