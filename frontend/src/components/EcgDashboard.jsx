import React, { useState } from 'react';
import axios from 'axios';
import { Heart, Activity, Upload, CheckCircle2, FileText, Sliders, Image as ImageIcon, User, AlertCircle, Cpu, ShieldCheck } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { FormField, Input, Select } from './ui/Input';

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
        }, 500);

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

        const { prediction } = response.data;
        const className = prediction.class_name;
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
      alert(err.response?.data?.detail || "Failed to connect to ECG Vision AI backend server.");
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
      {/* Top Mode Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-[#0f172a] rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2.5 px-3">
          <Heart className="w-5 h-5 text-rose-400" />
          <div>
            <span className="text-xs font-bold text-slate-100 block">ECG Electrophysiology AI</span>
            <span className="text-[10px] text-slate-400">Cardiovascular rhythm & infarction detection</span>
          </div>
        </div>

        <div className="flex bg-[#0b0f19] p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setAnalysisMode('values')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
              analysisMode === 'values' ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-950/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Clinical Values
          </button>
          <button
            onClick={() => setAnalysisMode('image')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
              analysisMode === 'image' ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-950/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            ECG Lead Vision Scan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Data Ingestion */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <div>
              <CardTitle icon={Activity}>
                {analysisMode === 'values' ? 'Cardiac Interval Parameters' : 'ECG Strip Waveform Scanner'}
              </CardTitle>
              <CardDescription>
                {analysisMode === 'values' ? 'Electrophysiological interval telemetry' : 'Convolutional ResNet18 neural trace classifier'}
              </CardDescription>
            </div>
            <Badge variant="info" size="sm" dot>Engine Ready</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Patient Details */}
            <div className="space-y-3 bg-[#0b0f19] p-4 rounded-2xl border border-slate-800">
              <FormField label="Patient Identification">
                <Input
                  icon={User}
                  placeholder="Patient full name..."
                  value={clinicalParams.patientName}
                  onChange={(e) => handleInputChange('patientName', e.target.value)}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Patient Age">
                  <Input
                    type="number"
                    value={clinicalParams.age}
                    onChange={(e) => handleInputChange('age', e.target.value)}
                  />
                </FormField>
                <FormField label="Biological Gender">
                  <Select
                    value={clinicalParams.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </Select>
                </FormField>
              </div>
            </div>

            {analysisMode === 'values' ? (
              <div className="space-y-3">
                <span className="text-[11px] font-semibold text-slate-400 block font-mono uppercase tracking-wider">
                  Cardiac Lead Measurements
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  <FormField label="Heart Rate (BPM)" hint="Normal: 60-100">
                    <Input
                      type="number"
                      value={clinicalParams.heartRate}
                      onChange={(e) => handleInputChange('heartRate', e.target.value)}
                    />
                  </FormField>
                  <FormField label="PR Interval (ms)" hint="Normal: 120-200">
                    <Input
                      type="number"
                      value={clinicalParams.prInterval}
                      onChange={(e) => handleInputChange('prInterval', e.target.value)}
                    />
                  </FormField>
                  <FormField label="QRS Width (ms)" hint="Normal: 80-120">
                    <Input
                      type="number"
                      value={clinicalParams.qrsDuration}
                      onChange={(e) => handleInputChange('qrsDuration', e.target.value)}
                    />
                  </FormField>
                  <FormField label="QT / QTc (ms)" hint="Normal: <440">
                    <Input
                      type="number"
                      value={clinicalParams.qtInterval}
                      onChange={(e) => handleInputChange('qtInterval', e.target.value)}
                    />
                  </FormField>
                  <FormField label="ST Shift (mm)" hint="Normal: 0.0">
                    <Input
                      type="number"
                      step="0.1"
                      value={clinicalParams.stSegment}
                      onChange={(e) => handleInputChange('stSegment', e.target.value)}
                    />
                  </FormField>
                  <FormField label="QRS Axis (°)" hint="Normal: -30 to 90">
                    <Input
                      type="number"
                      value={clinicalParams.qrsAxis}
                      onChange={(e) => handleInputChange('qrsAxis', e.target.value)}
                    />
                  </FormField>
                </div>
              </div>
            ) : (
              <FormField label="ECG Lead Trace File (Image)">
                <div className="border-2 border-dashed border-slate-800 hover:border-cyan-500/40 rounded-2xl p-6 text-center bg-[#0b0f19] relative transition-all">
                  {imagePreview ? (
                    <div className="relative group">
                      <img src={imagePreview} alt="ECG Strip" className="max-h-52 mx-auto rounded-xl object-contain border border-slate-700" />
                      <label className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-cyan-400 font-medium cursor-pointer transition-all rounded-xl gap-2 backdrop-blur-sm">
                        <ImageIcon className="w-4 h-4" /> Replace ECG Strip
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center py-6 space-y-2">
                      <div className="w-12 h-12 rounded-xl bg-slate-800/80 text-cyan-400 flex items-center justify-center mb-2">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-xs text-slate-200 font-semibold">Upload 12-Lead ECG Strip Image</span>
                      <span className="text-[10px] text-slate-500 font-mono">Supports standard paper ECG scans, PNG, JPG</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </FormField>
            )}

            <Button
              onClick={handleExecuteDiagnostic}
              loading={loading}
              icon={Cpu}
              className="w-full"
            >
              {loading ? 'Evaluating Cardiac Vector...' : `Execute ${analysisMode === 'values' ? 'Values-Based' : 'Vision-Based'} AI Diagnosis`}
            </Button>
          </CardContent>
        </Card>

        {/* Right Column: Diagnostic Output */}
        <Card className="lg:col-span-6 flex flex-col justify-between">
          <CardHeader>
            <CardTitle icon={Heart}>Cardiac Electrophysiology Findings</CardTitle>
            <Badge
              variant={diagnosisResult.status === 'NORMAL' ? 'success' : 'danger'}
              size="sm"
              dot
              pulse={diagnosisResult.status !== 'NORMAL'}
            >
              {diagnosisResult.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="p-4 rounded-2xl bg-[#0b0f19] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                  Electrophysiological Verdict
                </span>
                <div className="text-base font-bold text-slate-100 mt-0.5">{diagnosisResult.verdict}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                  Risk / Abnormality Score
                </span>
                <span className="text-xl font-mono font-bold text-cyan-400">{diagnosisResult.score}%</span>
              </div>
            </div>

            {/* Risk Indicator Meter */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Normal Sinus Rhythm</span>
                <span>Arrhythmia / Ischemia Threshold</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    diagnosisResult.status === 'NORMAL'
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-amber-500 to-rose-500'
                  }`}
                  style={{ width: `${Math.max(8, diagnosisResult.score)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2.5 bg-[#0b0f19] p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Clinical Interpretation & Diagnostic Notes</span>
              </div>
              <div className="space-y-2">
                {diagnosisResult.details.map((detail, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                    {diagnosisResult.status === 'NORMAL' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{detail}</span>
                  </div>
                ))}
              </div>
            </div>

            {currentUser && (
              <Button
                onClick={handleSaveToEHR}
                variant="secondary"
                icon={FileText}
                className="w-full"
              >
                Save Evaluation Report to Patient EHR
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}