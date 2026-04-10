from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime
from app.models.documents import AnalyseBiologique, Patient, Utilisateur
from app.core.auth import get_current_user

router = APIRouter()

def serialize(a: AnalyseBiologique) -> dict:
    return {
        "id": str(a.id),
        "patient_id": a.patient_id,
        "laboratoire_id": a.laboratoire_id,
        "date_analyse": a.date_analyse,
        "type_analyse": a.type_analyse,
        "resultats": a.resultats,
        "statut": a.statut,
        "notes": a.notes,
        "created_at": a.created_at,
    }

# ─── POST créer une analyse ───────────────────────────────────────────
@router.post("/", status_code=201)
async def creer_analyse(data: dict, current_user=Depends(get_current_user)):
    patient = await Patient.get(data["patient_id"])
    if not patient:
        raise HTTPException(404, "Patient non trouvé")

    analyse = AnalyseBiologique(
        patient_id=data["patient_id"],
        laboratoire_id=str(current_user.id),
        type_analyse=data["type_analyse"],
        resultats=data.get("resultats", {}),
        notes=data.get("notes"),
        statut="en_attente",
    )
    await analyse.insert()
    return serialize(analyse)

# ─── GET toutes les analyses du labo connecté ─────────────────────────
@router.get("/")
async def get_analyses(current_user=Depends(get_current_user)):
    if current_user.role == "admin":
        analyses = await AnalyseBiologique.find_all().to_list()
    else:
        analyses = await AnalyseBiologique.find(
            AnalyseBiologique.laboratoire_id == str(current_user.id)
        ).to_list()

    # Enrichir avec le nom du patient
    result = []
    for a in analyses:
        d = serialize(a)
        patient = await Patient.get(a.patient_id)
        d["patient_nom"] = f"{patient.prenom} {patient.nom}" if patient else "Inconnu"
        result.append(d)
    return result

# ─── PUT mettre à jour les résultats ──────────────────────────────────
@router.put("/{analyse_id}")
async def mettre_a_jour_analyse(analyse_id: str, data: dict, current_user=Depends(get_current_user)):
    analyse = await AnalyseBiologique.get(analyse_id)
    if not analyse:
        raise HTTPException(404, "Analyse non trouvée")

    analyse.resultats = data.get("resultats", analyse.resultats)
    analyse.notes = data.get("notes", analyse.notes)
    analyse.statut = data.get("statut", analyse.statut)
    await analyse.save()
    return serialize(analyse)

# ─── DELETE supprimer une analyse ─────────────────────────────────────
@router.delete("/{analyse_id}")
async def supprimer_analyse(analyse_id: str, current_user=Depends(get_current_user)):
    analyse = await AnalyseBiologique.get(analyse_id)
    if not analyse:
        raise HTTPException(404, "Analyse non trouvée")
    await analyse.delete()
    return {"message": "Analyse supprimée"}