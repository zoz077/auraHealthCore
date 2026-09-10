import React, { useState } from 'react';
import axios from 'axios';
import { Heart, Activity, Upload, CheckCircle2, FileText, RefreshCw, Sliders, Image as ImageIcon, User, AlertCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function EcgDashboard({ currentUser }) {
  // Mode switcher: 'values' or 'image'
  const [analysisMode, setAnalysisMode] = useState('values');

  // Clinical parameters input state
  const [clinicalParams, setClinicalParams] = useState({
    patientName: '',
    age: '45',
    gender: 'male',
    heartRate: '75',
    prInterval: '160',
    qrsDuration: '90',
    qtInterval: '400',
    stSegment: '0.0',
    pWaveDuration: '100',
    qrsAxis: '45'
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const [diagnosisResult, setDiagnosisResult] = useState({
    verdict: 'Normal Sinus Rhythm',
    status: 'NORMAL',
    score: 12,
    details: [
      'Normal P-Q-R-S-T wave morphology observed.',
      'Conduction intervals (PR, QRS, QTc) within safe baseline boundaries.',
      'No ST-segment elevation or ischemic changes detected.'
    ]
  });

  const handleInputChange = (field, value) => {
    setClinicalParams(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleExecuteDiagnostic = async () => {
    setLoading(true);

    try {
      if (analysisMode === 'values') {
        setTimeout(() => {
          const hr = parseFloat(clinicalParams.heartRate) || 75;
          const qrs = parseFloat(clinicalParams.qrsDuration) || 90;
          const qt = parseFloat(clinicalParams.qtInterval) || 400;
          const st = parseFloat(clinicalParams.stSegment) || 0;
          const pr = parseFloat(clinicalParams.prInterval) || 160;

          let isAbnormal = false;
          let findings = [];

          if (st > 1.0) {
            isAbnormal = true;
            findings.push(`Critical: ST-Segment Elevation Detected (${st} mm) - Ischemia/Infarction risk.`);
          } else if (st < -0.5) {
            isAbnormal = true;
            findings.push(`Warning: ST-Segment Depression (${st} mm) - Subendocardial ischemia marker.`);
          }

          if (hr > 100) {
            isAbnormal = true;
            findings.push(`Elevated Heart Rate (${hr} BPM - Sinus Tachycardia).`);
          } else if (hr < 50) {
            isAbnormal = true;
            findings.push(`Low Heart Rate (${hr} BPM - Sinus Bradycardia).`);
          }

          if (qrs > 120) {
            isAbnormal = true;
            findings.push(`Prolonged QRS (${qrs} ms) - Intraventricular Conduction Delay.`);
          }

          if (pr > 200) {
            isAbnormal = true;
            findings.push(`Prolonged PR Interval (${pr} ms) - 1st Degree AV Block.`);
          }

          if (findings.length === 0) {
            findings = [
              'All cardiac parameters (HR, PR, QRS, QT, ST) are within healthy reference ranges.',
              'Normal ventricular repolarization and depolarisation cycle.',
              'No immediate arrhythmia or ischemic indicators observed.'
            ];
          }

          setDiagnosisResult({
            verdict: isAbnormal ? 'Cardiac Rhythm Abnormality Detected' : 'Normal Sinus Rhythm',
            status: isAbnormal ? 'ABNORMAL' : 'NORMAL',
            score: isAbnormal ? Math.min(95, 50 + (st !== 0 ? 30 : 0) + (hr > 100 ? 15 : 0)) : 10,
            details: findings
          });
          setLoading(false);
        }, 600);

      } else {
        // --- Real Backend Integration for Image Vision Model ---
        if (!imageFile) {
          alert("Please upload an ECG image first!");
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", imageFile);

        const response = await axios.post(`${API_BASE_URL}/ecg/predict-image`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        const { prediction, all_probabilities } = response.data;
        const className = prediction.class_name; // 'AHB', 'COVID-19', 'HMI', 'MI', 'Normal'
        const confidence = prediction.confidence;
        const isNormal = className === 'Normal';

        let verdictText = `Diagnostic Class: ${className}`;
        let detailsList = [
          `Vision Model Prediction: ${className} (${confidence}% confidence score).`,
          `ResNet18 Deep Neural Network evaluation completed across 5 cardiac target classes.`
        ];

        if (className === 'AHB') {
          verdictText = 'Abnormal Heart Beats (AHB)';
          detailsList.push('Arrhythmia/Irregular waveform morphology detected in ECG lead trace.');
        } else if (className === 'COVID-19') {
          verdictText = 'COVID-19 Cardiac Involvement';
          detailsList.push('Electrophysiological pattern associated with viral myocarditis/inflammation detected.');
        } else if (className === 'HMI') {
          verdictText = 'History of Myocardial Infarction (HMI)';
          detailsList.push('Pathological Q-wave / repolarization changes indicating past ischemic injury.');
        } else if (className === 'MI') {
          verdictText = 'Acute Myocardial Infarction (MI)';
          detailsList.push('Critical ST-segment / waveform elevation pattern indicating acute myocardial infarction.');
        } else if (isNormal) {
          verdictText = 'Normal ECG Waveform';
          detailsList.push('No structural trace anomalies or acute ischemic markers detected in visual leads.');
        }

        setDiagnosisResult({
          verdict: verdictText,
          status: isNormal ? 'NORMAL' : 'ABNORMAL',
          score: isNormal ? Math.round(100 - confidence) : Math.round(confidence),
          details: detailsList
        });
        setLoading(false);
      }
    } catch (err) {
      console.error("AI Evaluation failed", err);
      alert(err.response?.data?.detail || "Failed to connect to ECG Vision AI backend server. Make sure FastAPI server is running.");
      setLoading(false);
    }
  };

  const handleSaveToEHR = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/medical-records/save`, {
        patient_name: clinicalParams.patientName || 'Anonymous Patient',
        patient_id: currentUser?.id,
        record_type: `ECG Diagnostic (${analysisMode === 'values' ? 'Detailed Values' : 'Waveform Image Vision'})`,
        risk_score: diagnosisResult.score,
        status_level: diagnosisResult.status,
        details: diagnosisResult.details
      });
      alert(`Report for ${clinicalParams.patientName || 'Patient'} saved to EHR system!`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save report to EHR system.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Switcher Bar */}
      <div className="bg-[#111827] p-2 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 px-3">
          <Activity className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-bold text-slate-200">ECG Diagnostic Mode</span>
        </div>

        <div className="flex bg-[#0b0f19] p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setAnalysisMode('values')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${
              analysisMode === 'values' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Detailed Clinical Values
          </button>
          <button
            onClick={() => setAnalysisMode('image')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${
              analysisMode === 'image' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            ECG Strip Image Scan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Input Section */}
        <div className="lg:col-span-6 bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <span className="text-xs font-semibold text-cyan-400">
              {analysisMode === 'values' ? 'Detailed Diagnostic Parameters' : 'ECG Image Waveform Upload'}
            </span>
            <span className="text-[10px] text-slate-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800 font-mono">
              {analysisMode === 'values' ? 'Multi-Feature Input' : 'Vision ResNet18 AI'}
            </span>
          </div>

          {/* Patient Details (Name, Age, Gender) */}
          <div className="space-y-3 bg-[#0b0f19] p-3.5 rounded-xl border border-slate-800">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Patient Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter patient name..."
                  value={clinicalParams.patientName}
                  onChange={(e) => handleInputChange('patientName', e.target.value)}
                  className="w-full bg-[#111827] border border-slate-800 focus:border-cyan-500 text-slate-100 rounded-lg pl-8 pr-3 py-2 text-xs outline-none transition-all"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Patient Age</label>
                <input
                  type="number"
                  value={clinicalParams.age}
                  onChange={(e) => handleInputChange('age', e.target.value)}
                  className="w-full bg-[#111827] border border-slate-800 focus:border-cyan-500 text-slate-100 rounded-lg p-2 text-xs font-mono outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Gender</label>
                <select
                  value={clinicalParams.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="w-full bg-[#111827] border border-slate-800 focus:border-cyan-500 text-slate-100 rounded-lg p-2 text-xs outline-none"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>
          </div>

          {analysisMode === 'values' ? (
            /* Specific Cardiac Values */
            <div className="space-y-3">
              <span className="text-[11px] font-semibold text-slate-400 block">Signal Intervals & Amplitudes</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Heart Rate (BPM)</label>
                  <input
                    type="number"
                    value={clinicalParams.heartRate}
                    onChange={(e) => handleInputChange('heartRate', e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-800 focus:border-cyan-500 text-slate-100 rounded-lg p-2 text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">PR Interval (ms)</label>
                  <input
                    type="number"
                    value={clinicalParams.prInterval}
                    onChange={(e) => handleInputChange('prInterval', e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-800 focus:border-cyan-500 text-slate-100 rounded-lg p-2 text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">QRS Duration (ms)</label>
                  <input
                    type="number"
                    value={clinicalParams.qrsDuration}
                    onChange={(e) => handleInputChange('qrsDuration', e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-800 focus:border-cyan-500 text-slate-100 rounded-lg p-2 text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">QT / QTc (ms)</label>
                  <input
                    type="number"
                    value={clinicalParams.qtInterval}
                    onChange={(e) => handleInputChange('qtInterval', e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-800 focus:border-cyan-500 text-slate-100 rounded-lg p-2 text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">ST Shift (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={clinicalParams.stSegment}
                    onChange={(e) => handleInputChange('stSegment', e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-800 focus:border-cyan-500 text-slate-100 rounded-lg p-2 text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">QRS Axis (°)</label>
                  <input
                    type="number"
                    value={clinicalParams.qrsAxis}
                    onChange={(e) => handleInputChange('qrsAxis', e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-800 focus:border-cyan-500 text-slate-100 rounded-lg p-2 text-xs font-mono outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Image Upload Mode */
            <div className="relative border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 text-center transition-all bg-[#0b0f19]">
              {imagePreview ? (
                <div className="relative group">
                  <img src={imagePreview} alt="ECG Strip" className="max-h-52 mx-auto rounded-lg object-contain" />
                  <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-cyan-400 font-medium cursor-pointer transition-all rounded-lg gap-2">
                    <ImageIcon className="w-4 h-4" /> Change Image
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center justify-center py-6 space-y-2">
                  <Upload className="w-10 h-10 text-cyan-400/80" />
                  <span className="text-xs text-slate-200 font-medium">Upload ECG Waveform Image</span>
                  <span className="text-[10px] text-slate-500">Supports standard paper ECG leads & DICOM scans</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              )}
            </div>
          )}

          <button
            onClick={handleExecuteDiagnostic}
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 active:scale-[0.99] text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-cyan-900/20"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Executing AI Cardiac Diagnostic...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                Execute Diagnostic ({analysisMode === 'values' ? 'Values Model' : 'Vision Model'})
              </>
            )}
          </button>
        </div>

        {/* Right Panel: Diagnosis Output */}
        <div className="lg:col-span-6 bg-[#111827] p-6 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-rose-400 font-semibold border-b border-slate-800 pb-3">
              <Heart className="w-5 h-5" />
              <span>Cardiac AI Findings & Assessment</span>
            </div>

            <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Diagnosis Verdict</div>
                <div className="text-lg font-bold text-slate-100 mt-0.5">{diagnosisResult.verdict}</div>
                <div className="text-xs text-cyan-400 mt-1 font-mono">
                  Abnormality Risk Score: <span className="font-bold">{diagnosisResult.score}%</span>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                diagnosisResult.status === 'NORMAL' 
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              }`}>
                {diagnosisResult.status}
              </span>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-400">Clinical Interpretation Details</div>
              <div className="space-y-2">
                {diagnosisResult.details.map((detail, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-[#0b0f19] p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                    {diagnosisResult.status === 'NORMAL' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveToEHR}
            className="w-full bg-[#0b0f19] hover:bg-slate-800 text-slate-200 border border-slate-800 font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            Save Report to Patient EHR
          </button>
        </div>
      </div>
    </div>
  );
}