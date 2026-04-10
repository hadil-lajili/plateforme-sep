from ai.data.dataset import MSSEGDataset

ds = MSSEGDataset("data/msseg")
print(f"Nombre de coupes : {len(ds)}")

flair, masque = ds[0]
print(f"FLAIR shape : {flair.shape} | min={flair.min():.2f} max={flair.max():.2f}")
print(f"Masque shape : {masque.shape} | lésions : {masque.sum():.0f} voxels")