import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Stethoscope, User, AlertCircle, RefreshCw, MessageSquare } from 'lucide-react';
import ChatInterface from './general_medicine/ChatInterface';
import TriageAssessmentCard from './general_medicine/TriageAssessmentCard';
import ClinicalMatrixCard from './general_medicine/ClinicalMatrixCard';
import EmergencyAlertModal from './general_medicine/EmergencyAlertModal';
import WorkstationPatientSelector from './WorkstationPatientSelector';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function GeneralMedicineDashboard({ currentUser, onNavigateToTab, activeGmSessionUuid, setActiveGmSessionUuid }) {
  const [sessionUuid, setSessionUuid] = useState(activeGmSessionUuid || null);
  const [messages, setMessages] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [clinicalMatrix, setClinicalMatrix] = useState({});
  const [completeness, setCompleteness] = useState(0);
  const [urgency, setUrgency] = useState('ROUTINE');
  const [sessionLanguage, setSessionLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyText, setEmergencyText] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Doctor Consultation State
  const [doctorQuery, setDoctorQuery] = useState('');
  const [doctorQueryLoading, setDoctorQueryLoading] = useState(false);

  // Initialize or resume session
  useEffect(() => {
    let isCancelled = false;
    async function loadOrInitSession() {
      try {
        const targetPatientId = selectedPatient ? selectedPatient.id : (currentUser?.role === 'patient' ? currentUser.id : null);
        if (currentUser?.role === 'doctor' && !targetPatientId) {
          // Awaiting doctor to pick a patient
          return;
        }

        // 1. If activeGmSessionUuid is set, try to restore that exact session
        if (activeGmSessionUuid) {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/general-medicine/session/${activeGmSessionUuid}`, { withCredentials: true });
            if (!isCancelled && res.data) {
              setSessionUuid(res.data.session_uuid);
              setSessionLanguage(res.data.language || 'en');
              setMessages(res.data.messages || []);
              setAssessment(res.data.current_state === 'SYNTHESIS' && res.data.assessment && Object.keys(res.data.assessment).length > 0 ? res.data.assessment : null);
              setClinicalMatrix(res.data.clinical_matrix || {});
              setCompleteness(res.data.information_completeness || 0);
              setUrgency(res.data.triage_urgency || 'ROUTINE');
              if (res.data.current_state === 'EMERGENCY_LOCK') {
                const emMsg = res.data.messages?.filter(m => m.sender === 'assistant').pop()?.content || '';
                setEmergencyText(emMsg);
                setShowEmergency(true);
              }
              return;
            }
          } catch (loadErr) {
            console.warn("Could not load session from activeGmSessionUuid:", loadErr);
          }
        }

        // 2. Otherwise initialize a fresh session
        const res = await axios.post(`${API_BASE_URL}/api/general-medicine/session`, {
          patient_id: targetPatientId,
          language: 'en'
        }, { withCredentials: true });

        if (!isCancelled && res.data) {
          setSessionUuid(res.data.session_uuid);
          if (setActiveGmSessionUuid) {
            setActiveGmSessionUuid(res.data.session_uuid);
          }
          setSessionLanguage(res.data.language || 'en');
          setMessages([{
            sender: 'assistant',
            content: res.data.welcome_message,
            language: res.data.language,
            data_provenance: 'PATIENT_REPORTED'
          }]);
          setAssessment(null);
          setClinicalMatrix({});
          setCompleteness(0);
        }
      } catch (e) {
        console.error("General Medicine Session initialization error:", e);
      }
    }
    loadOrInitSession();
    return () => { isCancelled = true; };
  }, [selectedPatient, currentUser, activeGmSessionUuid]);

  const handleNewConsultation = async () => {
    try {
      const targetPatientId = selectedPatient ? selectedPatient.id : (currentUser?.role === 'patient' ? currentUser.id : null);
      const res = await axios.post(`${API_BASE_URL}/api/general-medicine/session`, {
        patient_id: targetPatientId,
        language: 'en'
      }, { withCredentials: true });

      if (res.data) {
        setSessionUuid(res.data.session_uuid);
        if (setActiveGmSessionUuid) {
          setActiveGmSessionUuid(res.data.session_uuid);
        }
        setSessionLanguage(res.data.language || 'en');
        setMessages([{
          sender: 'assistant',
          content: res.data.welcome_message,
          language: res.data.language,
          data_provenance: 'PATIENT_REPORTED'
        }]);
        setAssessment(null);
        setClinicalMatrix({});
        setCompleteness(0);
        setUrgency('ROUTINE');
        setShowEmergency(false);
      }
    } catch (e) {
      console.error("Failed to start new consultation:", e);
    }
  };

  const handleSendMessage = async (text) => {
    if (!sessionUuid) return;
    setIsLoading(true);

    // Optimistic user message bubble
    const userMsg = {
      sender: currentUser?.role || 'patient',
      content: text,
      language: sessionLanguage,
      data_provenance: currentUser?.role === 'doctor' ? 'DOCTOR_PROVIDED' : 'PATIENT_REPORTED'
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/general-medicine/chat`, {
        session_uuid: sessionUuid,
        message: text
      }, { withCredentials: true });

      if (res.data) {
        const assistantMsg = {
          sender: 'assistant',
          content: res.data.assistant_message,
          language: res.data.language || sessionLanguage,
          data_provenance: 'PATIENT_REPORTED'
        };
        setMessages(prev => [...prev, assistantMsg]);
        setSessionLanguage(res.data.language || sessionLanguage);
        setCompleteness(res.data.information_completeness || 0);
        setUrgency(res.data.triage_urgency || 'ROUTINE');
        setClinicalMatrix(res.data.clinical_matrix || {});

        if (res.data.state === 'EMERGENCY_LOCK') {
          setEmergencyText(res.data.assistant_message);
          setShowEmergency(true);
          setAssessment(null);
        } else if (res.data.state === 'SYNTHESIS') {
          setAssessment(res.data);
        } else {
          setAssessment(null);
        }
      }
    } catch (err) {
      console.error("Chat turn error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToEhr = async () => {
    if (!sessionUuid) return;
    setIsSaving(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/general-medicine/save-to-ehr`, {
        session_uuid: sessionUuid
      }, { withCredentials: true });

      if (res.data && res.data.status === 'success') {
        alert("Consultation successfully recorded in patient EHR (Record #" + res.data.record_id + ")");
      }
    } catch (e) {
      alert("Failed to save consultation to EHR: " + (e.response?.data?.detail || e.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBookAppointment = (dept) => {
    if (onNavigateToTab) {
      onNavigateToTab('booking', {
        department: dept,
        notes: `Referral from General Medicine Triage: ${clinicalMatrix.chief_complaint || ''}`
      });
    }
  };

  const handleDoctorQuery = async (e) => {
    e.preventDefault();
    if (!doctorQuery.trim() || !selectedPatient) return;
    setDoctorQueryLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/general-medicine/doctor-consult`, {
        patient_id: selectedPatient.id,
        query: doctorQuery.trim()
      }, { withCredentials: true });

      if (res.data) {
        setMessages(prev => [
          ...prev,
          { sender: 'doctor', content: doctorQuery, data_provenance: 'DOCTOR_PROVIDED' },
          { sender: 'assistant', content: res.data.synthesis, data_provenance: 'DOCTOR_PROVIDED' }
        ]);
        setDoctorQuery('');
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Doctor consultation request failed.");
    } finally {
      setDoctorQueryLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4 animate-in fade-in">
      {/* Header Banner */}
      <div className="clay-card p-4 rounded-2xl bg-white/90 border border-slate-200 shadow-neu-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-sm">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              General Medicine &bull; Central Clinical Coordination Hub
            </h2>
            <p className="text-xs text-slate-500">
              Closed-loop multi-modal clinical intelligence, triage exploration, and specialty synthesis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={handleNewConsultation}
            className="clay-btn px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl border border-slate-300/80 flex items-center gap-1.5 transition-all shadow-sm"
            title="Start a fresh consultation session"
          >
            <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
            New Consultation
          </button>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
            Active Hub
          </span>
        </div>
      </div>

      {/* Doctor Patient Selector */}
      {currentUser?.role === 'doctor' && (
        <WorkstationPatientSelector
          currentUser={currentUser}
          selectedPatient={selectedPatient}
          onSelectPatient={setSelectedPatient}
        />
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Chatbot Conversation Stream */}
        <div className="lg:col-span-7 space-y-4">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            currentLanguage={sessionLanguage}
          />

          {/* Doctor Deep Consultation Query Bar */}
          {currentUser?.role === 'doctor' && selectedPatient && (
            <form onSubmit={handleDoctorQuery} className="p-3 bg-white border border-slate-200 rounded-xl flex gap-2 shadow-sm">
              <input
                type="text"
                value={doctorQuery}
                onChange={(e) => setDoctorQuery(e.target.value)}
                placeholder="Ask clinical assistant about patient's multi-department records..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={doctorQueryLoading}
              />
              <button
                type="submit"
                disabled={doctorQueryLoading || !doctorQuery.trim()}
                className="clay-btn px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Query
              </button>
            </form>
          )}
        </div>

        {/* Right Column: Clinical Matrix & Assessment Cards */}
        <div className="lg:col-span-5 space-y-5">
          <ClinicalMatrixCard
            matrix={clinicalMatrix}
            completeness={completeness}
            language={sessionLanguage}
          />

          <TriageAssessmentCard
            assessment={assessment}
            completeness={completeness}
            urgency={urgency}
            language={sessionLanguage}
            onBookAppointment={handleBookAppointment}
            onSaveToEhr={handleSaveToEhr}
            isSaving={isSaving}
          />
        </div>
      </div>

      {/* Emergency Alert Modal */}
      <EmergencyAlertModal
        isOpen={showEmergency}
        onClose={() => setShowEmergency(false)}
        message={emergencyText}
        language={sessionLanguage}
      />
    </div>
  );
}
