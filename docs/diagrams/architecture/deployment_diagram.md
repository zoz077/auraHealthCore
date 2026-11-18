# Deployment Diagram

Illustrates the physical execution environment, host processes, ports, protocols, and file stores in the local clinical deployment.

```mermaid
graph TB
    subgraph ClientNode["Client Tier: Workstation Web Browser"]
        Browser["Chrome / Edge / Firefox Browser"]
        SPA["React 18 Single Page Application (HTML5 / ES6 / Canvas)"]
        Cookies["Client Storage (HttpOnly aura_session, LocalStorage)"]
        Browser --- SPA
        Browser --- Cookies
    end

    subgraph AppServerNode["Application Tier: Host Machine (Windows 11)"]
        subgraph FrontendServer["Frontend Server Process"]
            Vite["Vite Development / Production Server (Port 5173)"]
        end
        
        subgraph BackendServer["Backend Server Process"]
            Uvicorn["Uvicorn ASGI Server (127.0.0.1:8000)"]
            FastAPIApp["FastAPI Core Application"]
            Uvicorn --- FastAPIApp
            
            subgraph Runtimes["AI Inference Runtimes"]
                TorchRT["PyTorch 2.6 Runtime (TorchScript / eager CPU/CUDA)"]
                KerasRT["Keras 3 Runtime (PyTorch Backend)"]
                YoloRT["Ultralytics YOLO Engine"]
                XgbRT["XGBoost / Scikit-Learn C++ Engine"]
            end
            
            FastAPIApp --- Runtimes
        end
    end

    subgraph DataStorageNode["Data Storage Tier: Local File System"]
        DBFile[("SQLite Database File: backend/app/aura_health.db")]
        ModelFiles[("Model Binaries: backend/app/models/*.pt, *.pth, *.keras, *.pkl, *.json")]
        TempUploads[("Temporary Uploads: backend/temp_uploads/")]
    end

    SPA -->|HTTP / REST (Port 8000)| Uvicorn
    SPA <-->|WebSocket ws://127.0.0.1:8000/ws/{id}| Uvicorn
    Browser -->|HTTP (Port 5173)| Vite
    FastAPIApp -->|Direct File I/O (SQLAlchemy)| DBFile
    Runtimes -->|File Read / Memory Map| ModelFiles
    FastAPIApp -->|Temporary Disk Buffering| TempUploads
```
