import os
from groq import Groq
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.auth import require_role
from app.models.documents import Patient, VisiteClinique, IRMScan, AnalyseBiologique

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

SYSTEM_PROMPT = """Tu es un assistant IA spécialisé en neurologie, expert en Sclérose En Plaques (SEP).
Tu assistes des médecins neurologues dans leur pratique clinique.

Tes capacités :
- Analyser les données cliniques de patients SEP (score EDSS, visites, IRM)
- Expliquer les résultats d'IRM et les rapports radiologiques
- Interpréter les analyses biologiques en contexte SEP
- Répondre aux questions sur les traitements DMT (natalizumab, ocrelizumab, etc.)
- Aider à la compréhension de l'évolution de la maladie
- Suggérer des pistes de réflexion clinique

Règles impératives :
- Tu réponds TOUJOURS en français
- Tu rappelles que tes suggestions sont des aides à la décision, pas des diagnostics
- Tu ne prescris pas de traitements — tu informes et contextualises
- Sois concis, structuré, et utilise le vocabulaire médical approprié
- Si des données patient sont fournies, appuie-toi dessus pour personnaliser tes réponses"""


class MessageRequest(BaseModel):
    message: str
    patient_id: Optional[str] = None
    historique: Optional[list] = []


async def build_patient_context(patient_id: str) -> str:
    try:
        patient = await Patient.get(patient_id)
        if not patient:
            return ""

        lines = [
            f"=== CONTEXTE PATIENT ===",
            f"Nom : {patient.prenom} {patient.nom}",
            f"Date de naissance : {patient.date_naissance}",
            f"Sexe : {patient.sexe or 'Non renseigné'}",
        ]

        # Dernières visites
        visites = await VisiteClinique.find(
            VisiteClinique.patient_id == patient_id
        ).sort(-VisiteClinique.date_visite).limit(5).to_list()

        if visites:
            lines.append("\n--- Dernières visites cliniques ---")
            for v in visites:
                lines.append(f"• {v.date_visite} | EDSS: {v.edss_score or 'N/R'} | Notes: {v.notes or 'Aucune'}")
                if v.tests_fonctionnels:
                    for k, val in v.tests_fonctionnels.items():
                        lines.append(f"  - {k}: {val}")

        # IRM récents
        irms = await IRMScan.find(
            IRMScan.patient_id == patient_id
        ).sort(-IRMScan.uploaded_at).limit(3).to_list()

        if irms:
            lines.append("\n--- IRM récents ---")
            for irm in irms:
                lines.append(f"• {irm.uploaded_at.date()} | Séquence: {irm.sequence_type or 'N/R'} | Statut: {irm.statut}")
                if irm.rapport:
                    conclusion = irm.rapport.get("conclusion", "")
                    nb_lesions = irm.rapport.get("nombre_lesions", "N/R")
                    if conclusion:
                        lines.append(f"  Rapport: {conclusion[:300]}")
                    lines.append(f"  Nombre de lésions: {nb_lesions}")

        # Analyses biologiques récentes
        analyses = await AnalyseBiologique.find(
            AnalyseBiologique.patient_id == patient_id
        ).sort(-AnalyseBiologique.date_analyse).limit(3).to_list()

        if analyses:
            lines.append("\n--- Analyses biologiques récentes ---")
            for a in analyses:
                lines.append(f"• {a.date_analyse.date()} | Type: {a.type_analyse} | Statut: {a.statut}")
                if a.resultats:
                    for k, val in list(a.resultats.items())[:5]:
                        lines.append(f"  - {k}: {val}")

        lines.append("=== FIN CONTEXTE PATIENT ===\n")
        return "\n".join(lines)

    except Exception:
        return ""


@router.post("/message")
async def envoyer_message(
    req: MessageRequest,
    current_user=Depends(require_role("medecin", "admin"))
):
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Clé API Groq non configurée. Ajoutez GROQ_API_KEY dans le fichier .env"
        )

    # Construire le contexte patient si fourni
    patient_context = ""
    if req.patient_id:
        patient_context = await build_patient_context(req.patient_id)

    # Construire l'historique au format Anthropic
    messages = []
    for msg in (req.historique or []):
        role = msg.get("role")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    # Ajouter le message courant (avec contexte patient si présent)
    user_content = req.message
    if patient_context:
        user_content = f"{patient_context}\n{req.message}"

    messages.append({"role": "user", "content": user_content})

    try:
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=1024,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages
        )
        reply = response.choices[0].message.content
        return {"reponse": reply, "role": "assistant"}

    except Exception as e:
        err = str(e).lower()
        if "invalid api key" in err or "authentication" in err:
            raise HTTPException(status_code=401, detail="Clé API Groq invalide.")
        if "rate limit" in err:
            raise HTTPException(status_code=429, detail="Limite de requêtes atteinte. Réessayez dans quelques instants.")
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")
