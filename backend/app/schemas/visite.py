from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date, datetime

class TestsFonctionnels(BaseModel):
    motricite: Optional[int] = Field(None, ge=0, le=2)
    vision: Optional[int] = Field(None, ge=0, le=2)
    cognition: Optional[int] = Field(None, ge=0, le=2)
    equilibre: Optional[int] = Field(None, ge=0, le=2)

class VisiteCreate(BaseModel):
    date_visite: date
    edss_score: Optional[float] = Field(None, ge=0.0, le=10.0)
    tests_fonctionnels: Optional[TestsFonctionnels] = None
    notes: Optional[str] = Field(None, max_length=1000)
    medecin_id: Optional[str] = None

    @field_validator("date_visite")
    @classmethod
    def valider_date(cls, v):
        if v > date.today():
            raise ValueError("La date de visite ne peut pas etre dans le futur")
        return v

class VisiteUpdate(BaseModel):
    date_visite: Optional[date] = None
    edss_score: Optional[float] = Field(None, ge=0.0, le=10.0)
    tests_fonctionnels: Optional[TestsFonctionnels] = None
    notes: Optional[str] = Field(None, max_length=1000)
    medecin_id: Optional[str] = None

class VisiteResponse(BaseModel):
    id: str
    patient_id: str
    date_visite: date
    edss_score: Optional[float]
    tests_fonctionnels: Optional[dict]
    notes: Optional[str]
    medecin_id: Optional[str]
    created_at: datetime