from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Depends
from fastapi.responses import StreamingResponse
from typing import Optional
import os
import uuid
import io
import tempfile
from bson import ObjectId
from app.models.documents import IRMScan, Patient, VisiteClinique
from app.core.auth import get_current_user
from app.core.database import get_gridfs

router = APIRouter()

FORMATS_VALIDES = [".nii", ".nii.gz", ".dcm"]
TAILLE_MAX_MB = 500


def serialize(irm: IRMScan) -> dict:
    return {
        "id": str(irm.id),
        "patient_id": irm.patient_id,
        "visite_id": irm.visite_id,
        "gridfs_id": irm.gridfs_id,
        "sequence_type": irm.sequence_type,
        "format_fichier": irm.metadata_dicom.get("format"),
        "metadata": irm.metadata_dicom,
        "statut": irm.statut,
        "uploaded_at": irm.uploaded_at,
        "rapport": irm.rapport,
        "radiologue_id": irm.radiologue_id,
        "radiologue_nom": irm.radiologue_nom,
        "envoi_medecin_id": irm.envoi_medecin_id,
        "envoye_at": irm.envoye_at,
    }


def extraire_metadata_nii(contenu: bytes, nom_fichier: str) -> dict:
    import nibabel as nib
    suffix = ".nii.gz" if nom_fichier.endswith(".nii.gz") else ".nii"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(contenu)
        tmp_path = tmp.name
    try:
        img = nib.load(tmp_path)
        shape = img.shape
        header = img.header
        return {
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


async def lire_nii_depuis_gridfs(gridfs_id: str, nom_fichier: str):
    """Télécharge un fichier NIfTI depuis GridFS dans un fichier temporaire et retourne le chemin."""
    bucket = get_gridfs()
    stream = await bucket.open_download_stream(ObjectId(gridfs_id))
    contenu = await stream.read()
    suffix = ".nii.gz" if nom_fichier and nom_fichier.endswith(".nii.gz") else ".nii"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.write(contenu)
    tmp.close()
    return tmp.name


# ─── POST upload IRM ─────────────────────────────────────────────────
@router.post("/{patient_id}/irm", status_code=201)
async def upload_irm(
    patient_id: str,
    fichier: UploadFile = File(...),
    visite_id: Optional[str] = Query(None),
    sequence_type: Optional[str] = Query(None),
):
    patient = await Patient.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouve")

    if visite_id:
        visite = await VisiteClinique.get(visite_id)
        if not visite or visite.patient_id != patient_id:
            raise HTTPException(status_code=404, detail="Visite non trouvee")

    nom = fichier.filename
    if nom.endswith(".nii.gz"):
        format_ext = ".nii.gz"
    elif nom.endswith(".nii"):
        format_ext = ".nii"
    elif nom.endswith(".dcm"):
        format_ext = ".dcm"
    else:
        raise HTTPException(status_code=400, detail=f"Format non supporte. Formats acceptes : {FORMATS_VALIDES}")

    contenu = await fichier.read()
    taille_mb = len(contenu) / (1024 * 1024)
    if taille_mb > TAILLE_MAX_MB:
        raise HTTPException(status_code=400, detail=f"Fichier trop volumineux : {taille_mb:.1f}MB. Maximum : {TAILLE_MAX_MB}MB")

    if format_ext in [".nii", ".nii.gz"]:
        # Validation légère : vérifier la signature NIfTI sans charger le volume complet
        try:
            if format_ext == ".nii.gz":
                import gzip
                header_bytes = gzip.decompress(contenu[:1024])
            else:
                header_bytes = contenu[:348]
            # Les fichiers NIfTI commencent avec sizeof_hdr = 348 (little-endian)
            import struct
            sizeof_hdr = struct.unpack_from('<i', header_bytes, 0)[0]
            if sizeof_hdr not in (348, 540):
                raise ValueError("Signature NIfTI invalide")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Fichier NIfTI invalide ou corrompu : {str(e)}")
        metadata = {
            "format": "NIfTI",
            "taille_mb": round(taille_mb, 2),
            "nom_original": nom,
        }
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

    existant = await IRMScan.find_one({"patient_id": patient_id, "metadata_dicom.nom_original": nom})
    if existant:
        raise HTTPException(status_code=409, detail=f"Ce fichier existe deja pour ce patient avec l'ID : {str(existant.id)}")

    fichier_uid = str(uuid.uuid4())

    # Stocker dans GridFS
    bucket = get_gridfs()
    nom_gridfs = f"{patient_id}/{fichier_uid}{format_ext}"
    gridfs_file_id = await bucket.upload_from_stream(
        nom_gridfs,
        contenu,
        metadata={"patient_id": patient_id, "nom_original": nom},
    )

    irm = IRMScan(
        patient_id=patient_id,
        visite_id=visite_id,
        dicom_uid=fichier_uid,
        gridfs_id=str(gridfs_file_id),
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
    irms = await IRMScan.find(IRMScan.patient_id == patient_id).skip(skip).limit(limit).to_list()
    total = await IRMScan.find(IRMScan.patient_id == patient_id).count()

    return {
        "data": [serialize(i) for i in irms],
        "pagination": {"page": page, "limit": limit, "total": total, "pages": -(-total // limit)}
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
    if irm.gridfs_id:
        try:
            bucket = get_gridfs()
            await bucket.delete(ObjectId(irm.gridfs_id))
        except Exception:
            pass
    await irm.delete()
    return {"message": "IRM supprimee avec succes"}


# ─── POST ajouter un rapport radiologique ────────────────────────────
@router.post("/{patient_id}/irm/{irm_id}/rapport")
async def ajouter_rapport(patient_id: str, irm_id: str, rapport: dict, current_user=Depends(get_current_user)):
    irm = await IRMScan.get(irm_id)
    if not irm or irm.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="IRM non trouvee")
    irm.rapport = rapport
    irm.statut = "analysee"
    irm.radiologue_id = str(current_user.id)
    irm.radiologue_nom = f"{current_user.prenom} {current_user.nom}"
    await irm.save()
    return {"message": "Rapport sauvegarde avec succes", "irm_id": irm_id}


# ─── POST envoyer le rapport à un médecin ────────────────────────────
@router.post("/{patient_id}/irm/{irm_id}/envoyer")
async def envoyer_rapport(patient_id: str, irm_id: str, body: dict, current_user=Depends(get_current_user)):
    from datetime import datetime
    irm = await IRMScan.get(irm_id)
    if not irm or irm.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="IRM non trouvée")
    if not irm.rapport:
        raise HTTPException(status_code=400, detail="Aucun rapport à envoyer. Rédigez d'abord le rapport.")
    medecin_id = body.get("medecin_id")
    if not medecin_id:
        raise HTTPException(status_code=400, detail="medecin_id obligatoire")
    irm.envoi_medecin_id = medecin_id
    irm.envoye_at = datetime.utcnow()
    await irm.save()
    return {"message": "Rapport envoyé au médecin", "irm_id": irm_id}


# ─── GET rapport d'une IRM ────────────────────────────────────────────
@router.get("/{patient_id}/irm/{irm_id}/rapport")
async def get_rapport(patient_id: str, irm_id: str):
    irm = await IRMScan.get(irm_id)
    if not irm or irm.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="IRM non trouvee")
    if not irm.rapport:
        raise HTTPException(status_code=404, detail="Aucun rapport pour cette IRM")
    return irm.rapport


# ─── GET rapports reçus (pour le médecin) ────────────────────────────
@router.get("/rapports/recus")
async def get_rapports_recus(current_user=Depends(get_current_user)):
    if current_user.role not in ["medecin", "admin"]:
        raise HTTPException(403, "Accès réservé au médecin")
    irms = await IRMScan.find(IRMScan.envoi_medecin_id == str(current_user.id)).to_list()
    result = []
    for irm in irms:
        patient = await Patient.get(irm.patient_id)
        d = serialize(irm)
        d["patient_nom"] = f"{patient.prenom} {patient.nom}" if patient else "Inconnu"
        result.append(d)
    result.sort(key=lambda x: x["envoye_at"] or x["uploaded_at"], reverse=True)
    return result


# ─── GET toutes les IRM (pour le radiologue) ─────────────────────────
@router.get("/irm/toutes")
async def get_toutes_irms(current_user=Depends(get_current_user)):
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


# ─── GET fichier IRM (téléchargement depuis GridFS) ──────────────────
@router.get("/{patient_id}/irm/{irm_id}/fichier")
async def get_fichier_irm(patient_id: str, irm_id: str, current_user=Depends(get_current_user)):
    irm = await IRMScan.get(irm_id)
    if not irm or irm.patient_id != patient_id:
        raise HTTPException(404, "IRM non trouvée")
    if not irm.gridfs_id:
        raise HTTPException(404, "Fichier non disponible")

    bucket = get_gridfs()
    stream = await bucket.open_download_stream(ObjectId(irm.gridfs_id))
    contenu = await stream.read()

    nom_original = irm.metadata_dicom.get("nom_original", f"{irm.dicom_uid}.nii")
    return StreamingResponse(
        io.BytesIO(contenu),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{nom_original}"'},
    )


# ─── GET comparer 2 IRM ───────────────────────────────────────────────
@router.get("/{patient_id}/irm/comparer/")
async def comparer_irms(
    patient_id: str,
    irm1_id: str = Query(...),
    irm2_id: str = Query(...),
    coupe: int = Query(None),
    current_user=Depends(get_current_user),
):
    import base64
    from PIL import Image

    async def extraire_coupe_b64(irm_id: str, coupe_idx: int = None):
        irm = await IRMScan.get(irm_id)
        if not irm or irm.patient_id != patient_id:
            raise HTTPException(404, f"IRM {irm_id} non trouvée")
        if not irm.gridfs_id:
            raise HTTPException(404, "Fichier IRM non disponible dans GridFS")

        import nibabel as nib
        import numpy as np
        nom_original = irm.metadata_dicom.get("nom_original", "")
        tmp_path = await lire_nii_depuis_gridfs(irm.gridfs_id, nom_original)
        try:
            img = nib.load(tmp_path)
            data = np.squeeze(img.get_fdata().astype(np.float32))
            n = data.shape[2] if len(data.shape) == 3 else 1
            idx = coupe_idx if coupe_idx is not None else n // 2
            idx = min(idx, n - 1)
            coupe_data = data[:, :, idx] if len(data.shape) == 3 else data
            std = coupe_data.std()
            coupe_norm = (coupe_data - coupe_data.mean()) / std if std > 0 else coupe_data
            coupe_uint8 = ((coupe_norm - coupe_norm.min()) / (coupe_norm.max() - coupe_norm.min() + 1e-6) * 255).astype(np.uint8)
            pil_img = Image.fromarray(coupe_uint8).resize((256, 256), Image.BILINEAR)
            buffer = io.BytesIO()
            pil_img.save(buffer, format="PNG")
            b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
            return {
                "irm_id": irm_id,
                "image": f"data:image/png;base64,{b64}",
                "sequence_type": irm.sequence_type,
                "uploaded_at": str(irm.uploaded_at),
                "n_coupes": n,
                "coupe_actuelle": idx,
            }
        finally:
            os.unlink(tmp_path)

    irm1_data = await extraire_coupe_b64(irm1_id, coupe)
    irm2_data = await extraire_coupe_b64(irm2_id, coupe)
    return {
        "irm1": irm1_data,
        "irm2": irm2_data,
        "coupe": coupe if coupe is not None else irm1_data["n_coupes"] // 2,
    }
