from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.documents import Utilisateur

SECRET_KEY = "sep_platform_secret_key_change_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 heures

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def hasher_mot_de_passe(mot_de_passe: str) -> str:
    return pwd_context.hash(mot_de_passe)

def verifier_mot_de_passe(mot_de_passe: str, hash: str) -> bool:
    return pwd_context.verify(mot_de_passe, hash)

def creer_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token invalide")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expire")

    user = await Utilisateur.get(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouve")
    if user.statut != "actif":
        raise HTTPException(status_code=403, detail="Compte non actif")
    return user

def require_role(*roles):
    async def checker(user: Utilisateur = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Acces refuse. Role requis : {', '.join(roles)}"
            )
        return user
    return checker