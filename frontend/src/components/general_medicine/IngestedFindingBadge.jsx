import React from 'react';
import { Sparkles, Brain, Bone, Heart, Wind, HeartPulse } from 'lucide-react';

export default function IngestedFindingBadge({ finding, language = 'en' }) {
  if (!finding) return null;

  const isArabic = language === 'ar';

  const getDeptIcon = (dept = '') => {
    const d = dept.toLowerCase();
    if (d.includes('neuro')) return Brain;
    if (d.includes('ortho')) return Bone;
    if (d.includes('cardio') || d.includes('ecg')) return Heart;
    if (d.includes('resp') || d.includes('pulmo')) return Wind;
    return HeartPulse;
  };

  const Icon = getDeptIcon(finding.department);

  return (
    <div 
      className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 shadow-neu-sm space-y-2 text-slate-800 animate-in fade-in"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-emerald-200/60 text-emerald-900">
              {isArabic ? 'تحليل ذكاء اصطناعي جديد' : 'New AI Analysis Ingested'}
            </span>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              {finding.department} &bull; {finding.model_name || 'Specialized Diagnostic Engine'}
            </div>
          </div>
        </div>

        {finding.confidence !== undefined && finding.confidence !== null && (
          <div className="text-right">
            <span className="text-[10px] text-slate-500 block font-semibold">
              {isArabic ? 'ثقة النموذج' : 'Model Confidence'}
            </span>
            <span className="text-xs font-bold font-mono text-emerald-700">
              {finding.confidence <= 1.0 ? `${(finding.confidence * 100).toFixed(1)}%` : `${finding.confidence}%`}
            </span>
          </div>
        )}
      </div>

      {finding.status_level && (
        <div className="text-xs text-slate-600 font-medium">
          {isArabic ? 'الحالة المسجلة:' : 'Clinical Status:'} <span className="font-semibold text-slate-800">{finding.status_level}</span>
        </div>
      )}
    </div>
  );
}
