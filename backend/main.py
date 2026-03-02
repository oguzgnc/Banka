import io
from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
import pandas as pd

from database import engine, SessionLocal, Base
import models  # Tabloları Base'e kaydetmek için import
from mock_data import (
    generate_mock_data,
    get_map_data,
    get_crop_trends,
    get_dynamic_risk_map,
    generate_credit_applications,
    process_single_application,
)

app = FastAPI(title="Tarımsal Kredi API")

_MARKET_SEED_PRODUCTS = ["Mısır", "Buğday", "Ayçiçeği", "Pamuk", "Şeker Pancarı"]


def _seed_market_trends_if_empty() -> None:
    db = SessionLocal()
    try:
        exists = db.query(models.MarketTrend.id).first()
        if exists:
            return
        for urun in _MARKET_SEED_PRODUCTS:
            db.add(models.MarketTrend(urun_adi=urun, etki_puani=0.0, aciklama=""))
        db.commit()
    finally:
        db.close()

# Uygulama başlarken tabloları oluştur
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    _seed_market_trends_if_empty()


def get_db():
    """Veritabanı oturumu dependency — istek sonunda kapatılır."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class StatusUpdate(BaseModel):
    durum: str


class MarketTrendUpdate(BaseModel):
    etki_puani: float
    aciklama: str = ""


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"mesaj": "Tarımsal Kredi API Çalışıyor"}


@app.get("/api/snapshot")
def get_snapshot():
    """
    Tek istekte tutarlı bir anlık görüntü üretir (Dashboard sayfası).
    Tüm veriler aynı generate_mock_data() çağrısından türetilir.
    """
    df = generate_mock_data()
    yuksek_riskli = int((df["Risk_Durumu"] == "Yüksek").sum())
    return {
        "kpi": {
            "toplam_ciftci":      12847,
            "bekleyen_kredi":     342,
            "yuksek_riskli_bolge": yuksek_riskli,
        },
        "recommendations": df.to_dict(orient="records"),
        "map_data":   get_map_data(df),
        "crop_trends": get_crop_trends(),
    }


@app.get("/api/kpi")
def get_kpi():
    df = generate_mock_data()
    yuksek_riskli = int((df["Risk_Durumu"] == "Yüksek").sum())
    return {
        "toplam_ciftci":      12847,
        "bekleyen_kredi":     342,
        "yuksek_riskli_bolge": yuksek_riskli,
    }


@app.get("/api/recommendations")
def get_recommendations():
    return generate_mock_data().to_dict(orient="records")


@app.get("/api/map-data")
def get_map_data_endpoint():
    return get_map_data(generate_mock_data())


@app.get("/api/crop-trends")
def get_crop_trends_endpoint():
    return get_crop_trends()


def _skor_to_durum(score: int) -> str:
    if score > 80:
        return "Onaylı"
    if score >= 60:
        return "İncelemede"
    return "Riskli"


def _score_to_risk_and_status(score_0_10: float) -> tuple[str, str]:
    if score_0_10 >= 8.0:
        return "Düşük", "Onaylı"
    if score_0_10 >= 6.0:
        return "Orta", "İncelemede"
    return "Yüksek", "Riskli"


def _apply_market_trend_effect(enriched: dict, db: Session) -> dict:
    urun = str(enriched.get("Urun1_Adi", "")).strip()
    base_score = float(enriched.get("Tesvik_Skoru", 0) or 0)

    trend = (
        db.query(models.MarketTrend)
        .filter(models.MarketTrend.urun_adi == urun)
        .first()
    )
    etki_puani = float(trend.etki_puani or 0) if trend else 0.0

    final_score = max(0.0, min(10.0, round(base_score + etki_puani, 2)))
    risk_durumu, durum = _score_to_risk_and_status(final_score)

    out = dict(enriched)
    out["Tesvik_Skoru"] = final_score
    out["Risk_Durumu"] = risk_durumu
    out["Durum"] = durum
    return out


@app.get("/api/cks-analyses")
def get_cks_analyses(db: Session = Depends(get_db)):
    """ÇKS analiz listesi: sadece veritabanındaki gerçek kayıtlar (JSON-serializable dict listesi)."""
    db_records = db.query(models.FarmerApplication).order_by(models.FarmerApplication.id.desc()).all()
    return [
        {
            "id": row.id,
            "TCKN": row.TCKN,
            "ad_soyad": row.ad_soyad,
            "Il": row.Il,
            "Urun1_Adi": row.Urun1_Adi,
            "Urun1_Alan": row.Urun1_Alan,
            "Onerilen_Urun": row.Onerilen_Urun,
            "Tesvik_Skoru": row.Tesvik_Skoru,
            "Risk_Durumu": row.Risk_Durumu,
            "Tarih": row.Tarih,
            "Durum": row.Durum
        }
        for row in db_records
    ]


@app.get("/api/market-trends")
def get_market_trends(db: Session = Depends(get_db)):
    rows = db.query(models.MarketTrend).order_by(models.MarketTrend.urun_adi.asc()).all()
    return [
        {
            "id": row.id,
            "urun_adi": row.urun_adi,
            "etki_puani": float(row.etki_puani or 0),
            "aciklama": str(row.aciklama or ""),
        }
        for row in rows
    ]


@app.put("/api/market-trends/{trend_id}")
def update_market_trend(trend_id: int, body: MarketTrendUpdate, db: Session = Depends(get_db)):
    if body.etki_puani < -2.0 or body.etki_puani > 2.0:
        raise HTTPException(status_code=400, detail="etki_puani -2.0 ile +2.0 arasında olmalıdır.")

    row = db.query(models.MarketTrend).filter(models.MarketTrend.id == trend_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Trend kaydı bulunamadı.")

    row.etki_puani = float(body.etki_puani)
    row.aciklama = str(body.aciklama or "").strip()
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "urun_adi": row.urun_adi,
        "etki_puani": float(row.etki_puani or 0),
        "aciklama": str(row.aciklama or ""),
    }


@app.get("/api/risk-map")
def get_risk_map():
    df = generate_mock_data()
    return get_dynamic_risk_map(df)


@app.get("/api/credit-applications")
def get_credit_applications():
    return generate_credit_applications()


# ---------------------------------------------------------------------------
# Yapay Zeka Fırsatları — en düşük riskli, yüksek skorlu çiftçiler
# ---------------------------------------------------------------------------
@app.get("/api/ai-opportunities")
def get_ai_opportunities(db: Session = Depends(get_db)):
    """
    Tamamen gerçek veritabanından fırsat listesi üretir.
    Kural: Tesvik_Skoru >= 7.0 veya Durum != 'Reddedildi'.
    """
    rows = (
        db.query(models.FarmerApplication)
        .order_by(models.FarmerApplication.Tesvik_Skoru.desc(), models.FarmerApplication.id.desc())
        .all()
    )

    opportunities = []
    for row in rows:
        skor = float(row.Tesvik_Skoru or 0)
        durum = str(row.Durum or "")
        if not (skor >= 7.0 or durum != "Reddedildi"):
            continue

        onerilen_urun = str(row.Onerilen_Urun or row.Urun1_Adi)
        opportunities.append(
            {
                "TCKN": row.TCKN,
                "ad_soyad": row.ad_soyad,
                "Il": row.Il,
                "Ilce": "Merkez",
                "Urun1_Adi": row.Urun1_Adi,
                "Urun1_Alan": float(row.Urun1_Alan or 0),
                "Onerilen_Urun": onerilen_urun,
                "Tesvik_Skoru": skor,
                "Risk_Durumu": row.Risk_Durumu,
                "Telefon": "Sistemde Kayıtlı",
                "ai_neden": f"{row.Il} bölgesindeki toprak yapısı ve pazar talebi {onerilen_urun} üretimi için oldukça elverişli. Bu müşteriye özel teşvik paketi sunulabilir.",
            }
        )

    return {"opportunities": opportunities}


# ---------------------------------------------------------------------------
# Yeni Başvuru — arayüzden girilen gerçek veriyi AI ile analiz et
# ---------------------------------------------------------------------------

@app.post("/api/applications")
def post_application(body: dict, db: Session = Depends(get_db)):
    """
    Gövde: { "TCKN", "ad_soyad", "Il", "Urun1_Adi", "Urun1_Alan" }.
    ML/DSS ile Risk_Durumu, Tesvik_Skoru, Onerilen_Urun hesaplanır; kayıt banka.db'ye yazılır.
    """
    required = ["TCKN", "ad_soyad", "Il", "Urun1_Adi", "Urun1_Alan"]
    for key in required:
        if key not in body:
            raise HTTPException(status_code=400, detail=f"Eksik alan: {key}")

    enriched = process_single_application(body)
    enriched = _apply_market_trend_effect(enriched, db)

    # Aynı TCKN varsa güncelleme veya hata — unique olduğu için yeni kayıt ekliyoruz
    existing = db.query(models.FarmerApplication).filter(models.FarmerApplication.TCKN == enriched["TCKN"]).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu TCKN ile daha önce başvuru kaydedilmiş.")

    record = models.FarmerApplication(
        TCKN=str(enriched["TCKN"]).strip(),
        ad_soyad=str(enriched.get("ad_soyad", "")).strip(),
        Il=str(enriched["Il"]).strip(),
        Urun1_Adi=str(enriched["Urun1_Adi"]).strip(),
        Urun1_Alan=float(enriched["Urun1_Alan"]),
        Onerilen_Urun=str(enriched.get("Onerilen_Urun", "")),
        Tesvik_Skoru=float(enriched.get("Tesvik_Skoru", 0)),
        Risk_Durumu=str(enriched.get("Risk_Durumu", "")),
        Durum=str(enriched.get("Durum", "İncelemede")),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # Saf dict dön — ORM objesi JSON'a çevrilmesin (serialization hatası önlenir)
    return {
        "id": int(record.id),
        "TCKN": str(record.TCKN),
        "ad_soyad": str(record.ad_soyad),
        "Il": str(record.Il),
        "Urun1_Adi": str(record.Urun1_Adi),
        "Urun1_Alan": float(record.Urun1_Alan),
        "Onerilen_Urun": str(record.Onerilen_Urun or ""),
        "Tesvik_Skoru": float(record.Tesvik_Skoru or 0),
        "Risk_Durumu": str(record.Risk_Durumu or ""),
        "Tarih": str(record.Tarih or ""),
        "Durum": str(record.Durum or ""),
    }


_REQUIRED_BULK_COLUMNS = {"TCKN", "ad_soyad", "Il", "Urun1_Adi", "Urun1_Alan"}
_COLUMN_ALIASES = {
    "tckn": "TCKN",
    "ad soyad": "ad_soyad",
    "ad_soyad": "ad_soyad",
    "il": "Il",
    "urun1_adi": "Urun1_Adi",
    "ürün": "Urun1_Adi",
    "urun": "Urun1_Adi",
    "urun1_alan": "Urun1_Alan",
    "alan": "Urun1_Alan",
    "alan (ha)": "Urun1_Alan",
}


def _normalize_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Sütun adlarını boşluk/slash temizleyip beklenen isimlere eşler."""
    out = {}
    for c in df.columns:
        key = str(c).strip().replace(" ", "_").replace("/", "_")
        key_lower = key.lower()
        if key_lower in _COLUMN_ALIASES:
            out[_COLUMN_ALIASES[key_lower]] = df[c]
        elif key in _REQUIRED_BULK_COLUMNS or key == "ad_soyad":
            out[key if key != "ad_soyad" else "ad_soyad"] = df[c]
    return pd.DataFrame(out)


