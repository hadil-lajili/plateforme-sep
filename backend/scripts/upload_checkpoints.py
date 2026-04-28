"""
Script one-shot : upload des checkpoints IA dans MongoDB GridFS.
Exécuter une seule fois depuis le dossier backend/ :
    python scripts/upload_checkpoints.py
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECKPOINTS = {
    "resnet_classifier.pth":       os.path.join(BASE_DIR, "ai", "checkpoints", "resnet_classifier.pth"),
    "predictor_lesions_v2.pth":    os.path.join(BASE_DIR, "ai", "checkpoints", "predictor_lesions_v2.pth"),
    "convlstm_predictor_aug.pth":  os.path.join(BASE_DIR, "ai", "checkpoints", "convlstm_predictor_aug.pth"),
}

async def main():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client.sep_db
    bucket = AsyncIOMotorGridFSBucket(db, bucket_name="model_checkpoints")

    for name, path in CHECKPOINTS.items():
        if not os.path.exists(path):
            print(f"  [SKIP] {name} — fichier introuvable")
            continue
        # Supprimer l'ancienne version si elle existe
        async for f in bucket.find({"filename": name}):
            await bucket.delete(f._id)
            print(f"  [DEL]  ancienne version de {name} supprimée")
        # Uploader
        size_mb = os.path.getsize(path) / (1024 * 1024)
        print(f"  [UP]   {name} ({size_mb:.0f} MB) ...", end="", flush=True)
        with open(path, "rb") as f:
            file_id = await bucket.upload_from_stream(name, f)
        print(f" OK → {file_id}")

    client.close()
    print("\nTous les checkpoints sont dans GridFS.")

asyncio.run(main())
