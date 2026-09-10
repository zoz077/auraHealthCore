import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Bone, Brain, Activity, Eye, ActivitySquare, Disc, Camera, Video, UploadCloud, Save, ShieldCheck, Sliders } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { FormField } from './ui/Input';
import EmptyState from './ui/EmptyState';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function NeurologyDashboard({ currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('tumor');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [asymmetry, setAsymmetry] = useState(0.05);
  const [tremor, setTremor] = useState(2.0);

  const [visionMode, setVisionMode] = useState('camera');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch {
      alert('Camera access denied. Please grant permission in your browser.');
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const resetState = (tab) => {
    stopCamera();
    setActiveSubTab(tab);
    setResult(null);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleFileUploadAndAnalyze = async (endpoint) => {
    if (!selectedFile) return alert('Please upload an image file first.');
    setLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/neurology/${endpoint}`, formData);
      setResult(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Server evaluation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEegAnalyze = async (isSeizureSim = false) => {
    setLoading(true);
    const sampleSignals = Array.from({ length: 178 }, () =>
      isSeizureSim ? (Math.random() * 200 - 100) : (Math.random() * 20 - 10)
    );

    try {
      const res = await axios.post(`${API_BASE_URL}/api/neurology/eeg`, { signals: sampleSignals });
      setResult(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error processing EEG signals.');
    } finally {
      setLoading(false);
    }
  };

  const handleVisionAnalyze = async () => {
    setLoading(true);
    try {
      if (visionMode === 'camera' && isCameraActive && videoRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
          if (!blob) {
            setLoading(false);
            return alert('Failed to capture camera frame.');
          }
          const formData = new FormData();
          formData.append('file', blob, 'webcam_frame.jpg');

          try {
            const res = await axios.post(`${API_BASE_URL}/api/neurology/vision-exam-file`, formData);
            setResult(res.data);
          } catch {
            alert('Failed to analyze camera frame.');
          } finally {
            setLoading(false);
          }
        }, 'image/jpeg');
        return;
      }

      if (visionMode === 'video' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const res = await axios.post(`${API_BASE_URL}/api/neurology/vision-exam-file`, formData);
        setResult(res.data);
      } else {
        const metrics = [
          100.0, 100.0 * (1 + asymmetry), asymmetry * 100, asymmetry,
          tremor * 0.4, tremor * 0.6, tremor, tremor * 1.1, tremor * 0.9, 25.0
        ];
        const res = await axios.post(`${API_BASE_URL}/api/neurology/vision-exam`, { metrics });
        setResult(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Vision evaluation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToEHR = async () => {
    if (!result || !currentUser) return;
    try {
      const detailsList = [
        `Primary Finding: ${result.diagnosis}`,
        `Confidence Score: ${result.confidence}%`
      ];
      if (result.tumor_area_percentage !== undefined) {
        detailsList.push(`Tumor Area: ${result.tumor_area_percentage}%`);
      }
      if (result.probabilities) {
        const topClasses = Object.entries(result.probabilities)
          .map(([k, v]) => `${k}: ${v}%`)
          .join(', ');
        detailsList.push(`Differential Classes: ${topClasses}`);
      }

      await axios.post(`${API_BASE_URL}/api/medical-records/save`, {
        patient_id: currentUser.id,
        record_type: `Neurology AI (${activeSubTab.toUpperCase()})`,
        risk_score: parseFloat(result.confidence) || 0,
        status_level: Number(result.confidence) > 50 ? 'HIGH' : 'NORMAL',
        details: detailsList
      });
      alert('Neurology evaluation successfully saved to patient EHR!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save record to EHR.');
    }
  };

  const subtabs = [
    { id: 'tumor', label: 'Tumor U-Net', icon: Brain },
    { id: 'alzheimer', label: 'Alzheimer', icon: Disc },
    { id: 'eeg', label: 'EEG Signals', icon: Activity },
    { id: 'vision', label: 'Vision Exam', icon: Eye },
    { id: 'parkinson', label: 'Parkinson', icon: ActivitySquare },
    { id: 'spine', label: 'Spine MRI', icon: Bone },
  ];

  return (
    <div className="space-y-6">
      {/* Module Sub-navigation */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-[#f0f4f8] rounded-2xl border border-white/90 shadow-neu-sm">
        {subtabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => resetState(tab.id)}
              className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 ${
                isActive
                  ? 'bg-white text-cyan-900 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/80 -translate-y-0.5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Clinical Input Console */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle icon={Brain}>Neurological Data Ingestion</CardTitle>
              <CardDescription>
                {activeSubTab === 'tumor' && 'Brain MRI Tumor Segmentation (U-Net Deep Learning)'}
                {activeSubTab === 'alzheimer' && 'Alzheimer Structural MRI Diagnostic Scan'}
                {activeSubTab === 'eeg' && 'EEG Micro-voltage Neural Telemetry Signal Analyzer'}
                {activeSubTab === 'vision' && 'Ocular Motor Tracking & Cranial Nerve Vision Assessment'}
                {activeSubTab === 'parkinson' && 'Kinematic Spiral Movement Feature Extractor'}
                {activeSubTab === 'spine' && 'Lumbar Spine Neuro-compression Assessment'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {['tumor', 'alzheimer', 'parkinson', 'spine'].includes(activeSubTab) && (
              <div className="space-y-4">
                <FormField label="Scan Ingestion File">
                  <div className="border-2 border-dashed border-slate-200 hover:border-cyan-400 rounded-2xl p-6 text-center bg-slate-50/60 hover:bg-cyan-50/20 transition-all">
                    {previewUrl ? (
                      <div className="relative inline-block">
                        <img src={previewUrl} alt="Scan Preview" className="max-h-48 mx-auto rounded-xl object-contain border border-slate-200 shadow-sm bg-white" />
                        <button
                          onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                          className="mt-2 text-[11px] text-rose-600 hover:underline block mx-auto font-medium"
                        >
                          Clear image
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-700">Upload Neurological Scan</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Supports PNG, JPG, DICOM preview</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files[0]) {
                              setSelectedFile(e.target.files[0]);
                              setPreviewUrl(URL.createObjectURL(e.target.files[0]));
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </FormField>

                <Button
                  onClick={() => handleFileUploadAndAnalyze(
                    activeSubTab === 'tumor' ? 'brain-tumor' : 
                    activeSubTab === 'parkinson' ? 'parkinsons' : activeSubTab
                  )}
                  disabled={!selectedFile}
                  loading={loading}
                  icon={Brain}
                  className="w-full"
                >
                  {loading ? 'Evaluating Neural Model...' : 'Execute Neurological AI Analysis'}
                </Button>
              </div>
            )}

            {activeSubTab === 'eeg' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Stream 178-point EEG cerebral microvoltage waveform vectors into the seizure classification pipeline:
                </p>
                <Button
                  onClick={() => handleEegAnalyze(false)}
                  disabled={loading}
                  variant="secondary"
                  icon={Activity}
                  className="w-full"
                >
                  Simulate Normal Brain Wave Vector
                </Button>
                <Button
                  onClick={() => handleEegAnalyze(true)}
                  disabled={loading}
                  variant="dangerOutline"
                  icon={Activity}
                  className="w-full"
                >
                  Simulate Ictal / Seizure Wave Vector
                </Button>
              </div>
            )}

            {activeSubTab === 'vision' && (
              <div className="space-y-4">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 text-xs">
                  <button
                    onClick={() => { setVisionMode('camera'); startCamera(); }}
                    className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-all ${
                      visionMode === 'camera' ? 'bg-white text-cyan-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" /> Live Camera
                  </button>
                  <button
                    onClick={() => { setVisionMode('video'); stopCamera(); }}
                    className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-all ${
                      visionMode === 'video' ? 'bg-white text-cyan-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" /> Video File
                  </button>
                  <button
                    onClick={() => { setVisionMode('sliders'); stopCamera(); }}
                    className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-all ${
                      visionMode === 'sliders' ? 'bg-white text-cyan-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" /> Metrics
                  </button>
                </div>

                {visionMode === 'camera' && (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 aspect-video flex items-center justify-center shadow-inner">
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                      {!isCameraActive && (
                        <Button onClick={startCamera} icon={Camera} size="sm" className="absolute">
                          Activate Ocular Camera
                        </Button>
                      )}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                )}

                {visionMode === 'video' && (
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center bg-slate-50/60">
                    <Video className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-600 mb-2">Upload facial & ocular tracking video</p>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        if (e.target.files[0]) setSelectedFile(e.target.files[0]);
                      }}
                      className="text-xs text-slate-500 block w-full mx-auto"
                    />
                  </div>
                )}

                {visionMode === 'sliders' && (
                  <div className="space-y-3 bg-white/90 p-4 rounded-xl border border-slate-200 text-xs shadow-sm">
                    <div>
                      <div className="flex justify-between text-slate-600 mb-1">
                        <span>Facial Asymmetry Ratio</span>
                        <span className="font-mono text-cyan-700 font-semibold">{asymmetry}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="0.4"
                        step="0.01"
                        value={asymmetry}
                        onChange={e => setAsymmetry(parseFloat(e.target.value))}
                        className="w-full accent-cyan-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-600 mb-1">
                        <span>Motor Tremor Variance</span>
                        <span className="font-mono text-cyan-700 font-semibold">{tremor} Hz</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="25.0"
                        step="0.5"
                        value={tremor}
                        onChange={e => setTremor(parseFloat(e.target.value))}
                        className="w-full accent-cyan-600"
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleVisionAnalyze}
                  loading={loading}
                  icon={Eye}
                  className="w-full"
                >
                  {loading ? 'Processing Vision Model...' : 'Run Cranial Vision Assessment'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Neurological Assessment Findings */}
        <Card className="lg:col-span-7 flex flex-col justify-center">
          {!result ? (
            <EmptyState
              icon={Brain}
              title="Awaiting Neurological Ingestion"
              description="Select a modality on the left and submit scan or telemetry data to execute AI model evaluation."
            />
          ) : (
            <CardContent className="space-y-5">
              <div className="p-5 rounded-2xl bg-[#f4f7fa] border border-white/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-neu-panel">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                    Primary Neurological Diagnosis
                  </span>
                  <div className="text-base font-bold text-cyan-900 mt-0.5">{result.diagnosis}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={Number(result.confidence) > 50 ? 'danger' : 'success'} size="lg" dot>
                    {Number(result.confidence) > 50 ? 'Pathology Detected' : 'Normal / Low Risk'}
                  </Badge>
                  <Badge variant="info" size="lg">
                    {result.confidence}% Conf.
                  </Badge>
                </div>
              </div>

              {/* U-Net Tumor Segmentation Info */}
              {result.tumor_area_percentage !== undefined && (
                <div className="p-4 bg-white/95 rounded-2xl border border-slate-200/70 space-y-2 shadow-[0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">U-Net Tumor Area Coverage</span>
                    <span className="font-mono text-rose-600 font-bold">{result.tumor_area_percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)]">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, result.tumor_area_percentage * 3))}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block">Relative voxel ratio over total cranial volume</span>
                </div>
              )}

              {/* Probabilities Breakdown */}
              {result.probabilities && (
                <div className="space-y-2.5 bg-white/95 p-4 rounded-2xl border border-slate-200/70 shadow-[0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-600" />
                    <span>Differential Probability Distribution</span>
                  </div>
                  {Object.entries(result.probabilities).map(([cls, prob]) => (
                    <div key={cls} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span className="font-medium">{cls}</span>
                        <span className="font-mono text-slate-800 font-semibold">{prob}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden shadow-inner">
                        <div
                          className="bg-gradient-to-r from-teal-500 to-cyan-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${prob}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {currentUser && (
                <Button
                  onClick={handleSaveToEHR}
                  variant="secondary"
                  icon={Save}
                  className="w-full"
                >
                  Save Neurological Assessment to Patient EHR
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}