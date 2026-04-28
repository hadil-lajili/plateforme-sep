from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from app.core.auth import get_current_user
from app.models.documents import IRMScan
import os

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ONNX_CLS  = os.path.join(BASE_DIR, "ai", "checkpoints", "resnet_classifier.onnx")
ONNX_PRED = os.path.join(BASE_DIR, "ai", "checkpoints", "predictor_lesions_v2.onnx")
ONNX_LSTM = os.path.join(BASE_DIR, "ai", "checkpoints", "convlstm_predictor_aug.onnx")

_cls_session  = None
_pred_session = None
_lstm_session = None


# ══════════════════════════════════════════════════════
# CHARGEMENT DES SESSIONS ONNX
# ══════════════════════════════════════════════════════

def _onnx_session(path):
    if not os.path.exists(path):
        return None
    try:
        import onnxruntime as ort
        sess = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        print(f"  [ONNX] {os.path.basename(path)} chargé")
        return sess
    except Exception as e:
        print(f"Erreur chargement ONNX {path}: {e}")
        return None

def get_cls_model():
    global _cls_session
    if _cls_session is None:
        _cls_session = _onnx_session(ONNX_CLS)
    return _cls_session

def get_pred_model():
    global _pred_session
    if _pred_session is None:
        _pred_session = _onnx_session(ONNX_PRED)
    return _pred_session

def get_lstm_model():
    global _lstm_session
    if _lstm_session is None:
        _lstm_session = _onnx_session(ONNX_LSTM)
    return _lstm_session


# ══════════════════════════════════════════════════════
# UTILITAIRES
# ══════════════════════════════════════════════════════

async def _resoudre_chemin(irm):
    """Retourne un chemin local vers le fichier IRM (depuis GridFS ou disque)."""
    import tempfile
    # Priorité : GridFS
    if irm.gridfs_id:
        from bson import ObjectId
        from app.core.database import get_gridfs
        try:
            bucket = get_gridfs()
            stream = await bucket.open_download_stream(ObjectId(irm.gridfs_id))
            data = await stream.read()
            nom = irm.metadata_dicom.get("nom_original", "irm.nii")
            suffix = ".nii.gz" if nom.endswith(".nii.gz") else ".nii"
            tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
            tmp.write(data)
            tmp.close()
            return tmp.name, True  # (chemin, est_temporaire)
        except Exception as e:
            print(f"Erreur lecture GridFS : {e}")
            return None, False
    # Fallback : disque (anciens fichiers)
    chemin = irm.fichier_path or ""
    if not os.path.exists(chemin):
        chemin = os.path.join(BASE_DIR, chemin)
    if os.path.exists(chemin):
        return chemin, False
    return None, False


def _charger_volume(chemin):
    import nibabel as nib
    import numpy as np
    return np.squeeze(nib.load(chemin).get_fdata().astype(np.float32))


def _prep_coupe(volume, idx, size=256):
    import numpy as np
    from PIL import Image
    n = volume.shape[2] if len(volume.shape) == 3 else 1
    idx = min(idx, n - 1)
    coupe = volume[:, :, idx] if len(volume.shape) == 3 else volume
    std = coupe.std()
    if std > 0:
        coupe = (coupe - coupe.mean()) / std
    return np.array(Image.fromarray(coupe).resize((size, size), Image.BILINEAR), dtype=np.float32)


# ══════════════════════════════════════════════════════
# MODÈLE 1 — Classification SEP vs Sain
# ResNet-50 Transfer Learning — Accuracy 99.35%
# ══════════════════════════════════════════════════════

