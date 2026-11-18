import React, { useState } from 'react';
import axios from 'axios';
import { HeartPulse, Activity, ShieldCheck, CheckCircle2, User, Sparkles } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { FormField, Input } from './ui/Input';
import EmptyState from './ui/EmptyState';
import WorkstationPatientSelector from './WorkstationPatientSelector';
import { sendFindingToGeneralMedicine } from '../utils/generalMedicineIntegration';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function IcuDashboard({ currentUser, activeGmSessionUuid, setActiveGmSessionUuid, onNavigateToTab }) {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [lastSavedRecordId, setLastSavedRecordId] = useState(null);
  const [lastSavedPatientId, setLastSavedPatientId] = useState(null);
  const [isSendingGm, setIsSendingGm] = useState(false);
  const [formData, setFormData] = useState({
    patient_name: currentUser?.role === 'patient' ? currentUser?.full_name : '',
    patient_id: 'ICU-2026-01',
    age: 45,
    ejection_fraction: 30,
    high_blood_pressure: 0,
    serum_creatinine: 1.0,
    serum_sodium: 140
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const targetPatientId = (currentUser?.role === 'doctor' || currentUser?.role === 'admin')
      ? selectedPatient?.id
      : currentUser?.id;

    const patientName = selectedPatient ? selectedPatient.full_name : formData.patient_name;
    if (!patientName.trim()) return alert('Please enter or select a patient name');

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/icu/analyze`, {
        ...formData,
        patient_name: patientName,
        db_patient_id: targetPatientId
      });
      setResult(res.data.assessment);
      if (res.data.record_id) {
        setLastSavedRecordId(res.data.record_id);
        setLastSavedPatientId(targetPatientId);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'ICU risk analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToGm = async () => {
    if (!lastSavedRecordId || !lastSavedPatientId) return;
    setIsSendingGm(true);
    try {
      await sendFindingToGeneralMedicine({
        patientId: lastSavedPatientId,
        recordId: lastSavedRecordId,
        activeGmSessionUuid,
        setActiveGmSessionUuid,
        onNavigateToTab
      });
    } catch (err) {
      alert(err.message || 'Failed to send finding to General Medicine.');
    } finally {
      setIsSendingGm(false);
    }
  };

  return (
    <div className="space-y-6">
      <WorkstationPatientSelector
        currentUser={currentUser}
        selectedPatient={selectedPatient}
        onSelectPatient={(p) => {
          setSelectedPatient(p);
          if (p) {
            setFormData(prev => ({
              ...prev,
              patient_name: p.full_name,
              patient_id: `PAT-${p.id.toString().padStart(4, '0')}`
            }));
          }
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Parameter Input Console */}
      <Card className="lg:col-span-5">
        <CardHeader>
          <div>
            <CardTitle icon={HeartPulse}>ICU & Critical Care Telemetry AI</CardTitle>
            <CardDescription>Predictive hemodynamic and renal decompensation risk analyzer</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Patient Identification" required>
              <Input
                icon={User}
                type="text"
                placeholder="Patient full name..."
                value={formData.patient_name}
                onChange={e => setFormData({...formData, patient_name: e.target.value})}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Age (Years)" required>
                <Input
                  type="number"
                  min="1"
                  max="120"
                  value={formData.age}
                  onChange={e => setFormData({...formData, age: Number(e.target.value)})}
                />
              </FormField>
              <FormField label="Ejection Fraction (%)" hint="Target: 50-70%">
                <Input
                  type="number"
                  min="5"
                  max="85"
                  value={formData.ejection_fraction}
                  onChange={e => setFormData({...formData, ejection_fraction: Number(e.target.value)})}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Serum Creatinine (mg/dL)" hint="Normal: 0.7 - 1.3">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="15.0"
                  value={formData.serum_creatinine}
                  onChange={e => setFormData({...formData, serum_creatinine: Number(e.target.value)})}
                />
              </FormField>
              <FormField label="Serum Sodium (mEq/L)" hint="Normal: 135 - 145">
                <Input
                  type="number"
                  min="100"
                  max="180"
                  value={formData.serum_sodium}
                  onChange={e => setFormData({...formData, serum_sodium: Number(e.target.value)})}
                />
              </FormField>
            </div>

            <Button
              type="submit"
              loading={loading}
              icon={Activity}
              className="w-full mt-2"
            >
              {loading ? 'Evaluating Telemetry...' : 'Run ICU Risk Assessment & Save'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Clinical Assessment Output */}
      <Card className="lg:col-span-7 flex flex-col justify-center">
        {!result ? (
          <EmptyState
            icon={HeartPulse}
            title="Awaiting Telemetry Data"
            description="Enter patient vitals and laboratory biomarkers on the left to execute model inference."
          />
        ) : (
          <CardContent className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#f4f7fa] border border-white/90 shadow-neu-panel">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium block">
                  Calculated Decompensation Risk
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold font-mono text-cyan-700">{result.risk_score}%</span>
                  <span className="text-xs text-slate-500 font-mono">probabilistic score</span>
                </div>
              </div>
              <div>
                <Badge
                  variant={result.status_level === 'HIGH' ? 'danger' : 'success'}
                  size="lg"
                  dot
                  pulse={result.status_level === 'HIGH'}
                >
                  Clinical Status: {result.status_level}
                </Badge>
              </div>
            </div>

            {/* Risk Gauge Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-medium text-slate-500">
                <span>Low Acuity</span>
                <span>Moderate</span>
                <span>High Decompensation</span>
              </div>
              <div className="h-2.5 w-full bg-slate-200/70 rounded-full overflow-hidden flex shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)]">
                <div
                  className={`transition-all duration-500 rounded-full ${
                    result.status_level === 'HIGH'
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(Math.max(result.risk_score, 5), 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                <span>Diagnostic Protocol & Biomarker Analysis</span>
              </div>
              <div className="space-y-2">
                {result.details.map((d, i) => (
                  <div
                    key={i}
                    className="text-xs bg-white/95 p-3.5 rounded-xl border border-slate-200/70 text-slate-700 shadow-[0_2px_6px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] leading-relaxed flex items-start gap-2.5 transition-all hover:border-slate-300"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>

            {lastSavedRecordId && (
              <div className="pt-3">
                <Button
                  onClick={handleSendToGm}
                  variant="primary"
                  icon={Sparkles}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                  disabled={isSendingGm}
                >
                  {isSendingGm ? 'Ingesting Finding...' : 'Send ICU Assessment to General Medicine Hub'}
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>
      </div>
    </div>
  );
}