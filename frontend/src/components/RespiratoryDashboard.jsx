import React, { useState } from 'react';
import axios from 'axios';
import { 
  Wind, 
  Activity, 
  Save, 
  Image as ImageIcon, 
  Layers, 
  Stethoscope, 
  Upload, 
  CheckCircle2, 
  Volume2,
  Cpu
} from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { FormField, Input } from './ui/Input';
import EmptyState from './ui/EmptyState';

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

  const modalities = [
    { id: 'ct', label: 'CT-Scan', sub: 'Tumor & Neoplasm', icon: Layers },
    { id: 'xray', label: 'Chest X-Ray', sub: 'Pneumonia & Infiltrates', icon: ImageIcon },
    { id: 'ultrasound', label: 'Ultrasound', sub: 'Pleural Effusion', icon: Activity },
    { id: 'sounds', label: 'Lung Sounds', sub: 'Auscultation Audio', icon: Volume2 },
    { id: 'vitals', label: 'Vital Signs', sub: 'SpO2, BPM & Temp', icon: Stethoscope },
  ];

  return (
    <div className="space-y-6">
      {/* Modality Selector Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {modalities.map((m) => {
          const Icon = m.icon;
          const isActive = testType === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => handleTabChange(m.id)}
              className={`p-3 rounded-2xl border text-left transition-all duration-150 flex flex-col justify-between ${
                isActive
                  ? 'bg-cyan-600/10 border-cyan-500/50 text-white shadow-sm shadow-cyan-950/40'
                  : 'bg-[#0f172a]/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span className={`text-xs font-semibold ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>{m.label}</span>
              </div>
              <span className="text-[10px] text-slate-500 truncate">{m.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Panel */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle icon={Wind}>Respiratory Ingestion Center</CardTitle>
              <CardDescription>
                Targeted multimodal diagnostic engine ({testType.toUpperCase()} modality)
              </CardDescription>
            </div>
            <Badge variant="info" size="sm" dot>Engine Ready</Badge>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAnalyze} className="space-y-4">
              {testType === 'sounds' ? (
                <FormField label="Lung Auscultation Audio File">
                  <div className="border-2 border-dashed border-slate-800 hover:border-cyan-500/40 rounded-2xl p-6 text-center bg-[#0b0f19] relative transition-all cursor-pointer group">
                    <input
                      key={testType}
                      type="file"
                      accept="audio/*,.wav,.mp3"
                      onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="w-10 h-10 rounded-xl bg-slate-800/80 group-hover:bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-2 transition-colors">
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-slate-200 font-medium block">
                      {selectedFile ? selectedFile.name : 'Click or drag Lung Sound Audio file'}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1 font-mono">Supports WAV, MP3 formats</span>
                  </div>
                </FormField>
              ) : testType !== 'vitals' ? (
                <FormField label={`Radiographic Scan (${testType.toUpperCase()})`}>
                  <div className="border-2 border-dashed border-slate-800 hover:border-cyan-500/40 rounded-2xl p-6 text-center bg-[#0b0f19] relative transition-all cursor-pointer group">
                    <input
                      key={testType}
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="w-10 h-10 rounded-xl bg-slate-800/80 group-hover:bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-2 transition-colors">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-slate-200 font-medium block">
                      {selectedFile ? selectedFile.name : `Click or drag scan for ${testType.toUpperCase()} evaluation`}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1 font-mono">Supports PNG, JPG, JPEG</span>
                  </div>
                </FormField>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Oxygen Saturation (SpO2 %)" hint="Target: 95-100%">
                      <Input
                        type="number"
                        step="0.1"
                        value={vitals.spo2}
                        onChange={(e) => setVitals({ ...vitals, spo2: parseFloat(e.target.value) || 0 })}
                      />
                    </FormField>
                    <FormField label="Body Temperature (°C)" hint="Normal: 36.5 - 37.5">
                      <Input
                        type="number"
                        step="0.1"
                        value={vitals.temp}
                        onChange={(e) => setVitals({ ...vitals, temp: parseFloat(e.target.value) || 0 })}
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Heart Rate (BPM)" hint="Resting: 60 - 100">
                      <Input
                        type="number"
                        value={vitals.heart_rate}
                        onChange={(e) => setVitals({ ...vitals, heart_rate: parseInt(e.target.value) || 0 })}
                      />
                    </FormField>
                    <FormField label="Respiration Rate (RPM)" hint="Normal: 12 - 20">
                      <Input
                        type="number"
                        value={vitals.resp_rate}
                        onChange={(e) => setVitals({ ...vitals, resp_rate: parseInt(e.target.value) || 0 })}
                      />
                    </FormField>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                loading={loading}
                icon={Cpu}
                className="w-full"
              >
                {loading ? 'Analyzing Biomarkers...' : `Execute ${testType.toUpperCase()} AI Diagnosis`}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right Column: Diagnostic Output */}
        <Card className="lg:col-span-7 flex flex-col justify-center">
          {!result ? (
            <EmptyState
              icon={Wind}
              title="Awaiting Pulmonary Telemetry"
              description="Select a diagnostic modality on the left and submit scan or vital parameters to run AI assessment."
            />
          ) : (
            <CardContent className="space-y-5">
              <div className="p-4 rounded-2xl bg-[#0b0f19] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                    Pulmonary Clinical Finding
                  </span>
                  <div className="text-base font-bold text-slate-100 mt-0.5">{result.diagnosis}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={result.risk_level === 'HIGH' ? 'danger' : 'success'}
                    size="lg"
                    dot
                  >
                    Risk: {result.risk_level}
                  </Badge>
                  {result.confidence && (
                    <Badge variant="info" size="lg">
                      {typeof result.confidence === 'number' ? (result.confidence * 100).toFixed(1) + '%' : result.confidence} Conf.
                    </Badge>
                  )}
                </div>
              </div>

              {result.details && (
                <div className="space-y-2.5 bg-[#0b0f19] p-4 rounded-2xl border border-slate-800">
                  <span className="text-xs font-semibold text-cyan-400 block mb-1">
                    Diagnostic Biomarker Breakdown:
                  </span>
                  {Array.isArray(result.details) ? (
                    result.details.map((detail, idx) => (
                      <div key={idx} className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{detail}</span>
                      </div>
                    ))
                  ) : typeof result.details === 'object' ? (
                    Object.entries(result.details).map(([cls, prob], idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                        <span className="font-medium text-slate-200">{cls}</span>
                        <span className="text-cyan-400 font-mono font-semibold">{prob}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl">
                      {result.details}
                    </div>
                  )}
                </div>
              )}

              {currentUser && (
                <div className="space-y-2 pt-2">
                  <Button
                    onClick={handleSaveRecord}
                    variant={saveStatus ? 'successOutline' : 'secondary'}
                    icon={saveStatus ? CheckCircle2 : Save}
                    className="w-full"
                  >
                    {saveStatus || 'Save Evaluation to Patient EHR'}
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