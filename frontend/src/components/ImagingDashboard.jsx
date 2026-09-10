import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileImage, Cpu, CheckCircle2, Trash2, Save, Brain, Activity } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { FormField, Input } from './ui/Input';
import Alert from './ui/Alert';
import EmptyState from './ui/EmptyState';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function ImagingDashboard({ currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('mri');
  const [patientName, setPatientName] = useState(
    currentUser?.role === 'patient' ? currentUser?.full_name : ''
  );
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const modules = [
    { id: 'mri', name: 'Brain & Body MRI', subtitle: 'Magnetic Resonance Imaging for Tissues & Tumors', icon: Brain, endpoint: '/api/mri/detect' },
    { id: 'xray', name: 'Diagnostic X-Ray', subtitle: 'Chest & Bone Radiographic Pathological Analysis', icon: FileImage, endpoint: '/api/xray/detect' },
    { id: 'ultrasound', name: 'Ultrasound Scan', subtitle: 'Abdominal & Soft Tissue Ultrasound Evaluation', icon: Activity, endpoint: '/api/ultrasound/detect' },
  ];

  const currentModule = modules.find(m => m.id === activeSubTab);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAnalysisResult(null);
      setErrorMessage('');
      setSavedSuccess(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysisResult(null);
    setErrorMessage('');
    setSavedSuccess(false);
  };

  const handleRunAnalysis = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a scan image first.');
      return;
    }
    setLoading(true);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (patientName) {
      formData.append('patient_name', patientName);
    }

    try {
      const res = await axios.post(`${API_BASE_URL}${currentModule.endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const payload = res.data.data || res.data;
      setAnalysisResult(payload);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || err.response?.statusText || 'Analysis request failed. Neural Engine returned error.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToRecord = async () => {
    if (!analysisResult) return;
    try {
      await axios.post(`${API_BASE_URL}/api/medical-records/save`, {
        patient_id: currentUser?.id,
        record_type: `${currentModule.name} Evaluation`,
        risk_score: analysisResult.confidence || 85,
        status_level: analysisResult.status_level || 'LOW_RISK',
        details: analysisResult.details || [analysisResult.diagnosis]
      });
      setSavedSuccess(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save record to EHR system.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Modality Selector Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const isActive = activeSubTab === mod.id;
          return (
            <button
              key={mod.id}
              onClick={() => {
                setActiveSubTab(mod.id);
                handleRemoveImage();
              }}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3 ${
                isActive
                  ? 'bg-gradient-to-r from-teal-50 to-cyan-50/90 border-cyan-400/60 shadow-[0_4px_14px_rgba(6,182,212,0.14)] text-cyan-950 font-semibold -translate-y-0.5'
                  : 'bg-[#f0f4f8] border-white/90 text-slate-600 hover:text-slate-900 shadow-neu-sm hover:shadow-neu-flat hover:-translate-y-0.5'
              }`}
            >
              <div className={`p-2.5 rounded-xl border ${isActive ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white border-transparent shadow-sm' : 'bg-white text-slate-500 border-slate-200 shadow-neu-sm'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-semibold ${isActive ? 'text-cyan-900' : 'text-slate-800'}`}>{mod.name}</div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">{mod.id.toUpperCase()} Vision Pipeline</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Ingestion Console */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle icon={currentModule.icon}>{currentModule.name} Ingestion</CardTitle>
              <CardDescription>{currentModule.subtitle}</CardDescription>
            </div>
            <Badge variant="info" size="sm" dot>Engine Ready</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <Alert variant="error" onDismiss={() => setErrorMessage('')}>
                {errorMessage}
              </Alert>
            )}

            <FormField label="Patient Identification">
              <Input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter patient full name..."
              />
            </FormField>

            <FormField label="Medical Scan File (DICOM / Image)">
              {!previewUrl ? (
                <label className="border-2 border-dashed border-slate-200 hover:border-cyan-400 bg-slate-50/60 hover:bg-cyan-50/20 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm group-hover:bg-cyan-50 text-slate-400 group-hover:text-cyan-600 flex items-center justify-center mb-3 transition-colors border border-slate-100">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Click or drag scan to upload</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-1">Supports PNG, JPG, JPEG</span>
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
              ) : (
                <div className="relative bg-slate-50/80 border border-slate-200 rounded-2xl p-3 flex flex-col items-center overflow-hidden shadow-inner">
                  <img src={previewUrl} alt="Scan Preview" className="max-h-64 rounded-xl object-contain" />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-4 right-4 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              )}
            </FormField>

            <Button
              onClick={handleRunAnalysis}
              disabled={!selectedFile}
              loading={loading}
              icon={Cpu}
              className="w-full"
            >
              {loading ? 'Evaluating Radiographic Features...' : 'Execute Neural AI Diagnostic Scan'}
            </Button>
          </CardContent>
        </Card>

        {/* Right Column: Radiologic Diagnostic Report */}
        <Card className="lg:col-span-7 flex flex-col justify-center">
          {!analysisResult ? (
            <EmptyState
              icon={FileImage}
              title="Awaiting Radiologic Scan"
              description="Upload a patient medical scan on the left and trigger the neural diagnostic engine to generate findings."
            />
          ) : (
            <CardContent className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#f4f7fa] border border-white/90 shadow-neu-panel">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                    Diagnostic Modality
                  </span>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{currentModule.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={analysisResult.status_level === 'HIGH_RISK' ? 'danger' : 'success'}
                    size="lg"
                    dot
                  >
                    {analysisResult.status_level || 'EVALUATED'}
                  </Badge>
                  {analysisResult.confidence && (
                    <Badge variant="info" size="lg">
                      {analysisResult.confidence}% Conf.
                    </Badge>
                  )}
                </div>
              </div>

              {analysisResult.annotated_image && (
                <div className="bg-slate-100/70 p-3.5 rounded-2xl border border-slate-200/80 shadow-[inset_0_1px_3px_rgba(0,0,0,0.04)] flex flex-col items-center">
                  <div className="text-[10px] text-slate-500 font-mono mb-2 self-start uppercase tracking-wider font-semibold">
                    Computer Vision Feature Map
                  </div>
                  <img
                    src={analysisResult.annotated_image}
                    alt="Neural Detection"
                    className="max-h-72 rounded-xl object-contain shadow-sm border border-slate-200 bg-white"
                  />
                </div>
              )}

              <div className="space-y-3 bg-white/95 p-4 rounded-2xl border border-slate-200/70 shadow-[0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)]">
                <div className="text-xs font-semibold text-cyan-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-600" />
                  <span>Primary Finding: {analysisResult.diagnosis || 'Evaluation completed.'}</span>
                </div>
                <div className="space-y-1.5 pl-6 border-l-2 border-cyan-200">
                  {(analysisResult.details || ['No pathological abnormalities detected in scanned region.']).map((d, i) => (
                    <p key={i} className="text-xs text-slate-700 leading-relaxed">{d}</p>
                  ))}
                </div>
              </div>

              {currentUser && (
                <Button
                  onClick={handleSaveToRecord}
                  disabled={savedSuccess}
                  variant={savedSuccess ? 'successOutline' : 'secondary'}
                  icon={savedSuccess ? CheckCircle2 : Save}
                  className="w-full"
                >
                  {savedSuccess ? 'Saved to Patient Medical Record (EHR)' : 'Save Evaluation to Patient EHR'}
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}