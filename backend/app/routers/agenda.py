from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, date
from typing import Optional
from app.models.documents import Rappel, VisiteClinique, IRMScan, AnalyseBiologique, Patient
from app.core.auth import get_current_user
from datetime import datetime, date

router = APIRouter()

def serialize_rappel(r) -> dict:
    return {
        "id": str(r.id),
        "medecin_id": r.medecin_id,
        "titre": r.titre,
        "description": r.description,
        "date_rappel": r.date_rappel,
        "type": "rappel",
        "couleur": "#f59e0b",
    }

@router.post("/rappels/", status_code=201)
async def creer_rappel(data: dict, current_user=Depends(get_current_user)):
    rappel = Rappel(
        medecin_id=str(current_user.id),
        titre=data["titre"],
        description=data.get("description", ""),
        date_rappel=datetime.fromisoformat(data["date_rappel"]),
    )
    await rappel.insert()
    return serialize_rappel(rappel)

@router.get("/rappels/")
async def get_rappels(current_user=Depends(get_current_user)):
    rappels = await Rappel.find(Rappel.medecin_id == str(current_user.id)).to_list()
    return [serialize_rappel(r) for r in rappels]

@router.delete("/rappels/{rappel_id}")
async def supprimer_rappel(rappel_id: str, current_user=Depends(get_current_user)):
    rappel = await Rappel.get(rappel_id)
    if not rappel:
        raise HTTPException(404, "Rappel non trouvé")
    await rappel.delete()
    return {"message": "Supprimé"}

@router.get("/evenements/")
async def get_evenements(current_user=Depends(get_current_user)):
    evenements = []

    # 1. Visites cliniques
    patients = await Patient.find(Patient.medecin_id == str(current_user.id)).to_list()
    patient_ids = [str(p.id) for p in patients]
    patient_map = {str(p.id): f"{p.prenom} {p.nom}" for p in patients}

    for pid in patient_ids:
        visites = await VisiteClinique.find(VisiteClinique.patient_id == pid).to_list()
        for v in visites:
            evenements.append({
                "id": str(v.id),
                "titre": f"Visite — {patient_map.get(pid, 'Patient')}",
                "description": v.notes or "Visite clinique",
                "date": datetime.combine(v.date_visite, datetime.min.time()) if isinstance(v.date_visite, date) else v.date_visite,
                "type": "visite",
                "couleur": "#3b82f6",
                "patient_nom": patient_map.get(pid, ""),
            })

    # 2. IRM à consulter
    for pid in patient_ids:
        irms = await IRMScan.find(IRMScan.patient_id == pid).to_list()
        for irm in irms:
            if not irm.rapport:
                evenements.append({
                    "id": str(irm.id),
                    "titre": f"IRM à analyser — {patient_map.get(pid, 'Patient')}",
                    "description": f"Séquence {irm.sequence_type or 'inconnue'}",
                    "date": irm.uploaded_at,
                    "type": "irm",
                    "couleur": "#8b5cf6",
                    "patient_nom": patient_map.get(pid, ""),
                })

    # 3. Analyses de laboratoire
    for pid in patient_ids:
        analyses = await AnalyseBiologique.find(
            AnalyseBiologique.patient_id == pid,
        ).to_list()
        for a in analyses:
            evenements.append({
                "id": str(a.id),
                "titre": f"Analyse — {patient_map.get(pid, 'Patient')}",
                "description": a.type_analyse.replace("_", " "),
                "date": a.date_analyse,
                "type": "analyse",
                "couleur": "#10b981",
                "patient_nom": patient_map.get(pid, ""),
                "statut": a.statut,
            })

    # 4. Rappels personnels
    rappels = await Rappel.find(Rappel.medecin_id == str(current_user.id)).to_list()
    for r in rappels:
        evenements.append({
            "id": str(r.id),
            "titre": r.titre,
            "description": r.description,
            "date": r.date_rappel,
            "type": "rappel",
            "couleur": "#f59e0b",
        })

    evenements.sort(key=lambda x: x["date"] if x["date"] else datetime.min)
    return evenements