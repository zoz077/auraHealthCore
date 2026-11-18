import React from 'react';
import { Stethoscope, Activity, ShieldCheck, AlertCircle } from 'lucide-react';
import DepartmentReferralCard from './DepartmentReferralCard';
import IngestedFindingBadge from './IngestedFindingBadge';

export default function TriageAssessmentCard({
  assessment,
  completeness = 0,
  urgency = 'ROUTINE',
  language = 'en',
  onBookAppointment,
  onSaveToEhr,
  isSaving
}) {
  if (!assessment) return null;

  const isArabic = language === 'ar';
  const considerations = assessment.possible_considerations || [];
  const investigations = assessment.recommended_investigations || [];
  const departments = assessment.recommended_departments || [];
  const lastIngested = assessment.last_ingested_finding;

  return (
    <div 
      className="clay-card p-5 bg-white border border-slate-200/90 rounded-2xl shadow-neu-sm space-y-4 text-slate-800"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-teal-600" />
          <h3 className="font-bold text-slate-900 text-sm">
            {isArabic ? 'التقييم السريري والتوجيه الطبي' : 'Clinical Triage & Assessment'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
            {urgency}
          </span>
        </div>
      </div>

      {/* Ingested AI Finding Badge if present */}
      {lastIngested && (
        <IngestedFindingBadge finding={lastIngested} language={language} />
      )}

      {/* Probabilistic Considerations */}
      {considerations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isArabic ? 'اعتبارات سريرية محتملة (غير تشخيصية)' : 'Possible Clinical Considerations (Non-Definitive)'}
          </h4>
          <div className="space-y-2">
            {considerations.map((c, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-900">{c.condition}</div>
                <div className="text-slate-600 leading-relaxed">{c.clinical_rationale}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Investigations to discuss with doctor */}
      {investigations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isArabic ? 'فحوصات استقصائية مقترحة للمناقشة مع الطبيب' : 'Suggested Investigations to Discuss with Clinician'}
          </h4>
          <div className="space-y-1.5">
            {investigations.map((inv, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-200/70 flex items-start gap-2 text-xs">
                <Activity className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">{inv.investigation}</span>
                  <span className="text-slate-500 mx-1">&bull; {inv.clinical_reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Department Referral */}
      {departments.length > 0 && (
        <DepartmentReferralCard
          departmentName={departments[0].department_name}
          indication={departments[0].clinical_indication}
          onBookAppointment={onBookAppointment}
          language={language}
        />
      )}

      {/* Clinical Disclaimer */}
      <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2.5 flex items-start gap-1.5 leading-relaxed">
        <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>
          {assessment.disclaimer || (isArabic 
            ? 'هذه المعلومات للإرشاد والدعم السريري فقط ولا تعتبر تشخيصاً طبياً نهائياً. يجب مراجعة الطبيب المرخص.'
            : 'This assessment is for clinical decision support and triage guidance only. It is not a medical diagnosis. Evaluation by a licensed physician is required.')}
        </span>
      </div>

      {/* Save Consultation to EHR Action */}
      <div className="flex justify-end pt-1">
        <button
          onClick={onSaveToEhr}
          disabled={isSaving}
          className="clay-btn px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all duration-150 disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{isSaving ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ الاستشارة في السجل الطبي (EHR)' : 'Save Consultation to EHR')}</span>
        </button>
      </div>
    </div>
  );
}