@router.post("/sep-sain/{irm_id}")
async def classifier_sep_sain(irm_id: str, current_user=Depends(get_current_user)):
    irm = await IRMScan.get(irm_id)
    if not irm:
        raise HTTPException(404, "IRM non trouvée")

    chemin, is_tmp = await _resoudre_chemin(irm)
    if not chemin:
        raise HTTPException(404, "Fichier IRM introuvable")

    session = get_cls_model()
    if session is None:
        if is_tmp: os.unlink(chemin)
        raise HTTPException(503, "Modèle classificateur non disponible")

    try:
        import numpy as np
        from PIL import Image

        data = _charger_volume(chemin)
        n = data.shape[2] if len(data.shape) == 3 else 1

        seuil = data.mean() + 1.5 * data.std()
        scores_coupes = []
        for i in range(n):
            coupe = data[:, :, i]
            scores_coupes.append((float((coupe > seuil).sum()), i))
        scores_coupes.sort(reverse=True)
        indices_actifs = [s[1] for s in scores_coupes[:5]]

        indices_uniform = np.linspace(0, n - 1, 20, dtype=int).tolist()
        tous_indices = list(set(indices_actifs + indices_uniform))

        scores_batches = []
        for start in range(0, len(tous_indices), 5):
            batch_idx = tous_indices[start:start + 5]
            while len(batch_idx) < 5:
                batch_idx.append(batch_idx[-1])
            coupes = [_prep_coupe(data, int(idx), size=224) for idx in batch_idx]
            arr = np.stack(coupes)[np.newaxis, :, np.newaxis, :, :].astype(np.float32)
            output = session.run(None, {"input": arr})[0]
            scores_batches.append(float(output[0, 0]))

        score = max(scores_batches)

        diagnostic = "SEP Détectée" if score > 0.5 else "Sain"
        confiance = score if score > 0.5 else 1 - score

        if score > 0.8:
            interpretation = {"niveau": "sep_certain", "message": "Forte probabilité de SEP. Confirmation clinique recommandée.", "couleur": "#ef4444"}
        elif score > 0.5:
            interpretation = {"niveau": "sep_probable", "message": "Probabilité modérée de SEP. Examens complémentaires conseillés.", "couleur": "#f59e0b"}
        elif score > 0.2:
            interpretation = {"niveau": "incertain", "message": "Résultat incertain. Surveillance recommandée.", "couleur": "#84cc16"}
        else:
            interpretation = {"niveau": "sain", "message": "Aucun signe de SEP détecté.", "couleur": "#22c55e"}

        resultats = {
            "score": round(score, 4),
            "diagnostic": diagnostic,
            "confiance": round(confiance * 100, 1),
            "interpretation": interpretation,
            "modele": "ResNet-50 Transfer Learning",
            "performance": "Accuracy 99.35%"
        }

        irm.rapport = irm.rapport or {}
        irm.rapport["sep_sain"] = resultats
        await irm.save()
        return resultats

    except Exception as e:
        raise HTTPException(500, f"Erreur classification : {str(e)}")
    finally:
        if is_tmp and os.path.exists(chemin): os.unlink(chemin)


@router.get("/sep-sain/{irm_id}")
async def get_sep_sain(irm_id: str, current_user=Depends(get_current_user)):
    irm = await IRMScan.get(irm_id)
    if not irm:
        raise HTTPException(404, "IRM non trouvée")
    if not irm.rapport or "sep_sain" not in irm.rapport:
        raise HTTPException(404, "Aucune classification disponible")
    return irm.rapport["sep_sain"]


# ══════════════════════════════════════════════════════
# MODÈLE 2 — Détection changements longitudinaux
# U-Net 2 canaux (T0+T1) — Dice 0.8215
# ══════════════════════════════════════════════════════

