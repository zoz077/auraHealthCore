import React, { useState } from 'react';
import axios from 'axios';
import { HeartPulse } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function IcuDashboard({ currentUser }) {
  // تفريغ اسم المريض عند دخول الطبيب وتعبئته تلقائياً فقط إذا كان المستخدم مريضاً
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
    if (!formData.patient_name.trim()) return alert('Please enter patient name');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/icu/analyze`, {
        ...formData,
        db_patient_id: currentUser?.role === 'patient' ? currentUser?.id : null
      });
      setResult(res.data.assessment);
    } catch (err) {
      alert(err.response?.data?.detail || 'ICU risk analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2 text-cyan-400">
          <HeartPulse className="w-5 h-5" /> ICU & Emergency AI Diagnostic Tool
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Patient Name</label>
            <input 
              type="text" 
              placeholder="Enter patient full name..."
              value={formData.patient_name} 
              onChange={e => setFormData({...formData, patient_name: e.target.value})} 
              className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500" 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Age</label>
              <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Ejection Fraction (%)</label>
              <input type="number" value={formData.ejection_fraction} onChange={e => setFormData({...formData, ejection_fraction: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Serum Creatinine</label>
              <input type="number" step="0.1" value={formData.serum_creatinine} onChange={e => setFormData({...formData, serum_creatinine: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Serum Sodium</label>
              <input type="number" value={formData.serum_sodium} onChange={e => setFormData({...formData, serum_sodium: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500 font-semibold text-xs py-3 rounded-xl transition-all">
            {loading ? 'Evaluating Model...' : 'Run Clinical Assessment & Save Record'}
          </button>
        </form>
      </div>

      <div className="lg:col-span-7 bg-[#111827] p-6 rounded-2xl border border-slate-800 flex flex-col justify-center">
        {!result ? (
          <div className="text-center text-slate-500 text-xs">Submit patient parameters to run emergency AI assessment.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-[#0b0f19] p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs text-slate-400 block">Calculated Risk Score</span>
                <span className="text-2xl font-bold font-mono text-cyan-400">{result.risk_score}%</span>
              </div>
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${result.status_level === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                {result.status_level}
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 block">AI Diagnostic Protocol Notes:</span>
              {result.details.map((d, i) => (
                <div key={i} className="text-xs bg-[#0b0f19] p-3 rounded-xl border border-slate-800/80 text-slate-300">{d}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}