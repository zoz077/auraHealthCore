import React, { useState } from 'react';
import axios from 'axios';
import { Bone, FileImage, Layers, Activity, UploadCloud, Save, ShieldCheck, CheckCircle2, AlertTriangle, Info, Sparkles } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import EmptyState from './ui/EmptyState';
import WorkstationPatientSelector from './WorkstationPatientSelector';
import { sendFindingToGeneralMedicine } from '../utils/generalMedicineIntegration';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function OrthopedicsDashboard({ currentUser, activeGmSessionUuid, setActiveGmSessionUuid, onNavigateToTab }) {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('xray');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [lastSavedRecordId, setLastSavedRecordId] = useState(null);
  const [lastSavedPatientId, setLastSavedPatientId] = useState(null);
  const [isSendingGm, setIsSendingGm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const subTabs = [
    { id: 'xray', label: 'X-Ray Fracture Detection', icon: Bone, desc: 'YOLOv8 Radiographic Bone Fracture Object Detection' },
    { id: 'mri_classify', label: 'MRI Joint Screening', icon: FileImage, desc: 'MobileNetV2 Joint Abnormality Classification' },
    { id: 'mri_segment', label: 'MRI Lesion Segmentation', icon: Layers, desc: '4-Level U-Net Joint & Tissue Lesion Segmentation' },
    { id: 'ct_scan', label: 'CT Scan (Postponed)', icon: Activity, desc: 'High-Resolution 3D Volumetric CT Analysis' },
  ];

  const resetState = (tab) => {
    setActiveSubTab(tab);
    setResult(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setSavedSuccess(false);
    setLastSavedRecordId(null);
    setLastSavedPatientId(null);
    setErrorMessage('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setSavedSuccess(false);
      setErrorMessage('');
    }
  };

  const handleRunEvaluation = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select or upload a diagnostic scan image.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSavedSuccess(false);

    let endpoint = '';
    if (activeSubTab === 'xray') endpoint = '/api/orthopedics/xray/detect';
    else if (activeSubTab === 'mri_classify') endpoint = '/api/orthopedics/mri/classify';
    else if (activeSubTab === 'mri_segment') endpoint = '/api/orthopedics/mri/segment';

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await axios.post(`${API_BASE_URL}${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data.data || res.data);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || err.response?.statusText || 'Diagnostic analysis failed. Server returned an error.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToEHR = async () => {
    if (!result) return;
    const targetPatientId = (currentUser?.role === 'doctor' || currentUser?.role === 'admin')
      ? selectedPatient?.id
      : currentUser?.id;

    if (!targetPatientId) {
      alert('Please select an attending clinic patient before saving this AI diagnostic evaluation.');
      return;
    }

    try {
      const modality = activeSubTab === 'xray' ? 'X-Ray' : 'MRI';
      const modelName = activeSubTab === 'xray'
        ? 'YOLOv8 Knee Fracture'
        : activeSubTab === 'mri_segment'
        ? 'Joint MRI UNet Segmentation'
        : 'Joint MRI Classifier';

      const saveRes = await axios.post(`${API_BASE_URL}/api/medical-records/save`, {
        patient_id: targetPatientId,
        record_type: `Orthopedics & Joints (${result.task || activeSubTab.toUpperCase()})`,
        risk_score: result.confidence || 85,
        status_level: result.status_level || 'LOW_RISK',
        department: 'Orthopedics',
        modality: modality,
        source_category: 'AI Analysis',
        model_name: modelName,
        confidence: result.confidence || null,
        details: result.details || [result.diagnosis]
      });
      setSavedSuccess(true);
      setLastSavedRecordId(saveRes.data?.record_id);
      setLastSavedPatientId(targetPatientId);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save diagnostic evaluation to EHR.');
    }
  };

  const handleSendToGm = async () => {
    if (!lastSavedRecordId || !lastSavedPatientId) return;
    setIsSendingGm(true);
    try {
      await sendFindingToGeneralMedicine({
        patientId: lastSavedPatientId,
        recordId: lastSavedRecordId,
        activeGmSessionUuid,
        setActiveGmSessionUuid,
        onNavigateToTab
      });
    } catch (err) {
      alert(err.message || 'Failed to send finding to General Medicine.');
    } finally {
      setIsSendingGm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Patient Selector for Clinical Doctors */}
      <WorkstationPatientSelector
        currentUser={currentUser}
        selectedPatient={selectedPatient}
        onSelectPatient={setSelectedPatient}
      />

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => resetState(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 whitespace-nowrap ${
                isActive
                  ? 'bg-white text-cyan-950 shadow-[0_4px_16px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                  : 'text-slate-600 hover:text-slate-900 bg-white/60 hover:bg-white/90 border border-slate-200/50 hover:shadow-neu-sm'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.id === 'ct_scan' && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 font-medium">
                  Paused
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* CT Scan Postponed Banner / Notice */}
      {activeSubTab === 'ct_scan' ? (
        <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shadow-neu-sm">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Computed Tomography (CT) Integration Postponed</CardTitle>
                <CardDescription>Volumetric Orthopedic CT pipeline currently held pending clinical validation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600 leading-relaxed">
            <p>
              As per current protocol, development on the Orthopedics CT scan pipeline is <strong>postponed</strong>.
              No CT models are loaded or executed in this phase to maintain validated focus on radiographic X-Ray and MRI joint evaluations.
            </p>
            <div className="p-4 rounded-xl bg-white/90 border border-amber-200/70 shadow-neu-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 space-y-1">
                <p className="font-semibold text-slate-900">Active Validated Modalities Available:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>X-Ray Fracture Detection:</strong> YOLOv8n object detection across upper limb anatomical sites (Elbow, Fingers, Forearm, Humerus, Shoulder, Wrist).</li>
                  <li><strong>MRI Joint Screening:</strong> MobileNetV2 transfer-learning classifier for binary pathology screening.</li>
                  <li><strong>MRI Lesion Segmentation:</strong> 4-Level U-Net architecture producing precise focal segmentation masks.</li>
                </ul>
              </div>
            </div>
            <div className="pt-2">
              <Button
                variant="primary"
                onClick={() => resetState('xray')}
              >
                Switch to X-Ray Fracture Detection
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Active Diagnostic Modalities: X-Ray or MRI */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Upload & Scan Control */}
          <div className="lg:col-span-5 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle icon={subTabs.find(t => t.id === activeSubTab)?.icon || Bone}>
                  {subTabs.find(t => t.id === activeSubTab)?.label}
                </CardTitle>
                <CardDescription>
                  {subTabs.find(t => t.id === activeSubTab)?.desc}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload Box */}
                <div className="border-2 border-dashed border-slate-300/80 hover:border-teal-500/80 rounded-2xl p-6 text-center transition-all duration-200 bg-slate-50/50 hover:bg-teal-50/20 group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="ortho-upload"
                  />
                  <label htmlFor="ortho-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-neu-sm group-hover:scale-105 flex items-center justify-center text-teal-600 transition-all duration-150">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">Click to upload scan image</span>
                    <span className="text-[11px] text-slate-500">Supports JPEG, PNG, WEBP radiographic scans</span>
                  </label>
                </div>

                {/* Scan Preview */}
                {previewUrl && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-semibold">Selected Scan:</span>
                      <span className="text-[11px] text-slate-500 truncate max-w-[200px]">{selectedFile?.name}</span>
                    </div>
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950/5 aspect-video flex items-center justify-center">
                      <img src={previewUrl} alt="Preview" className="max-h-full object-contain" />
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Action Trigger */}
                <Button
                  variant="primary"
                  className="w-full"
                  loading={loading}
                  disabled={!selectedFile}
                  onClick={handleRunEvaluation}
                >
                  Run Neural Evaluation
                </Button>
              </CardContent>
            </Card>

            {/* Model Architecture Transparency Card */}
            <Card className="bg-slate-50/60 border-slate-200/70">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <span>Clinical Model Metadata</span>
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-2 text-slate-600">
                {activeSubTab === 'xray' && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Active Engine:</span>
                      <span className="font-mono font-semibold text-slate-800">YOLOv8n (best.pt)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Backup Checkpoint:</span>
                      <span className="font-mono text-slate-600">last.pt (Preserved)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Input Size:</span>
                      <span className="font-mono text-slate-700">640x640 RGB</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Target Anatomy:</span>
                      <span className="text-slate-700 font-medium">Elbow, Fingers, Forearm, Humerus, Shoulder, Wrist</span>
                    </div>
                  </>
                )}
                {activeSubTab === 'mri_classify' && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Active Engine:</span>
                      <span className="font-mono font-semibold text-slate-800">mri_classifier.keras</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Architecture:</span>
                      <span className="text-slate-700 font-medium">MobileNetV2 Transfer Learning</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Input Resolution:</span>
                      <span className="font-mono text-slate-700">128x128x3 RGB</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Output Task:</span>
                      <span className="text-slate-700 font-medium">Binary Joint Abnormality Screening</span>
                    </div>
                  </>
                )}
                {activeSubTab === 'mri_segment' && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Active Engine:</span>
                      <span className="font-mono font-semibold text-slate-800">mri_unet_segmentation.keras</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Architecture:</span>
                      <span className="text-slate-700 font-medium">4-Level U-Net (32 Layers)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Input Resolution:</span>
                      <span className="font-mono text-slate-700">128x128x1 Grayscale</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Output Task:</span>
                      <span className="text-slate-700 font-medium">Focal Joint/Tissue Lesion Mask</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: AI Inference Results */}
          <div className="lg:col-span-7 space-y-6">
            {result ? (
              <Card className="border-teal-100 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{result.diagnosis}</CardTitle>
                      <CardDescription>
                        {result.modality} Evaluation &bull; {result.task}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={result.status_level === 'HIGH_RISK' ? 'danger' : 'success'}
                      size="md"
                    >
                      {result.status_level === 'HIGH_RISK' ? 'Pathology Indicated' : 'Negative / Clear'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Metric Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-neu-sm">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                        Model Confidence
                      </span>
                      <span className="text-lg font-bold text-slate-900">
                        {result.confidence}%
                      </span>
                    </div>

                    {result.total_detections !== undefined && (
                      <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-neu-sm">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                          Localized Regions
                        </span>
                        <span className="text-lg font-bold text-slate-900">
                          {result.total_detections}
                        </span>
                      </div>
                    )}

                    {result.segmented_area_pct !== undefined && (
                      <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-neu-sm">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                          Segmented Area
                        </span>
                        <span className="text-lg font-bold text-slate-900">
                          {result.segmented_area_pct}%
                        </span>
                      </div>
                    )}

                    <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-neu-sm">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                        Clinical Status
                      </span>
                      <span className={`text-xs font-bold ${result.status_level === 'HIGH_RISK' ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {result.status_level}
                      </span>
                    </div>
                  </div>

                  {/* Annotated Image Visualization */}
                  {result.annotated_image && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-700">Annotated Diagnostic Visualization:</span>
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950/10 shadow-inner flex items-center justify-center max-h-[380px]">
                        <img
                          src={result.annotated_image}
                          alt="Annotated Diagnostic Scan"
                          className="max-h-[360px] w-auto object-contain rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {/* Findings Details */}
                  {result.details && result.details.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-700">Detailed Diagnostic Findings:</span>
                      <div className="space-y-1.5">
                        {result.details.map((finding, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 text-xs text-slate-700 flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                            <span>{finding}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detections List for X-Ray */}
                  {result.detections && result.detections.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-700">Detected Anatomical Sites:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {result.detections.map((det, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-teal-50/50 border border-teal-200/60 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 capitalize">{det.class_name}</span>
                            <span className="font-mono text-teal-800 font-bold">{det.confidence}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save to Patient EHR Button */}
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <Button
                      variant="primary"
                      icon={Save}
                      onClick={handleSaveToEHR}
                      disabled={savedSuccess}
                    >
                      {savedSuccess ? 'Saved to Patient EHR' : 'Save to Patient EHR Record'}
                    </Button>
                    {savedSuccess && (
                      <>
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Successfully recorded
                        </span>
                        {lastSavedRecordId && (
                          <Button
                            variant="secondary"
                            icon={Sparkles}
                            onClick={handleSendToGm}
                            disabled={isSendingGm}
                            className="bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-200"
                          >
                            {isSendingGm ? 'Ingesting Finding...' : 'Send to General Medicine'}
                          </Button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Mandatory Clinical Disclaimer */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 leading-normal">
                    {result.disclaimer}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                icon={Bone}
                title="Awaiting Diagnostic Scan Upload"
                description="Upload an orthopedic X-Ray or MRI scan from the left panel and initiate neural evaluation to view detection bounding boxes, lesion masks, and clinical risk metrics."
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
