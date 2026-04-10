from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Depends
from typing import Optional
import os
from fastapi.responses import FileResponse
import os
import uuid
import aiofiles
import nibabel as nib
import numpy as np
import io
import tempfile
from app.models.documents import IRMScan, Patient, VisiteClinique
from app.core.auth import get_current_user
router = APIRouter()

UPLOAD_DIR = "data/irm"
FORMATS_VALIDES = [".nii", ".nii.gz", ".dcm"]
TAILLE_MAX_MB = 500

def serialize(irm: IRMScan) -> dict:
    return {
        "id": str(irm.id),
        "patient_id": irm.patient_id,
        "visite_id": irm.visite_id,
        "fichier_path": irm.fichier_path,
        "sequence_type": irm.sequence_type,
        "format_fichier": irm.metadata_dicom.get("format"),
        "metadata": irm.metadata_dicom,
        "statut": irm.statut,
        "uploaded_at": irm.uploaded_at,
    }

def extraire_metadata_nii(contenu: bytes, nom_fichier: str) -> dict:
    # Choisir le bon suffixe selon le nom du fichier
    if nom_fichier.endswith(".nii.gz"):
        suffix = ".nii.gz"
    else:
        suffix = ".nii"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(contenu)
        tmp_path = tmp.name
    try:
        img = nib.load(tmp_path)
        shape = img.shape
        header = img.header
        metadata = {
            "format": "NIfTI",
            "dimensions": list(shape),
            "nb_slices": int(shape[2]) if len(shape) >= 3 else None,
            "hauteur": int(shape[0]) if len(shape) >= 1 else None,
            "largeur": int(shape[1]) if len(shape) >= 2 else None,
            "resolution_mm": [round(float(v), 2) for v in header.get_zooms()[:3]],
            "taille_mb": round(len(contenu) / (1024 * 1024), 2),
            "nom_original": nom_fichier,
        }
    finally:
        os.unlink(tmp_path)
    return metadata


# ─── POST upload IRM (NIfTI ou DICOM) ────────────────────────────────
@router.post("/{patient_id}/irm", status_code=201)
async def upload_irm(
    patient_id: str,
    fichier: UploadFile = File(...),
    visite_id: Optional[str] = Query(None),
    sequence_type: Optional[str] = Query(None),
):
    # 1. Vérifier que le patient existe
    patient = await Patient.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouve")

    # 2. Vérifier la visite si fournie
    if visite_id:
        visite = await VisiteClinique.get(visite_id)
        if not visite or visite.patient_id != patient_id:
            raise HTTPException(status_code=404, detail="Visite non trouvee")

    # 3. Vérifier le format du fichier
    nom = fichier.filename
    if nom.endswith(".nii.gz"):
        format_ext = ".nii.gz"
    elif nom.endswith(".nii"):
        format_ext = ".nii"
    elif nom.endswith(".dcm"):
        format_ext = ".dcm"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Format non supporte. Formats acceptes : {FORMATS_VALIDES}"
        )

    # 4. Lire le contenu
    contenu = await fichier.read()

    # 5. Vérifier la taille
    taille_mb = len(contenu) / (1024 * 1024)
    if taille_mb > TAILLE_MAX_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Fichier trop volumineux : {taille_mb:.1f}MB. Maximum : {TAILLE_MAX_MB}MB"
        )

    # 6. Valider et extraire les métadonnées selon le format
    if format_ext in [".nii", ".nii.gz"]:
        try:
            metadata = extraire_metadata_nii(contenu, nom)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Fichier NIfTI invalide ou corrompu : {str(e)}"
            )
    else:
        import pydicom
        try:
            dicom_data = pydicom.dcmread(io.BytesIO(contenu))
            metadata = {
                "format": "DICOM",
                "hauteur": int(dicom_data.Rows) if hasattr(dicom_data, "Rows") else None,
                "largeur": int(dicom_data.Columns) if hasattr(dicom_data, "Columns") else None,
                "nb_slices": int(dicom_data.NumberOfFrames) if hasattr(dicom_data, "NumberOfFrames") else None,
                "modalite": str(dicom_data.Modality) if hasattr(dicom_data, "Modality") else None,
                "taille_mb": round(taille_mb, 2),
                "nom_original": nom,
            }
        except Exception:
            raise HTTPException(status_code=400, detail="Fichier DICOM invalide ou corrompu")

    # 7. Générer un UID unique pour ce fichier
    fichier_uid = str(uuid.uuid4())

    # 8. Vérifier doublon par nom original + patient
    existant = await IRMScan.find_one({
        "patient_id": patient_id,
        "metadata_dicom.nom_original": nom
    })
    if existant:
        raise HTTPException(
            status_code=409,
            detail=f"Ce fichier existe deja pour ce patient avec l'ID : {str(existant.id)}"
        )

    # 9. Créer le dossier patient
    dossier_patient = os.path.join(UPLOAD_DIR, patient_id)
    os.makedirs(dossier_patient, exist_ok=True)

    # 10. Sauvegarder sur disque
    nom_fichier = f"{fichier_uid}{format_ext}"
    chemin_fichier = os.path.join(dossier_patient, nom_fichier)
    async with aiofiles.open(chemin_fichier, "wb") as f:
        await f.write(contenu)

    # 11. Enregistrer en MongoDB
    irm = IRMScan(
        patient_id=patient_id,
        visite_id=visite_id,
        dicom_uid=fichier_uid,
        fichier_path=chemin_fichier,
        sequence_type=sequence_type,
        metadata_dicom=metadata,
        statut="pending",
    )
    await irm.insert()
    return serialize(irm)

