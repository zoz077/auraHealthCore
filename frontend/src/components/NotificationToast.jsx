import React from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export default function NotificationToast({ notifications = [], onClose }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2 max-w-sm w-full pointer-events-none">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className="pointer-events-auto bg-[#111827] border border-cyan-500/30 text-slate-100 p-4 rounded-xl shadow-2xl flex items-start gap-3 animate-bounce-once"
        >
          {notif.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
          {notif.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
          {notif.type === 'info' && <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />}

          <div className="flex-1 text-xs space-y-1">
            <p className="font-semibold text-slate-200">{notif.text}</p>
            <span className="text-[10px] text-slate-500">{notif.time}</span>
          </div>

          {onClose && (
            <button 
              onClick={() => onClose(notif.id)} 
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}