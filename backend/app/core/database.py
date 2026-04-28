from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from beanie import init_beanie
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://mllehadillajili_db_user:Sq7ov3CoE4lVRSaN@sepcluster.woh3fey.mongodb.net/sep_db?appName=SepCluster")

_db = None

def get_gridfs():
    return AsyncIOMotorGridFSBucket(_db, bucket_name="irm_files")

def get_checkpoints_gridfs():
    return AsyncIOMotorGridFSBucket(_db, bucket_name="model_checkpoints")

CHECKPOINT_NAMES = [
    "resnet_classifier.pth",
    "predictor_lesions_v2.pth",
    "convlstm_predictor_aug.pth",
]

async def _telecharger_checkpoints():
    """Télécharge les checkpoints depuis GridFS si absents sur disque."""
    bucket = get_checkpoints_gridfs()
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    dest_dir = os.path.join(base, "ai", "checkpoints")
    os.makedirs(dest_dir, exist_ok=True)
    for name in CHECKPOINT_NAMES:
        dest = os.path.join(dest_dir, name)
        if os.path.exists(dest):
            continue
        try:
            stream = await bucket.open_download_stream_by_name(name)
            data = await stream.read()
            with open(dest, "wb") as f:
                f.write(data)
            print(f"  [DL] {name} ({len(data)//1024//1024} MB) téléchargé depuis GridFS")
        except Exception as e:
            print(f"  [WARN] checkpoint {name} non disponible dans GridFS : {e}")

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