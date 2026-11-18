# Database Relationship Overview

A simplified, high-level structural overview of the relational connections centered around the `users` table in `aura_health.db`.

```mermaid
graph TD
    User["<b>users</b><br/>Primary entity for Patients, Doctors, Admins<br/>Tracks credentials, demographics, roles, Google ID"]
    
    Appt["<b>appointments</b><br/>patient_id ➔ users.id<br/>doctor_id ➔ users.id<br/>Tracks queue #, date, time slot, canonical status"]
    
    Record["<b>medical_records</b><br/>patient_id ➔ users.id<br/>doctor_id ➔ users.id<br/>Stores categorized records, modalities, AI confidence, model name"]
    
    Emerg["<b>emergency_ehrs</b><br/>patient_id ➔ users.id<br/>Stores acute distress telemetry, vitals, triage notes"]
    
    Notif["<b>notifications</b><br/>target_user_id ➔ users.id<br/>Stores strictly scoped user notifications & read status"]
    
    Audit["<b>audit_logs</b><br/>user_id (initiator) ➔ users.id<br/>patient_id (target) ➔ users.id<br/>Immutable regulatory ledger of all AI diagnostic evaluations"]

    User -->|1 : N (Patient & Doctor)| Appt
    User -->|1 : N (Patient Subject & Doctor Creator)| Record
    User -->|1 : N (Patient Incident)| Emerg
    User -->|1 : N (Target Recipient)| Notif
    User -->|1 : N (Initiating Staff)| Audit
    User -->|1 : N (Target Patient)| Audit
```
