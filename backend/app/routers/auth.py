from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from app.models.documents import Utilisateur
from app.core.auth import hasher_mot_de_passe, verifier_mot_de_passe, creer_token, get_current_user

router = APIRouter()

class InscriptionSchema(BaseModel):
    nom: str = Field(..., min_length=2)
    prenom: str = Field(..., min_length=2)
    email: EmailStr
    mot_de_passe: str = Field(..., min_length=6)
    role: str = Field(..., pattern="^(medecin|radiologue|laboratoire|patient)$")

class LoginSchema(BaseModel):
    email: EmailStr
    mot_de_passe: str

# ─── POST /api/auth/inscription ──────────────────────────────────────
@router.post("/inscription", status_code=201)
async def inscription(data: InscriptionSchema):
    existant = await Utilisateur.find_one(Utilisateur.email == data.email)
    if existant:
        raise HTTPException(status_code=409, detail="Email deja utilise")

    # Pour les patients : chercher un dossier Patient existant par email
    patient_id = None
    statut = "en_attente"
    if data.role == "patient":
        from app.models.documents import Patient
        patient_record = await Patient.find_one({"contact.email": data.email})
        if patient_record:
            patient_id = str(patient_record.id)
        statut = "actif"  # Les patients sont activés directement

    user = Utilisateur(
        nom=data.nom,
        prenom=data.prenom,
        email=data.email,
        mot_de_passe=hasher_mot_de_passe(data.mot_de_passe),
        role=data.role,
        statut=statut,
        patient_id=patient_id,
    )
    await user.insert()

    if data.role == "patient":
        return {
            "message": "Inscription réussie. Votre compte est actif.",
            "statut": "actif",
            "patient_id": patient_id,
        }

    return {
        "message": "Inscription reussie. Votre compte est en attente de validation.",
        "statut": "en_attente"
    }

# ─── POST /api/auth/login ─────────────────────────────────────────────
@router.post("/login")
async def login(data: LoginSchema):
    user = await Utilisateur.find_one(Utilisateur.email == data.email)
    if not user:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    if not verifier_mot_de_passe(data.mot_de_passe, user.mot_de_passe):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    if user.statut == "en_attente":
        raise HTTPException(status_code=403, detail="Compte en attente de validation")

    if user.statut == "refuse":
        raise HTTPException(status_code=403, detail="Compte refuse")

    token = creer_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "nom": user.nom,
            "prenom": user.prenom,
            "email": user.email,
            "role": user.role,
            "patient_id": user.patient_id,
        }
    }

# ─── GET /api/auth/me ─────────────────────────────────────────────────
@router.get("/me")
async def get_me(user: Utilisateur = Depends(get_current_user)):
    return {
        "id": str(user.id),
        "nom": user.nom,
        "prenom": user.prenom,
        "email": user.email,
        "role": user.role,
        "statut": user.statut,
        "patient_id": user.patient_id,
    }