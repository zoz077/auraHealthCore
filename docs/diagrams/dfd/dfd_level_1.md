# Data Flow Diagram (DFD) — Level 1 (Major Processes)

Decomposes the AuraHealth Core System into its six core sub-processes and maps data stores and data exchanges.

```mermaid
graph TB
    Patient["Patient"]
    Doctor["Doctor"]
    Admin["Admin"]
    Google["Google Identity"]

    P1["1.0<br/>Authentication & Profile Management"]
    P2["2.0<br/>Appointment Scheduling & Queue Lifecycle"]
    P3["3.0<br/>Clinical AI Diagnostic Workstations"]
    P4["4.0<br/>Electronic Health Records (EHR) Ledger"]
    P5["5.0<br/>Emergency Acute Triage & Telemetry"]
    P6["6.0<br/>Compliance Audit Trail & Admin Ops"]

    D1[("D1: Users Store")]
    D2[("D2: Appointments Store")]
    D3[("D3: Medical Records Store")]
    D4[("D4: Emergency EHR Store")]
    D5[("D5: Notifications Store")]
    D6[("D6: Audit Logs Store")]
    D7[("D7: Model Binaries Store")]

    %% Process 1.0 Flows
    Patient -->|Login / Google Auth / Profile Update| P1
    Doctor -->|Login Request| P1
    Admin -->|Login Request| P1
    Google <-->|OAuth Verification Token| P1
    P1 <-->|Read / Write User Credentials & Demographics| D1
    P1 -->|Session Cookie & User Profile| Patient

    %% Process 2.0 Flows
    Patient -->|Booking Request (Date, Slot, Doctor)| P2
    Doctor -->|Queue Transitions: Call In, Complete, Missed| P2
    Admin -->|Cancel Ticket| P2
    P2 <-->|Check Slots, Write Tickets, Sync Expiry| D2
    P2 -->|Dispatch Status Alerts| D5
    P2 -->|Ticket Confirmation & Queue Status| Patient
    P2 -->|Current Department Queue| Doctor

    %% Process 3.0 Flows
    Doctor -->|Select Patient ID, Upload Modality File| P3
    P3 <-->|Lookup Active Patient Context| D1
    P3 <-->|Load Weights & Execute Inference| D7
    P3 -->|Diagnostic Predictions & Overlays| Doctor
    P3 -->|Approved Analysis Data| P4
    P3 -->|Record Event Metadata| P6

    %% Process 4.0 Flows
    Doctor -->|Physician Notes & Diagnoses| P4
    P4 <-->|Query / Insert Categorized EHR Records| D3
    P4 -->|Dispatch Notification Event| D5
    P4 -->|Categorized Records View| Patient
    P4 -->|Patient Medical History (Auth-Checked)| Doctor

    %% Process 5.0 Flows
    Patient -->|Telemetry Data (HR, SpO2, BP, Temp)| P5
    Doctor -->|Follow-up Triage Notes| P5
    P5 <-->|Insert / Read Acute Incidents| D4
    P5 -->|Broadcast Urgent Alert| D5
    P5 -->|Live Telemetry Feed| Doctor

    %% Process 6.0 Flows
    Admin -->|Doctor Onboarding, Audit Queries| P6
    Doctor -->|Audit Trail Inspection| P6
    P6 <-->|Read / Write Audit Log Events| D6
    P6 <-->|Manage Doctor Accounts| D1
    P6 -->|Audit Tables & Hospital Ledgers| Admin
```
