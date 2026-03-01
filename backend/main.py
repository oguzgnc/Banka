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

# Uygulama başlarken tabloları oluştur
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


def get_db():
    """Veritabanı oturumu dependency — istek sonunda kapatılır."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class StatusUpdate(BaseModel):
    durum: str


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
            "Durum": row.Durum
        }
        for row in db_records
    ]


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

_AI_ISIMLER = [
    "Mehmet Yılmaz", "Ayşe Kaya", "Ali Demir", "Fatma Çelik", "Hasan Öztürk",
    "Emine Arslan", "Mustafa Şahin", "Zeynep Güneş", "İbrahim Koç", "Hatice Aydın",
]

_AI_NEDENLER = [
    "Bölgesel risk minimum seviyede ve önerilen ürüne geçiş yüksek karlılık vaat ediyor.",
    "Düşük temerrüt olasılığı; bölge–ürün uyumu model tarafından onaylandı.",
    "Yüksek teşvik skoru; kredi geri dönüşü güçlü görünüyor.",
    "AI analizi: Bu il–ürün kombinasyonu tarihsel verilerde düşük batırma oranına sahip.",
    "Önerilen ürün değişimi hem su tasarrufu hem de gelir artışı potansiyeli taşıyor.",
    "Bölge koşullarına uyumlu üretim profili; risk skoru en düşük dilimde.",
]


@app.get("/api/ai-opportunities")
def get_ai_opportunities():
    """
    Risk_Durumu 'Düşük' ve Tesvik_Skoru > 8.0 olan en iyi 6–8 çiftçiyi döner.
    Her fırsata ad_soyad ve ai_neden eklenir.
    """
    import random
    df = generate_mock_data()
    mask = (df["Risk_Durumu"] == "Düşük") & (df["Tesvik_Skoru"] > 8.0)
    best = df[mask].sort_values("Tesvik_Skoru", ascending=False).head(8)
    rng = random.Random()
    isimler = rng.sample(_AI_ISIMLER, min(len(best), len(_AI_ISIMLER)))
    nedenler = _AI_NEDENLER.copy()
    rng.shuffle(nedenler)
    opportunities = []
    for i, (_, row) in enumerate(best.iterrows()):
        rec = row.to_dict()
        rec["ad_soyad"] = isimler[i % len(isimler)]
        rec["ai_neden"] = nedenler[i % len(nedenler)]
        opportunities.append(rec)
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
        Durum="İncelemede",
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
                Durum="İncelemede",
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
