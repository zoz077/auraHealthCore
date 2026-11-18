import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Calendar, 
  ShieldCheck, 
  LogOut, 
  FileText, 
  Stethoscope, 
  Bell, 
  Printer, 
  AlertTriangle, 
  User, 
  Users, 
  Eye, 
  PlusCircle, 
  X, 
  Check, 
  Clock, 
  HeartPulse, 
  Heart,
  Brain,
  Wind,
  Layers,
  Bone,
  Lock,
  Mail,
  ChevronRight,
  Globe,
  Smartphone,
  KeyRound,
  History,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import IcuDashboard from './components/IcuDashboard';
import EcgDashboard from './components/EcgDashboard';
import RespiratoryDashboard from './components/RespiratoryDashboard';
import NotificationToast from './components/NotificationToast';
import NeurologyDashboard from './components/NeurologyDashboard';
import OrthopedicsDashboard from './components/OrthopedicsDashboard';
import GeneralMedicineDashboard from './components/GeneralMedicineDashboard';

// Design System UI Components
import Button from './components/ui/Button';
import Badge from './components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui/Card';
import Modal from './components/ui/Modal';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './components/ui/Table';
import { FormField, Input, Select, Textarea } from './components/ui/Input';
import Alert from './components/ui/Alert';
import EmptyState from './components/ui/EmptyState';

