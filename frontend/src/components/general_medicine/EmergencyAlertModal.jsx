import React from 'react';
import { ShieldAlert, PhoneCall } from 'lucide-react';

export default function EmergencyAlertModal({ isOpen, onClose, message, language = 'ar' }) {
  if (!isOpen) return null;

  const isArabic = language === 'ar' || (message && /[\u0600-\u06FF]/.test(message));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="clay-card w-full max-w-lg p-6 bg-rose-50/95 border-2 border-rose-400 rounded-2xl shadow-2xl text-slate-900"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center gap-3 text-rose-700 mb-4">
          <div className="p-3 bg-rose-200 rounded-xl">
            <ShieldAlert className="w-8 h-8 text-rose-700 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-bold">
              {isArabic ? 'تنبيه طوارئ سريري فوري' : 'Immediate Clinical Emergency Alert'}
            </h3>
            <p className="text-xs text-rose-600 font-medium">
              {isArabic ? 'بروتوكول الطوارئ الإلزامي' : 'Mandatory Emergency Safety Protocol'}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-800 leading-relaxed font-medium mb-6">
          {message || (isArabic 
            ? 'الأعراض التي ذكرتها قد تشير إلى حالة طبية طارئة وتحتاج إلى تقييم طبي عاجل. يرجى الاتصال بالرقم 911 فوراً أو التوجه إلى أقرب قسم طوارئ.'
            : 'The symptoms you described may indicate a medical emergency requiring urgent medical evaluation. Please call 911 immediately or go to the nearest emergency department.')}
        </p>

        <div className="p-4 bg-white/80 rounded-xl border border-rose-200 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PhoneCall className="w-6 h-6 text-rose-600" />
            <div>
              <div className="text-xs font-semibold text-slate-500">
                {isArabic ? 'رقم طوارئ العراق' : 'Iraq Emergency Hotline'}
              </div>
              <div className="text-2xl font-black text-rose-700">911</div>
            </div>
          </div>
          <a
            href="tel:911"
            className="clay-btn px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md text-sm transition-all"
          >
            {isArabic ? 'اتصال فوري' : 'Call 911 Now'}
          </a>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="clay-btn px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg"
          >
            {isArabic ? 'فهمت التنبيه' : 'Acknowledge Directive'}
          </button>
        </div>
      </div>
    </div>
  );
}
