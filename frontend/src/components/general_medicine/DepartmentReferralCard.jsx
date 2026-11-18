import React from 'react';
import { Building2, CalendarPlus, ChevronRight } from 'lucide-react';

export default function DepartmentReferralCard({
  departmentName,
  indication,
  onBookAppointment,
  language = 'en'
}) {
  const isArabic = language === 'ar';

  return (
    <div 
      className="p-4 rounded-xl bg-gradient-to-br from-teal-50/90 via-white to-cyan-50/70 border border-teal-200/80 shadow-neu-sm space-y-3"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shadow-sm">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-teal-700 tracking-wider">
              {isArabic ? 'القسم الطبي الموصى به' : 'Recommended Department'}
            </div>
            <div className="text-sm font-bold text-slate-900">{departmentName}</div>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        {indication}
      </p>

      <div className="pt-1 flex justify-end">
        <button
          onClick={() => onBookAppointment(departmentName)}
          className="clay-btn px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all duration-150"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          <span>{isArabic ? 'حجز موعد مع القسم' : 'Book Appointment'}</span>
          <ChevronRight className={`w-3.5 h-3.5 ${isArabic ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}