@app.post("/api/applications/bulk-upload")
def bulk_upload_applications(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Excel (.xlsx, .xls) veya CSV dosyası yükler. Her satırda TCKN, ad_soyad, Il, Urun1_Adi, Urun1_Alan
    beklenir. Eksik sütunu olan satırlar atlanır. Her satır ML/DSS'ten geçirilip veritabanına eklenir.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Dosya adı yok.")
    ext = (file.filename or "").lower().split(".")[-1]
    try:
        contents = file.file.read()
        buf = io.BytesIO(contents)
        if ext == "xlsx":
            df = pd.read_excel(buf, engine="openpyxl")
        elif ext == "xls":
            try:
                df = pd.read_excel(buf, engine="xlrd")
            except ImportError:
                raise HTTPException(status_code=400, detail=" .xls için pip install xlrd gerekir. .xlsx kullanın.")
        else:
            df = pd.read_csv(buf, encoding="utf-8", sep=None, engine="python")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Dosya okunamadı: {e!s}")
    df = _normalize_dataframe_columns(df)
    missing = _REQUIRED_BULK_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Eksik sütunlar: {', '.join(sorted(missing))}. Gerekli: TCKN, ad_soyad, Il, Urun1_Adi, Urun1_Alan",
        )
    added = 0
    for _, row in df.iterrows():
        try:
            tckn = str(row.get("TCKN", "")).strip()
            if not tckn or len(tckn) != 11 or not tckn.isdigit():
                continue
            ad_soyad = str(row.get("ad_soyad", "")).strip() or "—"
            il = str(row.get("Il", "")).strip()
            urun = str(row.get("Urun1_Adi", "")).strip()
            alan = row.get("Urun1_Alan")
            try:
                alan_f = float(alan)
            except (TypeError, ValueError):
                continue
            if not il or not urun:
                continue
            body = {"TCKN": tckn, "ad_soyad": ad_soyad, "Il": il, "Urun1_Adi": urun, "Urun1_Alan": alan_f}
            enriched = process_single_application(body)
            enriched = _apply_market_trend_effect(enriched, db)
            if db.query(models.FarmerApplication).filter(models.FarmerApplication.TCKN == tckn).first():
                continue
            record = models.FarmerApplication(
                TCKN=tckn,
                ad_soyad=enriched.get("ad_soyad", ad_soyad),
                Il=il,
                Urun1_Adi=urun,
                Urun1_Alan=alan_f,
                Onerilen_Urun=str(enriched.get("Onerilen_Urun", "")),
                Tesvik_Skoru=float(enriched.get("Tesvik_Skoru", 0)),
                Risk_Durumu=str(enriched.get("Risk_Durumu", "")),
                Durum=str(enriched.get("Durum", "İncelemede")),
            )
            db.add(record)
            added += 1
        except Exception:
            continue
    db.commit()
    return {"mesaj": "Toplu yükleme tamamlandı.", "eklenen": added}


