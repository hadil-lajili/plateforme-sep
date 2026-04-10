from fastapi import APIRouter, HTTPException, Depends
from app.models.documents import Utilisateur
from app.core.auth import require_role, hasher_mot_de_passe
from pydantic import BaseModel, EmailStr, Field

router = APIRouter()

# ─── GET tous les utilisateurs en attente ────────────────────────────
@router.get("/utilisateurs")
async def get_utilisateurs(
    admin=Depends(require_role("admin"))
):
    users = await Utilisateur.find_all().to_list()
    return [
        {
            "id": str(u.id),
            "nom": u.nom,
            "prenom": u.prenom,
            "email": u.email,
            "role": u.role,
            "statut": u.statut,
            "created_at": u.created_at,
        }
        for u in users
    ]

# ─── PUT valider un compte ───────────────────────────────────────────
@router.put("/utilisateurs/{user_id}/valider")
async def valider_compte(user_id: str, admin=Depends(require_role("admin"))):
    user = await Utilisateur.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")
    user.statut = "actif"
    await user.save()
    return {"message": f"Compte de {user.prenom} {user.nom} valide avec succes"}

# ─── PUT refuser un compte ───────────────────────────────────────────
@router.put("/utilisateurs/{user_id}/refuser")
async def refuser_compte(user_id: str, admin=Depends(require_role("admin"))):
    user = await Utilisateur.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")
    user.statut = "refuse"
    await user.save()
    return {"message": f"Compte de {user.prenom} {user.nom} refuse"}

# ─── POST créer un compte admin (premier setup) ──────────────────────
@router.post("/setup", status_code=201)
async def setup_admin(nom: str, prenom: str, email: str, mot_de_passe: str):
    # Vérifier qu'il n'y a pas déjà un admin
    admin_exist = await Utilisateur.find_one(Utilisateur.role == "admin")
    if admin_exist:
        raise HTTPException(status_code=409, detail="Un admin existe deja")

    admin = Utilisateur(
        nom=nom,
        prenom=prenom,
        email=email,
        mot_de_passe=hasher_mot_de_passe(mot_de_passe),
        role="admin",
        statut="actif",
    )
    await admin.insert()
    return {"message": "Compte admin cree avec succes"}