from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from app.core.auth import require_role
from app.models.documents import Patient, VisiteClinique, IRMScan, Utilisateur

router = APIRouter()


def serialize_patient(p: Patient) -> dict:
    return {
        "id": str(p.id),
        "nom": p.nom,
        "prenom": p.prenom,
        "date_naissance": p.date_naissance,
        "sexe": p.sexe,
        "contact": p.contact,
        "created_at": p.created_at,
    }


def serialize_visite(v: VisiteClinique) -> dict:
    return {
        "id": str(v.id),
        "date_visite": v.date_visite,
        "edss_score": v.edss_score,
        "tests_fonctionnels": v.tests_fonctionnels,
        "notes": v.notes,
        "created_at": v.created_at,
    }


def serialize_irm(irm: IRMScan) -> dict:
    return {
        "id": str(irm.id),
        "sequence_type": irm.sequence_type,
        "statut": irm.statut,
        "uploaded_at": irm.uploaded_at,
        "metadata": irm.metadata_dicom,
        "rapport": irm.rapport,
    }


async def get_patient_id(user: Utilisateur) -> str:
    """Récupère le patient_id lié à l'utilisateur patient."""
    if not user.patient_id:
        raise HTTPException(
            status_code=404,
            detail="Aucun dossier patient lié à votre compte. Contactez votre médecin."
        )
    # Vérifier que le patient existe
    patient = await Patient.get(user.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Dossier patient introuvable")
    return user.patient_id


# ─── GET /api/patient-portal/mon-dossier ─────────────────────────────
@router.get("/mon-dossier")
async def get_mon_dossier(current_user=Depends(require_role("patient"))):
    patient_id = await get_patient_id(current_user)
    patient = await Patient.get(patient_id)

    # Compter les visites et IRM
    visites = await VisiteClinique.find(
        VisiteClinique.patient_id == patient_id
    ).to_list()
    irms = await IRMScan.find(
        IRMScan.patient_id == patient_id
    ).to_list()

    dernier_edss = None
    if visites:
        visites_sorted = sorted(visites, key=lambda v: v.date_visite, reverse=True)
        dernier_edss = visites_sorted[0].edss_score

    return {
        "patient": serialize_patient(patient),
        "resume": {
            "total_visites": len(visites),
            "total_irm": len(irms),
            "dernier_edss": dernier_edss,
        }
    }


# ─── GET /api/patient-portal/mes-visites ─────────────────────────────
@router.get("/mes-visites")
async def get_mes_visites(current_user=Depends(require_role("patient"))):
    patient_id = await get_patient_id(current_user)
    visites = await VisiteClinique.find(
        VisiteClinique.patient_id == patient_id
    ).sort(-VisiteClinique.date_visite).to_list()

    return {
        "data": [serialize_visite(v) for v in visites],
        "total": len(visites),
    }


# ─── GET /api/patient-portal/mes-irm ─────────────────────────────────
@router.get("/mes-irm")
async def get_mes_irm(current_user=Depends(require_role("patient"))):
    patient_id = await get_patient_id(current_user)
    irms = await IRMScan.find(
        IRMScan.patient_id == patient_id
    ).sort(-IRMScan.uploaded_at).to_list()

    return {
        "data": [serialize_irm(i) for i in irms],
        "total": len(irms),
    }


# ─── GET /api/patient-portal/mes-rapports ────────────────────────────
@router.get("/mes-rapports")
async def get_mes_rapports(current_user=Depends(require_role("patient"))):
    patient_id = await get_patient_id(current_user)

    # Récupérer les IRM ayant un rapport
    irms = await IRMScan.find(
        IRMScan.patient_id == patient_id
    ).to_list()

    rapports = []
    for irm in irms:
        if irm.rapport:
            rapport_entry = {
                "irm_id": str(irm.id),
                "sequence_type": irm.sequence_type,
                "date": irm.uploaded_at,
                "rapport": {},
            }
            # Segmentation — version simplifiée pour le patient
            if irm.rapport.get("segmentation_ia"):
                seg = irm.rapport["segmentation_ia"]
                rapport_entry["rapport"]["segmentation"] = {
                    "type": "Segmentation des lésions",
                    "niveau": seg.get("interpretation", {}).get("niveau", "—"),
                    "message": seg.get("interpretation", {}).get("message", ""),
                    "volume_lesions": seg.get("resultats", {}).get("volume_lesions_voxels"),
                    "coupes_touchees": seg.get("resultats", {}).get("n_coupes_touchees"),
                }
            # Classification
            if irm.rapport.get("classification_ia"):
                cls = irm.rapport["classification_ia"]
                rapport_entry["rapport"]["classification"] = {
                    "type": "Classification SEP",
                    "diagnostic": cls.get("diagnostic", "—"),
                    "confiance": cls.get("confiance"),
                    "message": cls.get("interpretation", {}).get("message", ""),
                }
            # Prédiction futures
            if irm.rapport.get("prediction_ia"):
                pred = irm.rapport["prediction_ia"]
                rapport_entry["rapport"]["prediction"] = {
                    "type": "Prédiction futures",
                    "rechute_probable": pred.get("rechute_probable"),
                    "proba_rechute": pred.get("proba_rechute"),
                    "message": pred.get("interpretation", {}).get("message", ""),
                }

            if rapport_entry["rapport"]:
                rapports.append(rapport_entry)

    rapports.sort(key=lambda r: r["date"], reverse=True)
    return {"data": rapports, "total": len(rapports)}


# ─── GET /api/patient-portal/mon-evolution ────────────────────────────
@router.get("/mon-evolution")
async def get_mon_evolution(current_user=Depends(require_role("patient"))):
    patient_id = await get_patient_id(current_user)

    visites = await VisiteClinique.find(
        VisiteClinique.patient_id == patient_id
    ).sort(VisiteClinique.date_visite).to_list()

    evolution_edss = []
    evolution_tests = []

    for v in visites:
        if v.edss_score is not None:
            evolution_edss.append({
                "date": v.date_visite,
                "score": v.edss_score,
            })
        if v.tests_fonctionnels:
            evolution_tests.append({
                "date": v.date_visite,
                "tests": v.tests_fonctionnels,
            })

    # Calculer la tendance
    tendance = "stable"
    if len(evolution_edss) >= 2:
        dernier = evolution_edss[-1]["score"]
        avant_dernier = evolution_edss[-2]["score"]
        if dernier > avant_dernier:
            tendance = "progression"
        elif dernier < avant_dernier:
            tendance = "amelioration"

    return {
        "evolution_edss": evolution_edss,
        "evolution_tests": evolution_tests,
        "tendance": tendance,
        "total_visites": len(visites),
    }


# ─── GET /api/patient-portal/actualites ──────────────────────────────
@router.get("/actualites")
async def get_actualites(current_user=Depends(require_role("patient"))):
    """Retourne des actualités sur la SEP (articles statiques + PubMed)."""

    articles = [
        {
            "id": "1",
            "titre": "Nouveaux traitements de la SEP : ce qu'il faut savoir en 2026",
            "resume": "Les avancées récentes dans le traitement de la sclérose en plaques offrent de nouvelles perspectives. Les thérapies ciblées et la remyélinisation en sont les points forts.",
            "categorie": "Traitements",
            "source": "Fondation SEP France",
            "date": "2026-03-15",
            "image_url": None,
            "lien": "https://www.fondation-sclerose-en-plaques.org",
        },
        {
            "id": "2",
            "titre": "Vivre avec la SEP : conseils pour le quotidien",
            "resume": "Gestion de la fatigue, exercice physique adapté et soutien psychologique : découvrez les meilleures stratégies pour améliorer votre qualité de vie.",
            "categorie": "Vie quotidienne",
            "source": "ARSEP",
            "date": "2026-03-10",
            "image_url": None,
            "lien": "https://www.arsep.org",
        },
        {
            "id": "3",
            "titre": "L'intelligence artificielle au service du diagnostic de la SEP",
            "resume": "Des modèles d'IA permettent désormais de détecter plus précocement les lésions à l'IRM et de prédire l'évolution de la maladie avec une précision inédite.",
            "categorie": "Recherche",
            "source": "INSERM",
            "date": "2026-02-28",
            "image_url": None,
            "lien": "https://www.inserm.fr",
        },
        {
            "id": "4",
            "titre": "Alimentation et SEP : quels aliments privilégier ?",
            "resume": "Une alimentation anti-inflammatoire riche en oméga-3, fruits et légumes pourrait contribuer à réduire l'inflammation et les poussées.",
            "categorie": "Vie quotidienne",
            "source": "Fondation SEP France",
            "date": "2026-02-20",
            "image_url": None,
            "lien": "https://www.fondation-sclerose-en-plaques.org",
        },
        {
            "id": "5",
            "titre": "Thérapie par cellules souches : résultats prometteurs",
            "resume": "Les essais cliniques de phase III montrent des résultats encourageants pour la thérapie par cellules souches dans les formes progressives de SEP.",
            "categorie": "Recherche",
            "source": "Nature Medicine",
            "date": "2026-02-15",
            "image_url": None,
            "lien": "https://www.nature.com/nm",
        },
        {
            "id": "6",
            "titre": "Témoignage : courir un marathon avec la SEP",
            "resume": "Marie, diagnostiquée il y a 8 ans, partage son parcours inspirant et comment le sport l'aide à gérer sa maladie au quotidien.",
            "categorie": "Témoignages",
            "source": "SEP Mag",
            "date": "2026-02-10",
            "image_url": None,
            "lien": "#",
        },
        {
            "id": "7",
            "titre": "Remyélinisation : les avancées de la recherche",
            "resume": "De nouvelles molécules capables de stimuler la réparation de la myéline sont en cours d'essais cliniques, ouvrant la voie à des traitements régénératifs.",
            "categorie": "Recherche",
            "source": "INSERM",
            "date": "2026-01-28",
            "image_url": None,
            "lien": "https://www.inserm.fr",
        },
        {
            "id": "8",
            "titre": "Gestion du stress et de la fatigue dans la SEP",
            "resume": "La méditation, le yoga et la thérapie cognitive comportementale sont des outils efficaces pour gérer le stress et la fatigue liés à la SEP.",
            "categorie": "Vie quotidienne",
            "source": "ARSEP",
            "date": "2026-01-20",
            "image_url": None,
            "lien": "https://www.arsep.org",
        },
    ]

    return {"data": articles, "total": len(articles)}
