"""
Veritabanı modelleri — çiftçi başvuruları (FarmerApplication).
"""
from datetime import date
from sqlalchemy import Column, Integer, String, Float

from database import Base


def _bugun_str() -> str:
    return date.today().isoformat()


class FarmerApplication(Base):
    __tablename__ = "farmer_applications"

    id = Column(Integer, primary_key=True, index=True)
    TCKN = Column(String(11), unique=True, nullable=False, index=True)
    ad_soyad = Column(String(255), nullable=False)
    Il = Column(String(100), nullable=False)
    Urun1_Adi = Column(String(100), nullable=False)
    Urun1_Alan = Column(Float, nullable=False)
    Onerilen_Urun = Column(String(100), nullable=True)
    Tesvik_Skoru = Column(Float, nullable=True)
    Risk_Durumu = Column(String(50), nullable=True)
    Tarih = Column(String(10), default=_bugun_str, nullable=False)
    Durum = Column(String(50), default="İncelemede", nullable=False)
