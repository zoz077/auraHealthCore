import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Calendar, ShieldCheck, LogOut, FileText, Stethoscope, Bell, Printer } from 'lucide-react';
import IcuDashboard from './components/IcuDashboard';
import ImagingDashboard from './components/ImagingDashboard';
import EcgDashboard from './components/EcgDashboard';
import RespiratoryDashboard from './components/RespiratoryDashboard';
import NotificationToast from './components/NotificationToast';
import NeurologyDashboard from './components/NeurologyDashboard';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
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
  const [showNotifs, setShowNotifs] = useState(false);
  const [selectedPrintRecord, setSelectedPrintRecord] = useState(null);

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
  };

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
      axios.get(`${API_BASE_URL}/api/appointments/patient/${currentUser.id}`).then(res => setPatientAppointments(res.data));
      axios.get(`${API_BASE_URL}/api/medical-records/patient/${currentUser.id}`).then(res => setMedicalRecords(res.data));
    } else if (currentUser.role === 'doctor') {
      axios.get(`${API_BASE_URL}/api/appointments/doctor/${currentUser.id}`).then(res => setDoctorQueue(res.data));
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

  const userNotifications = notifications.filter(n => n.targetUserId === currentUser?.id);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4">
        <NotificationToast />
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
      <NotificationToast />
      <nav className="bg-[#111827] border-b border-slate-800 px-6 py-4 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-cyan-400" />
          <span className="font-bold text-lg">AuraHealth <span className="text-cyan-400">Core</span></span>
        </div>

        <div className="flex items-center gap-2 bg-[#0b0f19] p-1 rounded-xl border border-slate-800 text-xs">
          {currentUser.role === 'patient' && (
            <>
              <button onClick={() => setActiveTab('booking')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'booking' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Book Appointment</button>
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
            <button onClick={() => setActiveTab('admin')} className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'admin' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Admin Management</button>
          )}
        </div>

        <div className="flex items-center gap-4">
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
                  <span className="text-[10px] text-cyan-400 cursor-pointer" onClick={() => setNotifications(notifications.map(n => n.targetUserId === currentUser.id ? {...n, read: true} : n))}>Mark read</span>
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
          <button onClick={() => setCurrentUser(null)} className="p-2 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl text-slate-400 transition-all">
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
                {patientAppointments.map(item => (
                  <div key={item.id} className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-bold text-cyan-400">{item.department} Clinic</div>
                      <div className="text-xs text-slate-400 mt-1">Doctor: {item.doctor_name} | {item.appointment_date}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full font-mono font-semibold">Queue #{item.queue_number}</span>
                      <div className="text-[10px] text-slate-400 uppercase mt-1">{item.status}</div>
                    </div>
                  </div>
                ))}
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
                        onClick={() => updateQueueStatus(item, 'IN_PROGRESS')} 
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-cyan-600 hover:border-cyan-500 text-slate-200 transition-all">
                        Call In
                      </button>
                      <button 
                        onClick={() => updateQueueStatus(item, 'COMPLETED')} 
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-emerald-600 hover:border-emerald-500 text-slate-200 transition-all">
                        Complete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-xl mx-auto bg-[#111827] p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-base font-semibold text-cyan-400 flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Admin Staff Portal</h2>
            {adminMsg && <div className="p-3 bg-cyan-500/10 text-cyan-400 text-xs rounded-xl">{adminMsg}</div>}
            <form onSubmit={handleCreateDoctor} className="space-y-3">
              <input type="text" placeholder="Doctor Full Name" required value={newDocForm.full_name} onChange={e => setNewDocForm({...newDocForm, full_name: e.target.value})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm" />
              <input type="email" placeholder="Doctor Email" required value={newDocForm.email} onChange={e => setNewDocForm({...newDocForm, email: e.target.value})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm" />
              <input type="password" placeholder="Password" required value={newDocForm.password} onChange={e => setNewDocForm({...newDocForm, password: e.target.value})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm" />
              <select value={newDocForm.department} onChange={e => setNewDocForm({...newDocForm, department: e.target.value})} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm">
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <button type="submit" className="w-full bg-cyan-600 font-semibold text-sm py-3 rounded-xl">Create Doctor Account</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}