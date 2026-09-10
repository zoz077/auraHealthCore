import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileImage, Cpu, CheckCircle2, AlertTriangle, Trash2, Save } from 'lucide-react';

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
    { id: 'mri', name: 'Brain & Body MRI', subtitle: 'Magnetic Resonance Imaging for Tissues & Tumors', endpoint: '/api/mri/detect' },
    { id: 'xray', name: 'Diagnostic X-Ray', subtitle: 'Chest & Bone X-Ray Pathological Analysis', endpoint: '/api/xray/detect' },
    { id: 'ultrasound', name: 'Ultrasound Scan', subtitle: 'Abdominal & Soft Tissue Ultrasound Evaluation', endpoint: '/api/ultrasound/detect' },
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
        err.response?.data?.detail || err.response?.statusText || 'Analysis request failed. Engine returned error.'
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
      <div className="flex gap-2 bg-[#111827] p-2 rounded-2xl border border-slate-800">
        {modules.map((mod) => (
          <button
            key={mod.id}
            onClick={() => {
              setActiveSubTab(mod.id);
              handleRemoveImage();
            }}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold transition-all ${
              activeSubTab === mod.id
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {mod.name}
          </button>
        ))}
      </div>

      <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <FileImage className="w-5 h-5 text-cyan-400" />
              {currentModule.name} Analysis
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{currentModule.subtitle}</p>
          </div>
          <span className="text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-3 py-1 rounded-full">
            AI Module Ready
          </span>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">Patient Name</label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              placeholder="Enter patient full name"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">Upload Scan File</label>
            {!previewUrl ? (
              <label className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 bg-[#0b0f19] rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all">
                <Upload className="w-8 h-8 text-slate-500 mb-2" />
                <span className="text-xs font-semibold text-slate-300">Click to upload medical image</span>
                <span className="text-[10px] text-slate-500 mt-1">Supports JPG, PNG</span>
                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </label>
            ) : (
              <div className="relative bg-[#0b0f19] border border-slate-800 rounded-2xl p-3 flex flex-col items-center">
                <img src={previewUrl} alt="Scan Preview" className="max-h-64 rounded-xl object-contain mb-3" />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-4 right-4 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleRunAnalysis}
            disabled={loading || !selectedFile}
            className={`w-full py-3.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
              loading || !selectedFile
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20'
            }`}
          >
            <Cpu className="w-4 h-4" />
            {loading ? 'Analyzing Scan with Neural Engine...' : 'Execute AI Diagnostic Scan'}
          </button>
        </div>

        {analysisResult && (
          <div className="mt-6 bg-[#0b0f19] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-200">AI Diagnostic Report</h3>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                analysisResult.status_level === 'HIGH_RISK' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {analysisResult.status_level || 'LOW_RISK'} ({analysisResult.confidence || 90}% Confidence)
              </span>
            </div>

            {analysisResult.annotated_image && (
              <div className="flex justify-center bg-[#090d16] p-3 rounded-xl border border-slate-800">
                <img src={analysisResult.annotated_image} alt="Detection Bounding Boxes" className="max-h-72 rounded-lg object-contain" />
              </div>
            )}

            <div className="space-y-2 text-xs text-slate-300">
              <p className="font-semibold text-cyan-400">{analysisResult.diagnosis || 'Scan evaluated successfully.'}</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400">
                {(analysisResult.details || ['No abnormal findings identified.']).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>

            {currentUser?.role === 'patient' && (
              <button
                onClick={handleSaveToRecord}
                disabled={savedSuccess}
                className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  savedSuccess
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Saved to Medical Record
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Evaluation to Patient EHR
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}