import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/**
 * Sends a saved diagnostic AI finding from a specialized department
 * to the General Medicine consultation hub for multi-modal cross-department synthesis.
 */
export async function sendFindingToGeneralMedicine({
  patientId,
  recordId,
  activeGmSessionUuid,
  setActiveGmSessionUuid,
  onNavigateToTab
}) {
  if (!recordId) {
    throw new Error("Cannot send to General Medicine: Record ID is missing. Please save to EHR first.");
  }
  if (!patientId) {
    throw new Error("Cannot send to General Medicine: Patient ID is required.");
  }

  try {
    let sessionUuid = activeGmSessionUuid;

    // 1. If activeGmSessionUuid is not set, resolve or create active session for this patient
    if (!sessionUuid) {
      const activeRes = await axios.get(`${API_BASE_URL}/api/general-medicine/active-session/${patientId}`, {
        withCredentials: true
      });
      if (activeRes.data && activeRes.data.session_uuid) {
        sessionUuid = activeRes.data.session_uuid;
      }
    }

    // 2. If still no session, initialize a new consultation session
    if (!sessionUuid) {
      const createRes = await axios.post(`${API_BASE_URL}/api/general-medicine/session`, {
        patient_id: patientId,
        language: 'en'
      }, { withCredentials: true });
      sessionUuid = createRes.data.session_uuid;
    }

    if (setActiveGmSessionUuid && sessionUuid) {
      setActiveGmSessionUuid(sessionUuid);
    }

    // 3. Ingest finding into General Medicine session
    const ingestRes = await axios.post(`${API_BASE_URL}/api/general-medicine/ingest-finding`, {
      session_uuid: sessionUuid,
      record_id: recordId
    }, { withCredentials: true });

    // 4. Navigate to General Medicine tab
    if (onNavigateToTab) {
      onNavigateToTab('general_medicine');
    }

    return {
      success: true,
      session_uuid: sessionUuid,
      data: ingestRes.data
    };
  } catch (err) {
    const errorMsg = err.response?.data?.detail || err.message || 'Failed to send finding to General Medicine.';
    throw new Error(errorMsg);
  }
}
