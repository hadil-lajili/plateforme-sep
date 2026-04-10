from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models.documents import VisiteClinique, Patient
from app.schemas.visite import VisiteCreate, VisiteUpdate

router = APIRouter()

def serialize(visite: VisiteClinique) -> dict:
    return {
        "id": str(visite.id),
        "patient_id": visite.patient_id,
        "date_visite": visite.date_visite,
        "edss_score": visite.edss_score,
        "tests_fonctionnels": visite.tests_fonctionnels,
        "notes": visite.notes,
        "medecin_id": visite.medecin_id,
        "created_at": visite.created_at,
    }

# ─── GET toutes les visites d'un patient ─────────────────────────────
@router.get("/{patient_id}/visites")
async def get_visites(
    patient_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    # Vérifier que le patient existe
    patient = await Patient.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouve")

    skip = (page - 1) * limit
    visites = await VisiteClinique.find(
        VisiteClinique.patient_id == patient_id
    ).skip(skip).limit(limit).to_list()

    total = await VisiteClinique.find(
        VisiteClinique.patient_id == patient_id
    ).count()

    return {
        "data": [serialize(v) for v in visites],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": -(-total // limit)
        }
    }

# ─── GET une visite par ID ────────────────────────────────────────────
@router.get("/{patient_id}/visites/{visite_id}")
async def get_visite(patient_id: str, visite_id: str):
    visite = await VisiteClinique.get(visite_id)
    if not visite or visite.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="Visite non trouvee")
    return serialize(visite)

# ─── POST créer une visite ────────────────────────────────────────────
@router.post("/{patient_id}/visites", status_code=201)
async def create_visite(patient_id: str, data: VisiteCreate):
    # Vérifier que le patient existe
    patient = await Patient.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouve")

    visite = VisiteClinique(
        patient_id=patient_id,
        date_visite=data.date_visite,
        edss_score=data.edss_score,
        tests_fonctionnels=data.tests_fonctionnels.model_dump() if data.tests_fonctionnels else {},
        notes=data.notes,
        medecin_id=data.medecin_id,
    )
    await visite.insert()
    return serialize(visite)

# ─── PUT modifier une visite ──────────────────────────────────────────
@router.put("/{patient_id}/visites/{visite_id}")
async def update_visite(patient_id: str, visite_id: str, data: VisiteUpdate):
    visite = await VisiteClinique.get(visite_id)
    if not visite or visite.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="Visite non trouvee")

    if data.date_visite is not None:
        visite.date_visite = data.date_visite
    if data.edss_score is not None:
        visite.edss_score = data.edss_score
    if data.tests_fonctionnels is not None:
        visite.tests_fonctionnels = data.tests_fonctionnels.model_dump()
    if data.notes is not None:
        visite.notes = data.notes
    if data.medecin_id is not None:
        visite.medecin_id = data.medecin_id

    await visite.save()
    return serialize(visite)

# ─── DELETE supprimer une visite ──────────────────────────────────────
@router.delete("/{patient_id}/visites/{visite_id}")
async def delete_visite(patient_id: str, visite_id: str):
    visite = await VisiteClinique.get(visite_id)
    if not visite or visite.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="Visite non trouvee")
    await visite.delete()
    return {"message": "Visite supprimee avec succes"}