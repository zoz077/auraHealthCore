import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Bone, Brain, Activity, Eye, ActivitySquare, Disc, Camera, Video, UploadCloud } from 'lucide-react';

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
    } catch (err) {
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
          } catch (err) {
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

  return (
    <div className="space-y-6">
      {/* Module Navigation Header */}
      <div className="grid grid-cols-2 md:grid-cols-6 bg-[#111827] p-1.5 rounded-2xl border border-slate-800 gap-2">
        <button onClick={() => resetState('tumor')} className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${activeSubTab === 'tumor' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
          <Brain className="w-3.5 h-3.5" /> Brain Tumor U-Net
        </button>
        <button onClick={() => resetState('alzheimer')} className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${activeSubTab === 'alzheimer' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
          <Disc className="w-3.5 h-3.5" /> Alzheimer
        </button>
        <button onClick={() => resetState('eeg')} className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${activeSubTab === 'eeg' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
          <Activity className="w-3.5 h-3.5" /> EEG Signals
        </button>
        <button onClick={() => resetState('vision')} className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${activeSubTab === 'vision' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
          <Eye className="w-3.5 h-3.5" /> Vision Exam
        </button>
        <button onClick={() => resetState('parkinson')} className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${activeSubTab === 'parkinson' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
          <ActivitySquare className="w-3.5 h-3.5" /> Parkinson ResNet
        </button>
        <button onClick={() => resetState('spine')} className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${activeSubTab === 'spine' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
          <Bone className="w-3.5 h-3.5" /> Spine MRI
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Inputs */}
        <div className="lg:col-span-5 bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">
            {activeSubTab === 'tumor' && 'Brain MRI Tumor Analysis (U-Net)'}
            {activeSubTab === 'alzheimer' && 'Alzheimer MRI Scan Input'}
            {activeSubTab === 'eeg' && 'EEG Signal Simulation'}
            {activeSubTab === 'vision' && 'Vision & Ocular Movement Exam'}
            {activeSubTab === 'parkinson' && 'Parkinson Spiral Drawing Scan'}
            {activeSubTab === 'spine' && 'Lumbar Spine MRI Scan Input'}
          </h3>

          {['tumor', 'alzheimer', 'parkinson', 'spine'].includes(activeSubTab) && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-800 rounded-2xl p-6 text-center bg-[#0b0f19]">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-xl border border-slate-700" />
                ) : (
                  <div className="space-y-2">
                    <UploadCloud className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-500">Upload Image File (DICOM / PNG / JPEG)</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                      setPreviewUrl(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                  className="mt-4 text-xs text-slate-400 block w-full"
                />
              </div>
              <button
                onClick={() => handleFileUploadAndAnalyze(
                  activeSubTab === 'tumor' ? 'brain-tumor' : 
                  activeSubTab === 'parkinson' ? 'parkinsons' : activeSubTab
                )}
                disabled={loading}
                className="w-full bg-cyan-600 hover:bg-cyan-500 font-semibold text-xs py-3 rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? 'Analyzing Neural Scan...' : 'Run AI Diagnostic Evaluation'}
              </button>
            </div>
          )}

          {activeSubTab === 'eeg' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">Simulate 178-point EEG brain wave input for classification.</p>
              <button onClick={() => handleEegAnalyze(false)} disabled={loading} className="w-full bg-slate-800 hover:bg-slate-700 text-xs py-3 rounded-xl text-slate-200">
                Test Normal Brain Waves
              </button>
              <button onClick={() => handleEegAnalyze(true)} disabled={loading} className="w-full bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs py-3 rounded-xl">
                Test Epileptic Seizure Waves
              </button>
            </div>
          )}

          {activeSubTab === 'vision' && (
            <div className="space-y-4">
              <div className="flex bg-[#0b0f19] p-1 rounded-xl border border-slate-800 gap-1 text-xs">
                <button onClick={() => { setVisionMode('camera'); startCamera(); }} className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 ${visionMode === 'camera' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
                  <Camera className="w-3.5 h-3.5" /> Live Camera
                </button>
                <button onClick={() => { setVisionMode('video'); stopCamera(); }} className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 ${visionMode === 'video' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
                  <Video className="w-3.5 h-3.5" /> Upload Video
                </button>
                <button onClick={() => { setVisionMode('sliders'); stopCamera(); }} className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 ${visionMode === 'sliders' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
                  Manual Adjust
                </button>
              </div>

              {visionMode === 'camera' && (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                    {!isCameraActive && (
                      <button onClick={startCamera} className="absolute bg-cyan-600 text-white text-xs px-4 py-2 rounded-xl flex items-center gap-2">
                        <Camera className="w-4 h-4" /> Start Camera
                      </button>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              )}

              {visionMode === 'video' && (
                <div className="border-2 border-dashed border-slate-800 rounded-2xl p-6 text-center bg-[#0b0f19]">
                  <p className="text-xs text-slate-400 mb-2">Upload facial & ocular movement video (.mp4 / .webm)</p>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      if (e.target.files[0]) setSelectedFile(e.target.files[0]);
                    }}
                    className="text-xs text-slate-400 block w-full"
                  />
                </div>
              )}

              {visionMode === 'sliders' && (
                <div className="space-y-3 bg-[#0b0f19] p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Facial Asymmetry Ratio: {asymmetry}</label>
                    <input type="range" min="0.0" max="0.4" step="0.01" value={asymmetry} onChange={e => setAsymmetry(parseFloat(e.target.value))} className="w-full" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Motor Tremor Variance: {tremor}</label>
                    <input type="range" min="0.1" max="25.0" step="0.5" value={tremor} onChange={e => setTremor(parseFloat(e.target.value))} className="w-full" />
                  </div>
                </div>
              )}

              <button onClick={handleVisionAnalyze} disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500 font-semibold text-xs py-3 rounded-xl transition-all">
                {loading ? 'Analyzing...' : 'Run AI Vision Assessment'}
              </button>
            </div>
          )}
        </div>

        {/* Right Panel: AI Results & Segmentation Data */}
        <div className="lg:col-span-7 bg-[#111827] p-6 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Diagnostic Results & AI Report</h3>

          {result ? (
            <div className="space-y-4">
              <div className="p-4 bg-[#0b0f19] rounded-xl border border-cyan-500/30 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 block">Primary Diagnostic Finding:</span>
                  <h4 className="text-lg font-bold text-cyan-400">{result.diagnosis}</h4>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">AI Confidence Score:</span>
                  <div className="text-lg font-mono font-bold text-emerald-400">{result.confidence}%</div>
                </div>
              </div>

              {/* U-Net Tumor Segmentation Info */}
              {result.tumor_area_percentage !== undefined && (
                <div className="p-4 bg-[#0b0f19] rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 font-semibold block">U-Net Tumor Segmentation Coverage:</span>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">Tumor Area / Total Brain Volume:</span>
                    <span className="font-mono text-cyan-400 font-bold">{result.tumor_area_percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full" style={{ width: `${Math.min(100, result.tumor_area_percentage * 3)}%` }}></div>
                  </div>
                </div>
              )}

              {/* Probabilities Breakdown */}
              {result.probabilities && (
                <div className="space-y-2.5 mt-4 bg-[#0b0f19] p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-semibold block">Differential Class Distribution:</span>
                  {Object.entries(result.probabilities).map(([cls, prob]) => (
                    <div key={cls} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{cls}</span>
                        <span className="font-mono font-semibold">{prob}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full" style={{ width: `${prob}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-20 text-xs">
              Select a diagnostic module on the left and submit data to view model inferences.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}