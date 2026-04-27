import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.database import connect_db
from app.routers import patients, visites, irm, auth, admin, analyses, agenda, predictions, chat, dashboard, patient_portal, notifications, settings, public, news, rendez_vous, medecins, pdf_generator, contrats


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield

app = FastAPI(title="SEP Platform API", version="1.0.0", lifespan=lifespan)

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:63742,http://127.0.0.1:63742"
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
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
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(settings.router, prefix="/api/settings", tags=["Paramètres"])
app.include_router(public.router, prefix="/api/public", tags=["Public"])
app.include_router(news.router, prefix="/api", tags=["Actualités"])
app.include_router(rendez_vous.router, prefix="/api", tags=["Rendez-vous"])
app.include_router(medecins.router, prefix="/api", tags=["Médecins"])
app.include_router(pdf_generator.router, prefix="/api", tags=["PDF"])
app.include_router(contrats.router, prefix="/api", tags=["Contrats"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "database": "mongodb"}