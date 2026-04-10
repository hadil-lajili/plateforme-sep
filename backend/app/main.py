from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.database import connect_db
from app.routers import patients, visites, irm, auth, admin
from app.routers import patients, visites, irm, auth, admin, analyses
from app.routers import patients, visites, irm, auth, admin, analyses, agenda
from app.routers import patients, visites, irm, auth, admin, analyses, agenda, predictions, chat, dashboard, patient_portal


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield

app = FastAPI(title="SEP Platform API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentification"])
app.include_router(admin.router, prefix="/api/admin", tags=["Administration"])
app.include_router(patients.router, prefix="/api/patients", tags=["Patients"])
app.include_router(visites.router, prefix="/api/patients", tags=["Visites"])
app.include_router(irm.router, prefix="/api/patients", tags=["IRM"])
app.include_router(analyses.router, prefix="/api/analyses", tags=["Analyses"])
app.include_router(agenda.router, prefix="/api/agenda", tags=["Agenda"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Prédictions IA"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat IA"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(patient_portal.router, prefix="/api/patient-portal", tags=["Portail Patient"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "database": "mongodb"}