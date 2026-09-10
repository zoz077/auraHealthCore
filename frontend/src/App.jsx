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
  Lock,
  Mail,
  ChevronRight
} from 'lucide-react';
import IcuDashboard from './components/IcuDashboard';
import ImagingDashboard from './components/ImagingDashboard';
import EcgDashboard from './components/EcgDashboard';
import RespiratoryDashboard from './components/RespiratoryDashboard';
import NotificationToast from './components/NotificationToast';
import NeurologyDashboard from './components/NeurologyDashboard';

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

  const [authForm, setAuthForm] = useState({ email: '', password: '', full_name: '' });
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [departments] = useState([
    'Cardiology',
    'ICU & Critical Care',
    'Radiology',
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
      axios.get(`${API_BASE_URL}/api/medical-records/patient/${currentUser.id}`).then(res => setMedicalRecords(res.data)).catch(console.error);
      axios.get(`${API_BASE_URL}/api/v1/emergency/records`).then(res => setEmergencyRecords(res.data)).catch(console.error);
    } else if (currentUser.role === 'doctor') {
      axios.get(`${API_BASE_URL}/api/appointments/doctor/${currentUser.id}`).then(res => setDoctorQueue(res.data)).catch(console.error);
      axios.get(`${API_BASE_URL}/api/v1/emergency/records`).then(res => setEmergencyRecords(res.data)).catch(console.error);
    } else if (currentUser.role === 'admin') {
      axios.get(`${API_BASE_URL}/api/admin/users`).then(res => setAdminUsers(res.data)).catch(console.error);
      axios.get(`${API_BASE_URL}/api/admin/appointments`).then(res => setAdminAppointments(res.data)).catch(console.error);
      axios.get(`${API_BASE_URL}/api/v1/emergency/records`).then(res => setEmergencyRecords(res.data)).catch(console.error);
      axios.get(`${API_BASE_URL}/api/doctors`).then(res => setDoctorsList(res.data)).catch(console.error);
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
        details: [doctorClinicalModal.notes || 'Clinical notes recorded by physician.']
      });
      addNotification(`Clinical record recorded for ${doctorClinicalModal.patient_name}`, currentUser.id, 'success');
      const updatedPatientId = doctorClinicalModal.patient_id;
      const updatedPatientName = doctorClinicalModal.patient_name;
      setDoctorClinicalModal(null);
      if (selectedPatientEhr && selectedPatientEhr.patientId === updatedPatientId) {
        handleViewPatientEhr(updatedPatientId, updatedPatientName);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save clinical evaluation.');
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentUser, activeTab]);

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
            onClick={() => setActiveTab('imaging')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap ${
              activeTab === 'imaging'
                ? 'bg-white text-cyan-950 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-slate-200/90 font-bold -translate-y-0.5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-sm'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-600" /> Radiology AI
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
        </div>
      </header>

      {/* Main Workspace Surface */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 print:p-0">
        {activeTab === 'neurology' && <NeurologyDashboard currentUser={currentUser} />}
        {activeTab === 'ecg' && <EcgDashboard currentUser={currentUser} />}
        {activeTab === 'icu' && <IcuDashboard currentUser={currentUser} />}
        {activeTab === 'imaging' && <ImagingDashboard currentUser={currentUser} />}
        {activeTab === 'respiratory' && <RespiratoryDashboard currentUser={currentUser} />}

        {/* --- 1. PATIENT: MY SAVED EHR MEDICAL RECORDS --- */}
        {activeTab === 'records' && (
          <div className="space-y-6 print:bg-white print:text-black">
            <Card className="print:border-none print:shadow-none">
              <CardHeader className="print:hidden">
                <div>
                  <CardTitle icon={FileText}>Personal Medical Health Records (EHR)</CardTitle>
                  <CardDescription>Verified AI evaluations, diagnostic impressions, and clinical encounter notes</CardDescription>
                </div>
                <Badge variant="info" size="md">
                  {medicalRecords.length} Saved Records
                </Badge>
              </CardHeader>
              <CardContent className="print:hidden">
                {medicalRecords.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No Medical Records on File"
                    description="Run an AI diagnostic evaluation (Neurology, ECG, ICU, Radiology, or Respiratory) and click 'Save to Patient EHR' to record your first clinical document."
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
                            <span className="text-xs font-bold text-cyan-900">{rec.record_type}</span>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">{rec.created_at}</div>
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
                              Print Official Report
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
                  <CardTitle icon={Clock}>My Active Consultation Tickets</CardTitle>
                  <CardDescription>Live clinic queue position & scheduled consults</CardDescription>
                </div>
                <Badge variant="info" size="sm">
                  {patientAppointments.length} Active
                </Badge>
              </CardHeader>
              <CardContent>
                {patientAppointments.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title="No Active Consultation Tickets"
                    description="Book an appointment on the left to obtain your queue ticket number and scheduled consultation slot."
                  />
                ) : (
                  <div className="space-y-3">
                    {patientAppointments.map(item => (
                      <div
                        key={item.id}
                        className="bg-white/95 p-4 rounded-2xl border border-slate-200/70 shadow-[0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_6px_16px_rgba(15,23,42,0.07)] hover:-translate-y-0.5 transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
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
                            <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200/80 shadow-neu-sm">
                              Queue #{item.queue_number}
                            </span>
                            <Badge
                              variant={
                                item.status === 'COMPLETED' ? 'success' :
                                item.status === 'IN_PROGRESS' ? 'warning' :
                                item.status === 'CANCELLED' ? 'danger' : 'info'
                              }
                              size="sm"
                              dot={item.status === 'IN_PROGRESS'}
                              pulse={item.status === 'IN_PROGRESS'}
                            >
                              {item.status}
                            </Badge>
                          </div>

                          {item.status === 'WAITING' && (
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
                    ))}
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
                  <div className="bg-white/95 p-3.5 rounded-xl border border-slate-200/70 shadow-sm space-y-1">
                    <span className="text-slate-400 block font-mono text-[10px] uppercase">Registered Official Email</span>
                    <span className="text-slate-800 font-medium">{currentUser.email}</span>
                  </div>
                  <div className="bg-white/95 p-3.5 rounded-xl border border-slate-200/70 shadow-sm space-y-1">
                    <span className="text-slate-400 block font-mono text-[10px] uppercase">Assigned Security Role</span>
                    <span className="text-cyan-800 font-semibold uppercase">{currentUser.role}</span>
                  </div>
                  <div className="bg-white/95 p-3.5 rounded-xl border border-slate-200/70 shadow-sm space-y-1">
                    <span className="text-slate-400 block font-mono text-[10px] uppercase">Assigned Clinic / Care Focus</span>
                    <span className="text-slate-800 font-medium">{currentUser.department || 'General Care'}</span>
                  </div>
                  <div className="bg-white/95 p-3.5 rounded-xl border border-slate-200/70 shadow-sm space-y-1">
                    <span className="text-slate-400 block font-mono text-[10px] uppercase">Session Security State</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> HttpOnly Authenticated
                    </span>
                  </div>
                </div>

                {/* Academic registry transparency notice */}
                <Alert variant="info" title="Academic & Institutional Registry Synchronization">
                  Student and campus credentials (University, Academic Stage, Section) are preserved in the institutional record in compliance with the current database schema constraints.
                </Alert>
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
                            item.status === 'COMPLETED' ? 'success' :
                            item.status === 'IN_PROGRESS' ? 'warning' : 'neutral'
                          }
                          size="md"
                          dot={item.status === 'IN_PROGRESS'}
                          pulse={item.status === 'IN_PROGRESS'}
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
                          onClick={() => updateQueueStatus(item, 'IN_PROGRESS')}
                        >
                          Call In
                        </Button>

                        <Button
                          variant="success"
                          size="xs"
                          onClick={() => updateQueueStatus(item, 'COMPLETED')}
                        >
                          Complete
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
                                a.status === 'COMPLETED' ? 'success' :
                                a.status === 'IN_PROGRESS' ? 'warning' :
                                a.status === 'CANCELLED' ? 'danger' : 'neutral'
                              }
                              size="sm"
                              dot={a.status === 'IN_PROGRESS'}
                            >
                              {a.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {a.status === 'WAITING' && (
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
    </div>
  );
}