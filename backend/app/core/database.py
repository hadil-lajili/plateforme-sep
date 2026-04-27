from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from beanie import init_beanie
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://mllehadillajili_db_user:Sq7ov3CoE4lVRSaN@sepcluster.woh3fey.mongodb.net/sep_db?appName=SepCluster")

_db = None

def get_gridfs():
    return AsyncIOMotorGridFSBucket(_db, bucket_name="irm_files")

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