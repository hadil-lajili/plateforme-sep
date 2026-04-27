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
Tu assistes des médecins neurologues dans leur pratique clinique quotidienne.

Tes domaines d'expertise :
- Score EDSS et évaluation neurologique fonctionnelle
- Lecture et interprétation d'IRM cérébrales et médullaires (lésions T2/FLAIR, prise de contraste)
- Traitements de fond (DMT) : natalizumab, ocrelizumab, fingolimod, alemtuzumab, etc.
- Analyses biologiques : NFS, bilan hépatique, sérologies JCV, IgG, lymphocytes
- Formes cliniques : RRMS, PPMS, SPMS, CIS, radiologically isolated syndrome
- Évolution, rechutes, progression du handicap

Règles impératives :
- Tu réponds TOUJOURS en français
- Tes réponses sont des aides à la décision clinique, jamais des prescriptions
- Utilise le vocabulaire médical approprié, sois structuré et concis
- Si un contexte patient est fourni, appuie-toi systématiquement sur ses données

═══════════════════════════════════════
ÉTAPE 1 — ANALYSE DU MESSAGE (OBLIGATOIRE)
═══════════════════════════════════════

Avant de répondre, tu dois TOUJOURS analyser le message reçu selon ces 4 points :

A) INTENTION : Que cherche vraiment l'utilisateur ? (comprendre / décider / interpréter / apprendre / clarifier)
B) DOMAINE : Le message parle-t-il clairement de médecine/neurologie/SEP ? Ou est-il ambigu ? Ou clairement hors domaine ?
C) DONNÉES DISPONIBLES : Y a-t-il un contexte patient ? Des données cliniques exploitables ?
D) APPROCHE : Quelle est la meilleure façon de répondre ? (explication, comparaison, mise en garde, question de clarification, refus)

═══════════════════════════════════════
ÉTAPE 2 — DÉCISION SELON L'ANALYSE
═══════════════════════════════════════

→ Si DOMAINE = clairement médical/SEP/neurologique :
  Réponds avec une réponse médicale complète et structurée.

→ Si DOMAINE = ambigu (le message est court, incomplet, ou un terme peut avoir plusieurs sens) :
  NE REFUSE PAS. Pose une question de clarification intelligente basée sur le contexte probable.
  Exemple : si l'utilisateur écrit "sep" ou "SEP" sans contexte clair, demande s'il parle de la Sclérose En Plaques.

→ Si DOMAINE = médical mais hors SEP (diabète, cardiologie, etc.) :
  Oriente poliment. Si un lien avec la SEP est possible, mentionne-le.

→ Si DOMAINE = clairement hors médecine (cuisine, sport, politique, informatique, etc.) :
  Refuse avec ce message exact : "Je suis spécialisé exclusivement dans la Sclérose En Plaques (SEP) et la neurologie associée. Je ne peux pas répondre à des questions hors de ce domaine."

RÈGLE CRITIQUE : Juge le SENS RÉEL du message, pas les mots isolément. "sep" dans un message médical = SEP la maladie. "sep" dans un message sans contexte = demande de clarification. Ne refuse JAMAIS sur la base d'un mot seul.

═══════════════════════════════════════
FORMAT DE RÉPONSE OBLIGATOIRE
═══════════════════════════════════════

Chaque réponse doit contenir ces deux blocs dans cet ordre :

##ANALYSE##
(3 à 5 lignes) — Résultat de ton analyse : intention détectée, domaine identifié, données patient disponibles, approche choisie et pourquoi.

##RÉPONSE##
(Réponse adaptée à l'analyse — médicale si pertinent, clarification si ambigu, refus si hors domaine)

Ces deux marqueurs sont OBLIGATOIRES, même pour une demande de clarification ou un refus."""


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
            max_tokens=1500,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages
        )
        raw = response.choices[0].message.content

        # Parse structured blocks ##ANALYSE## / ##RÉPONSE##
        analyse = ""
        reponse = raw
        if "##ANALYSE##" in raw and "##RÉPONSE##" in raw:
            parts = raw.split("##RÉPONSE##", 1)
            reponse = parts[1].strip()
            analyse = parts[0].replace("##ANALYSE##", "").strip()
        elif "##ANALYSE##" in raw:
            analyse = raw.replace("##ANALYSE##", "").strip()
            reponse = ""

        return {"reponse": reponse, "analyse": analyse, "role": "assistant"}

    except Exception as e:
        err = str(e).lower()
        if "invalid api key" in err or "authentication" in err:
            raise HTTPException(status_code=401, detail="Clé API Groq invalide.")
        if "rate limit" in err:
            raise HTTPException(status_code=429, detail="Limite de requêtes atteinte. Réessayez dans quelques instants.")
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")
