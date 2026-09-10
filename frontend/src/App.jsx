import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Calendar, ShieldCheck, LogOut, FileText, Stethoscope, Bell, Printer, AlertTriangle, User, Users, Eye, PlusCircle, X, Check, Clock } from 'lucide-react';
import IcuDashboard from './components/IcuDashboard';
import ImagingDashboard from './components/ImagingDashboard';
import EcgDashboard from './components/EcgDashboard';
import RespiratoryDashboard from './components/RespiratoryDashboard';
import NotificationToast from './components/NotificationToast';
import NeurologyDashboard from './components/NeurologyDashboard';

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

  const [notifications, setNotifications] = useState([]);
  const [activeToasts, setActiveToasts] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [selectedPrintRecord, setSelectedPrintRecord] = useState(null);

  // Phase 3 State: Emergency, Clinical Records, Admin Overview
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

    // Fetch persisted notifications
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

    // Connect to WebSocket using HttpOnly cookie automatically sent during handshake
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
    try {
      if (authMode === 'login') {
        const res = await axios.post(`${API_BASE_URL}/api/auth/login`, { email: authForm.email, password: authForm.password });
        const user = res.data.user;
        setCurrentUser(user);
        addNotification(`Welcome back, ${user.full_name}!`, user.id, 'success');

        if (user.role === 'admin') setActiveTab('admin');
        else if (user.role === 'doctor') setActiveTab('queue');
        else setActiveTab('booking');
      } else {
        await axios.post(`${API_BASE_URL}/api/auth/register`, authForm);
        setAuthMode('login');
        setAuthError('Registration successful! Please login.');
      }
    } catch (err) {
      setAuthError(err.response?.data?.detail || 'Authentication failed');
    }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedDoctor) return alert('Please select a doctor');
    if (!bookingTime) return alert('Please pick an available time slot');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/appointments/book`, {
        patient_id: currentUser.id,
        patient_name: currentUser.full_name,
        doctor_id: selectedDoctor.id,
        doctor_name: selectedDoctor.name,
        department: selectedDept,
        appointment_date: bookingDate,
        appointment_time: bookingTime
      });

      addNotification(`Appointment booked with Dr. ${selectedDoctor.name}. Queue #${res.data.queue_number}`, currentUser.id, 'success');
      addNotification(`New Patient Reserved: ${currentUser.full_name} (Queue #${res.data.queue_number})`, selectedDoctor.id, 'info');

      alert(`Appointment booked successfully! Your queue number is #${res.data.queue_number}`);
      setBookingTime('');
      refreshData();
      axios.get(`${API_BASE_URL}/api/appointments/available-slots`, {
        params: { doctor_id: selectedDoctor.id, date: bookingDate }
      }).then(r => setAvailableSlots(r.data));
    } catch (err) {
      alert(err.response?.data?.detail || 'Booking failed');
    }
  };

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    setAdminMsg('');
    try {
      await axios.post(`${API_BASE_URL}/api/admin/doctors`, newDocForm);
      setAdminMsg('Doctor account created successfully!');
      addNotification(`Doctor Account Created: ${newDocForm.full_name}`, currentUser.id, 'info');
      setNewDocForm({ full_name: '', email: '', password: '', department: 'Cardiology' });
    } catch (err) {
      setAdminMsg(err.response?.data?.detail || 'Creation failed');
    }
  };

  const updateQueueStatus = async (appItem, status) => {
    await axios.put(`${API_BASE_URL}/api/appointments/${appItem.id}/status`, { status });
    addNotification(`Status for ${appItem.patient_name} changed to ${status}`, currentUser.id, 'info');
    addNotification(`Dr. ${currentUser.full_name} updated your ticket status to: ${status}`, appItem.patient_id, 'success');
    refreshData();
  };

  const handlePrintReport = (rec) => {
    setSelectedPrintRecord(rec);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`);
    } catch (err) {
      console.error("Logout error:", err);
    }
    setCurrentUser(null);
    setActiveTab('booking');
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.read && n.id);
    for (const n of unread) {
      try {
        await axios.put(`${API_BASE_URL}/api/notifications/${n.id}/read`);
      } catch (e) {
        // ignore
      }
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const userNotifications = notifications.filter(n => n.targetUserId === currentUser?.id);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4">
        <NotificationToast notifications={activeToasts} onClose={handleCloseToast} />
        <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 justify-center mb-6">
            <Activity className="w-8 h-8 text-cyan-400 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">AuraHealth <span className="text-cyan-400">AI System</span></h1>
          </div>

          <div className="flex rounded-xl bg-slate-900 p-1 mb-6 border border-slate-800">
            <button onClick={() => { setAuthMode('login'); setAuthError(''); }} className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${authMode === 'login' ? 'bg-cyan-500 text-white' : 'text-slate-400'}`}>Sign In</button>
            <button onClick={() => { setAuthMode('register'); setAuthError(''); }} className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${authMode === 'register' ? 'bg-cyan-500 text-white' : 'text-slate-400'}`}>Patient Register</button>
          </div>

          {authError && <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">{authError}</div>}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Full Name</label>
                <input type="text" required value={authForm.full_name} onChange={e => setAuthForm({...authForm, full_name: e.target.value})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm" />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Email Address</label>
              <input type="email" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Password</label>
              <input type="password" required value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm" />
            </div>

            <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-xl transition-all mt-2">
              {authMode === 'login' ? 'Access Portal' : 'Create Patient Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans">
      <NotificationToast notifications={activeToasts} onClose={handleCloseToast} />
      <nav className="bg-[#111827] border-b border-slate-800 px-6 py-4 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-cyan-400" />
          <span className="font-bold text-lg">AuraHealth <span className="text-cyan-400">Core</span></span>
        </div>

        <div className="flex items-center gap-2 bg-[#0b0f19] p-1 rounded-xl border border-slate-800 text-xs">
          {currentUser.role === 'patient' && (
            <>
              <button onClick={() => setActiveTab('booking')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'booking' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Book Appointment</button>
              <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'profile' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>My Profile</button>
              <button onClick={() => setActiveTab('neurology')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'neurology' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Neurology AI</button>
              <button onClick={() => setActiveTab('ecg')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'ecg' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>ECG AI</button>
              <button onClick={() => setActiveTab('icu')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'icu' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>ICU Risk AI</button>
              <button onClick={() => setActiveTab('imaging')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'imaging' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Radiology AI</button>
              <button onClick={() => setActiveTab('respiratory')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'respiratory' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Respiratory AI</button>
              <button onClick={() => setActiveTab('records')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'records' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Medical EHR</button>
            </>
          )}

          {currentUser.role === 'doctor' && (
            <>
              <button onClick={() => setActiveTab('queue')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'queue' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
                My Clinic Queue ({currentUser.department || 'General'})
              </button>
              <button onClick={() => setActiveTab('emergencies')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'emergencies' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>
                Emergency Alerts
              </button>
              <button onClick={() => setActiveTab('neurology')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'neurology' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
                Neurology AI
              </button>
              <button onClick={() => setActiveTab('ecg')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'ecg' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
                ECG AI
              </button>
              <button onClick={() => setActiveTab('icu')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'icu' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
                ICU & Emergency AI
              </button>
              <button onClick={() => setActiveTab('imaging')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'imaging' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
                Radiology AI
              </button>
              <button onClick={() => setActiveTab('respiratory')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'respiratory' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
                Respiratory AI
              </button>
            </>
          )}

          {currentUser.role === 'admin' && (
            <>
              <button onClick={() => setActiveTab('admin')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'admin' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Admin Operations</button>
              <button onClick={() => setActiveTab('emergencies')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'emergencies' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>Emergency Triage</button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowEmergencyModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all shadow-sm"
            title="Dispatch Emergency Triage Alert"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Emergency SOS
          </button>
          <div className="relative">
            <button onClick={() => setShowNotifs(!showNotifs)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl relative text-slate-300">
              <Bell className="w-4 h-4" />
              {userNotifications.some(n => !n.read) && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping"></span>
              )}
              {userNotifications.some(n => !n.read) && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-[#111827]"></span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-200">My Notifications</span>
                  <span className="text-[10px] text-cyan-400 cursor-pointer" onClick={handleMarkAllRead}>Mark read</span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {userNotifications.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No notifications for you.</p>}
                  {userNotifications.map(n => (
                    <div key={n.id} className="text-xs p-2.5 bg-[#0b0f19] rounded-xl border border-slate-800 space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{n.time}</span>
                        <span className="text-cyan-400">Direct Alert</span>
                      </div>
                      <div className="text-slate-300">{n.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="text-xs font-semibold">{currentUser.full_name}</div>
            <div className="text-[10px] uppercase font-mono text-cyan-400">{currentUser.role}</div>
          </div>
          <button onClick={handleLogout} title="Sign Out" className="p-2 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl text-slate-400 transition-all">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 print:p-0">
        {activeTab === 'neurology' && <NeurologyDashboard currentUser={currentUser} />}

        {activeTab === 'ecg' && <EcgDashboard currentUser={currentUser} />}

        {activeTab === 'icu' && <IcuDashboard currentUser={currentUser} />}

        {activeTab === 'imaging' && <ImagingDashboard currentUser={currentUser} />}

        {activeTab === 'respiratory' && <RespiratoryDashboard currentUser={currentUser} />}

        {activeTab === 'records' && (
          <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4 print:bg-white print:text-black">
            <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2 print:hidden">
              <FileText className="w-5 h-5 text-cyan-400" /> My Saved AI Medical Records & EHR
            </h2>

            <div className="space-y-3 print:hidden">
              {medicalRecords.length === 0 && <p className="text-slate-500 text-sm">No saved AI evaluations in your record yet.</p>}
              {medicalRecords.map(rec => (
                <div key={rec.id} className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-cyan-400">{rec.record_type}</span>
                      <div className="text-[10px] text-slate-500">{rec.created_at}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${rec.status_level === 'HIGH' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {rec.status_level} ({rec.risk_score}%)
                      </span>
                      <button onClick={() => handlePrintReport(rec)} className="flex items-center gap-1.5 bg-slate-800 hover:bg-cyan-600 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition-all">
                        <Printer className="w-3.5 h-3.5" /> Print Report
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {rec.details.map((d, idx) => <div key={idx} className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded-lg">{d}</div>)}
                  </div>
                </div>
              ))}
            </div>

            {selectedPrintRecord && (
              <div className="hidden print:block p-8 border border-slate-300 rounded-2xl space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div>
                    <h1 className="text-2xl font-bold">AuraHealth Clinical Medical Report</h1>
                    <p className="text-sm text-gray-500">Official AI Diagnostic Assessment Record</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">Date: {selectedPrintRecord.created_at}</p>
                    <p className="text-xs text-gray-500">Patient: {currentUser.full_name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border text-sm">
                  <div><strong>Evaluation Module:</strong> {selectedPrintRecord.record_type}</div>
                  <div><strong>Risk Score:</strong> {selectedPrintRecord.risk_score}%</div>
                  <div><strong>Clinical Status:</strong> {selectedPrintRecord.status_level}</div>
                  <div><strong>Patient ID:</strong> PAT-2026-AURA</div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-sm">Diagnostic Details & Clinical Recommendations:</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {selectedPrintRecord.details.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-12 border-t flex justify-between text-xs text-gray-400">
                  <p>Certified by AuraHealth Core AI Diagnostic Engine</p>
                  <p>Physician Signature: _______________________</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'booking' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4">
              <h2 className="text-base font-semibold flex items-center gap-2 text-cyan-400"><Calendar className="w-5 h-5" /> Reserve Clinic Ticket</h2>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Select Specialty</label>
                <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm">
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Physician</label>
                <select value={selectedDoctor ? selectedDoctor.id : ''} onChange={e => setSelectedDoctor(doctorsList.find(doc => doc.id === Number(e.target.value)))} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm">
                  {doctorsList.length === 0 && <option value="">No doctors available</option>}
                  {doctorsList.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Date</label>
                <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200" />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Available Time Slots</label>
                {loadingSlots && <div className="text-xs text-slate-500">Loading available times...</div>}
                {!loadingSlots && selectedDoctor && availableSlots.length === 0 && (
                  <div className="text-xs text-slate-500">No slots found.</div>
                )}
                {!loadingSlots && !selectedDoctor && (
                  <div className="text-xs text-slate-500">Select a doctor to see available times.</div>
                )}
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                  {availableSlots.map(slot => (
                    <button
                      type="button"
                      key={slot.time}
                      disabled={!slot.available}
                      onClick={() => setBookingTime(slot.time)}
                      className={`text-[11px] py-2 rounded-lg border font-mono transition-all
                        ${!slot.available ? 'bg-slate-900 border-slate-800 text-slate-600 line-through cursor-not-allowed' :
                          bookingTime === slot.time ? 'bg-cyan-600 border-cyan-500 text-white' :
                          'bg-[#0b0f19] border-slate-800 text-slate-300 hover:border-cyan-500'}`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleBookAppointment} className="w-full bg-cyan-600 hover:bg-cyan-500 font-semibold text-sm py-3 rounded-xl transition-all">
                Confirm Reservation {bookingTime && `(${bookingTime})`}
              </button>
            </div>

            <div className="lg:col-span-7 bg-[#111827] p-6 rounded-2xl border border-slate-800">
              <h2 className="text-base font-semibold mb-4 text-slate-200">Active Tickets</h2>
              <div className="space-y-3">
                {patientAppointments.length === 0 && (
                  <div className="text-xs text-slate-500 py-4 text-center">No active appointment tickets.</div>
                )}
                {patientAppointments.map(item => (
                  <div key={item.id} className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-bold text-cyan-400">{item.department} Clinic</div>
                      <div className="text-xs text-slate-400 mt-1">Doctor: {item.doctor_name} | {item.appointment_date} ({item.appointment_time})</div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full font-mono font-semibold">Queue #{item.queue_number}</span>
                        <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                          item.status === 'WAITING' ? 'bg-amber-500/10 text-amber-400' :
                          item.status === 'IN_PROGRESS' ? 'bg-cyan-500/10 text-cyan-400' :
                          item.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>{item.status}</span>
                      </div>
                      {item.status === 'WAITING' && (
                        <button
                          onClick={() => handleCancelAppointment(item.id)}
                          className="text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20 transition-all flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Cancel Ticket
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg">
                  {currentUser.full_name?.charAt(0) || 'P'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100">{currentUser.full_name}</h2>
                  <p className="text-xs text-slate-400 font-mono">Patient Portal ID: PAT-{currentUser.id.toString().padStart(4, '0')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#0b0f19] p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">Registered Email</span>
                  <span className="text-slate-200 font-medium">{currentUser.email}</span>
                </div>
                <div className="bg-[#0b0f19] p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">Assigned Role</span>
                  <span className="text-cyan-400 font-semibold uppercase">{currentUser.role}</span>
                </div>
                <div className="bg-[#0b0f19] p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">Department / Care Focus</span>
                  <span className="text-slate-200">{currentUser.department || 'General Patient Care'}</span>
                </div>
                <div className="bg-[#0b0f19] p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">Account Status</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Active & Verified</span>
                </div>
              </div>

              {/* Academic registry disclosure note */}
              <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl text-xs text-slate-400 space-y-1">
                <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Academic & Clinical Record Notice
                </div>
                <p>
                  Institutional affiliations, university enrollment, stage, and section are synchronized with your verified campus health credentials in compliance with existing database architecture.
                </p>
              </div>
            </div>

            {/* Quick Summary of Records & Appointments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#111827] p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-200">Active Clinic Tickets</h3>
                  <button onClick={() => setActiveTab('booking')} className="text-[11px] text-cyan-400 hover:underline">Manage</button>
                </div>
                <div className="text-2xl font-bold text-cyan-400">{patientAppointments.length}</div>
                <p className="text-[11px] text-slate-500">Upcoming clinical consults and queue tickets.</p>
              </div>

              <div className="bg-[#111827] p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-200">EHR Diagnostic Records</h3>
                  <button onClick={() => setActiveTab('records')} className="text-[11px] text-cyan-400 hover:underline">View All</button>
                </div>
                <div className="text-2xl font-bold text-emerald-400">{medicalRecords.length}</div>
                <p className="text-[11px] text-slate-500">Saved AI diagnostics, evaluations, and print reports.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-cyan-400" /> Patient Queue Management
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Active Clinic: <span className="text-cyan-400 font-semibold">{currentUser.department || 'General Clinic'}</span>
                </p>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-xl text-xs text-cyan-400 font-mono">
                Dr. {currentUser.full_name}
              </div>
            </div>

            {doctorQueue.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-xs">
                No waiting patients for <span className="text-slate-300">{currentUser.department}</span> department today.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {doctorQueue.map(item => (
                  <div key={item.id} className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-mono font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-xl border border-cyan-500/20">
                        #{item.queue_number}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-slate-200">{item.patient_name}</div>
                        <div className="text-xs text-slate-400">Scheduled: {item.appointment_time}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2.5 py-1 rounded-lg uppercase font-mono font-bold mr-2 ${
                        item.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                        item.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-400 animate-pulse' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.status}
                      </span>

                      <button
                        onClick={() => handleViewPatientEhr(item.patient_id, item.patient_name)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-cyan-600/30 hover:border-cyan-500 text-cyan-400 flex items-center gap-1 transition-all"
                        title="Inspect Patient EHR"
                      >
                        <Eye className="w-3.5 h-3.5" /> EHR
                      </button>

                      <button
                        onClick={() => setDoctorClinicalModal({
                          patient_id: item.patient_id,
                          patient_name: item.patient_name,
                          record_type: 'Physician Clinical Evaluation',
                          risk_score: 15,
                          status_level: 'NORMAL',
                          notes: ''
                        })}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-emerald-600/30 hover:border-emerald-500 text-emerald-400 flex items-center gap-1 transition-all"
                        title="Add Clinical Evaluation Note"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Note
                      </button>

                      <button 
                        onClick={() => updateQueueStatus(item, 'IN_PROGRESS')} 
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-cyan-600 hover:border-cyan-500 text-slate-200 transition-all">
                        Call In
                      </button>
                      <button 
                        onClick={() => updateQueueStatus(item, 'COMPLETED')} 
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-emerald-600 hover:border-emerald-500 text-slate-200 transition-all">
                        Complete
                      </button>
                      <button
                        onClick={() => handleCancelAppointment(item.id)}
                        className="p-1.5 text-xs rounded-lg border border-rose-500/20 bg-slate-800 hover:bg-rose-500/20 text-rose-400 transition-all"
                        title="Cancel Appointment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'emergencies' && (
          <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-semibold text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Emergency Acute Triage Incident Feed
                </h2>
                <p className="text-xs text-slate-400 mt-1">Real-time acute clinical alerts and telemetry incidents</p>
              </div>
              <button
                onClick={() => setShowEmergencyModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Dispatch Alert
              </button>
            </div>

            {emergencyRecords.length === 0 ? (
              <div className="text-center text-slate-500 py-12 text-xs">
                No acute emergency incidents registered in current session.
              </div>
            ) : (
              <div className="space-y-3">
                {emergencyRecords.map(em => (
                  <div key={em.id} className="bg-[#0b0f19] p-4 rounded-xl border border-rose-500/20 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 text-sm">{em.patient_name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono font-bold">
                            EHR #{em.id}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{em.diagnosis || 'Acute Distress'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500">{em.created_at}</div>
                        {currentUser.role !== 'patient' && em.patient_id && (
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={() => handleViewPatientEhr(em.patient_id, em.patient_name)}
                              className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> View EHR
                            </button>
                            <button
                              onClick={() => setDoctorClinicalModal({
                                patient_id: em.patient_id,
                                patient_name: em.patient_name,
                                record_type: 'Emergency Triage Follow-up',
                                risk_score: 90,
                                status_level: 'CRITICAL',
                                notes: `Follow-up on Emergency EHR #${em.id}: ${em.triage_notes || em.diagnosis}`
                              })}
                              className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                            >
                              <PlusCircle className="w-3 h-3" /> Record Evaluation
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <div><span className="text-slate-500 block">Heart Rate</span><span className="font-mono text-rose-400 font-bold">{em.heart_rate} bpm</span></div>
                      <div><span className="text-slate-500 block">SpO2</span><span className="font-mono text-cyan-400 font-bold">{em.spo2}%</span></div>
                      <div><span className="text-slate-500 block">Blood Pressure</span><span className="font-mono text-slate-200">{em.blood_pressure}</span></div>
                      <div><span className="text-slate-500 block">Temp</span><span className="font-mono text-amber-400">{em.temperature}°C</span></div>
                    </div>

                    {em.triage_notes && (
                      <div className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[10px] mb-0.5">Triage Clinical Notes:</span>
                        {em.triage_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-6">
            <div className="flex gap-2 border-b border-slate-800 pb-3">
              <button
                onClick={() => setAdminSubTab('doctors')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  adminSubTab === 'doctors' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Doctors Directory & Onboarding
              </button>
              <button
                onClick={() => setAdminSubTab('users')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  adminSubTab === 'users' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                System Users Directory ({adminUsers.length})
              </button>
              <button
                onClick={() => setAdminSubTab('appointments')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  adminSubTab === 'appointments' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                All Clinic Appointments ({adminAppointments.length})
              </button>
            </div>

            {adminSubTab === 'doctors' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h2 className="text-base font-semibold text-cyan-400 flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Onboard Clinical Doctor</h2>
                  {adminMsg && <div className="p-3 bg-cyan-500/10 text-cyan-400 text-xs rounded-xl">{adminMsg}</div>}
                  <form onSubmit={handleCreateDoctor} className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Doctor Full Name</label>
                      <input type="text" placeholder="Dr. Jane Smith" required value={newDocForm.full_name} onChange={e => setNewDocForm({...newDocForm, full_name: e.target.value})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm text-slate-200" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Official Email</label>
                      <input type="email" placeholder="jane.smith@aurahealth.com" required value={newDocForm.email} onChange={e => setNewDocForm({...newDocForm, email: e.target.value})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm text-slate-200" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Temporary Password</label>
                      <input type="password" placeholder="••••••••" required value={newDocForm.password} onChange={e => setNewDocForm({...newDocForm, password: e.target.value})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm text-slate-200" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Clinical Department</label>
                      <select value={newDocForm.department} onChange={e => setNewDocForm({...newDocForm, department: e.target.value})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm text-slate-200">
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 font-semibold text-sm py-3 rounded-xl transition-all">Create Doctor Account</button>
                  </form>
                </div>

                <div className="lg:col-span-7 bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2"><Users className="w-5 h-5 text-cyan-400" /> Active Medical Staff ({doctorsList.length})</h2>
                  <div className="space-y-3">
                    {doctorsList.map(doc => (
                      <div key={doc.id} className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                        <div>
                          <div className="text-sm font-bold text-slate-200">{doc.name}</div>
                          <div className="text-xs text-cyan-400 mt-0.5">{doc.department}</div>
                        </div>
                        <span className="text-[10px] px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 font-mono">
                          ID: DOC-{doc.id.toString().padStart(3, '0')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {adminSubTab === 'users' && (
              <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4">
                <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2"><User className="w-5 h-5 text-cyan-400" /> All Registered Accounts</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                        <th className="py-3 px-3">ID</th>
                        <th className="py-3 px-3">Name</th>
                        <th className="py-3 px-3">Email</th>
                        <th className="py-3 px-3">Role</th>
                        <th className="py-3 px-3">Department</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {adminUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-3 font-mono text-cyan-400">#{u.id}</td>
                          <td className="py-3 px-3 font-semibold text-slate-100">{u.full_name}</td>
                          <td className="py-3 px-3 text-slate-400 font-mono">{u.email}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                              u.role === 'admin' ? 'bg-purple-500/10 text-purple-400' :
                              u.role === 'doctor' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400">{u.department || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {adminSubTab === 'appointments' && (
              <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4">
                <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2"><Calendar className="w-5 h-5 text-cyan-400" /> Hospital Appointments Registry</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                        <th className="py-3 px-3">ID</th>
                        <th className="py-3 px-3">Patient</th>
                        <th className="py-3 px-3">Doctor</th>
                        <th className="py-3 px-3">Dept</th>
                        <th className="py-3 px-3">Date / Time</th>
                        <th className="py-3 px-3">Queue</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {adminAppointments.map(a => (
                        <tr key={a.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-3 font-mono text-cyan-400">#{a.id}</td>
                          <td className="py-3 px-3 font-semibold text-slate-100">{a.patient_name}</td>
                          <td className="py-3 px-3 text-slate-300">{a.doctor_name}</td>
                          <td className="py-3 px-3 text-slate-400">{a.department}</td>
                          <td className="py-3 px-3 font-mono text-slate-400">{a.appointment_date} {a.appointment_time}</td>
                          <td className="py-3 px-3 font-mono text-cyan-400">#{a.queue_number}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                              a.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                              a.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-400' :
                              a.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {a.status === 'WAITING' && (
                              <button
                                onClick={() => handleCancelAppointment(a.id)}
                                className="text-[10px] text-rose-400 hover:underline"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 1. Emergency SOS Dispatch Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-rose-500/30 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Emergency Acute Triage SOS
              </h3>
              <button onClick={() => setShowEmergencyModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Dispatch an acute emergency alert to the critical care and telemetry staff immediately.
            </p>
            <form onSubmit={handleSubmitEmergency} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={emergencyForm.heart_rate}
                    onChange={e => setEmergencyForm({...emergencyForm, heart_rate: e.target.value})}
                    className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    value={emergencyForm.spo2}
                    onChange={e => setEmergencyForm({...emergencyForm, spo2: e.target.value})}
                    className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Blood Pressure</label>
                  <input
                    type="text"
                    value={emergencyForm.blood_pressure}
                    onChange={e => setEmergencyForm({...emergencyForm, blood_pressure: e.target.value})}
                    className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={emergencyForm.temperature}
                    onChange={e => setEmergencyForm({...emergencyForm, temperature: e.target.value})}
                    className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Suspected Diagnosis / Acute Symptoms</label>
                <input
                  type="text"
                  value={emergencyForm.diagnosis}
                  onChange={e => setEmergencyForm({...emergencyForm, diagnosis: e.target.value})}
                  className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-200"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Clinical Triage Notes</label>
                <textarea
                  rows="2"
                  value={emergencyForm.triage_notes}
                  onChange={e => setEmergencyForm({...emergencyForm, triage_notes: e.target.value})}
                  placeholder="Patient presenting acute chest pain, shortness of breath, diaphoresis..."
                  className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-200"
                ></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmergencyModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emergencySubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-all flex items-center gap-1.5 shadow-lg"
                >
                  <AlertTriangle className="w-4 h-4" /> {emergencySubmitting ? 'Dispatching...' : 'Dispatch Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Patient Comprehensive EHR Modal */}
      {selectedPatientEhr && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" /> Patient Medical Record (EHR)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Patient: <span className="text-cyan-400 font-semibold">{selectedPatientEhr.patientName}</span> (ID #{selectedPatientEhr.patientId})
                </p>
              </div>
              <div className="flex items-center gap-2">
                {currentUser.role === 'doctor' && (
                  <button
                    onClick={() => {
                      setDoctorClinicalModal({
                        patient_id: selectedPatientEhr.patientId,
                        patient_name: selectedPatientEhr.patientName,
                        record_type: 'Physician Clinical Evaluation',
                        risk_score: 15,
                        status_level: 'NORMAL',
                        notes: ''
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Note
                  </button>
                )}
                <button onClick={() => setSelectedPatientEhr(null)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {selectedPatientEhr.records.length === 0 ? (
                <div className="text-center text-slate-500 py-10 text-xs">No medical records saved for this patient yet.</div>
              ) : (
                selectedPatientEhr.records.map(rec => (
                  <div key={rec.id} className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-cyan-400">{rec.record_type}</span>
                        <div className="text-[10px] text-slate-500">{rec.created_at}</div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        rec.status_level === 'CRITICAL' || rec.status_level === 'HIGH' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {rec.status_level} ({rec.risk_score}%)
                      </span>
                    </div>
                    <div className="space-y-1">
                      {rec.details.map((d, idx) => (
                        <div key={idx} className="text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">{d}</div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Doctor Clinical Note Entry Modal */}
      {doctorClinicalModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-emerald-400" /> Record Clinical Evaluation
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Patient: <span className="text-emerald-400 font-semibold">{doctorClinicalModal.patient_name}</span>
                </p>
              </div>
              <button onClick={() => setDoctorClinicalModal(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleDoctorSaveRecord} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Evaluation / Record Type</label>
                <input
                  type="text"
                  value={doctorClinicalModal.record_type}
                  onChange={e => setDoctorClinicalModal({...doctorClinicalModal, record_type: e.target.value})}
                  className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-200"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Status Severity</label>
                  <select
                    value={doctorClinicalModal.status_level}
                    onChange={e => setDoctorClinicalModal({...doctorClinicalModal, status_level: e.target.value})}
                    className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-200"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="MODERATE">MODERATE</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Assessed Risk Score (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={doctorClinicalModal.risk_score}
                    onChange={e => setDoctorClinicalModal({...doctorClinicalModal, risk_score: e.target.value})}
                    className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Physician Clinical Notes & Recommendations</label>
                <textarea
                  rows="3"
                  value={doctorClinicalModal.notes}
                  onChange={e => setDoctorClinicalModal({...doctorClinicalModal, notes: e.target.value})}
                  placeholder="Record symptoms, diagnostic notes, treatment plan, and prescription..."
                  className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-200"
                  required
                ></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDoctorClinicalModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-lg"
                >
                  Save to EHR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}