# ─── GET toutes les IRM d'un patient ─────────────────────────────────
@router.get("/{patient_id}/irm")
async def get_irm_patient(
    patient_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    patient = await Patient.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouve")

    skip = (page - 1) * limit
    irms = await IRMScan.find(
        IRMScan.patient_id == patient_id
    ).skip(skip).limit(limit).to_list()

    total = await IRMScan.find(
        IRMScan.patient_id == patient_id
    ).count()

    return {
        "data": [serialize(i) for i in irms],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": -(-total // limit)
        }
    }

# ─── GET une IRM par ID ───────────────────────────────────────────────
@router.get("/{patient_id}/irm/{irm_id}")
async def get_irm(patient_id: str, irm_id: str):
    irm = await IRMScan.get(irm_id)
    if not irm or irm.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="IRM non trouvee")
    return serialize(irm)

# ─── DELETE supprimer une IRM ─────────────────────────────────────────
@router.delete("/{patient_id}/irm/{irm_id}")
async def delete_irm(patient_id: str, irm_id: str):
    irm = await IRMScan.get(irm_id)
    if not irm or irm.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="IRM non trouvee")
    if os.path.exists(irm.fichier_path):
        os.remove(irm.fichier_path)
    await irm.delete()
    return {"message": "IRM supprimee avec succes"}
# ─── POST ajouter un rapport radiologique ────────────────────────────
@router.post("/{patient_id}/irm/{irm_id}/rapport")
async def ajouter_rapport(patient_id: str, irm_id: str, rapport: dict):
    irm = await IRMScan.get(irm_id)
    if not irm or irm.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="IRM non trouvee")
    irm.rapport = rapport
    irm.statut = "analysee"
    await irm.save()
    return {"message": "Rapport sauvegarde avec succes", "irm_id": irm_id}

# ─── GET rapport d'une IRM ────────────────────────────────────────────
@router.get("/{patient_id}/irm/{irm_id}/rapport")
async def get_rapport(patient_id: str, irm_id: str):
    irm = await IRMScan.get(irm_id)
    if not irm or irm.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="IRM non trouvee")
    if not irm.rapport:
        raise HTTPException(status_code=404, detail="Aucun rapport pour cette IRM")
    return irm.rapport

