from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://mllehadillajili_db_user:Sq7ov3CoE4lVRSaN@sepcluster.woh3fey.mongodb.net/sep_db?appName=SepCluster")

async def connect_db():
    client = AsyncIOMotorClient(MONGODB_URL)
    from app.models.documents import Patient, VisiteClinique, IRMScan, Utilisateur, AnalyseBiologique, Rappel
    await init_beanie(
        database=client.sep_db,
        document_models=[Patient, VisiteClinique, IRMScan, Utilisateur, AnalyseBiologique, Rappel]
    )
    print("Connecte a MongoDB")