@app.put("/api/applications/{tckn}/status")
def update_application_status(tckn: str, body: StatusUpdate, db: Session = Depends(get_db)):
    """
    TCKN ile bulunan başvurunun Durum sütununu günceller.
    Body: { "durum": "Onaylandı" | "Reddedildi" | "İncelemede" }
    """
    record = db.query(models.FarmerApplication).filter(models.FarmerApplication.TCKN == tckn.strip()).first()
    if not record:
        raise HTTPException(status_code=404, detail="Bu TCKN ile kayıt bulunamadı.")
    record.Durum = body.durum.strip()
    db.commit()
    return {"mesaj": "Durum güncellendi", "TCKN": tckn, "durum": record.Durum}


@app.get("/api/applications")
def get_applications(db: Session = Depends(get_db)):
    """Veritabanındaki tüm çiftçi başvurularını saf JSON (dict listesi) olarak döner."""
    rows = db.query(models.FarmerApplication).order_by(models.FarmerApplication.id.desc()).all()
    return [
        {
            "id": int(r.id),
            "TCKN": str(r.TCKN),
            "ad_soyad": str(r.ad_soyad),
            "Il": str(r.Il),
            "Urun1_Adi": str(r.Urun1_Adi),
            "Urun1_Alan": float(r.Urun1_Alan),
            "Onerilen_Urun": str(r.Onerilen_Urun or ""),
            "Tesvik_Skoru": float(r.Tesvik_Skoru or 0),
            "Risk_Durumu": str(r.Risk_Durumu or ""),
            "Tarih": str(r.Tarih or ""),
            "Durum": str(r.Durum or ""),
        }
        for r in rows
    ]
