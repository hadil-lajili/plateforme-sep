from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional
from datetime import date, datetime
import re

class ContactSchema(BaseModel):
    email: Optional[EmailStr] = None
    telephone: Optional[str] = None

    @field_validator("telephone")
    @classmethod
    def valider_telephone(cls, v):
        if v is None:
            return v
        pattern = r"^(\+?\d{1,3})?[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{1,4}[\s\-]?\d{1,9}$"
        if not re.match(pattern, v):
            raise ValueError("Numero de telephone invalide")
        return v

class PatientCreate(BaseModel):
    nom: str = Field(..., min_length=2, max_length=100)
    prenom: str = Field(..., min_length=2, max_length=100)
    date_naissance: date
    sexe: Optional[str] = Field(None, pattern="^(M|F)$")
    contact: Optional[ContactSchema] = None

    @field_validator("date_naissance")
    @classmethod
    def valider_date(cls, v):
        if v >= date.today():
            raise ValueError("La date de naissance doit etre dans le passe")
        if v.year < 1900:
            raise ValueError("Date de naissance invalide")
        return v

    @field_validator("nom", "prenom")
    @classmethod
    def valider_lettres(cls, v):
        if not re.match(r"^[a-zA-ZÀ-ÿ\s\-']+$", v):
            raise ValueError("Uniquement des lettres, espaces et tirets")
        return v.strip()

class PatientUpdate(BaseModel):
    nom: Optional[str] = Field(None, min_length=2, max_length=100)
    prenom: Optional[str] = Field(None, min_length=2, max_length=100)
    date_naissance: Optional[date] = None
    sexe: Optional[str] = Field(None, pattern="^(M|F)$")
    contact: Optional[ContactSchema] = None

class PatientResponse(BaseModel):
    id: str
    nom: str
    prenom: str
    date_naissance: date
    sexe: Optional[str]
    contact: Optional[dict]
    created_at: datetime
    updated_at: datetime