// Ensure all Axios requests send and receive HttpOnly session cookies
axios.defaults.withCredentials = true;

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [activeTab, setActiveTab] = useState('booking');
  const [activeGmSessionUuid, setActiveGmSessionUuid] = useState(null);

  const [authForm, setAuthForm] = useState({ email: '', password: '', full_name: '' });
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Google authentication & profile completion modal states
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');
  const [showProfileCompletionModal, setShowProfileCompletionModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    phone_number: '',
    date_of_birth: '',
    gender: 'male',
    blood_group: 'O+',
    emergency_contact: ''
  });

  // Profile email & Google linking states
  const [showEmailEditModal, setShowEmailEditModal] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [emailUpdateMsg, setEmailUpdateMsg] = useState({ type: '', text: '' });
  const [showLinkGoogleModal, setShowLinkGoogleModal] = useState(false);
  const [linkGoogleInput, setLinkGoogleInput] = useState('');

  // Medical records category filter
  const [selectedRecordCategory, setSelectedRecordCategory] = useState('All');

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditModal, setShowAuditModal] = useState(false);

  const [departments] = useState([
    'Cardiology',
    'ICU & Critical Care',
    'Neurology & Brain',
    'Orthopedics',
    'Dermatology',
    'Pulmonology',
    'General Clinic'
  ]);
  const [selectedDept, setSelectedDept] = useState('Cardiology');
  const [doctorsList, setDoctorsList] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);

  const [doctorQueue, setDoctorQueue] = useState([]);
  const [newDocForm, setNewDocForm] = useState({ full_name: '', email: '', password: '', department: 'Cardiology' });
  const [adminMsg, setAdminMsg] = useState('');
  const [creatingDoc, setCreatingDoc] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [activeToasts, setActiveToasts] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [selectedPrintRecord, setSelectedPrintRecord] = useState(null);

  // Emergency, Clinical Records, Admin Overview
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencySubmitting, setEmergencySubmitting] = useState(false);
  const [emergencyForm, setEmergencyForm] = useState({
    heart_rate: 98,
    spo2: 95,
    blood_pressure: '120/80',
    temperature: 37.0,
    triage_notes: '',
    diagnosis: 'Acute Chest Discomfort',
    priority: 'CRITICAL'
  });
  const [emergencyRecords, setEmergencyRecords] = useState([]);
  const [selectedPatientEhr, setSelectedPatientEhr] = useState(null);
  const [doctorClinicalModal, setDoctorClinicalModal] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminAppointments, setAdminAppointments] = useState([]);
  const [adminSubTab, setAdminSubTab] = useState('doctors');

  const addNotification = (text, targetUserId, type = 'info') => {
    const newNotif = { 
      id: Date.now() + Math.random(), 
      targetUserId, 
      text, 
      type, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
      read: false 
    };
    setNotifications(prev => [newNotif, ...prev]);
    setActiveToasts(prev => [newNotif, ...prev]);
    setTimeout(() => {
      setActiveToasts(prev => prev.filter(t => t.id !== newNotif.id));
    }, 5000);
  };

  const handleCloseToast = (id) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  // Restore session via /api/auth/me on component mount
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/auth/me`)
      .then(res => {
        const user = res.data.user || res.data;
        setCurrentUser(user);
        if (user.role === 'admin') setActiveTab('admin');
        else if (user.role === 'doctor') setActiveTab('queue');
        else setActiveTab('booking');
      })
      .catch(() => {
        setCurrentUser(null);
      })
      .finally(() => {
        setIsCheckingAuth(false);
      });
  }, []);

  // Fetch notifications and establish authenticated WebSocket when logged in
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setActiveToasts([]);
      return;
    }

    axios.get(`${API_BASE_URL}/api/notifications`)
      .then(res => {
        const loaded = res.data.map(n => ({
          id: n.id,
          targetUserId: currentUser.id,
          text: n.message || n.title,
          type: (n.priority === 'CRITICAL' || n.priority === 'HIGH') ? 'error' : 'info',
          time: n.created_at || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: n.is_read
        }));
        setNotifications(loaded);
      })
      .catch(err => console.error("Could not fetch notifications:", err));

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = API_BASE_URL.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}//${wsHost}/ws/notifications`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const incoming = {
          id: data.id || Date.now() + Math.random(),
          targetUserId: currentUser.id,
          text: data.message || data.title || data.text,
          type: data.type || ((data.priority === 'CRITICAL' || data.priority === 'HIGH') ? 'error' : 'info'),
          time: data.created_at || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false
        };
        setNotifications(prev => [incoming, ...prev]);
        setActiveToasts(prev => [incoming, ...prev]);
        setTimeout(() => {
          setActiveToasts(prev => prev.filter(t => t.id !== incoming.id));
        }, 6000);
      } catch (err) {
        console.error("Failed to parse websocket message:", err);
      }
    };

    ws.onerror = (err) => {
      console.warn("WebSocket notification error:", err);
    };

    return () => {
      ws.close();
    };
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      axios.get(`${API_BASE_URL}/api/doctors?department=${selectedDept}`)
        .then(res => {
          setDoctorsList(res.data);
          if (res.data.length > 0) setSelectedDoctor(res.data[0]);
          else setSelectedDoctor(null);
        }).catch(err => console.error(err));
    }
  }, [selectedDept, currentUser]);

  useEffect(() => {
    if (!selectedDoctor || !bookingDate) {
      setAvailableSlots([]);
      return;
    }
    setLoadingSlots(true);
    setBookingTime('');
    axios.get(`${API_BASE_URL}/api/appointments/available-slots`, {
      params: { doctor_id: selectedDoctor.id, date: bookingDate }
    })
      .then(res => setAvailableSlots(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoadingSlots(false));
  }, [selectedDoctor, bookingDate]);

  const refreshData = () => {
    if (!currentUser) return;
    if (currentUser.role === 'patient') {
      axios.get(`${API_BASE_URL}/api/appointments/patient/${currentUser.id}`).then(res => setPatientAppointments(res.data)).catch(console.error);
      const catParam = selectedRecordCategory && selectedRecordCategory !== 'All' ? `?category=${encodeURIComponent(selectedRecordCategory)}` : '';
      axios.get(`${API_BASE_URL}/api/medical-records/patient/${currentUser.id}${catParam}`).then(res => setMedicalRecords(res.data)).catch(console.error);
      axios.get(`${API_BASE_URL}/api/v1/emergency/records`).then(res => setEmergencyRecords(res.data)).catch(console.error);
    } else if (currentUser.role === 'doctor') {
      axios.get(`${API_BASE_URL}/api/appointments/doctor/${currentUser.id}`).then(res => setDoctorQueue(res.data)).catch(console.error);
      axios.get(`${API_BASE_URL}/api/v1/emergency/records`).then(res => setEmergencyRecords(res.data)).catch(console.error);
      axios.get(`${API_BASE_URL}/api/audit-logs`).then(res => setAuditLogs(res.data)).catch(console.error);
    } else if (currentUser.role === 'admin') {
      axios.get(`${API_BASE_URL}/api/admin/users`).then(res => setAdminUsers(res.data)).catch(console.error);
      axios.get(`${API_BASE_URL}/api/admin/appointments`).then(res => setAdminAppointments(res.data)).catch(console.error);
      axios.get(`${API_BASE_URL}/api/v1/emergency/records`).then(res => setEmergencyRecords(res.data)).catch(console.error);
      axios.get(`${API_BASE_URL}/api/doctors`).then(res => setDoctorsList(res.data)).catch(console.error);
      axios.get(`${API_BASE_URL}/api/audit-logs`).then(res => setAuditLogs(res.data)).catch(console.error);
    }
  };

  const handleGoogleAuth = async (email, name) => {
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const gEmail = (email || googleEmailInput || 'alex.morgan@gmail.com').trim().toLowerCase();
      const gName = (name || googleNameInput || gEmail.split('@')[0].replace('.', ' ')).trim();
      const gId = 'g_' + Math.abs(gEmail.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0));

      const res = await axios.post(`${API_BASE_URL}/api/auth/google`, {
        google_id: gId,
        email: gEmail,
        name: gName
      });

      const user = res.data.user;
      setCurrentUser(user);
      setShowGoogleModal(false);

      if (res.data.requires_profile_completion) {
        setProfileForm({
          phone_number: user.phone_number || '',
          date_of_birth: user.date_of_birth || '',
          gender: user.gender || 'male',
          blood_group: user.blood_group || 'O+',
          emergency_contact: user.emergency_contact || ''
        });
        setShowProfileCompletionModal(true);
      } else {
        if (user.role === 'admin') setActiveTab('admin');
        else if (user.role === 'doctor') setActiveTab('queue');
        else setActiveTab('booking');
      }
    } catch (err) {
      setAuthError(err.response?.data?.detail || 'Google authentication failed.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/complete-profile`, profileForm);
      setCurrentUser(res.data.user);
      setShowProfileCompletionModal(false);
      addNotification('Patient profile completed successfully!', res.data.user.id, 'success');
      setActiveTab('booking');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to complete profile.');
    }
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailUpdateMsg({ type: '', text: '' });
    try {
      const res = await axios.put(`${API_BASE_URL}/api/auth/profile/email`, {
        new_email: newEmailInput,
        password: currentPasswordInput || null
      });
      setCurrentUser(res.data.user);
      setEmailUpdateMsg({ type: 'success', text: res.data.message });
      setTimeout(() => setShowEmailEditModal(false), 1200);
      addNotification('Email address updated successfully.', res.data.user.id, 'info');
    } catch (err) {
      setEmailUpdateMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to update email.' });
    }
  };

  const handleVerifyEmail = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/profile/verify-email`);
      setCurrentUser(res.data.user);
      addNotification('Email verified successfully!', currentUser.id, 'success');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to verify email.');
    }
  };

  const handleLinkGoogle = async () => {
    const gEmail = (linkGoogleInput || currentUser.email).trim().toLowerCase();
    const gId = 'g_' + Math.abs(gEmail.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0));
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/profile/link-google`, {
        google_id: gId,
        email: gEmail
      });
      setCurrentUser(res.data.user);
      setShowLinkGoogleModal(false);
      addNotification('Google account connected successfully!', currentUser.id, 'success');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to link Google account.');
    }
  };

  const handleCancelAppointment = async (appId) => {
    if (!confirm('Are you sure you want to cancel this appointment ticket?')) return;
    try {
      await axios.put(`${API_BASE_URL}/api/appointments/${appId}/cancel`);
      addNotification('Appointment cancelled successfully.', currentUser.id, 'info');
      refreshData();
      if (selectedDoctor && bookingDate) {
        axios.get(`${API_BASE_URL}/api/appointments/available-slots`, {
          params: { doctor_id: selectedDoctor.id, date: bookingDate }
        }).then(r => setAvailableSlots(r.data)).catch(console.error);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel appointment.');
    }
  };

  const handleSubmitEmergency = async (e) => {
    e.preventDefault();
    setEmergencySubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/v1/emergency/report`, {
        patient_name: currentUser.full_name,
        heart_rate: Number(emergencyForm.heart_rate),
        spo2: Number(emergencyForm.spo2),
        blood_pressure: emergencyForm.blood_pressure,
        temperature: Number(emergencyForm.temperature),
        triage_notes: emergencyForm.triage_notes,
        diagnosis: emergencyForm.diagnosis || 'Acute Distress',
        priority: emergencyForm.priority,
        db_patient_id: currentUser.role === 'patient' ? currentUser.id : null
      });
      addNotification(`Emergency alert dispatched (EHR #${res.data.ehr_id})! Clinical staff alerted.`, currentUser.id, 'error');
      setShowEmergencyModal(false);
      setEmergencyForm({
        heart_rate: 98,
        spo2: 95,
        blood_pressure: '120/80',
        temperature: 37.0,
        triage_notes: '',
        diagnosis: 'Acute Chest Discomfort',
        priority: 'CRITICAL'
      });
      refreshData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to dispatch emergency alert.');
    } finally {
      setEmergencySubmitting(false);
    }
  };

  const handleViewPatientEhr = async (patientId, patientName) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/medical-records/patient/${patientId}`);
      setSelectedPatientEhr({ patientId, patientName, records: res.data });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to fetch patient EHR.');
    }
  };

  const handleDoctorSaveRecord = async (e) => {
    e.preventDefault();
    if (!doctorClinicalModal) return;
    try {
      await axios.post(`${API_BASE_URL}/api/medical-records/save`, {
        patient_id: doctorClinicalModal.patient_id,
        record_type: doctorClinicalModal.record_type || 'Physician Clinical Evaluation',
        risk_score: Number(doctorClinicalModal.risk_score) || 0,
        status_level: doctorClinicalModal.status_level || 'NORMAL',
        department: currentUser.department || 'General Clinic',
        modality: 'Clinical Evaluation',
        source_category: 'Doctor Notes',
        details: [doctorClinicalModal.notes || 'Clinical notes recorded by physician.']
      });
      addNotification(`Clinical record recorded for ${doctorClinicalModal.patient_name}`, currentUser.id, 'success');
      const updatedPatientId = doctorClinicalModal.patient_id;
      const updatedPatientName = doctorClinicalModal.patient_name;
      setDoctorClinicalModal(null);
      if (selectedPatientEhr && selectedPatientEhr.patientId === updatedPatientId) {
        handleViewPatientEhr(updatedPatientId, updatedPatientName);
      }
      refreshData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save clinical evaluation.');
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentUser, activeTab, selectedRecordCategory]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      if (authMode === 'login') {
        const res = await axios.post(`${API_BASE_URL}/api/auth/login`, {
          email: authForm.email,
          password: authForm.password
        });
        const user = res.data.user;
        setCurrentUser(user);
        if (user.role === 'admin') setActiveTab('admin');
        else if (user.role === 'doctor') setActiveTab('queue');
        else setActiveTab('booking');
      } else {
        await axios.post(`${API_BASE_URL}/api/auth/register`, {
          full_name: authForm.full_name,
          email: authForm.email,
          password: authForm.password
        });
        // Auto-login after registration
        const loginRes = await axios.post(`${API_BASE_URL}/api/auth/login`, {
          email: authForm.email,
          password: authForm.password
        });
        setCurrentUser(loginRes.data.user);
        setActiveTab('booking');
      }
    } catch (err) {
      setAuthError(err.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`);
    } catch (err) {
      console.error(err);
    }
    setCurrentUser(null);
    setActiveTab('booking');
  };

  const handleBookAppointment = async () => {
    if (!selectedDoctor || !bookingTime) {
      alert('Please select a doctor and time slot.');
      return;
    }
    try {
      const res = await axios.post(`${API_BASE_URL}/api/appointments/book`, {
        doctor_id: selectedDoctor.id,
        patient_name: currentUser.full_name,
        doctor_name: selectedDoctor.name,
        department: selectedDept,
        appointment_date: bookingDate,
        appointment_time: bookingTime
      });
      addNotification(`Appointment booked! Queue #${res.data.queue_number}`, currentUser.id, 'success');
      refreshData();
      setBookingTime('');
    } catch (err) {
      alert(err.response?.data?.detail || 'Booking failed.');
    }
  };

  const updateQueueStatus = async (item, newStatus) => {
    try {
      await axios.put(`${API_BASE_URL}/api/appointments/${item.id}/status`, { status: newStatus });
      addNotification(`Patient #${item.queue_number} marked as ${newStatus}`, currentUser.id, 'info');
      refreshData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    setCreatingDoc(true);
    setAdminMsg('');
    try {
      await axios.post(`${API_BASE_URL}/api/admin/doctors`, newDocForm);
      setAdminMsg(`Doctor ${newDocForm.full_name} created successfully.`);
      setNewDocForm({ full_name: '', email: '', password: '', department: 'Cardiology' });
      refreshData();
    } catch (err) {
      setAdminMsg(err.response?.data?.detail || 'Failed to create doctor.');
    } finally {
      setCreatingDoc(false);
    }
  };

  const handlePrintReport = (record) => {
    setSelectedPrintRecord(record);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.put(`${API_BASE_URL}/api/notifications/mark-all-read`);
    } catch {
      // ignore
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const userNotifications = notifications.filter(n => n.targetUserId === currentUser?.id);
  const unreadCount = userNotifications.filter(n => !n.read).length;

  // Render Loading Splash while checking session
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center text-slate-800">
        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-cyan-600 mb-4 shadow-[4px_4px_12px_#e2e8f0,-4px_-4px_12px_#ffffff] animate-pulse">
          <HeartPulse className="w-7 h-7 animate-spin" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">AuraHealth Core</h1>
        <p className="text-xs text-slate-500 mt-1 font-mono">Restoring Secure Clinical Session...</p>
      </div>
    );
  }

  // Render Login / Registration Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
        {/* Ambient atmospheric shapes for subtle depth */}
        <div className="absolute -top-32 -left-32 w-[450px] h-[450px] bg-cyan-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-32 w-[400px] h-[400px] bg-teal-100/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-slate-200/50 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10 space-y-6">
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white mb-2 shadow-[0_6px_20px_rgba(13,148,136,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]">
              <HeartPulse className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">AuraHealth Core</h1>
            <p className="text-xs text-slate-500">Clinical Artificial Intelligence & Hospital Operations Platform</p>
          </div>

          <Card className="bg-white/98 backdrop-blur-xl border border-slate-200/80 shadow-glass-lg rounded-3xl">
            <CardHeader className="text-center pb-2">
              <div className="w-full flex items-center justify-center gap-1.5 p-1 bg-[#f0f4f8] rounded-2xl border border-white/90 shadow-neu-sm">
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-150 ${
                    authMode === 'login'
                      ? 'bg-white text-cyan-950 shadow-[0_2px_6px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/80 font-bold -translate-y-0.5'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Clinical Staff & Patient Login
                </button>
                <button
                  onClick={() => { setAuthMode('register'); setAuthError(''); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-150 ${
                    authMode === 'register'
                      ? 'bg-white text-cyan-950 shadow-[0_2px_6px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/80 font-bold -translate-y-0.5'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  New Patient Registration
                </button>
              </div>
            </CardHeader>

            <CardContent>
              {authError && (
                <Alert variant="error" className="mb-4">
                  {authError}
                </Alert>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'register' && (
                  <FormField label="Full Name" required>
                    <Input
                      icon={User}
                      placeholder="e.g. Johnathan Doe"
                      value={authForm.full_name}
                      onChange={(e) => setAuthForm({ ...authForm, full_name: e.target.value })}
                      required
                    />
                  </FormField>
                )}

                <FormField label="Account Email" required>
                  <Input
                    icon={Mail}
                    type="email"
                    placeholder="user@aurahealth.com"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    required
                  />
                </FormField>

                <FormField label="Password" required>
                  <Input
                    icon={Lock}
                    type="password"
                    placeholder="••••••••"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    required
                  />
                </FormField>

                <Button
                  type="submit"
                  loading={authSubmitting}
                  className="w-full mt-2"
                >
                  {authMode === 'login' ? 'Authenticate & Enter Clinical Portal' : 'Create Verified Patient Account'}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-400 font-mono text-[10px]">Or Continue With</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-2"
                  onClick={() => setShowGoogleModal(true)}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continue with Google</span>
                </Button>
              </form>

              {/* Neutral Trust & Security Indicators */}
              <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 text-xs">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <span>Clinical Security & Access Controls</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                  <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center gap-1.5 font-medium">
                    <Check className="w-3 h-3 text-teal-600 shrink-0" />
                    <span>Secure Session</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center gap-1.5 font-medium">
                    <Check className="w-3 h-3 text-teal-600 shrink-0" />
                    <span>Protected Clinical Data</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center gap-1.5 font-medium">
                    <Check className="w-3 h-3 text-teal-600 shrink-0" />
                    <span>Role-Based Access</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center gap-1.5 font-medium">
                    <Check className="w-3 h-3 text-teal-600 shrink-0" />
                    <span>Privacy Controls</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Google Authentication Modal */}
        <Modal
          isOpen={showGoogleModal}
          onClose={() => setShowGoogleModal(false)}
          title="Sign in with Google"
          description="Connect your verified Google account to AuraHealth Clinical Portal"
          icon={Globe}
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Fast Account Select (Demo / Sandbox)
              </span>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleGoogleAuth('alex.morgan@gmail.com', 'Alex Morgan')}
                  className="w-full p-2.5 rounded-lg bg-white border border-slate-200 hover:border-teal-500 flex items-center justify-between text-xs transition-colors group text-left"
                >
                  <div>
                    <div className="font-semibold text-slate-800 group-hover:text-teal-700">Alex Morgan</div>
                    <div className="text-[11px] text-slate-500">alex.morgan@gmail.com</div>
                  </div>
                  <Badge variant="neutral" size="xs">Patient</Badge>
                </button>
                <button
                  type="button"
                  onClick={() => handleGoogleAuth('sarah.connor@gmail.com', 'Sarah Connor')}
                  className="w-full p-2.5 rounded-lg bg-white border border-slate-200 hover:border-teal-500 flex items-center justify-between text-xs transition-colors group text-left"
                >
                  <div>
                    <div className="font-semibold text-slate-800 group-hover:text-teal-700">Sarah Connor</div>
                    <div className="text-[11px] text-slate-500">sarah.connor@gmail.com</div>
                  </div>
                  <Badge variant="neutral" size="xs">Patient</Badge>
                </button>
              </div>
            </div>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-mono text-[10px]">Or enter Google account</span>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleGoogleAuth(); }} className="space-y-3">
              <FormField label="Google Account Email" required>
                <Input
                  type="email"
                  placeholder="your.account@gmail.com"
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Full Name">
                <Input
                  type="text"
                  placeholder="e.g. John Smith"
                  value={googleNameInput}
                  onChange={(e) => setGoogleNameInput(e.target.value)}
                />
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowGoogleModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" loading={authSubmitting}>
                  Continue with Google
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      </div>
    );
  }

  // Main Authenticated Portal
  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 flex flex-col font-sans relative overflow-x-hidden">
      <NotificationToast notifications={activeToasts} onClose={handleCloseToast} />

      {/* Subtle atmospheric background depth forms */}
      <div className="fixed -top-40 -left-40 w-[500px] h-[500px] bg-cyan-100/35 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 -right-40 w-[450px] h-[450px] bg-teal-100/30 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed -bottom-40 left-1/4 w-[600px] h-[600px] bg-slate-200/40 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Clinical Header Bar */}
      <header className="bg-white/92 border-b border-slate-200/80 sticky top-0 z-40 backdrop-blur-xl shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.95)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand & Telemetry Status Beacon */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 flex items-center justify-center text-white shadow-[0_4px_12px_rgba(13,148,136,0.25),inset_0_1px_0_rgba(255,255,255,0.3)]">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm tracking-tight">AuraHealth Core</span>
                <span className="hidden sm:inline-flex text-[10px] font-semibold text-cyan-700 bg-cyan-50 border border-cyan-200/80 px-2 py-0.5 rounded-full shadow-neu-sm">
                  Clinical AI Engine
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-slate-500 font-medium">Clinical AI Online</span>
              </div>
            </div>
          </div>

          {/* Right Action Controls: Emergency SOS, Notifications, User Identity, Logout */}
          <div className="flex items-center gap-3">
            {/* Emergency SOS Button */}
            <Button
              variant="dangerOutline"
              size="sm"
              icon={AlertTriangle}
              onClick={() => setShowEmergencyModal(true)}
              className="border-rose-300 text-rose-700 bg-rose-50/90 hover:bg-rose-100 shadow-sm"
              title="Dispatch Acute Emergency Telemetry Alert"
            >
              <span className="hidden sm:inline">Emergency</span> SOS
            </Button>

            {/* Notification Popover Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifs(!showNotifs)}
                className="p-2.5 bg-[#f0f4f8] hover:bg-[#e8eff6] rounded-xl relative text-slate-600 hover:text-slate-900 border border-white/90 shadow-neu-sm hover:shadow-neu-flat transition-all duration-150 focus:outline-none hover:-translate-y-0.5 active:translate-y-0.5"
                title="View In-App Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Tray Dropdown */}
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-glass-lg p-4 z-50 space-y-3 animate-in fade-in-0 zoom-in-95">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-cyan-600" />
                      <span className="text-xs font-bold text-slate-800">Telemetry Notifications</span>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-cyan-700 hover:text-cyan-800 font-semibold"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {userNotifications.length === 0 ? (
                      <div className="text-xs text-slate-400 text-center py-6">No recent notifications.</div>
                    ) : (
                      userNotifications.map(n => (
                        <div
                          key={n.id}
                          className={`text-xs p-3 rounded-xl border transition-colors space-y-1 ${
                            n.read
                              ? 'bg-slate-50/70 border-slate-100 text-slate-600'
                              : 'bg-cyan-50/70 border-cyan-200/80 text-cyan-950 font-medium'
                          }`}
                        >
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                            <span>{n.time}</span>
                            <span className={n.type === 'error' ? 'text-rose-600 font-semibold' : 'text-cyan-700 font-semibold'}>
                              {n.type === 'error' ? 'Urgent Alert' : 'Direct Notice'}
                            </span>
                          </div>
                          <div className="leading-snug">{n.text}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Info & Identity Badge */}
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800 leading-tight">{currentUser.full_name}</span>
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <Badge
                  variant={
                    currentUser.role === 'admin' ? 'purple' :
                    currentUser.role === 'doctor' ? 'info' : 'success'
                  }
                  size="sm"
                >
                  {currentUser.role}
                </Badge>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              title="Sign Out of Portal"
              className="p-2.5 bg-[#f0f4f8] hover:bg-rose-50 hover:text-rose-600 rounded-xl text-slate-500 border border-white/90 shadow-neu-sm hover:shadow-neu-flat transition-all duration-150 focus:outline-none hover:-translate-y-0.5 active:translate-y-0.5"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Secondary Workspace Sub-Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none border-t border-slate-200/60">
          {currentUser.role === 'patient' && (
            <>
              <button
                onClick={() => setActiveTab('general_medicine')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 whitespace-nowrap ${
                  activeTab === 'general_medicine'
                    ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-600" /> Virtual Triage & Symptom Checker
              </button>
              <button
                onClick={() => setActiveTab('booking')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 whitespace-nowrap ${
                  activeTab === 'booking'
                    ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Appointments
                {patientAppointments.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-cyan-100 text-cyan-800 text-[10px] font-mono font-semibold shadow-neu-sm">
                    {patientAppointments.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 whitespace-nowrap ${
                  activeTab === 'profile'
                    ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
                }`}
              >
                <User className="w-3.5 h-3.5" /> My Profile
              </button>
              <button
                onClick={() => setActiveTab('records')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 whitespace-nowrap ${
                  activeTab === 'records'
                    ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Medical Records
                {medicalRecords.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold shadow-neu-sm">
                    {medicalRecords.length}
                  </span>
                )}
              </button>
              <div className="h-4 w-px bg-slate-200 mx-1" />
            </>
          )}

          {currentUser.role === 'doctor' && (
            <>
              <button
                onClick={() => setActiveTab('general_medicine')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 whitespace-nowrap ${
                  activeTab === 'general_medicine'
                    ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-600" /> General Medicine
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 whitespace-nowrap ${
                  activeTab === 'queue'
                    ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" /> Clinic Queue
                {doctorQueue.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-cyan-100 text-cyan-800 text-[10px] font-mono font-semibold shadow-neu-sm">
                    {doctorQueue.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('emergencies')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 whitespace-nowrap ${
                  activeTab === 'emergencies'
                    ? 'bg-white text-rose-700 shadow-[0_2px_8px_rgba(244,63,94,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-rose-200/90 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Acute Triage Feed
                {emergencyRecords.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10px] font-mono font-semibold shadow-neu-sm">
                    {emergencyRecords.length}
                  </span>
                )}
              </button>
              <div className="h-4 w-px bg-slate-200 mx-1" />
            </>
          )}

          {currentUser.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('general_medicine')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 whitespace-nowrap ${
                  activeTab === 'general_medicine'
                    ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-600" /> General Medicine
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 whitespace-nowrap ${
                  activeTab === 'admin'
                    ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Hospital Operations
              </button>
              <button
                onClick={() => setActiveTab('emergencies')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 whitespace-nowrap ${
                  activeTab === 'emergencies'
                    ? 'bg-white text-rose-700 shadow-[0_2px_8px_rgba(244,63,94,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-rose-200/90 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Emergency Triage Feed
              </button>
              <div className="h-4 w-px bg-slate-200 mx-1" />
            </>
          )}

          {/* AI Diagnostic Workstations (Available to all authorized roles) */}
          <button
            onClick={() => setActiveTab('neurology')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap ${
              activeTab === 'neurology'
                ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-cyan-600" /> Neurology AI
          </button>
          <button
            onClick={() => setActiveTab('ecg')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap ${
              activeTab === 'ecg'
                ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500" /> ECG Rhythm
          </button>
          <button
            onClick={() => setActiveTab('icu')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap ${
              activeTab === 'icu'
                ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5 text-teal-600" /> ICU Risk AI
          </button>
          <button
            onClick={() => setActiveTab('respiratory')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap ${
              activeTab === 'respiratory'
                ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
            }`}
          >
            <Wind className="w-3.5 h-3.5 text-teal-600" /> Respiratory AI
          </button>
          <button
            onClick={() => setActiveTab('orthopedics')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap ${
              activeTab === 'orthopedics'
                ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
            }`}
          >
            <Bone className="w-3.5 h-3.5 text-teal-600" /> Orthopedics AI
          </button>
        </div>
      </header>

      {/* Main Workspace Surface */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 print:p-0">
        {activeTab === 'general_medicine' && (
          <GeneralMedicineDashboard
            currentUser={currentUser}
            onNavigateToTab={(tab, prefillData) => {
              if (tab === 'booking' && prefillData) {
                if (prefillData.department) setSelectedDept(prefillData.department);
                setActiveTab('booking');
              } else {
                setActiveTab(tab);
              }
            }}
            activeGmSessionUuid={activeGmSessionUuid}
            setActiveGmSessionUuid={setActiveGmSessionUuid}
          />
        )}
        {activeTab === 'neurology' && (
          <NeurologyDashboard
            currentUser={currentUser}
            activeGmSessionUuid={activeGmSessionUuid}
            setActiveGmSessionUuid={setActiveGmSessionUuid}
            onNavigateToTab={setActiveTab}
          />
        )}
        {activeTab === 'ecg' && (
          <EcgDashboard
            currentUser={currentUser}
            activeGmSessionUuid={activeGmSessionUuid}
            setActiveGmSessionUuid={setActiveGmSessionUuid}
            onNavigateToTab={setActiveTab}
          />
        )}
        {activeTab === 'icu' && (
          <IcuDashboard
            currentUser={currentUser}
            activeGmSessionUuid={activeGmSessionUuid}
            setActiveGmSessionUuid={setActiveGmSessionUuid}
            onNavigateToTab={setActiveTab}
          />
        )}
        {activeTab === 'respiratory' && (
          <RespiratoryDashboard
            currentUser={currentUser}
            activeGmSessionUuid={activeGmSessionUuid}
            setActiveGmSessionUuid={setActiveGmSessionUuid}
            onNavigateToTab={setActiveTab}
          />
        )}
        {activeTab === 'orthopedics' && (
          <OrthopedicsDashboard
            currentUser={currentUser}
            activeGmSessionUuid={activeGmSessionUuid}
            setActiveGmSessionUuid={setActiveGmSessionUuid}
            onNavigateToTab={setActiveTab}
          />
        )}

        {/* --- 1. PATIENT: MY SAVED EHR MEDICAL RECORDS --- */}
        {activeTab === 'records' && (
          <div className="space-y-6 print:bg-white print:text-black">
            <Card className="print:border-none print:shadow-none">
              <CardHeader className="print:hidden">
                <div>
                  <CardTitle icon={FileText}>Personal Medical Health Records (EHR)</CardTitle>
                  <CardDescription>Structured clinical documentation: AI analysis, doctor encounter notes, and diagnostic reports</CardDescription>
                </div>
                <Badge variant="info" size="md">
                  {medicalRecords.length} Saved Records
                </Badge>
              </CardHeader>

              {/* Structured Category Tabs */}
              <div className="px-6 pb-2 print:hidden">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                  {['All', 'AI Analysis', 'Doctor Notes', 'Medical Reports', 'Lab Results', 'Patient History', 'Appointment History'].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedRecordCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                        selectedRecordCategory === cat
                          ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-sm font-bold -translate-y-0.5'
                          : 'bg-white/90 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-200/80 shadow-neu-sm'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <CardContent className="print:hidden">
                {medicalRecords.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title={`No Records Found in "${selectedRecordCategory}"`}
                    description="Run an AI diagnostic evaluation (Neurology, ECG, ICU, Respiratory, or Orthopedics) and save it to patient EHR, or switch categories above."
                  />
                ) : (
                  <div className="space-y-4">
                    {medicalRecords.map((rec) => (
                      <div
                        key={rec.id}
                        className="bg-white/95 p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_6px_18px_rgba(15,23,42,0.07)] hover:-translate-y-0.5 space-y-3 transition-all duration-150"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-cyan-900">{rec.record_type}</span>
                              <Badge variant="neutral" size="xs">
                                {rec.source_category || 'AI Analysis'}
                              </Badge>
                              {rec.modality && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                  {rec.modality}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-1 flex items-center gap-2 flex-wrap">
                              <span>{rec.created_at}</span>
                              {rec.department && <span>• {rec.department}</span>}
                              {rec.doctor_name && <span className="text-cyan-800 font-semibold">• Dr. {rec.doctor_name}</span>}
                              {rec.model_name && <span className="text-slate-400">• Model: {rec.model_name}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={
                                rec.status_level === 'CRITICAL' || rec.status_level === 'HIGH' ? 'danger' :
                                rec.status_level === 'MODERATE' ? 'warning' : 'success'
                              }
                              size="md"
                              dot
                            >
                              {rec.status_level} ({rec.risk_score}%)
                            </Badge>
                            <Button
                              variant="outline"
                              size="xs"
                              icon={Printer}
                              onClick={() => handlePrintReport(rec)}
                            >
                              Print
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {rec.details && rec.details.map((d, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-slate-700 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 leading-relaxed"
                            >
                              {d}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>

              {/* Printable Official Clinical Report */}
              {selectedPrintRecord && (
                <div className="hidden print:block p-8 border border-slate-300 rounded-2xl space-y-6 text-black">
                  <div className="flex justify-between items-center border-b pb-4">
                    <div>
                      <h1 className="text-2xl font-bold">AuraHealth Clinical Medical Report</h1>
                      <p className="text-xs text-gray-500">Certified Hospital EHR Diagnostic Evaluation</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-semibold">Assessment Date: {selectedPrintRecord.created_at}</p>
                      <p className="text-gray-500">Patient: {currentUser.full_name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border text-xs">
                    <div><strong>Module Evaluated:</strong> {selectedPrintRecord.record_type}</div>
                    <div><strong>Assessed Risk Metric:</strong> {selectedPrintRecord.risk_score}%</div>
                    <div><strong>Clinical Acuity Status:</strong> {selectedPrintRecord.status_level}</div>
                    <div><strong>Patient Registry ID:</strong> PAT-{currentUser.id.toString().padStart(4, '0')}</div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-xs">Diagnostic Assessment & Biomarker Details:</h3>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-gray-700">
                      {selectedPrintRecord.details && selectedPrintRecord.details.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-12 border-t flex justify-between text-xs text-gray-400">
                    <p>Verified by AuraHealth Core Clinical Neural Diagnostic Engine</p>
                    <p>Attending Physician Signature: _______________________</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* --- 2. PATIENT: APPOINTMENT BOOKING & ACTIVE TICKETS --- */}
        {activeTab === 'booking' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Reservation Form */}
            <Card className="lg:col-span-5">
              <CardHeader>
                <div>
                  <CardTitle icon={Calendar}>Reserve Consultation Ticket</CardTitle>
                  <CardDescription>Select specialty, doctor, and live appointment slot</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Clinical Specialty">
                  <Select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </FormField>

                <FormField label="Attending Physician">
                  <Select
                    value={selectedDoctor ? selectedDoctor.id : ''}
                    onChange={e => setSelectedDoctor(doctorsList.find(doc => doc.id === Number(e.target.value)))}
                  >
                    {doctorsList.length === 0 && <option value="">No physicians scheduled</option>}
                    {doctorsList.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} ({doc.department})
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Target Date">
                  <Input
                    type="date"
                    value={bookingDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setBookingDate(e.target.value)}
                  />
                </FormField>

                <FormField label="Available Clinic Slots" hint="Select an open 20-minute consultation window">
                  {loadingSlots && <div className="text-xs text-slate-500 py-2">Loading available clinic slots...</div>}
                  {!loadingSlots && selectedDoctor && availableSlots.length === 0 && (
                    <div className="text-xs text-slate-500 py-2">No open slots found for this date.</div>
                  )}
                  {!loadingSlots && !selectedDoctor && (
                    <div className="text-xs text-slate-500 py-2">Select an attending physician to load open slots.</div>
                  )}
                  <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                    {availableSlots.map(slot => (
                      <button
                        type="button"
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => setBookingTime(slot.time)}
                        className={`text-[11px] py-2 rounded-xl border font-mono transition-all duration-150 ${
                          !slot.available
                            ? 'bg-slate-100/70 border-slate-200 text-slate-400 line-through cursor-not-allowed opacity-50'
                            : bookingTime === slot.time
                            ? 'bg-gradient-to-r from-teal-600 to-cyan-600 border-transparent text-white shadow-md font-semibold -translate-y-0.5'
                            : 'bg-[#f0f4f8] border-white/90 text-slate-700 shadow-neu-sm hover:shadow-neu-flat hover:-translate-y-0.5 hover:bg-white'
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </FormField>

                <Button
                  onClick={handleBookAppointment}
                  disabled={!selectedDoctor || !bookingTime}
                  className="w-full mt-2"
                >
                  Confirm Reservation {bookingTime && `(${bookingTime})`}
                </Button>
              </CardContent>
            </Card>

            {/* Right Column: Active Tickets */}
            <Card className="lg:col-span-7">
              <CardHeader>
                <div>
                  <CardTitle icon={Clock}>My Consultation Appointments</CardTitle>
                  <CardDescription>Live clinic queue position & scheduled consults</CardDescription>
                </div>
                <Badge variant="info" size="sm">
                  {patientAppointments.length} Total
                </Badge>
              </CardHeader>
              <CardContent>
                {patientAppointments.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title="No Consultation Tickets"
                    description="Book an appointment on the left to obtain your queue ticket number and scheduled consultation slot."
                  />
                ) : (
                  <div className="space-y-3">
                    {patientAppointments.map(item => {
                      const isMissed = item.status === 'Missed';
                      const isCancelled = item.status === 'Cancelled';
                      const isCompleted = item.status === 'Completed';
                      const isInProgress = item.status === 'In Progress';
                      const isUpcoming = item.status === 'Upcoming' || item.status === 'WAITING';

                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-2xl border transition-all duration-150 ${
                            isMissed
                              ? 'bg-amber-50/40 border-amber-200/80 shadow-sm'
                              : isCancelled
                              ? 'bg-slate-50/70 border-slate-200 text-slate-500'
                              : 'bg-white/95 border-slate-200/70 shadow-[0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_6px_16px_rgba(15,23,42,0.07)] hover:-translate-y-0.5'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-cyan-900">{item.department} Clinic</span>
                                <span className="text-[10px] text-slate-400 font-mono">Ticket #{item.id}</span>
                              </div>
                              <div className="text-xs text-slate-600 mt-1">
                                Dr. {item.doctor_name} • <span className="font-mono text-slate-500">{item.appointment_date} ({item.appointment_time})</span>
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {isUpcoming && (
                                  <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200/80 shadow-neu-sm">
                                    Queue #{item.queue_number}
                                  </span>
                                )}
                                <Badge
                                  variant={
                                    isCompleted ? 'success' :
                                    isInProgress ? 'warning' :
                                    isCancelled ? 'danger' :
                                    isMissed ? 'neutral' : 'info'
                                  }
                                  size="sm"
                                  dot={isInProgress}
                                  pulse={isInProgress}
                                >
                                  {item.status}
                                </Badge>
                              </div>

                              {isUpcoming && (
                                <Button
                                  variant="dangerOutline"
                                  size="xs"
                                  icon={X}
                                  onClick={() => handleCancelAppointment(item.id)}
                                >
                                  Cancel Ticket
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Expired / Missed Appointment Experience */}
                          {isMissed && (
                            <div className="mt-3 pt-3 border-t border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 text-amber-800 font-medium">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>This appointment has ended. Scheduled time slot has passed.</span>
                              </div>
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => {
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                              >
                                Book New Appointment
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* --- 3. PATIENT: PROFILE TAB --- */}
        {activeTab === 'profile' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {currentUser.full_name?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">{currentUser.full_name}</h2>
                    <p className="text-xs text-slate-400 font-mono">Patient Portal Identifier: PAT-{currentUser.id.toString().padStart(4, '0')}</p>
                  </div>
                </div>
                <Badge variant="success" size="sm" dot>Verified Patient</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Email & Verification */}
                  <div className="bg-white/95 p-3.5 rounded-xl border border-slate-200/70 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono text-[10px] uppercase">Registered Email</span>
                      <Badge variant={currentUser.is_email_verified ? 'success' : 'warning'} size="xs" dot={currentUser.is_email_verified}>
                        {currentUser.is_email_verified ? 'Verified' : 'Unverified'}
                      </Badge>
                    </div>
                    <div className="text-slate-800 font-medium truncate">{currentUser.email}</div>
                    <div className="flex items-center gap-2 pt-1">
                      {!currentUser.is_email_verified && (
                        <Button variant="primaryOutline" size="xs" onClick={handleVerifyEmail}>
                          Verify Email
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setNewEmailInput(currentUser.email);
                          setCurrentPasswordInput('');
                          setEmailUpdateMsg({ type: '', text: '' });
                          setShowEmailEditModal(true);
                        }}
                      >
                        Change Email
                      </Button>
                    </div>
                  </div>

                  {/* Google Account Connection */}
                  <div className="bg-white/95 p-3.5 rounded-xl border border-slate-200/70 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono text-[10px] uppercase">Google Authentication</span>
                      {currentUser.google_id ? (
                        <Badge variant="info" size="xs">Connected</Badge>
                      ) : (
                        <Badge variant="neutral" size="xs">Not Linked</Badge>
                      )}
                    </div>
                    <div className="text-slate-700 text-xs flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      <span className="truncate">{currentUser.google_id ? 'Google Account Connected' : 'No Google account linked'}</span>
                    </div>
                    <div className="pt-1">
                      {!currentUser.google_id ? (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => {
                            setLinkGoogleInput(currentUser.email);
                            setShowLinkGoogleModal(true);
                          }}
                        >
                          Connect Google Account
                        </Button>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> OAuth Active
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/95 p-3.5 rounded-xl border border-slate-200/70 shadow-sm space-y-1">
                    <span className="text-slate-400 block font-mono text-[10px] uppercase">Assigned Security Role</span>
                    <span className="text-cyan-800 font-semibold uppercase">{currentUser.role}</span>
                  </div>
                  <div className="bg-white/95 p-3.5 rounded-xl border border-slate-200/70 shadow-sm space-y-1">
                    <span className="text-slate-400 block font-mono text-[10px] uppercase">Assigned Clinic / Care Focus</span>
                    <span className="text-slate-800 font-medium">{currentUser.department || 'General Care'}</span>
                  </div>
                </div>

                {/* Patient Clinical Demographics */}
                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-cyan-700" /> Clinical Demographic Records
                    </span>
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setProfileForm({
                          phone_number: currentUser.phone_number || '',
                          date_of_birth: currentUser.date_of_birth || '',
                          gender: currentUser.gender || 'male',
                          blood_group: currentUser.blood_group || 'O+',
                          emergency_contact: currentUser.emergency_contact || ''
                        });
                        setShowProfileCompletionModal(true);
                      }}
                    >
                      Update Demographics
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">Phone</span>
                      <span className="font-semibold text-slate-800">{currentUser.phone_number || '—'}</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">Date of Birth</span>
                      <span className="font-semibold text-slate-800">{currentUser.date_of_birth || '—'}</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">Gender</span>
                      <span className="font-semibold text-slate-800 capitalize">{currentUser.gender || '—'}</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">Blood Group</span>
                      <span className="font-semibold text-rose-700">{currentUser.blood_group || '—'}</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100 sm:col-span-2">
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">Emergency Contact</span>
                      <span className="font-semibold text-slate-800">{currentUser.emergency_contact || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/95 p-3 rounded-xl border border-slate-200/70 shadow-sm flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Session Security Protocol</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> HttpOnly Authenticated Cookie
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Overview Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card variant="neu" hover onClick={() => setActiveTab('booking')} className="cursor-pointer">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500 block">Active Clinic Tickets</span>
                    <div className="text-2xl font-bold font-mono text-cyan-800">{patientAppointments.length}</div>
                    <p className="text-[11px] text-slate-400">Upcoming clinical consults</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-neu-sm text-slate-400">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>

              <Card variant="neu" hover onClick={() => setActiveTab('records')} className="cursor-pointer">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500 block">Stored EHR Diagnostic Records</span>
                    <div className="text-2xl font-bold font-mono text-emerald-700">{medicalRecords.length}</div>
                    <p className="text-[11px] text-slate-400">Saved AI assessments</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-neu-sm text-slate-400">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* --- 4. DOCTOR: CLINIC QUEUE MANAGEMENT --- */}
        {activeTab === 'queue' && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle icon={Stethoscope}>Patient Queue Management</CardTitle>
                <CardDescription>
                  Active Department: <span className="text-cyan-800 font-semibold">{currentUser.department || 'General Clinic'}</span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={History}
                  onClick={() => setShowAuditModal(true)}
                >
                  AI Analysis Audit Trail
                </Button>
                <Badge variant="info" size="md">
                  Dr. {currentUser.full_name}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {doctorQueue.length === 0 ? (
                <EmptyState
                  icon={Stethoscope}
                  title="No Patients in Queue"
                  description={`There are currently no waiting appointments scheduled for the ${currentUser.department || 'General'} department today.`}
                />
              ) : (
                <div className="space-y-3">
                  {doctorQueue.map(item => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-white/95 border border-slate-200/70 shadow-[0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_6px_18px_rgba(15,23,42,0.07)] hover:-translate-y-0.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-150"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xl font-mono font-bold text-cyan-800 bg-cyan-50 px-3.5 py-2 rounded-xl border border-cyan-200/80 shadow-neu-sm">
                          #{item.queue_number}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-slate-800">{item.patient_name}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            Scheduled: {item.appointment_time} • {item.appointment_date}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            item.status === 'Completed' || item.status === 'COMPLETED' ? 'success' :
                            item.status === 'In Progress' || item.status === 'IN_PROGRESS' ? 'warning' :
                            item.status === 'Cancelled' ? 'danger' : 'neutral'
                          }
                          size="md"
                          dot={item.status === 'In Progress' || item.status === 'IN_PROGRESS'}
                          pulse={item.status === 'In Progress' || item.status === 'IN_PROGRESS'}
                        >
                          {item.status}
                        </Badge>

                        <Button
                          variant="secondary"
                          size="xs"
                          icon={Eye}
                          onClick={() => handleViewPatientEhr(item.patient_id, item.patient_name)}
                          title="Inspect Patient EHR"
                        >
                          EHR
                        </Button>

                        <Button
                          variant="secondary"
                          size="xs"
                          icon={PlusCircle}
                          onClick={() => setDoctorClinicalModal({
                            patient_id: item.patient_id,
                            patient_name: item.patient_name,
                            record_type: 'Physician Clinical Evaluation',
                            risk_score: 15,
                            status_level: 'NORMAL',
                            notes: ''
                          })}
                          title="Record Clinical Evaluation Note"
                        >
                          Note
                        </Button>

                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => updateQueueStatus(item, 'In Progress')}
                        >
                          Call In
                        </Button>

                        <Button
                          variant="success"
                          size="xs"
                          onClick={() => updateQueueStatus(item, 'Completed')}
                        >
                          Complete
                        </Button>

                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => updateQueueStatus(item, 'Missed')}
                          title="Mark as Missed"
                        >
                          Missed
                        </Button>

                        <Button
                          variant="dangerOutline"
                          size="xs"
                          icon={X}
                          onClick={() => handleCancelAppointment(item.id)}
                          title="Cancel Appointment"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* --- 5. EMERGENCY ACUTE TRIAGE FEED (Doctor & Admin) --- */}
        {activeTab === 'emergencies' && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle icon={AlertTriangle}>Emergency Acute Triage Telemetry Feed</CardTitle>
                <CardDescription>Real-time clinical alerts, acute distress incidents, and telemetry feeds</CardDescription>
              </div>
              <Button
                variant="danger"
                size="sm"
                icon={AlertTriangle}
                onClick={() => setShowEmergencyModal(true)}
              >
                Dispatch Alert
              </Button>
            </CardHeader>
            <CardContent>
              {emergencyRecords.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="No Acute Emergency Incidents"
                  description="No acute distress cases registered in current session."
                />
              ) : (
                <div className="space-y-4">
                  {emergencyRecords.map(em => (
                    <div
                      key={em.id}
                      className="bg-white/95 p-5 rounded-2xl border border-rose-200/80 shadow-[0_4px_16px_-2px_rgba(244,63,94,0.08),0_2px_6px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_8px_24px_-4px_rgba(244,63,94,0.12)] hover:-translate-y-0.5 space-y-3.5 transition-all duration-150"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-slate-900 text-sm">{em.patient_name}</span>
                          <Badge variant="danger" size="sm">
                            EHR #{em.id}
                          </Badge>
                          <span className="text-xs text-slate-500">• {em.diagnosis || 'Acute Distress'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-mono text-slate-400">{em.created_at}</span>
                          {currentUser.role !== 'patient' && em.patient_id && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="xs"
                                icon={Eye}
                                onClick={() => handleViewPatientEhr(em.patient_id, em.patient_name)}
                              >
                                View EHR
                              </Button>
                              <Button
                                variant="secondary"
                                size="xs"
                                icon={PlusCircle}
                                onClick={() => setDoctorClinicalModal({
                                  patient_id: em.patient_id,
                                  patient_name: em.patient_name,
                                  record_type: 'Emergency Triage Follow-up',
                                  risk_score: 90,
                                  status_level: 'CRITICAL',
                                  notes: `Follow-up on Emergency EHR #${em.id}: ${em.triage_notes || em.diagnosis}`
                                })}
                              >
                                Add Note
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vital Signs Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#f4f7fa] p-3.5 rounded-xl border border-white/90 shadow-neu-sm">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-mono block font-medium">Heart Rate</span>
                          <span className="font-mono text-rose-600 font-bold text-sm">{em.heart_rate} bpm</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-mono block font-medium">Oxygen SpO2</span>
                          <span className="font-mono text-cyan-700 font-bold text-sm">{em.spo2}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-mono block font-medium">Blood Pressure</span>
                          <span className="font-mono text-slate-800 font-bold text-sm">{em.blood_pressure}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-mono block font-medium">Temperature</span>
                          <span className="font-mono text-amber-700 font-bold text-sm">{em.temperature}°C</span>
                        </div>
                      </div>

                      {em.triage_notes && (
                        <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                          <span className="text-slate-400 text-[10px] font-mono block mb-1 uppercase tracking-wider font-semibold">
                            Attending Clinical Triage Notes:
                          </span>
                          {em.triage_notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* --- 6. ADMIN: OPERATIONS PORTAL --- */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
            {/* Sub-navigation Controls */}
            <div className="flex gap-2 p-1.5 bg-[#f0f4f8] rounded-2xl border border-white/90 shadow-neu-sm overflow-x-auto">
              <button
                onClick={() => setAdminSubTab('doctors')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  adminSubTab === 'doctors'
                    ? 'bg-white text-cyan-950 shadow-[0_2px_6px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/80 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Medical Staff Directory & Onboarding
              </button>
              <button
                onClick={() => setAdminSubTab('users')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  adminSubTab === 'users'
                    ? 'bg-white text-cyan-950 shadow-[0_2px_6px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/80 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                System Users Directory ({adminUsers.length})
              </button>
              <button
                onClick={() => setAdminSubTab('appointments')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  adminSubTab === 'appointments'
                    ? 'bg-white text-cyan-950 shadow-[0_2px_6px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/80 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hospital Appointments Registry ({adminAppointments.length})
              </button>
              <button
                onClick={() => setAdminSubTab('audit')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  adminSubTab === 'audit'
                    ? 'bg-white text-cyan-950 shadow-[0_2px_6px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/80 font-bold -translate-y-0.5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                AI Analysis Audit Trail ({auditLogs.length})
              </button>
            </div>

            {/* Subtab 1: Doctors Directory & Onboarding Form */}
            {adminSubTab === 'doctors' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Card className="lg:col-span-5">
                  <CardHeader>
                    <div>
                      <CardTitle icon={ShieldCheck}>Onboard Medical Doctor</CardTitle>
                      <CardDescription>Register a verified physician into clinical departments</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {adminMsg && (
                      <Alert variant={adminMsg.includes('success') ? 'success' : 'error'} className="mb-4">
                        {adminMsg}
                      </Alert>
                    )}
                    <form onSubmit={handleCreateDoctor} className="space-y-4">
                      <FormField label="Physician Full Name" required>
                        <Input
                          type="text"
                          placeholder="Dr. Jane Smith"
                          value={newDocForm.full_name}
                          onChange={e => setNewDocForm({...newDocForm, full_name: e.target.value})}
                          required
                        />
                      </FormField>

                      <FormField label="Official Hospital Email" required>
                        <Input
                          type="email"
                          placeholder="jane.smith@aurahealth.com"
                          value={newDocForm.email}
                          onChange={e => setNewDocForm({...newDocForm, email: e.target.value})}
                          required
                        />
                      </FormField>

                      <FormField label="Initial Password" required>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={newDocForm.password}
                          onChange={e => setNewDocForm({...newDocForm, password: e.target.value})}
                          required
                        />
                      </FormField>

                      <FormField label="Clinical Specialty / Department" required>
                        <Select
                          value={newDocForm.department}
                          onChange={e => setNewDocForm({...newDocForm, department: e.target.value})}
                        >
                          {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </Select>
                      </FormField>

                      <Button
                        type="submit"
                        loading={creatingDoc}
                        className="w-full mt-2"
                      >
                        Create Doctor Account
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-7">
                  <CardHeader>
                    <div>
                      <CardTitle icon={Users}>Active Medical Staff Directory</CardTitle>
                      <CardDescription>Verified physicians currently assigned to hospital departments</CardDescription>
                    </div>
                    <Badge variant="info" size="sm">
                      {doctorsList.length} Doctors
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {doctorsList.map(doc => (
                        <div
                          key={doc.id}
                          className="p-4 rounded-2xl bg-white/95 border border-slate-200/70 shadow-[0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_6px_16px_rgba(15,23,42,0.07)] hover:-translate-y-0.5 flex items-center justify-between transition-all duration-150"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-800">{doc.name}</div>
                            <div className="text-[11px] text-cyan-700 font-medium mt-0.5">{doc.department} Clinic</div>
                          </div>
                          <Badge variant="neutral" size="sm">
                            DOC-{doc.id.toString().padStart(3, '0')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Subtab 2: All Users Directory */}
            {adminSubTab === 'users' && (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle icon={User}>Hospital User Accounts Ledger</CardTitle>
                    <CardDescription>Registered patients, physicians, and administrative accounts</CardDescription>
                  </div>
                  <Badge variant="info" size="sm">
                    {adminUsers.length} Users
                  </Badge>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow hover={false}>
                        <TableHead>User ID</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Department</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminUsers.map(u => (
                        <TableRow key={u.id}>
                          <TableCell className="font-mono text-cyan-700 font-semibold">#{u.id}</TableCell>
                          <TableCell className="font-semibold text-slate-800">{u.full_name}</TableCell>
                          <TableCell className="font-mono text-slate-500">{u.email}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                u.role === 'admin' ? 'purple' :
                                u.role === 'doctor' ? 'info' : 'success'
                              }
                              size="sm"
                            >
                              {u.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">{u.department || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Subtab 3: Hospital Appointments Registry */}
            {adminSubTab === 'appointments' && (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle icon={Calendar}>Hospital Appointments Registry</CardTitle>
                    <CardDescription>Comprehensive ledger of all consultations across hospital departments</CardDescription>
                  </div>
                  <Badge variant="info" size="sm">
                    {adminAppointments.length} Total
                  </Badge>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow hover={false}>
                        <TableHead>ID</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Date / Time</TableHead>
                        <TableHead>Queue</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminAppointments.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-cyan-700 font-semibold">#{a.id}</TableCell>
                          <TableCell className="font-semibold text-slate-800">{a.patient_name}</TableCell>
                          <TableCell className="text-slate-700">{a.doctor_name}</TableCell>
                          <TableCell className="text-slate-600">{a.department}</TableCell>
                          <TableCell className="font-mono text-slate-500 text-[11px]">{a.appointment_date} {a.appointment_time}</TableCell>
                          <TableCell className="font-mono text-cyan-700 font-semibold">#{a.queue_number}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                a.status === 'Completed' || a.status === 'COMPLETED' ? 'success' :
                                a.status === 'In Progress' || a.status === 'IN_PROGRESS' ? 'warning' :
                                a.status === 'Cancelled' ? 'danger' : 'neutral'
                              }
                              size="sm"
                              dot={a.status === 'In Progress' || a.status === 'IN_PROGRESS'}
                            >
                              {a.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(a.status === 'WAITING' || a.status === 'Upcoming') && (
                              <Button
                                variant="dangerOutline"
                                size="xs"
                                onClick={() => handleCancelAppointment(a.id)}
                              >
                                Cancel
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Subtab 4: AI Diagnostic Analysis Audit Trail */}
            {adminSubTab === 'audit' && (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle icon={History}>AI Diagnostic Analysis Audit Trail</CardTitle>
                    <CardDescription>Immutable regulatory compliance ledger of all AI diagnostic inferences executed across hospital departments</CardDescription>
                  </div>
                  <Badge variant="info" size="sm">
                    {auditLogs.length} Events Logged
                  </Badge>
                </CardHeader>
                <CardContent>
                  {auditLogs.length === 0 ? (
                    <EmptyState
                      icon={History}
                      title="No AI Analysis Audit Logs"
                      description="AI inference events and physician clinical saves will be logged here automatically."
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow hover={false}>
                          <TableHead>Event ID</TableHead>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Initiator</TableHead>
                          <TableHead>Target Patient</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Modality</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Summary</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-cyan-700 font-semibold">#{log.id}</TableCell>
                            <TableCell className="font-mono text-slate-500 text-[11px] whitespace-nowrap">{log.timestamp}</TableCell>
                            <TableCell className="font-semibold text-slate-800">{log.initiator_name}</TableCell>
                            <TableCell className="text-slate-700">{log.patient_name ? `${log.patient_name} (#${log.patient_id})` : `Patient #${log.patient_id}`}</TableCell>
                            <TableCell className="text-slate-600">{log.department || '—'}</TableCell>
                            <TableCell><Badge variant="neutral" size="xs">{log.modality || '—'}</Badge></TableCell>
                            <TableCell className="font-mono text-[11px] text-slate-600">{log.model_name || '—'}</TableCell>
                            <TableCell className="font-mono font-bold text-cyan-800">{log.confidence ? `${(log.confidence * 100).toFixed(1)}%` : '—'}</TableCell>
                            <TableCell className="text-slate-700 max-w-xs truncate text-[11px]" title={log.summary}>{log.summary || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* --- MODAL 1: EMERGENCY SOS DISPATCH MODAL --- */}
      <Modal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        title="Acute Emergency Triage SOS"
        description="Dispatch an immediate clinical triage telemetry alert to critical care staff"
        icon={AlertTriangle}
        headerVariant="danger"
      >
        <form onSubmit={handleSubmitEmergency} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Heart Rate (BPM)" required>
              <Input
                type="number"
                value={emergencyForm.heart_rate}
                onChange={e => setEmergencyForm({...emergencyForm, heart_rate: e.target.value})}
                required
              />
            </FormField>
            <FormField label="Oxygen SpO2 (%)" required>
              <Input
                type="number"
                value={emergencyForm.spo2}
                onChange={e => setEmergencyForm({...emergencyForm, spo2: e.target.value})}
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Blood Pressure" required>
              <Input
                type="text"
                value={emergencyForm.blood_pressure}
                onChange={e => setEmergencyForm({...emergencyForm, blood_pressure: e.target.value})}
                required
              />
            </FormField>
            <FormField label="Temperature (°C)" required>
              <Input
                type="number"
                step="0.1"
                value={emergencyForm.temperature}
                onChange={e => setEmergencyForm({...emergencyForm, temperature: e.target.value})}
                required
              />
            </FormField>
          </div>

          <FormField label="Suspected Acute Symptoms / Diagnosis" required>
            <Input
              type="text"
              value={emergencyForm.diagnosis}
              onChange={e => setEmergencyForm({...emergencyForm, diagnosis: e.target.value})}
              required
            />
          </FormField>

          <FormField label="Clinical Triage Notes">
            <Textarea
              rows={2}
              value={emergencyForm.triage_notes}
              onChange={e => setEmergencyForm({...emergencyForm, triage_notes: e.target.value})}
              placeholder="Record acute patient distress signs, consciousness level..."
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setShowEmergencyModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={emergencySubmitting}
              icon={AlertTriangle}
            >
              Dispatch Acute Alert
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 2: PATIENT COMPREHENSIVE EHR MODAL --- */}
      <Modal
        isOpen={Boolean(selectedPatientEhr)}
        onClose={() => setSelectedPatientEhr(null)}
        title="Patient Electronic Health Record (EHR)"
        description={selectedPatientEhr ? `Patient: ${selectedPatientEhr.patientName} (ID #${selectedPatientEhr.patientId})` : ''}
        icon={FileText}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-700">Clinical Evaluation Ledger</span>
            {currentUser.role === 'doctor' && selectedPatientEhr && (
              <Button
                variant="success"
                size="xs"
                icon={PlusCircle}
                onClick={() => setDoctorClinicalModal({
                  patient_id: selectedPatientEhr.patientId,
                  patient_name: selectedPatientEhr.patientName,
                  record_type: 'Physician Clinical Evaluation',
                  risk_score: 15,
                  status_level: 'NORMAL',
                  notes: ''
                })}
              >
                Add Clinical Note
              </Button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
            {selectedPatientEhr && selectedPatientEhr.records.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Stored Clinical Records"
                description="No diagnostic assessments or consultation records found for this patient."
              />
            ) : (
              selectedPatientEhr && selectedPatientEhr.records.map(rec => (
                <div key={rec.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-cyan-900">{rec.record_type}</span>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{rec.created_at}</div>
                    </div>
                    <Badge
                      variant={
                        rec.status_level === 'CRITICAL' || rec.status_level === 'HIGH' ? 'danger' :
                        rec.status_level === 'MODERATE' ? 'warning' : 'success'
                      }
                      size="sm"
                      dot
                    >
                      {rec.status_level} ({rec.risk_score}%)
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {rec.details && rec.details.map((d, idx) => (
                      <div key={idx} className="text-slate-700 bg-slate-50/80 p-2 rounded-xl border border-slate-100 leading-relaxed">
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* --- MODAL 3: DOCTOR CLINICAL EVALUATION NOTE MODAL --- */}
      <Modal
        isOpen={Boolean(doctorClinicalModal)}
        onClose={() => setDoctorClinicalModal(null)}
        title="Record Clinical Evaluation"
        description={doctorClinicalModal ? `Patient: ${doctorClinicalModal.patient_name}` : ''}
        icon={Stethoscope}
        headerVariant="success"
      >
        {doctorClinicalModal && (
          <form onSubmit={handleDoctorSaveRecord} className="space-y-4">
            <FormField label="Evaluation / Encounter Type" required>
              <Input
                type="text"
                value={doctorClinicalModal.record_type}
                onChange={e => setDoctorClinicalModal({...doctorClinicalModal, record_type: e.target.value})}
                required
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Acuity Severity">
                <Select
                  value={doctorClinicalModal.status_level}
                  onChange={e => setDoctorClinicalModal({...doctorClinicalModal, status_level: e.target.value})}
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="MODERATE">MODERATE</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </Select>
              </FormField>

              <FormField label="Assessed Risk Score (0-100)">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={doctorClinicalModal.risk_score}
                  onChange={e => setDoctorClinicalModal({...doctorClinicalModal, risk_score: e.target.value})}
                />
              </FormField>
            </div>

            <FormField label="Physician Findings & Treatment Plan" required>
              <Textarea
                rows={3}
                value={doctorClinicalModal.notes}
                onChange={e => setDoctorClinicalModal({...doctorClinicalModal, notes: e.target.value})}
                placeholder="Document clinical diagnosis, medication regimen, and follow-up plan..."
                required
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setDoctorClinicalModal(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="success"
                icon={Check}
              >
                Save to Patient EHR
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- MODAL 4: PROFILE DEMOGRAPHICS COMPLETION MODAL --- */}
      <Modal
        isOpen={showProfileCompletionModal}
        onClose={() => setShowProfileCompletionModal(false)}
        title="Clinical Demographic Profile"
        description="Complete and verify your official clinical demographic records"
        icon={User}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCompleteProfile} className="space-y-3.5">
          <Alert variant="info">
            Required for electronic health records (EHR) synchronization and clinical emergency triage.
          </Alert>

          <FormField label="Phone Number" required>
            <Input
              type="tel"
              placeholder="+1 (555) 019-2834"
              value={profileForm.phone_number}
              onChange={e => setProfileForm({ ...profileForm, phone_number: e.target.value })}
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date of Birth" required>
              <Input
                type="date"
                value={profileForm.date_of_birth}
                onChange={e => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Gender" required>
              <Select
                value={profileForm.gender}
                onChange={e => setProfileForm({ ...profileForm, gender: e.target.value })}
                required
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Blood Group" required>
              <Select
                value={profileForm.blood_group}
                onChange={e => setProfileForm({ ...profileForm, blood_group: e.target.value })}
                required
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Emergency Contact (Name & Phone)" required>
              <Input
                type="text"
                placeholder="Jane Doe (555-0199)"
                value={profileForm.emergency_contact}
                onChange={e => setProfileForm({ ...profileForm, emergency_contact: e.target.value })}
                required
              />
            </FormField>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setShowProfileCompletionModal(false)}>
              Close
            </Button>
            <Button type="submit" variant="primary" icon={CheckCircle2}>
              Save Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 5: CHANGE EMAIL MODAL --- */}
      <Modal
        isOpen={showEmailEditModal}
        onClose={() => setShowEmailEditModal(false)}
        title="Update Registered Email Address"
        description="Modify the official email associated with your AuraHealth account"
        icon={Mail}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateEmail} className="space-y-4">
          {emailUpdateMsg.text && (
            <Alert variant={emailUpdateMsg.type === 'success' ? 'success' : 'error'}>
              {emailUpdateMsg.text}
            </Alert>
          )}

          <FormField label="Current Email">
            <Input
              type="email"
              value={currentUser.email}
              disabled
              className="bg-slate-100 cursor-not-allowed opacity-75"
            />
          </FormField>

          <FormField label="New Email Address" required>
            <Input
              type="email"
              placeholder="new.email@example.com"
              value={newEmailInput}
              onChange={e => setNewEmailInput(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Current Password" helperText="Required for security verification of local accounts">
            <Input
              type="password"
              placeholder="••••••••"
              value={currentPasswordInput}
              onChange={e => setCurrentPasswordInput(e.target.value)}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowEmailEditModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Update Email
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 6: CONNECT GOOGLE ACCOUNT MODAL --- */}
      <Modal
        isOpen={showLinkGoogleModal}
        onClose={() => setShowLinkGoogleModal(false)}
        title="Connect Google Account"
        description="Link your Google identity for streamlined one-click clinical authentication"
        icon={Globe}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <Alert variant="info">
            Connecting your Google account allows instant authentication with this verified Google email address.
          </Alert>

          <FormField label="Google Email Address" required>
            <Input
              type="email"
              placeholder="your.account@gmail.com"
              value={linkGoogleInput}
              onChange={e => setLinkGoogleInput(e.target.value)}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setShowLinkGoogleModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleLinkGoogle}>
              Connect Account
            </Button>
          </div>
        </div>
      </Modal>

      {/* --- MODAL 7: AI ANALYSIS AUDIT TRAIL MODAL (Doctor & Admin) --- */}
      <Modal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        title="AI Diagnostic Analysis Audit Trail"
        description="Immutable clinical ledger recording every AI analysis executed and saved"
        icon={History}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="text-xs text-slate-500 font-medium">Showing {auditLogs.length} audit trail records</span>
            <Badge variant="info" size="sm">{currentUser.role === 'admin' ? 'Hospital-Wide Log' : 'Clinical Department Log'}</Badge>
          </div>

          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {auditLogs.length === 0 ? (
              <EmptyState
                icon={History}
                title="No Audit Logs Recorded"
                description="AI inference events and physician clinical saves will appear here automatically."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow hover={false}>
                    <TableHead>Event ID</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Initiator</TableHead>
                    <TableHead>Target Patient</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Modality</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-cyan-700 font-semibold">#{log.id}</TableCell>
                      <TableCell className="font-mono text-slate-500 text-[11px] whitespace-nowrap">{log.timestamp}</TableCell>
                      <TableCell className="font-semibold text-slate-800">{log.initiator_name}</TableCell>
                      <TableCell className="text-slate-700">{log.patient_name ? `${log.patient_name} (#${log.patient_id})` : `Patient #${log.patient_id}`}</TableCell>
                      <TableCell className="text-slate-600">{log.department || '—'}</TableCell>
                      <TableCell><Badge variant="neutral" size="xs">{log.modality || '—'}</Badge></TableCell>
                      <TableCell className="font-mono text-[11px] text-slate-600">{log.model_name || '—'}</TableCell>
                      <TableCell className="font-mono font-bold text-cyan-800">{log.confidence ? `${(log.confidence * 100).toFixed(1)}%` : '—'}</TableCell>
                      <TableCell className="text-slate-700 max-w-xs truncate text-[11px]" title={log.summary}>{log.summary || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}