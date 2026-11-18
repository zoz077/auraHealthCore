import React from 'react';
import { CheckCircle, Circle, ClipboardList } from 'lucide-react';

export default function ClinicalMatrixCard({ matrix = {}, completeness = 0, language = 'en' }) {
  const isArabic = language === 'ar';

  const axes = [
    { key: 'chief_complaint', labelEn: 'Primary Complaint', labelAr: 'الشكوى الأساسية', val: matrix.chief_complaint },
    { key: 'onset', labelEn: 'Onset & Timing', labelAr: 'وقت وتطور الأعراض', val: matrix.onset },
    { key: 'associated_symptoms', labelEn: 'Associated Symptoms', labelAr: 'الأعراض المصاحبة', val: matrix.associated_symptoms?.length ? matrix.associated_symptoms.join(', ') : null },
    { key: 'triggers', labelEn: 'Triggers / Context', labelAr: 'المسببات والأنشطة', val: matrix.triggers?.length ? matrix.triggers.join(', ') : null },
    { key: 'medical_history', labelEn: 'Medical History', labelAr: 'التاريخ الصحي المزمن', val: matrix.medical_history?.length ? matrix.medical_history.join(', ') : null },
    { key: 'medications', labelEn: 'Current Medications', labelAr: 'الأدوية الحالية', val: matrix.medications?.length ? matrix.medications.join(', ') : null }
  ];

  return (
    <div className="clay-card p-4 bg-white/80 border border-slate-200/90 rounded-2xl shadow-neu-sm space-y-3" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-teal-600" />
          <h4 className="text-xs font-bold text-slate-800">
            {isArabic ? 'سجل المحاور السريرية' : 'Clinical Information Matrix'}
          </h4>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
          {(completeness * 100).toFixed(0)}% {isArabic ? 'مكتمل' : 'gathered'}
        </span>
      </div>

      <div className="space-y-2">
        {axes.map(ax => {
          const isCollected = Boolean(ax.val);
          return (
            <div key={ax.key} className="flex items-start gap-2 text-xs">
              {isCollected ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className={`font-semibold ${isCollected ? 'text-slate-800' : 'text-slate-400'}`}>
                  {isArabic ? ax.labelAr : ax.labelEn}:
                </span>
                {isCollected ? (
                  <span className="text-slate-700 mx-1 font-medium">{ax.val}</span>
                ) : (
                  <span className="text-slate-400 italic mx-1">{isArabic ? 'لم يذكر بعد' : 'Not provided yet'}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
