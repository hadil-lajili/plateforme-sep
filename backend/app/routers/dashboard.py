from fastapi import APIRouter, Depends
from datetime import datetime, date, timedelta
from app.core.auth import require_role
from app.models.documents import Patient, VisiteClinique, IRMScan, AnalyseBiologique

router = APIRouter()


@router.get("/stats")
async def get_stats(current_user=Depends(require_role("medecin", "admin"))):
    medecin_id = str(current_user.id)
    aujourd_hui = date.today()
    seuil_suivi = datetime.utcnow() - timedelta(days=180)
    seuil_irm = datetime.utcnow() - timedelta(days=7)

    # ── Patients du médecin ──────────────────────────────────────────────
    patients = await Patient.find(
        Patient.medecin_id == medecin_id
    ).to_list()
    patient_ids = [str(p.id) for p in patients]

    # ── Visites aujourd'hui ──────────────────────────────────────────────
    visites_today = await VisiteClinique.find(
        VisiteClinique.medecin_id == medecin_id,
        VisiteClinique.date_visite == aujourd_hui
    ).to_list()

    # ── IRM en attente ───────────────────────────────────────────────────
    irm_pending = []
    if patient_ids:
        all_irm = await IRMScan.find(IRMScan.statut == "pending").to_list()
        irm_pending = [i for i in all_irm if i.patient_id in patient_ids]

    # ── Analyses en attente ──────────────────────────────────────────────
    analyses_pending = []
    if patient_ids:
        all_analyses = await AnalyseBiologique.find(
            AnalyseBiologique.statut == "en_attente"
        ).to_list()
        analyses_pending = [a for a in all_analyses if a.patient_id in patient_ids]

    # ── Dernière visite par patient ──────────────────────────────────────
    alertes = []
    patients_dict = {str(p.id): p for p in patients}

    for pid in patient_ids:
        visites = await VisiteClinique.find(
            VisiteClinique.patient_id == pid
        ).sort(-VisiteClinique.date_visite).limit(2).to_list()

        patient = patients_dict.get(pid)
        if not patient:
            continue

        nom_complet = f"{patient.prenom} {patient.nom}"

        # Alerte : aucune visite depuis > 6 mois
        if not visites:
            alertes.append({
                "type": "suivi_manquant",
                "niveau": "warning",
                "patient_id": pid,
                "patient_nom": nom_complet,
                "message": "Aucune visite enregistrée",
                "detail": "Aucune visite dans le dossier"
            })
        else:
            derniere = visites[0]
            # Convertir date_visite en datetime si nécessaire
            dv = derniere.date_visite
            if isinstance(dv, date) and not isinstance(dv, datetime):
                dv = datetime(dv.year, dv.month, dv.day)
            if dv < seuil_suivi:
                jours = (datetime.utcnow() - dv).days
                alertes.append({
                    "type": "suivi_manquant",
                    "niveau": "warning",
                    "patient_id": pid,
                    "patient_nom": nom_complet,
                    "message": f"Pas de visite depuis {jours} jours",
                    "detail": f"Dernière visite : {derniere.date_visite}"
                })

            # Alerte : EDSS ≥ 6
            edss = derniere.edss_score
            if edss is not None and edss >= 6.0:
                alertes.append({
                    "type": "edss_eleve",
                    "niveau": "danger",
                    "patient_id": pid,
                    "patient_nom": nom_complet,
                    "message": f"EDSS élevé : {edss}",
                    "detail": f"Score EDSS critique (≥ 6.0) lors de la dernière visite"
                })

            # Alerte : progression EDSS ≥ 1.0 entre deux visites
            if len(visites) >= 2:
                edss_avant = visites[1].edss_score
                edss_apres = visites[0].edss_score
                if edss_avant is not None and edss_apres is not None:
                    delta = edss_apres - edss_avant
                    if delta >= 1.0:
                        alertes.append({
                            "type": "progression_edss",
                            "niveau": "danger",
                            "patient_id": pid,
                            "patient_nom": nom_complet,
                            "message": f"Progression EDSS +{delta:.1f}",
                            "detail": f"EDSS passé de {edss_avant} à {edss_apres}"
                        })

    # Alerte : IRM en attente depuis > 7 jours
    for irm in irm_pending:
        if irm.uploaded_at < seuil_irm:
            patient = patients_dict.get(irm.patient_id)
            nom = f"{patient.prenom} {patient.nom}" if patient else "Inconnu"
            jours = (datetime.utcnow() - irm.uploaded_at).days
            alertes.append({
                "type": "irm_en_attente",
                "niveau": "info",
                "patient_id": irm.patient_id,
                "patient_nom": nom,
                "message": f"IRM en attente depuis {jours} jours",
                "detail": f"Uploadée le {irm.uploaded_at.date()}, séquence : {irm.sequence_type or 'N/R'}"
            })

    # Trier : danger en premier, puis warning, puis info
    ordre = {"danger": 0, "warning": 1, "info": 2}
    alertes.sort(key=lambda a: ordre.get(a["niveau"], 3))

    return {
        "stats": {
            "total_patients": len(patients),
            "visites_aujourdhui": len(visites_today),
            "irm_en_attente": len(irm_pending),
            "analyses_en_attente": len(analyses_pending),
        },
        "alertes": alertes,
        "updated_at": datetime.utcnow().isoformat()
    }
