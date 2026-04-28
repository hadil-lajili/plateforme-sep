from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from beanie import init_beanie
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://mllehadillajili_db_user:Sq7ov3CoE4lVRSaN@sepcluster.woh3fey.mongodb.net/sep_db?appName=SepCluster")

_db = None

def get_gridfs():
    return AsyncIOMotorGridFSBucket(_db, bucket_name="irm_files")

GITHUB_RELEASE_BASE = os.getenv(
    "MODELS_BASE_URL",
    "https://github.com/hadil-lajili/plateforme-sep/releases/download/v1.0-models"
)

CHECKPOINT_NAMES = [
    "resnet_classifier.pth",
    "predictor_lesions_v2.pth",
    "convlstm_predictor_aug.pth",
]

async def _telecharger_checkpoints():
    """Télécharge les checkpoints depuis GitHub Releases si absents sur disque."""
    import httpx
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    dest_dir = os.path.join(base, "ai", "checkpoints")
    os.makedirs(dest_dir, exist_ok=True)
    async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
        for name in CHECKPOINT_NAMES:
            dest = os.path.join(dest_dir, name)
            if os.path.exists(dest):
                continue
            url = f"{GITHUB_RELEASE_BASE}/{name}"
            try:
                print(f"  [DL] {name} depuis GitHub Releases...", flush=True)
                async with client.stream("GET", url) as r:
                    r.raise_for_status()
                    with open(dest, "wb") as f:
                        async for chunk in r.aiter_bytes(chunk_size=1024 * 1024):
                            f.write(chunk)
                size_mb = os.path.getsize(dest) // (1024 * 1024)
                print(f"  [OK] {name} ({size_mb} MB)")
            except Exception as e:
                print(f"  [WARN] {name} non téléchargeable : {e}")

async def connect_db():
    global _db
    client = AsyncIOMotorClient(MONGODB_URL)
    _db = client.sep_db
    from app.models.documents import Patient, VisiteClinique, IRMScan, Utilisateur, AnalyseBiologique, Rappel, RendezVous, Contrat
    await init_beanie(
        database=_db,
        document_models=[Patient, VisiteClinique, IRMScan, Utilisateur, AnalyseBiologique, Rappel, RendezVous, Contrat]
    )
    print("Connecte a MongoDB")
    await _telecharger_checkpoints()