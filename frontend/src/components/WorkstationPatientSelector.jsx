import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User } from 'lucide-react';
import Badge from './ui/Badge';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function WorkstationPatientSelector({ currentUser, selectedPatient, onSelectPatient }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'doctor' && currentUser.role !== 'admin')) {
      return;
    }

    setLoading(true);
    axios.get(`${API_BASE_URL}/api/doctor/patients`)
      .then((res) => {
        setPatients(res.data);
        if (res.data.length > 0 && !selectedPatient) {
          onSelectPatient(res.data[0]);
        }
      })
      .catch((err) => {
        console.error('Failed to load clinic patients:', err);
      })
      .finally(() => setLoading(false));
  }, [currentUser]);

  if (!currentUser || (currentUser.role !== 'doctor' && currentUser.role !== 'admin')) {
    return null;
  }

  return (
    <div className="p-3.5 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700 shadow-neu-sm shrink-0">
          <User className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">Attending Clinical Patient</span>
            <Badge variant={selectedPatient ? 'success' : 'warning'} size="sm" dot>
              {selectedPatient ? 'Patient Active' : 'Select Patient'}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500">
            AI analysis and diagnostic impressions will be attributed to this patient's EHR
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-[260px]">
        {loading ? (
          <span className="text-xs text-slate-400">Loading patients...</span>
        ) : patients.length === 0 ? (
          <span className="text-xs text-slate-400">No scheduled patients</span>
        ) : (
          <select
            className="w-full text-xs font-medium bg-[#f0f4f8] border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            value={selectedPatient ? selectedPatient.id : ''}
            onChange={(e) => {
              const p = patients.find((pat) => pat.id === Number(e.target.value));
              onSelectPatient(p || null);
            }}
          >
            <option value="">-- Choose Patient --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} (PAT-{p.id.toString().padStart(4, '0')})
                {p.blood_group ? ` • ${p.blood_group}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
