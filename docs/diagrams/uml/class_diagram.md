# Class Diagram

Based directly on the actual SQLAlchemy model definitions in `backend/app/models/db_models.py`, capturing exact primary keys, foreign keys, data types, attributes, and relationships.

```mermaid
classDiagram
    class UserDB {
        +Integer id [PK]
        +String full_name
        +String email [Unique, Index]
        +String hashed_password
        +String role
        +String department
        +String google_id [Index]
        +Boolean is_email_verified
        +String phone_number
        +String date_of_birth
        +String gender
        +String blood_group
        +String emergency_contact
        +Boolean profile_completed
        +DateTime created_at
    }

    class AppointmentDB {
        +Integer id [PK]
        +Integer patient_id [FK -> users.id]
        +String patient_name
        +Integer doctor_id [FK -> users.id]
        +String doctor_name
        +String department
        +String appointment_date
        +String appointment_time
        +String status
        +Integer queue_number
        +DateTime created_at
    }

    class MedicalRecordDB {
        +Integer id [PK]
        +Integer patient_id [FK -> users.id]
        +Integer doctor_id [FK -> users.id]
        +String record_type
        +Integer risk_score
        +String status_level
        +String department
        +String modality
        +String source_category
        +String model_name
        +Float confidence
        +String image_ref
        +Text details
        +DateTime created_at
    }

    class EmergencyEHR {
        +Integer id [PK]
        +Integer patient_id [FK -> users.id]
        +String patient_name
        +Integer heart_rate
        +Integer spo2
        +String blood_pressure
        +Float temperature
        +Text triage_notes
        +String diagnosis
        +String priority
        +DateTime created_at
    }

    class NotificationDB {
        +Integer id [PK]
        +Integer target_user_id [FK -> users.id]
        +String title
        +Text message
        +String priority
        +Boolean is_read
        +DateTime created_at
    }

    class AuditLogDB {
        +Integer id [PK]
        +Integer user_id [FK -> users.id]
        +Integer patient_id [FK -> users.id]
        +String action
        +String department
        +String modality
        +String model_name
        +String result_summary
        +DateTime created_at
    }

    %% Relationships
    UserDB "1" --> "0..*" AppointmentDB : "patient_appointments (patient_id)"
    UserDB "1" --> "0..*" AppointmentDB : "doctor_appointments (doctor_id)"
    UserDB "1" --> "0..*" MedicalRecordDB : "patient_records (patient_id)"
    UserDB "1" --> "0..*" MedicalRecordDB : "physician_records (doctor_id)"
    UserDB "1" --> "0..*" EmergencyEHR : "emergency_records (patient_id)"
    UserDB "1" --> "0..*" NotificationDB : "user_notifications (target_user_id)"
    UserDB "1" --> "0..*" AuditLogDB : "initiated_actions (user_id)"
    UserDB "1" --> "0..*" AuditLogDB : "targeted_actions (patient_id)"
```