# ─── GET toutes les IRM (pour le radiologue) ─────────────────────────
@router.get("/irm/toutes")
async def get_toutes_irms(current_user=Depends(get_current_user)):
    from app.core.auth import require_role
    if current_user.role not in ["radiologue", "admin"]:
        raise HTTPException(403, "Accès réservé au radiologue")

    irms = await IRMScan.find_all().to_list()
    result = []
    for irm in irms:
        patient = await Patient.get(irm.patient_id)
        d = serialize(irm)
        d["patient_nom"] = f"{patient.prenom} {patient.nom}" if patient else "Inconnu"
        result.append(d)
    return result    

# ─── GET fichier IRM (pour visualisation) ────────────────────────────
@router.get("/{patient_id}/irm/{irm_id}/fichier")
async def get_fichier_irm(patient_id: str, irm_id: str, current_user=Depends(get_current_user)):
    irm = await IRMScan.get(irm_id)
    if not irm or irm.patient_id != patient_id:
        raise HTTPException(404, "IRM non trouvée")
    
    # Chemin absolu
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    chemin = irm.fichier_path if os.path.exists(irm.fichier_path) else os.path.join(base_dir, irm.fichier_path)
    
    if not os.path.exists(chemin):
        raise HTTPException(404, "Fichier introuvable sur le disque")
    
    return FileResponse(
        chemin,
        media_type="application/octet-stream",
        filename=os.path.basename(chemin)
    )    
# ─── GET comparer 2 IRM ───────────────────────────────────────────────
@router.get("/{patient_id}/irm/comparer/")
async def comparer_irms(
    patient_id: str,
    irm1_id: str = Query(...),
    irm2_id: str = Query(...),
    coupe: int = Query(None),
    current_user=Depends(get_current_user)
):
    """Retourne 2 coupes IRM en base64 pour comparaison"""
    import base64
    from PIL import Image

    async def extraire_coupe_b64(irm_id: str, coupe_idx: int = None):
        irm = await IRMScan.get(irm_id)
        if not irm or irm.patient_id != patient_id:
            raise HTTPException(404, f"IRM {irm_id} non trouvée")

        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        chemin = irm.fichier_path if os.path.exists(irm.fichier_path) else os.path.join(base_dir, irm.fichier_path)

        if not os.path.exists(chemin):
            raise HTTPException(404, "Fichier IRM introuvable")

        img = nib.load(chemin)
        data = np.squeeze(img.get_fdata().astype(np.float32))

        n = data.shape[2] if len(data.shape) == 3 else 1
        idx = coupe_idx if coupe_idx is not None else n // 2
        idx = min(idx, n - 1)

        coupe_data = data[:, :, idx] if len(data.shape) == 3 else data

        std = coupe_data.std()
        if std > 0:
            coupe_norm = (coupe_data - coupe_data.mean()) / std
        else:
            coupe_norm = coupe_data

        coupe_uint8 = ((coupe_norm - coupe_norm.min()) /
                      (coupe_norm.max() - coupe_norm.min() + 1e-6) * 255).astype(np.uint8)

        pil_img = Image.fromarray(coupe_uint8).resize((256, 256), Image.BILINEAR)

        buffer = io.BytesIO()
        pil_img.save(buffer, format='PNG')
        b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return {
            "irm_id": irm_id,
            "image": f"data:image/png;base64,{b64}",
            "sequence_type": irm.sequence_type,
            "uploaded_at": str(irm.uploaded_at),
            "n_coupes": n,
            "coupe_actuelle": idx
        }

    irm1_data = await extraire_coupe_b64(irm1_id, coupe)
    irm2_data = await extraire_coupe_b64(irm2_id, coupe)

    return {
        "irm1": irm1_data,
        "irm2": irm2_data,
        "coupe": coupe if coupe is not None else irm1_data["n_coupes"] // 2
    }