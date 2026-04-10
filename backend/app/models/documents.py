from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime

class Patient(Document):
    nom: str
    prenom: str
    date_naissance: date
    sexe: Optional[str] = None
    contact: Optional[dict] = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    medecin_id: Optional[str] = None

    class Settings:
        name = "patients"

class VisiteClinique(Document):
    patient_id: str
    date_visite: date
    edss_score: Optional[float] = None
    tests_fonctionnels: Optional[dict] = {}
    notes: Optional[str] = None
    medecin_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "visites_cliniques"

class IRMScan(Document):
    patient_id: str
    visite_id: Optional[str] = None
    dicom_uid: str
    fichier_path: str
    sequence_type: Optional[str] = None
    metadata_dicom: dict = {}
    statut: str = "pending"
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    rapport: Optional[dict] = None  # ← ajoute cette ligne
    class Settings:
        name = "irm_scans"


class Utilisateur(Document):
    nom: str
    prenom: str
    email: str
    mot_de_passe: str
    role: str = "medecin"  # medecin | radiologue | laboratoire | admin | patient
    statut: str = "en_attente"  # en_attente | actif | refuse
    patient_id: Optional[str] = None  # Lien vers le dossier Patient (pour role=patient)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "utilisateurs"     

class AnalyseBiologique(Document):
    patient_id: str
    laboratoire_id: str
    date_analyse: datetime = Field(default_factory=datetime.utcnow)
    type_analyse: str  # "bilan_sanguin", "ponction_lombaire", "bilan_inflammatoire"
    resultats: dict = {}
    statut: str = "en_attente"  # "en_attente", "termine"
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "analyses" 

class Rappel(Document):
    medecin_id: str
    titre: str
    description: Optional[str] = ""
    date_rappel: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "rappels"                  