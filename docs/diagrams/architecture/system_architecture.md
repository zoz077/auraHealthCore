# System Architecture Diagram

This diagram represents the actual implemented software architecture of **AuraHealth Core**, illustrating the client interface, API routing layer, security middleware, AI service layer, ORM persistence layer, and the underlying database.

```mermaid
graph TB
    subgraph ClientLayer["Frontend Client Layer (React 18 + Vite + TailwindCSS)"]
        UI_Auth["Authentication & Google OAuth Modal"]
        UI_Profile["Profile & Demographics Management"]
        UI_Booking["Appointment Booking & Lifecycle View"]
        UI_Records["Organized Medical Records (EHR)"]
        UI_Queue["Doctor Patient Queue Management"]
        UI_Emergency["Emergency Acute Triage Telemetry"]
        UI_Admin["Admin Staff Onboarding & System Ledger"]
        
        subgraph Workstations["Clinical AI Workstations"]
            WS_Selector["WorkstationPatientSelector"]
            WS_Cardio["Cardiology Dashboard (EcgDashboard)"]
            WS_ICU["ICU Critical Care Dashboard (IcuDashboard)"]
            WS_Neuro["Neurology & Brain Dashboard (NeurologyDashboard)"]
            WS_Ortho["Orthopedics Dashboard (OrthopedicsDashboard)"]
            WS_Resp["Pulmonology Dashboard (RespiratoryDashboard)"]
        end
    end

    subgraph APILayer["Backend Application Layer (FastAPI + Uvicorn)"]
        direction TB
        Auth_MW["Security Middleware (JWT, HttpOnly Cookies, RBAC)"]
        WS_Manager["WebSocket ConnectionManager (/ws/{user_id})"]
        
        subgraph Routers["FastAPI API Routers"]
            R_Auth["/api/auth (Login, Register, Google, Profile)"]
            R_Appt["/api/appointments (Booking, Queue, Status)"]
            R_EHR["/api/medical-records (Save, Query, EHR)"]
            R_Doctor["/api/doctor/patients"]
            R_Admin["/api/admin (Doctors, Users, Appointments)"]
            R_Emerg["/api/v1/emergency (Triage SOS)"]
            R_Audit["/api/audit-logs (Audit Trail)"]
            R_Ortho["/api/orthopedics (X-Ray, MRI Classify/Segment)"]
            R_Neuro["/api/neurology (MRI, EEG, Vision, Parkinson, Spine)"]
            R_Resp["/api/respiratory (X-Ray, US, CT, Audio, Vitals)"]
            R_Cardio["/api/ecg (1D Signal, 2D Vision)"]
            R_ICU["/api/icu/analyze"]
        end
    end

    subgraph ServiceLayer["AI Inference & Diagnostic Services"]
        S_Ortho["orthopedics_service.py"]
        S_Neuro["neurology_service.py"]
        S_Resp["respiratory_service.py"]
        S_Cardio["ecg_service.py"]
        S_ICU["icu_service.py"]
        S_Xray["xray_service.py"]
        S_MRI["mri_service.py"]
        S_US["ultrasound_service.py"]
    end

    subgraph ModelLayer["AI Models Runtime Layer"]
        M_YOLO["Ultralytics YOLOv8 (best.pt, yolov8_*.pt)"]
        M_Torch["PyTorch (ResNet, DenseNet, ConvNeXt, EffNet, SMP U-Net)"]
        M_Keras["Keras 3 with PyTorch Backend (MobileNetV2, U-Net)"]
        M_XGB["XGBoost / Scikit-Learn (ICU & Vital Signs)"]
    end

    subgraph PersistenceLayer["Data Persistence Layer"]
        ORM["SQLAlchemy ORM (SessionLocal, declarative_base)"]
        DB[(SQLite Database: aura_health.db)]
        
        subgraph Tables["Database Tables"]
            T_Users["users"]
            T_Appts["appointments"]
            T_Records["medical_records"]
            T_Emerg["emergency_ehrs"]
            T_Notifs["notifications"]
            T_Audit["audit_logs"]
        end
    end

    %% Connections
    ClientLayer -->|HTTP / REST Axios| APILayer
    ClientLayer <-->|Real-Time WebSocket| WS_Manager
    APILayer --> Auth_MW
    Auth_MW --> Routers
    
    R_Ortho --> S_Ortho
    R_Neuro --> S_Neuro
    R_Resp --> S_Resp
    R_Cardio --> S_Cardio
    R_ICU --> S_ICU
    
    S_Ortho --> M_YOLO
    S_Ortho --> M_Keras
    S_Neuro --> M_Torch
    S_Resp --> M_Torch
    S_Resp --> M_XGB
    S_Cardio --> M_Torch
    S_ICU --> M_XGB
    S_Xray --> M_YOLO
    S_MRI --> M_YOLO
    S_US --> M_YOLO
    
    Routers --> ORM
    WS_Manager -.->|Dispatches To| ClientLayer
    ORM --> DB
    DB --- Tables
```