@router.post("/prediction/{irm_id}")
async def predire_lesions_futures(
    irm_id: str,
    irm_t0_id: Optional[str] = Query(None),
    current_user=Depends(get_current_user)
):
    irm_t1 = await IRMScan.get(irm_id)
    if not irm_t1:
        raise HTTPException(404, "IRM T1 non trouvée")

    chemin_t1, t1_tmp = await _resoudre_chemin(irm_t1)
    if not chemin_t1:
        raise HTTPException(404, "Fichier IRM T1 introuvable")

    # Chercher IRM T0
    chemin_t0, t0_tmp = None, False
    if irm_t0_id:
        irm_t0 = await IRMScan.get(irm_t0_id)
        if irm_t0:
            chemin_t0, t0_tmp = await _resoudre_chemin(irm_t0)
    else:
        autres = await IRMScan.find(
            IRMScan.patient_id == irm_t1.patient_id,
            IRMScan.sequence_type == irm_t1.sequence_type,
        ).sort(+IRMScan.uploaded_at).to_list()
        for candidat in autres:
            if str(candidat.id) == irm_id:
                continue
            c, c_tmp = await _resoudre_chemin(candidat)
            if c:
                chemin_t0, t0_tmp = c, c_tmp
                break

    if chemin_t0 is None:
        if t1_tmp and os.path.exists(chemin_t1): os.unlink(chemin_t1)
        raise HTTPException(400, "Aucune IRM T0 disponible. Uploadez une IRM antérieure.")

    session = get_pred_model()
    if session is None:
        raise HTTPException(503, "Modèle U-Net non disponible")

    try:
        import numpy as np
        from PIL import Image
        import base64
        import io

        data_t0 = _charger_volume(chemin_t0)
        data_t1 = _charger_volume(chemin_t1)
        n = data_t1.shape[2] if len(data_t1.shape) == 3 else 1
        indices = np.linspace(n//4, 3*n//4, 10, dtype=int)

        seg_preds, cls_preds, images_base64 = [], [], []

        for idx in indices:
            coupe_t0 = _prep_coupe(data_t0, int(idx), size=256)
            coupe_t1 = _prep_coupe(data_t1, int(idx), size=256)

            arr = np.stack([coupe_t0, coupe_t1])[np.newaxis].astype(np.float32)
            seg_np, cls_out = session.run(None, {"input": arr})
            seg_np = seg_np.squeeze()
            seg_preds.append(seg_np)
            cls_preds.append(float(cls_out[0, 0]))

            # Visualisation
            t1_uint8 = ((coupe_t1 - coupe_t1.min()) /
                        (coupe_t1.max() - coupe_t1.min() + 1e-6) * 255).astype(np.uint8)
            masque_bin = (seg_np > 0.5).astype(np.uint8)
            img_rgb = np.stack([t1_uint8, t1_uint8, t1_uint8], axis=-1)
            if masque_bin.sum() > 0:
                img_rgb[:, :, 0] = np.where(masque_bin == 1, 255, t1_uint8)
                img_rgb[:, :, 1] = np.where(masque_bin == 1, 0, t1_uint8)
                img_rgb[:, :, 2] = np.where(masque_bin == 1, 0, t1_uint8)

            buffer = io.BytesIO()
            Image.fromarray(img_rgb.astype(np.uint8)).save(buffer, format='PNG')
            img_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

            orig_buffer = io.BytesIO()
            Image.fromarray(t1_uint8).save(orig_buffer, format='PNG')
            orig_b64 = base64.b64encode(orig_buffer.getvalue()).decode('utf-8')

            images_base64.append({
                "coupe": int(idx),
                "image": f"data:image/png;base64,{img_b64}",
                "image_originale": f"data:image/png;base64,{orig_b64}",
                "n_lesions": int(masque_bin.sum())
            })

        proba_rechute = float(np.mean(cls_preds))
        volume_predit = int((np.mean(seg_preds, axis=0) > 0.5).sum())
        rechute_probable = proba_rechute > 0.5

        if proba_rechute > 0.7:
            interpretation = {"niveau": "risque_eleve", "message": f"Risque élevé ({proba_rechute*100:.1f}%). Consultation urgente.", "couleur": "#ef4444"}
        elif proba_rechute > 0.5:
            interpretation = {"niveau": "risque_modere", "message": f"Risque modéré ({proba_rechute*100:.1f}%). Suivi rapproché.", "couleur": "#f59e0b"}
        else:
            interpretation = {"niveau": "risque_faible", "message": f"Faible risque ({proba_rechute*100:.1f}%). Surveillance normale.", "couleur": "#22c55e"}

        images_base64.sort(key=lambda x: x['n_lesions'], reverse=True)

        resultats = {
            "proba_rechute": round(proba_rechute * 100, 1),
            "rechute_probable": rechute_probable,
            "volume_lesions_futures": volume_predit,
            "interpretation": interpretation,
            "images_lesions": images_base64[:5],
            "modele": "U-Net 2 canaux (T0+T1)",
            "performance": "Dice 0.8215"
        }

        irm_t1.rapport = irm_t1.rapport or {}
        irm_t1.rapport["prediction_futures"] = resultats
        await irm_t1.save()
        return resultats

    except Exception as e:
        raise HTTPException(500, f"Erreur U-Net : {str(e)}")
    finally:
        if t1_tmp and chemin_t1 and os.path.exists(chemin_t1): os.unlink(chemin_t1)
        if t0_tmp and chemin_t0 and os.path.exists(chemin_t0): os.unlink(chemin_t0)


@router.get("/prediction/{irm_id}")
async def get_prediction(irm_id: str, current_user=Depends(get_current_user)):
    irm = await IRMScan.get(irm_id)
    if not irm:
        raise HTTPException(404, "IRM non trouvée")
    if not irm.rapport or "prediction_futures" not in irm.rapport:
        raise HTTPException(404, "Aucune prédiction disponible")
    return irm.rapport["prediction_futures"]


# ══════════════════════════════════════════════════════
# MODÈLE 3 — Prédiction temporelle ConvLSTM
# 3 IRM consécutives → prédire T4 — Dice 0.7394
# ══════════════════════════════════════════════════════

@router.post("/temporal/{irm_id}")
async def predire_temporal(
    irm_id: str,
    irm_t1_id: Optional[str] = Query(None, description="IRM T1 (la plus ancienne)"),
    irm_t2_id: Optional[str] = Query(None, description="IRM T2 (intermédiaire)"),
    current_user=Depends(get_current_user)
):
    """
    Prédiction temporelle ConvLSTM
    Input  : 3 IRM consécutives (T1, T2, T3)
    Output : masque lésions futures T4
    """
    # IRM T3 (la plus récente = irm_id)
    irm_t3 = await IRMScan.get(irm_id)
    if not irm_t3:
        raise HTTPException(404, "IRM T3 non trouvée")

    chemin_t3, t3_tmp = await _resoudre_chemin(irm_t3)
    if not chemin_t3:
        raise HTTPException(404, "Fichier IRM T3 introuvable")

    # Chercher T1 et T2 automatiquement si non fournis
    chemins = []
    tmp_flags = []
    if irm_t1_id and irm_t2_id:
        for mid in [irm_t1_id, irm_t2_id]:
            irm = await IRMScan.get(mid)
            if not irm:
                raise HTTPException(404, f"IRM {mid} non trouvée")
            c, c_tmp = await _resoudre_chemin(irm)
            if not c:
                raise HTTPException(404, f"Fichier IRM {mid} introuvable")
            chemins.append(c)
            tmp_flags.append(c_tmp)
        chemins.append(chemin_t3)
        tmp_flags.append(t3_tmp)
    else:
        toutes = await IRMScan.find(
            IRMScan.patient_id == irm_t3.patient_id,
            IRMScan.sequence_type == irm_t3.sequence_type,
        ).sort(+IRMScan.uploaded_at).to_list()

        for irm in toutes:
            c, c_tmp = await _resoudre_chemin(irm)
            if c:
                chemins.append(c)
                tmp_flags.append(c_tmp)
            if len(chemins) == 3:
                break

    if len(chemins) < 3:
        raise HTTPException(
            400,
            f"ConvLSTM nécessite 3 IRM FLAIR du même patient. "
            f"Seulement {len(chemins)} disponibles. "
            f"Uploadez des IRM supplémentaires."
        )

    session = get_lstm_model()
    if session is None:
        raise HTTPException(503, "Modèle ConvLSTM non disponible")

    try:
        import numpy as np
        from PIL import Image
        import base64
        import io

        vols = [_charger_volume(c) for c in chemins[:3]]
        n = min(v.shape[2] if len(v.shape) == 3 else 1 for v in vols)
        indices = np.linspace(n//4, 3*n//4, 10, dtype=int)

        seg_preds = []
        images_base64 = []

        for idx in indices:
            coupes = [_prep_coupe(v, int(idx), size=128) for v in vols]
            arr = np.stack(coupes)[np.newaxis, :, np.newaxis, :, :].astype(np.float32)  # (1, 3, 1, 128, 128)
            seg_np = session.run(None, {"input": arr})[0].squeeze()
            seg_preds.append(seg_np)

            # Visualisation — IRM T3 + lésions prédites en rouge
            coupe_t3 = _prep_coupe(vols[2], int(idx), size=128)
            t3_uint8 = ((coupe_t3 - coupe_t3.min()) /
                        (coupe_t3.max() - coupe_t3.min() + 1e-6) * 255).astype(np.uint8)
            masque_bin = (seg_np > 0.5).astype(np.uint8)

            img_rgb = np.stack([t3_uint8, t3_uint8, t3_uint8], axis=-1)
            if masque_bin.sum() > 0:
                img_rgb[:, :, 0] = np.where(masque_bin == 1, 255, t3_uint8)
                img_rgb[:, :, 1] = np.where(masque_bin == 1, 0, t3_uint8)
                img_rgb[:, :, 2] = np.where(masque_bin == 1, 0, t3_uint8)

            buffer = io.BytesIO()
            Image.fromarray(img_rgb.astype(np.uint8)).save(buffer, format='PNG')
            img_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

            orig_buffer = io.BytesIO()
            Image.fromarray(t3_uint8).save(orig_buffer, format='PNG')
            orig_b64 = base64.b64encode(orig_buffer.getvalue()).decode('utf-8')

            images_base64.append({
                "coupe": int(idx),
                "image": f"data:image/png;base64,{img_b64}",
                "image_originale": f"data:image/png;base64,{orig_b64}",
                "n_lesions": int(masque_bin.sum())
            })

        seg_moyen = np.mean(seg_preds, axis=0)
        volume_predit = int((seg_moyen > 0.5).sum())

        if volume_predit > 500:
            interpretation = {"niveau": "risque_eleve", "message": f"Volume important de lésions futures prédit ({volume_predit} voxels). Consultation urgente.", "couleur": "#ef4444"}
        elif volume_predit > 100:
            interpretation = {"niveau": "risque_modere", "message": f"Lésions futures modérées prédites ({volume_predit} voxels). Suivi rapproché.", "couleur": "#f59e0b"}
        else:
            interpretation = {"niveau": "risque_faible", "message": f"Peu de lésions futures prédites ({volume_predit} voxels). Surveillance normale.", "couleur": "#22c55e"}

        images_base64.sort(key=lambda x: x['n_lesions'], reverse=True)

        resultats = {
            "volume_lesions_futures": volume_predit,
            "interpretation": interpretation,
            "images_lesions": images_base64[:5],
            "n_irm_utilisees": 3,
            "modele": "ConvLSTM — Prédiction Temporelle",
            "performance": "Dice 0.7394"
        }

        irm_t3.rapport = irm_t3.rapport or {}
        irm_t3.rapport["prediction_temporelle"] = resultats
        await irm_t3.save()
        return resultats

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Erreur ConvLSTM : {str(e)}")
    finally:
        for c, is_t in zip(chemins, tmp_flags):
            if is_t and c and os.path.exists(c): os.unlink(c)


@router.get("/temporal/{irm_id}")
async def get_temporal(irm_id: str, current_user=Depends(get_current_user)):
    irm = await IRMScan.get(irm_id)
    if not irm:
        raise HTTPException(404, "IRM non trouvée")
    if not irm.rapport or "prediction_temporelle" not in irm.rapport:
        raise HTTPException(404, "Aucune prédiction temporelle disponible")
    return irm.rapport["prediction_temporelle"]


# ══════════════════════════════════════════════════════
# Visualisation 3D lésions
# ══════════════════════════════════════════════════════

@router.get("/lesions3d/{irm_id}")
async def get_lesions_3d(irm_id: str, current_user=Depends(get_current_user)):
    irm = await IRMScan.get(irm_id)
    if not irm:
        raise HTTPException(404, "IRM non trouvée")

    chemin, is_tmp = await _resoudre_chemin(irm)
    if not chemin:
        raise HTTPException(404, "Fichier IRM introuvable")

    session = get_pred_model()
    if session is None:
        if is_tmp and os.path.exists(chemin): os.unlink(chemin)
        raise HTTPException(503, "Modèle non disponible")

    try:
        import numpy as np
        from PIL import Image

        data = _charger_volume(chemin)
        n = data.shape[2] if len(data.shape) == 3 else 1
        RENDER_SIZE = 128

        points_lesions = []
        points_cerveau = []

        for idx in range(0, n, 3):
            coupe_256 = _prep_coupe(data, idx, size=256)
            arr = np.stack([coupe_256, coupe_256])[np.newaxis].astype(np.float32)
            seg_np = session.run(None, {"input": arr})[0].squeeze()
            seg_resized = np.array(
                Image.fromarray(seg_np).resize((RENDER_SIZE, RENDER_SIZE), Image.BILINEAR),
                dtype=np.float32
            )

            lesion_pixels = np.argwhere(seg_resized > 0.1)
            for px in lesion_pixels[::2]:
                points_lesions.append([
                    float(px[1] / RENDER_SIZE * 2 - 1),
                    float(idx / n * 2 - 1),
                    float(px[0] / RENDER_SIZE * 2 - 1)
                ])

            coupe_small = _prep_coupe(data, idx, size=RENDER_SIZE)
            cerveau_pixels = np.argwhere(coupe_small > 0.1)
            for px in cerveau_pixels[::20]:
                points_cerveau.append([
                    float(px[1] / RENDER_SIZE * 2 - 1),
                    float(idx / n * 2 - 1),
                    float(px[0] / RENDER_SIZE * 2 - 1)
                ])

        return {
            "lesions": points_lesions[:2000],
            "cerveau": points_cerveau[:5000],
            "n_lesions": len(points_lesions),
            "irm_id": irm_id
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Erreur 3D : {str(e)}")
    finally:
        if is_tmp and os.path.exists(chemin): os.unlink(chemin)


# ══════════════════════════════════════════════════════
# VIEWER IRM COMPLET — Coupes individuelles
# ══════════════════════════════════════════════════════

@router.get("/viewer/{irm_id}/info")
async def viewer_info(irm_id: str, current_user=Depends(get_current_user)):
    irm = await IRMScan.get(irm_id)
    if not irm:
        raise HTTPException(404, "IRM non trouvée")
    chemin, is_tmp = await _resoudre_chemin(irm)
    if not chemin:
        raise HTTPException(404, "Fichier IRM introuvable")
    try:
        import nibabel as nib
        shape = nib.load(chemin).shape
        n_coupes = int(shape[2]) if len(shape) >= 3 else 1
        return {"n_coupes": n_coupes}
    finally:
        if is_tmp and os.path.exists(chemin): os.unlink(chemin)


@router.get("/viewer/{irm_id}/coupe/{idx}")
async def viewer_coupe_originale(irm_id: str, idx: int, current_user=Depends(get_current_user)):
    irm = await IRMScan.get(irm_id)
    if not irm:
        raise HTTPException(404, "IRM non trouvée")
    chemin, is_tmp = await _resoudre_chemin(irm)
    if not chemin:
        raise HTTPException(404, "Fichier IRM introuvable")
    try:
        import numpy as np, io, base64
        from PIL import Image
        data = _charger_volume(chemin)
        n = data.shape[2] if len(data.shape) == 3 else 1
        idx = max(0, min(idx, n - 1))
        coupe = _prep_coupe(data, idx, size=256)
        uint8 = ((coupe - coupe.min()) / (coupe.max() - coupe.min() + 1e-6) * 255).astype(np.uint8)
        buf = io.BytesIO()
        Image.fromarray(uint8).save(buf, format='PNG')
        b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return {"image": f"data:image/png;base64,{b64}", "coupe": idx}
    finally:
        if is_tmp and os.path.exists(chemin): os.unlink(chemin)


@router.get("/viewer/{irm_id}/overlay/{idx}")
async def viewer_coupe_overlay(irm_id: str, idx: int, current_user=Depends(get_current_user)):
    irm = await IRMScan.get(irm_id)
    if not irm:
        raise HTTPException(404, "IRM non trouvée")
    chemin_t1, t1_tmp = await _resoudre_chemin(irm)
    if not chemin_t1:
        raise HTTPException(404, "Fichier IRM introuvable")

    session = get_pred_model()
    if session is None:
        if t1_tmp and os.path.exists(chemin_t1): os.unlink(chemin_t1)
        raise HTTPException(503, "Modèle IA non disponible")

    # Auto-sélection T0
    chemin_t0 = chemin_t1
    t0_tmp = False
    autres = await IRMScan.find(
        IRMScan.patient_id == irm.patient_id,
        IRMScan.sequence_type == irm.sequence_type,
    ).sort(+IRMScan.uploaded_at).to_list()
    for candidat in autres:
        if str(candidat.id) == irm_id:
            continue
        c, c_tmp = await _resoudre_chemin(candidat)
        if c:
            chemin_t0 = c
            t0_tmp = c_tmp
            break

    try:
        import numpy as np, io, base64
        from PIL import Image

        data_t0 = _charger_volume(chemin_t0)
        data_t1 = _charger_volume(chemin_t1)
        n = data_t1.shape[2] if len(data_t1.shape) == 3 else 1
        idx = max(0, min(idx, n - 1))

        coupe_t0 = _prep_coupe(data_t0, idx, size=256)
        coupe_t1 = _prep_coupe(data_t1, idx, size=256)
        arr = np.stack([coupe_t0, coupe_t1])[np.newaxis].astype(np.float32)
        seg_np = session.run(None, {"input": arr})[0].squeeze()
        t1_uint8 = ((coupe_t1 - coupe_t1.min()) / (coupe_t1.max() - coupe_t1.min() + 1e-6) * 255).astype(np.uint8)
        masque_bin = (seg_np > 0.5).astype(np.uint8)
        n_lesions = int(masque_bin.sum())

        img_rgb = np.stack([t1_uint8, t1_uint8, t1_uint8], axis=-1)
        if n_lesions > 0:
            img_rgb[:, :, 0] = np.where(masque_bin == 1, 255, t1_uint8)
            img_rgb[:, :, 1] = np.where(masque_bin == 1, 0, t1_uint8)
            img_rgb[:, :, 2] = np.where(masque_bin == 1, 0, t1_uint8)

        buf = io.BytesIO()
        Image.fromarray(img_rgb.astype(np.uint8)).save(buf, format='PNG')
        b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return {
            "image": f"data:image/png;base64,{b64}",
            "coupe": idx,
            "n_lesions": n_lesions
        }
    finally:
        if t1_tmp and os.path.exists(chemin_t1): os.unlink(chemin_t1)
        if t0_tmp and chemin_t0 != chemin_t1 and os.path.exists(chemin_t0): os.unlink(chemin_t0)