# Sequence Diagram — Appointment Booking & Lifecycle Verification

Illustrates the end-to-end appointment booking workflow with strict frontend and backend past-date/time validation, slot collision detection, and personal notification dispatch.

```mermaid
sequenceDiagram
    autonumber
    actor Patient as Patient
    participant UI as React Frontend (App.jsx)
    participant API as FastAPI (/api/appointments)
    participant Lifecycle as Lifecycle Engine
    participant DB as SQLite Database
    participant WS as WebSocket Manager

    Patient->>UI: Selects Doctor, Department, Date, Time Slot
    Note over UI: Frontend checks min date >= today<br/>Filters slots if today & slot time has passed
    UI->>API: POST /api/appointments/book {doctor_id, doctor_name, department, date, time}
    
    API->>Lifecycle: parse_appointment_datetime(date, time)
    alt Date or Time in the Past
        Lifecycle-->>API: Slot is in the past!
        API-->>UI: HTTP 400 Bad Request ("Cannot book an appointment in the past")
        UI-->>Patient: Display validation alert
    else Future Slot Validated
        API->>DB: Query AppointmentDB WHERE doctor_id & date & time & status != 'Cancelled'
        alt Slot Already Booked
            DB-->>API: Existing Appointment Found
            API-->>UI: HTTP 409 Conflict ("Slot already booked")
            UI-->>Patient: Display conflict alert
        else Slot Available
            API->>DB: Query max(queue_number) for doctor on date
            DB-->>API: Current Max Queue (e.g. #3)
            API->>DB: Insert AppointmentDB (queue_number=#4, status="Upcoming")
            API->>DB: Insert NotificationDB (target_user_id=Patient.id)
            DB-->>API: Commit Success
            API->>WS: send_personal(Patient.id, NotificationPayload)
            WS-->>UI: Live Toast ("Appointment booked! Queue Ticket #4")
            API-->>UI: Return HTTP 200 {appointment_id, queue_number, status: "Upcoming"}
            UI-->>Patient: Render Ticket Badge & Confirmation
        end
    end
```
