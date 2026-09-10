import React, { useState } from 'react';
import axios from 'axios';
import { 
  Wind, 
  Activity, 
  Save, 
  Image as ImageIcon, 
  RefreshCw, 
  Layers, 
  Stethoscope, 
  Upload, 
  CheckCircle2, 
  AlertTriangle,
  Volume2
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function RespiratoryDashboard({ currentUser }) {
  // Active test mode: 'ct' | 'xray' | 'ultrasound' | 'sounds' | 'vitals'
  const [testType, setTestType] = useState('ct');
  const [selectedFile, setSelectedFile] = useState(null);

  const [vitals, setVitals] = useState({
    spo2: 95,
    temp: 37.0,
    heart_rate: 75,
    resp_rate: 18
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');

  const handleTabChange = (type) => {
    setTestType(type);
    setSelectedFile(null);
    setResult(null);
    setSaveStatus('');
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaveStatus('');
    setResult(null);

    const formData = new FormData();
    formData.append('test_type', testType);
    formData.append('modality', testType);

    if (testType === 'vitals') {
      formData.append('spo2', vitals.spo2);
      formData.append('temp', vitals.temp);
      formData.append('heart_rate', vitals.heart_rate);
      formData.append('resp_rate', vitals.resp_rate);
      formData.append('vitals', JSON.stringify(vitals));
    } else {
      if (!selectedFile) {
        alert(`Please upload a file for ${testType.toUpperCase()} analysis.`);
        setLoading(false);
        return;
      }
      formData.append('file', selectedFile);
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/respiratory/diagnose`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
    } catch (err) {
      console.error("Analysis Error:", err);
      alert(err.response?.data?.detail || err.response?.data?.message || "Failed to complete AI assessment.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecord = async () => {
    if (!result || !currentUser) return;

    const detailsList = typeof result.details === 'object' && !Array.isArray(result.details)
      ? Object.entries(result.details).map(([k, v]) => `${k}: ${v}`)
      : result.details || [result.diagnosis];

    try {
      await axios.post(`${API_BASE_URL}/api/medical-records/save`, {
        patient_id: currentUser.id,
        record_type: `Respiratory AI (${testType.toUpperCase()})`,
        risk_score: parseFloat(result.confidence) || 85,
        status_level: result.risk_level || 'HIGH',
        details: detailsList
      });
      setSaveStatus('Record successfully saved to patient EHR!');
    } catch (err) {
      console.error("Save Error:", err);
      setSaveStatus('Failed to save record to EHR system.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Input Selection Panel */}
      <div className="lg:col-span-6 bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <Wind className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-100">AI Respiratory Diagnostic Center</h2>
            <p className="text-xs text-slate-400">Select an available modality to run targeted AI evaluation</p>
          </div>
        </div>

        {/* Diagnostic Modality Selector Tabs */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleTabChange('ct')}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
              testType === 'ct'
                ? 'border-cyan-500 bg-cyan-950/30 text-slate-100'
                : 'border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold">CT-Scan</span>
            </div>
            <span className="text-[10px] text-slate-400">Tumor & Cancer</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('xray')}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
              testType === 'xray'
                ? 'border-cyan-500 bg-cyan-950/30 text-slate-100'
                : 'border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ImageIcon className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold">Chest X-Ray</span>
            </div>
            <span className="text-[10px] text-slate-400">Pneumonia</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('ultrasound')}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
              testType === 'ultrasound'
                ? 'border-cyan-500 bg-cyan-950/30 text-slate-100'
                : 'border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold">Ultrasound</span>
            </div>
            <span className="text-[10px] text-slate-400">Effusion</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('sounds')}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
              testType === 'sounds'
                ? 'border-cyan-500 bg-cyan-950/30 text-slate-100'
                : 'border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold">Lung Sounds</span>
            </div>
            <span className="text-[10px] text-slate-400">Auscultation Audio</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('vitals')}
            className={`col-span-2 p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
              testType === 'vitals'
                ? 'border-cyan-500 bg-cyan-950/30 text-slate-100'
                : 'border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Stethoscope className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold">Vital Signs</span>
            </div>
            <span className="text-[10px] text-slate-400">SpO2, Temp, BPM & Resp Rate</span>
          </button>
        </div>

        {/* Dynamic Modality Form */}
        <form onSubmit={handleAnalyze} className="space-y-4 pt-2">
          {testType === 'sounds' ? (
            <div className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 text-center cursor-pointer bg-[#0b0f19] relative transition-all">
              <input
                key={testType}
                type="file"
                accept="audio/*,.wav,.mp3"
                onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Volume2 className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <span className="text-xs text-slate-200 font-medium block">
                {selectedFile ? selectedFile.name : 'Click or drag Lung Sound Audio file'}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">Supports WAV, MP3 formats</span>
            </div>
          ) : testType !== 'vitals' ? (
            <div className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 text-center cursor-pointer bg-[#0b0f19] relative transition-all">
              <input
                key={testType}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <span className="text-xs text-slate-200 font-medium block">
                {selectedFile ? selectedFile.name : `Click or drag image for ${testType.toUpperCase()} assessment`}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">Supports PNG, JPG, JPEG</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 bg-[#0b0f19] p-4 rounded-xl border border-slate-800">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Oxygen Saturation (SpO2 %)</label>
                <input
                  type="number"
                  step="0.1"
                  value={vitals.spo2}
                  onChange={(e) => setVitals({ ...vitals, spo2: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#111827] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Body Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={vitals.temp}
                  onChange={(e) => setVitals({ ...vitals, temp: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#111827] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Heart Rate (BPM)</label>
                <input
                  type="number"
                  value={vitals.heart_rate}
                  onChange={(e) => setVitals({ ...vitals, heart_rate: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#111827] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Respiration Rate (RPM)</label>
                <input
                  type="number"
                  value={vitals.resp_rate}
                  onChange={(e) => setVitals({ ...vitals, resp_rate: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#111827] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 mt-4 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {loading ? 'Analyzing Data...' : `Run ${testType.toUpperCase()} AI Diagnosis`}
          </button>
        </form>
      </div>

      {/* Output Results Panel */}
      <div className="lg:col-span-6 bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" /> AI Diagnostic Output
        </h2>

        {!result && !loading && (
          <div className="text-center py-24 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
            Select a test type and submit medical input to execute diagnostic analysis.
          </div>
        )}

        {loading && (
          <div className="text-center py-24 text-slate-400 text-xs space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
            <p>Evaluating AI deep learning model for {testType.toUpperCase()} input...</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-slate-400">Diagnosis Finding</div>
                  <div className="text-lg font-bold text-slate-100 mt-0.5">{result.diagnosis}</div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                    result.risk_level === 'HIGH'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {result.risk_level === 'HIGH' ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                  Risk: {result.risk_level} ({typeof result.confidence === 'number' ? (result.confidence * 100).toFixed(1) + '%' : result.confidence})
                </span>
              </div>

              {result.details && (
                <div className="border-t border-slate-800 pt-3 space-y-2">
                  <div className="text-xs font-semibold text-cyan-400">Diagnostic Breakdown:</div>
                  {Array.isArray(result.details) ? (
                    result.details.map((detail, idx) => (
                      <div key={idx} className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg flex items-start gap-2">
                        <span className="text-cyan-400 font-bold">•</span>
                        <span>{detail}</span>
                      </div>
                    ))
                  ) : typeof result.details === 'object' ? (
                    Object.entries(result.details).map(([cls, prob], idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg">
                        <span className="font-medium text-slate-200">{cls}</span>
                        <span className="text-cyan-400 font-semibold">{prob}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg">
                      {result.details}
                    </div>
                  )}
                </div>
              )}
            </div>

            {currentUser && (
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleSaveRecord}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-cyan-600 text-slate-100 text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition-all font-medium cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Evaluation to Patient EHR
                </button>
                {saveStatus && <span className="text-xs text-emerald-400 font-medium">{saveStatus}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}