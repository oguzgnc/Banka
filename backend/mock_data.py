"""
Tarımsal Kredi Karar Destek Sistemi — Veri Üretim Motoru
=========================================================
Mimari: DenizBank ÇKS PostgreSQL şemasına uyumlu pipeline.
Aşama 2 (process_cks_data) eğitilmiş ML modeli ile risk/skor üretir;
model yoksa manuel DSS kurallarına yedeklenir (fallback).
"""

import random
import warnings
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd

# ---------------------------------------------------------------------------
# ML Model yükleme (model.pkl / encoder.pkl)
# ---------------------------------------------------------------------------
_ML_MODEL = None
_ML_ENCODER = None
try:
    _backend_dir = Path(__file__).resolve().parent
    _ML_MODEL = joblib.load(_backend_dir / "model.pkl")
    _ML_ENCODER = joblib.load(_backend_dir / "encoder.pkl")
except Exception as e:
    warnings.warn(
        f"ML model/encoder yüklenemedi, manuel DSS kullanılacak: {e}",
        UserWarning,
        stacklevel=0,
    )

# ---------------------------------------------------------------------------
# Türkiye 81 il (resmî sıra)
# ---------------------------------------------------------------------------
TURKEY_CITIES: list[str] = [
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara",
    "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt",
    "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı",
    "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum",
    "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır",
    "Isparta", "İstanbul", "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars",
    "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli", "Kırşehir", "Kocaeli",
    "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş",
    "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Siirt",
    "Sinop", "Sivas", "Şanlıurfa", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli",
    "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
]

# Pilot iller — haritada mevcut analiz (DataFrame) ile renklendirilir
_PILOT_ILLER: frozenset[str] = frozenset({
    "İzmir", "Konya", "Adana", "Samsun", "Erzurum", "Şanlıurfa",
})

# Diğer iller için risk dağılımı: %50 Düşük, %30 Orta, %20 Yüksek
_NON_PILOT_RISK_WEIGHTS: list[tuple[str, float]] = [
    ("Düşük", 0.50),
    ("Orta", 0.30),
    ("Yüksek", 0.20),
]

# Bölge bazlı risk nedenleri (pilot olmayan iller için mantıklı atama)
_IL_BOLGE_RISK_NEDENI: dict[str, str] = {
    "Doğu": "Don Riski / Erken Don",
    "Güneydoğu": "Kuraklık / Yeraltı Suyu",
    "Karadeniz": "Sel / Fiyat Dalgalanması",
    "Ege": "Fiyat Volatilitesi / Kuraklık",
    "Akdeniz": "Sulama Baskısı / Hastalık",
    "İç Anadolu": "Kuraklık / Arazi Parçalanması",
    "Marmara": "Sel / Toprak Tuzluluğu",
}

def _bolge_risk_nedeni(il: str) -> str:
    """İl adına göre bölgesel risk nedeni döner (pilot olmayan iller için)."""
    dogu = {"Ağrı", "Ardahan", "Artvin", "Bayburt", "Bingöl", "Bitlis", "Erzincan", "Erzurum", "Hakkari", "Iğdır", "Kars", "Muş", "Tunceli", "Van", "Şırnak"}
    guneydogu = {"Adıyaman", "Batman", "Diyarbakır", "Gaziantep", "Kilis", "Mardin", "Siirt", "Şanlıurfa"}
    karadeniz = {"Amasya", "Bartın", "Bolu", "Çorum", "Düzce", "Giresun", "Kastamonu", "Ordu", "Rize", "Samsun", "Sinop", "Tokat", "Trabzon", "Zonguldak"}
    ege = {"Aydın", "Denizli", "İzmir", "Manisa", "Muğla", "Uşak"}
    akdeniz = {"Adana", "Antalya", "Burdur", "Hatay", "Isparta", "Mersin", "Osmaniye"}
    ic_anadolu = {"Aksaray", "Ankara", "Çankırı", "Eskişehir", "Karaman", "Kayseri", "Kırıkkale", "Kırşehir", "Konya", "Nevşehir", "Niğde", "Sivas", "Yozgat"}
    marmara = {"Balıkesir", "Bilecik", "Bursa", "Çanakkale", "Edirne", "İstanbul", "Kırklareli", "Kocaeli", "Sakarya", "Tekirdağ", "Yalova"}
    if il in dogu:
        return _IL_BOLGE_RISK_NEDENI["Doğu"]
    if il in guneydogu:
        return _IL_BOLGE_RISK_NEDENI["Güneydoğu"]
    if il in karadeniz:
        return _IL_BOLGE_RISK_NEDENI["Karadeniz"]
    if il in ege:
        return _IL_BOLGE_RISK_NEDENI["Ege"]
    if il in akdeniz:
        return _IL_BOLGE_RISK_NEDENI["Akdeniz"]
    if il in ic_anadolu:
        return _IL_BOLGE_RISK_NEDENI["İç Anadolu"]
    if il in marmara:
        return _IL_BOLGE_RISK_NEDENI["Marmara"]
    return "Bölgesel Risk"

# ---------------------------------------------------------------------------
# Ürün sınıflandırmaları
# ---------------------------------------------------------------------------
SU_ISTEYEN   = {"Mısır", "Şeker Pancarı", "Yonca", "Pamuk", "Pirinç"}
SU_DAYANIKLI = {"Buğday", "Arpa", "Mercimek", "Nohut", "Ayçiçeği", "Haşhaş"}
YUKSEK_KATMA = {"Pamuk", "Soya Fasulyesi", "Narenciye", "Fındık", "Zeytin",
                "Üzüm Bağı", "Fıstık", "İncir"}
DUSUK_GETIRI = {"Buğday", "Arpa", "Yulaf", "Çavdar"}

WaterLevel = Literal["KISITLI", "NORMAL", "IYI"]
Rule       = Literal["SU_TASARRUFU", "KATMA_DEGER", "RISKLI_ISRAR"]


@dataclass
class BolgeProfile:
    il: str
    ilceler: list[str]
    su_durumu: WaterLevel
    tipik_urunler: list[str]


# ---------------------------------------------------------------------------
# Bölge veri tabanı
# ---------------------------------------------------------------------------
BOLGELER: list[BolgeProfile] = [
    # ── İç Anadolu – Su KISITLI ──────────────────────────────────────────
    BolgeProfile("Konya",      ["Çumra", "Karapınar", "Ereğli", "Akşehir"],
                 "KISITLI",    ["Mısır", "Buğday", "Şeker Pancarı", "Arpa"]),
    BolgeProfile("Karaman",    ["Ermenek", "Sarıveliler"],
                 "KISITLI",    ["Arpa", "Şeker Pancarı", "Yonca"]),
    BolgeProfile("Ankara",     ["Polatlı", "Beypazarı", "Haymana"],
                 "KISITLI",    ["Buğday", "Arpa", "Mısır"]),
    BolgeProfile("Eskişehir",  ["Sivrihisar", "Mahmudiye"],
                 "KISITLI",    ["Buğday", "Arpa", "Şeker Pancarı"]),
    BolgeProfile("Sivas",      ["Şarkışla", "Gemerek"],
                 "KISITLI",    ["Arpa", "Buğday", "Yonca"]),
    BolgeProfile("Aksaray",    ["Ortaköy", "Güzelyurt"],
                 "KISITLI",    ["Şeker Pancarı", "Buğday", "Mısır"]),
    BolgeProfile("Kayseri",    ["Sarıoğlan", "Develi"],
                 "KISITLI",    ["Şeker Pancarı", "Arpa", "Mısır"]),
    BolgeProfile("Niğde",      ["Bor", "Çiftlik"],
                 "KISITLI",    ["Patates", "Şeker Pancarı", "Buğday"]),
    # ── Güneydoğu Anadolu – Su KISITLI ──────────────────────────────────
    BolgeProfile("Şanlıurfa",  ["Suruç", "Viranşehir", "Bozova"],
                 "KISITLI",    ["Pamuk", "Buğday", "Mısır"]),
    BolgeProfile("Diyarbakır", ["Ergani", "Çüngüş", "Çermik"],
                 "KISITLI",    ["Buğday", "Arpa", "Mısır"]),
    BolgeProfile("Mardin",     ["Kızıltepe", "Derik"],
                 "KISITLI",    ["Buğday", "Arpa", "Pamuk"]),
    BolgeProfile("Gaziantep",  ["Nurdağı", "İslahiye", "Araban"],
                 "KISITLI",    ["Arpa", "Buğday", "Mısır"]),
    # ── Ege – Su NORMAL ──────────────────────────────────────────────────
    BolgeProfile("İzmir",      ["Ödemiş", "Tire", "Torbalı", "Bergama"],
                 "NORMAL",     ["Buğday", "Tütün", "Pamuk", "İncir"]),
    BolgeProfile("Manisa",     ["Akhisar", "Salihli", "Sarıgöl"],
                 "NORMAL",     ["Pamuk", "Buğday", "Üzüm Bağı"]),
    BolgeProfile("Aydın",      ["Söke", "Nazilli", "Koçarlı"],
                 "NORMAL",     ["Pamuk", "İncir", "Buğday"]),
    BolgeProfile("Denizli",    ["Sarayköy", "Buldan"],
                 "NORMAL",     ["Buğday", "Pamuk", "Arpa"]),
    BolgeProfile("Uşak",       ["Banaz", "Sivaslı"],
                 "NORMAL",     ["Arpa", "Buğday", "Ayçiçeği"]),
    # ── Akdeniz – Su NORMAL ──────────────────────────────────────────────
    BolgeProfile("Adana",      ["Ceyhan", "Kozan", "Seyhan"],
                 "NORMAL",     ["Pamuk", "Arpa", "Buğday"]),
    BolgeProfile("Mersin",     ["Tarsus", "Silifke"],
                 "NORMAL",     ["Buğday", "Narenciye", "Arpa"]),
    BolgeProfile("Hatay",      ["Dörtyol", "İskenderun"],
                 "NORMAL",     ["Arpa", "Buğday", "Zeytin"]),
    BolgeProfile("Antalya",    ["Manavgat", "Serik", "Alanya"],
                 "NORMAL",     ["Buğday", "Narenciye", "Arpa"]),
    # ── Karadeniz – Su İYİ ───────────────────────────────────────────────
    BolgeProfile("Samsun",     ["Bafra", "Çarşamba", "Alaçam"],
                 "IYI",        ["Mısır", "Fındık", "Buğday"]),
    BolgeProfile("Trabzon",    ["Akçaabat", "Araklı"],
                 "IYI",        ["Fındık", "Mısır", "Çay"]),
    BolgeProfile("Ordu",       ["Fatsa", "Ünye"],
                 "IYI",        ["Fındık", "Mısır", "Yulaf"]),
    BolgeProfile("Giresun",    ["Bulancak", "Tirebolu"],
                 "IYI",        ["Fındık", "Mısır", "Buğday"]),
    # ── Marmara – Su İYİ ─────────────────────────────────────────────────
    BolgeProfile("Bursa",      ["İnegöl", "Orhaneli", "Mustafakemalpaşa"],
                 "IYI",        ["Mısır", "Buğday", "Ayçiçeği"]),
    BolgeProfile("Tekirdağ",   ["Çorlu", "Malkara", "Muratlı"],
                 "IYI",        ["Ayçiçeği", "Buğday", "Arpa"]),
    BolgeProfile("Edirne",     ["Havsa", "İpsala", "Keşan"],
                 "IYI",        ["Ayçiçeği", "Pirinç", "Buğday"]),
]

# İl → su durumu hızlı lookup
_IL_SU_DURUMU: dict[str, WaterLevel] = {b.il: b.su_durumu for b in BOLGELER}

# ---------------------------------------------------------------------------
# DSS Kural Motoru — iç fonksiyonlar (bağımsız, test edilebilir)
# ---------------------------------------------------------------------------

def _onerilen(urun1_adi: str, su: WaterLevel, rng: random.Random) -> tuple[str, Rule]:
    """Urun1_Adi ve bölge su durumuna göre önerilen ürün + kural döner."""
    if su == "KISITLI" and urun1_adi in SU_ISTEYEN:
        if rng.random() < 0.30:
            return urun1_adi, "RISKLI_ISRAR"
        return rng.choice(list(SU_DAYANIKLI - {urun1_adi})), "SU_TASARRUFU"

    if su in ("NORMAL", "IYI") and urun1_adi in DUSUK_GETIRI:
        return rng.choice(list(YUKSEK_KATMA - {urun1_adi})), "KATMA_DEGER"

    if su == "KISITLI":
        return rng.choice(list(SU_DAYANIKLI - {urun1_adi})), "SU_TASARRUFU"

    return rng.choice(list(YUKSEK_KATMA - {urun1_adi})), "KATMA_DEGER"


def _skor_ve_risk(kural: Rule, rng: random.Random) -> tuple[float, str]:
    if kural == "SU_TASARRUFU":
        return round(rng.uniform(8.5, 10.0), 1), "Düşük"
    if kural == "KATMA_DEGER":
        return round(rng.uniform(7.0, 8.5), 1), "Orta"
    return round(rng.uniform(2.0, 4.0), 1), "Yüksek"


# ---------------------------------------------------------------------------
# Aşama 1 — Ham ÇKS Verisi (DenizBank PostgreSQL şeması)
# ---------------------------------------------------------------------------

def _rastgele_telefon(rng: random.Random) -> str:
    """053X XXX XX XX formatında gerçekçi cep numarası üretir."""
    x = rng.choice([2, 3, 4, 5, 6, 7, 8, 9])
    a = rng.randint(100, 999)
    b = rng.randint(10, 99)
    c = rng.randint(10, 99)
    return f"053{x} {a} {b} {c}"


def generate_raw_cks_data() -> pd.DataFrame:
    """
    DenizBank gerçek ÇKS tablosunu taklit eden ham veri üretir.

    Sütunlar (PostgreSQL → pandas sütun adı birebir eşleşir):
        TCKN          : 11 haneli TC Kimlik No (string)
        UretimSezonu  : 2025 veya 2026
        Il            : Şehir adı
        Ilce          : İlçe adı
        Urun1_Adi     : Birincil ürün adı
        Urun1_Alan    : Parsel alanı (hektar, float)
        Telefon       : 053X XXX XX XX formatında cep numarası
    """
    rng = random.Random()
    rows: list[dict] = []

    for _ in range(50):
        bolge = rng.choice(BOLGELER)
        tckn  = "".join([str(rng.randint(0, 9)) for _ in range(11)])
        rows.append({
            "TCKN":         tckn,
            "UretimSezonu": rng.choice([2025, 2026]),
            "Il":           bolge.il,
            "Ilce":         rng.choice(bolge.ilceler),
            "Urun1_Adi":    rng.choice(bolge.tipik_urunler),
            "Urun1_Alan":   round(rng.uniform(1.5, 28.0), 1),
            "Telefon":      _rastgele_telefon(rng),
        })

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Aşama 2 — ML veya manuel DSS ile işleme
# ---------------------------------------------------------------------------

def _proba_to_risk_skor(proba: float, rng: random.Random) -> tuple[float, str]:
    """Temerrüt olasılığını UI formatına çevirir: Tesvik_Skoru, Risk_Durumu."""
    if proba > 0.55:
        return round(rng.uniform(2.0, 4.5), 1), "Yüksek"
    if proba >= 0.30:
        return round(rng.uniform(5.0, 7.0), 1), "Orta"
    return round(rng.uniform(7.5, 9.8), 1), "Düşük"


def _onerilen_urun_bölge(il: str, mevcut_urun: str, rng: random.Random) -> str:
    """Bölgeye uygun, az su isteyen mantıklı öneri (ML ile birlikte kullanılır)."""
    secenekler = [u for u in list(SU_DAYANIKLI) + ["Ayçiçeği"] if u != mevcut_urun]
    return rng.choice(secenekler) if secenekler else "Buğday"


def process_cks_data(raw_df: pd.DataFrame) -> pd.DataFrame:
    """
    Ham ÇKS verisini alır; ML modeli ile temerrüt olasılığı tahmin edip
    Risk_Durumu ve Tesvik_Skoru üretir. Model yoksa manuel DSS kullanılır.

    Eklenen sütunlar: Onerilen_Urun | Tesvik_Skoru | Risk_Durumu
    """
    rng = random.Random()
    onerilen_urunler: list[str]   = []
    tesvik_skorlar:   list[float] = []
    risk_durumlari:   list[str]   = []

    use_ml = _ML_MODEL is not None and _ML_ENCODER is not None

    for _, row in raw_df.iterrows():
        if use_ml:
            try:
                X_row = pd.DataFrame(
                    [{
                        "Il": row["Il"],
                        "Urun1_Adi": row["Urun1_Adi"],
                        "Urun1_Alan": row["Urun1_Alan"],
                    }],
                    columns=["Il", "Urun1_Adi", "Urun1_Alan"],
                )
                X_enc = _ML_ENCODER.transform(X_row)
                # predict_proba: [P(sınıf 0), P(sınıf 1)]; sınıf 1 = temerrüt (batırdı)
                proba = _ML_MODEL.predict_proba(X_enc)[0, 1]
                skor, risk = _proba_to_risk_skor(proba, rng)
                oneri = _onerilen_urun_bölge(row["Il"], row["Urun1_Adi"], rng)
            except Exception:
                # Encoder bilinmeyen kategori vb. → manuel yedek
                su = _IL_SU_DURUMU.get(row["Il"], "NORMAL")
                oneri, kural = _onerilen(row["Urun1_Adi"], su, rng)
                skor, risk = _skor_ve_risk(kural, rng)
        else:
            su = _IL_SU_DURUMU.get(row["Il"], "NORMAL")
            oneri, kural = _onerilen(row["Urun1_Adi"], su, rng)
            skor, risk = _skor_ve_risk(kural, rng)

        onerilen_urunler.append(oneri)
        tesvik_skorlar.append(skor)
        risk_durumlari.append(risk)

    enriched = raw_df.copy()
    enriched["Onerilen_Urun"] = onerilen_urunler
    enriched["Tesvik_Skoru"]  = tesvik_skorlar
    enriched["Risk_Durumu"]   = risk_durumlari
    return enriched


# ---------------------------------------------------------------------------
# Ana pipeline — dışarıya açılan tek üretim fonksiyonu
# ---------------------------------------------------------------------------

def generate_mock_data() -> pd.DataFrame:
    """
    Ham ÇKS verisi üretir, DSS motorundan geçirir.
    Dönen DataFrame sütunları PostgreSQL prod şemasıyla birebir uyumludur.
    """
    raw = generate_raw_cks_data()
    return process_cks_data(raw)


# ---------------------------------------------------------------------------
# Tek başvuru — arayüzden gelen gerçek veriyi anlık AI analizinden geçirir
# ---------------------------------------------------------------------------

def process_single_application(data: dict) -> dict:
    """
    Bankacının arayüzden girdiği tek bir başvuruyu alır, process_cks_data
    mantığıyla (ML veya manuel DSS) Risk_Durumu, Tesvik_Skoru, Onerilen_Urun
    üretir. Dönen dict hem gelen alanları hem de bu üç alanı içerir.

    Beklenen giriş: TCKN, ad_soyad, Il, Urun1_Adi, Urun1_Alan (Ilce opsiyonel)
    """
    ilce = data.get("Ilce") or "Merkez"
    raw = pd.DataFrame([
        {
            "TCKN":         str(data["TCKN"]).strip(),
            "Il":           str(data["Il"]).strip(),
            "Ilce":         ilce,
            "Urun1_Adi":    str(data["Urun1_Adi"]).strip(),
            "Urun1_Alan":   float(data["Urun1_Alan"]),
        }
    ])
    enriched = process_cks_data(raw)
    row = enriched.iloc[0].to_dict()
    row["ad_soyad"] = data.get("ad_soyad", "").strip()
    return row


# ---------------------------------------------------------------------------
# ÇKS Analiz sayfası verisi
# ---------------------------------------------------------------------------

_AD_SOYAD_HAVUZU = [
    "Mehmet Yılmaz", "Ayşe Kaya", "Ali Demir", "Fatma Çelik", "Hasan Öztürk",
    "Emine Arslan", "Mustafa Şahin", "Zeynep Güneş", "İbrahim Koç", "Hatice Aydın",
    "Osman Polat", "Gülten Yıldız", "Kadir Çetin", "Selin Doğan", "Taner Özkan",
    "Meral Erdoğan", "Recep Kara", "Nurgül Özdemir", "Serhat Aktaş", "Dilek Bozkurt",
]


def _durum_from_score(score: int) -> str:
    if score > 80:
        return "Onaylı"
    if score >= 60:
        return "İncelemede"
    return "Riskli"


def generate_cks_analyses() -> dict:
    """
    Ana pipeline'dan 15 satır örnekler; ÇKS Analiz sayfası için DenizBank
    şemasına uygun farmer listesi ve hesaplanmış summary döndürür.

    Farmer sütunları: TCKN | Ad_Soyad | Il | Urun1_Adi | Urun1_Alan |
                      Kredi_Skoru | Durum
    """
    rng    = random.Random()
    df     = generate_mock_data()
    sample = df.sample(n=min(15, len(df)), random_state=rng.randint(0, 9999))

    isimler = rng.sample(_AD_SOYAD_HAVUZU, len(sample))
    farmers: list[dict] = []

    for (_, row), isim in zip(sample.iterrows(), isimler):
        # Tesvik_Skoru (0–10) → Kredi_Skoru (0–100) doğrusal dönüşüm
        kredi_skoru = min(100, max(0, round(row["Tesvik_Skoru"] * 10)))
        durum       = _durum_from_score(kredi_skoru)
        farmers.append({
            "TCKN":         row["TCKN"],
            "Ad_Soyad":     isim,
            "Il":           row["Il"],
            "Urun1_Adi":    row["Urun1_Adi"],
            "Urun1_Alan":   row["Urun1_Alan"],
            "Kredi_Skoru":  kredi_skoru,
            "Durum":        durum,
        })

    skorlar = [f["Kredi_Skoru"] for f in farmers]
    return {
        "summary": {
            "analiz_edilen":   6241 + rng.randint(-50, 50),
            "ortalama_skor":   round(sum(skorlar) / len(skorlar), 1),
            "tamamlanan_oran": rng.randint(85, 93),
        },
        "farmers": farmers,
    }


# ---------------------------------------------------------------------------
# Kredi Başvuruları — DenizBank şemasına uyumlu
# ---------------------------------------------------------------------------

_KREDI_BASVURU_ISIMLER = [
    "Osman Yıldız", "Zeynep Aktaş", "Kadir Şahin", "Gülay Kılıç", "Murat Doğan",
    "Selin Yılmaz", "Taner Çelik", "Hatice Arslan", "İbrahim Polat", "Nermin Güneş",
    "Recep Koç", "Dilek Aydın", "Serhat Demir", "Meral Kaya", "Ümit Öztürk",
    "Ayşe Çetin", "Mehmet Kara", "Fatma Doğan", "Hasan Şimşek", "Zühal Yıldırım",
]

_KREDI_ILLER = [
    "Konya", "İzmir", "Adana", "Samsun", "Şanlıurfa", "Bursa", "Diyarbakır",
    "Ankara", "Mersin", "Gaziantep", "Tekirdağ", "Manisa", "Kayseri", "Erzurum", "Ordu",
]

_KREDI_TURLERI = [
    "Traktör/Ekipman", "Tohum & Gübre", "Sera Kurulumu", "Sulama Sistemi",
    "Arazi Islahı", "Depolama", "Hayvancılık", "Tarımsal Araç",
]

_AY_TR = {
    1: "Oca", 2: "Şub", 3: "Mar", 4: "Nis", 5: "May", 6: "Haz",
    7: "Tem", 8: "Ağu", 9: "Eyl", 10: "Eki", 11: "Kas", 12: "Ara",
}


def generate_credit_applications() -> dict:
    """
    DenizBank kredi başvuru şemasına uyumlu 10–15 başvuru üretir.

    Her obje: Basvuru_No | TCKN | Ad_Soyad | Il | Kredi_Turu | Tutar | Tarih | Durum
    """
    rng = random.Random()
    n = rng.randint(10, 15)
    isimler = rng.sample(_KREDI_BASVURU_ISIMLER, min(n, len(_KREDI_BASVURU_ISIMLER)))
    base_no = rng.randint(300, 400)
    bugun = date.today()

    _DURUMLAR = ["Onaylandı", "Onaylandı", "Onaylandı", "Bekliyor", "Bekliyor", "Reddedildi"]

    applications: list[dict] = []
    for i in range(n):
        tckn = "".join(str(rng.randint(0, 9)) for _ in range(11))
        gun_oncesi = rng.randint(0, 25)
        tarih_obj = bugun - timedelta(days=gun_oncesi)
        tarih_str = f"{tarih_obj.day} {_AY_TR[tarih_obj.month]} {tarih_obj.year}"

        tur = rng.choice(_KREDI_TURLERI)
        tutar_raw = rng.randint(50_000, 750_000)
        # 5.000 TL katlarına yuvarla (opsiyonel, daha gerçekçi görünüm)
        tutar_raw = (tutar_raw // 5_000) * 5_000

        applications.append({
            "Basvuru_No": f"BA-{bugun.year}-{base_no + i:04d}",
            "TCKN":       tckn,
            "Ad_Soyad":   isimler[i % len(isimler)],
            "Il":         rng.choice(_KREDI_ILLER),
            "Kredi_Turu": tur,
            "Tutar":      tutar_raw,
            "Tarih":      tarih_str,
            "Durum":      rng.choice(_DURUMLAR),
        })

    onaylanan  = sum(1 for a in applications if a["Durum"] == "Onaylandı")
    bekleyen   = sum(1 for a in applications if a["Durum"] == "Bekliyor")
    reddedilen = sum(1 for a in applications if a["Durum"] == "Reddedildi")

    return {
        "summary": {
            "onaylanan":  onaylanan,
            "bekleyen":   bekleyen,
            "reddedilen": reddedilen,
        },
        "applications": applications,
    }


# ---------------------------------------------------------------------------
# Risk Haritası — il+ilçe bazında dinamik özet
# ---------------------------------------------------------------------------

_RISK_SIRASI: dict[str, int] = {"Yüksek": 3, "Orta": 2, "Düşük": 1}

_DEGISIM_RANGE: dict[str, tuple[int, int]] = {
    "Yüksek": (5, 22),
    "Orta":   (1,  8),
    "Düşük":  (1,  9),
}


def _risk_nedeni(il: str, dominant_urun: str, risk: str) -> str:
    su = _IL_SU_DURUMU.get(il, "NORMAL")
    if risk == "Yüksek":
        if su == "KISITLI":
            return "Aşırı Su Tüketimi" if dominant_urun in SU_ISTEYEN else "Kuraklık / Yeraltı Suyu"
        return "Don / Sel Riski" if su == "IYI" else "Sulama Baskısı"
    if risk == "Orta":
        if su == "KISITLI":
            return "Sulama Yetersizliği"
        return "Mevsimsel Don Riski" if su == "IYI" else "Toprak Tuzluluğu"
    # Düşük
    if su == "IYI":
        return "Fındık / Mısır Fiyat Dalgalanması"
    return "Fiyat Volatilitesi" if su == "NORMAL" else "Arazi Parçalanması"


def get_dynamic_risk_map(df: pd.DataFrame) -> dict:
    """50 satırlık zenginleştirilmiş DataFrame'den tutarlı risk haritası üretir."""
    rng = random.Random()

    high_count = int((df["Risk_Durumu"] == "Yüksek").sum())
    mid_count  = int((df["Risk_Durumu"] == "Orta").sum())
    low_count  = int((df["Risk_Durumu"] == "Düşük").sum())

    total_affected = (
        high_count * rng.randint(380, 520)
        + mid_count  * rng.randint(180, 280)
        + low_count  * rng.randint(60,  130)
    )

    regions: list[dict] = []
    for (il, ilce), grp in df.groupby(["Il", "Ilce"]):
        n = len(grp)

        counts: pd.Series = grp["Risk_Durumu"].value_counts()
        max_c  = counts.max()
        tied   = [r for r in counts[counts == max_c].index]
        dominant_risk: str = max(tied, key=lambda r: _RISK_SIRASI.get(r, 0))

        dominant_urun: str = grp["Urun1_Adi"].value_counts().index[0]
        neden = _risk_nedeni(il, dominant_urun, dominant_risk)

        carpan = {"Yüksek": (350, 500), "Orta": (160, 260), "Düşük": (50, 120)}
        lo, hi = carpan.get(dominant_risk, (100, 200))
        etkilenen = n * rng.randint(lo, hi)

        lo_pct, hi_pct = _DEGISIM_RANGE[dominant_risk]
        pct     = rng.randint(lo_pct, hi_pct)
        degisim = f"+{pct}%" if dominant_risk in ("Yüksek", "Orta") else f"-{pct}%"

        regions.append({
            "bolge":            f"{il} / {ilce}",
            "risk_seviyesi":    dominant_risk,
            "risk_nedeni":      neden,
            "etkilenen_ciftci": etkilenen,
            "degisim":          degisim,
        })

    _SIRA = {"Yüksek": 0, "Orta": 1, "Düşük": 2}
    regions.sort(key=lambda r: (_SIRA[r["risk_seviyesi"]], -r["etkilenen_ciftci"]))

    return {
        "summary": {
            "high_risk_count":   high_count,
            "medium_risk_count": mid_count,
            "low_risk_count":    low_count,
            "total_affected":    total_affected,
        },
        "regions": regions,
    }


# ---------------------------------------------------------------------------
# Dashboard haritası — sadece tabloda (recommendations) geçen iller
# ---------------------------------------------------------------------------

def get_map_data(df: pd.DataFrame) -> list[dict]:
    """
    Sadece 50 satırlık recommendations (DataFrame) içinde geçen illeri döner.
    Her il için o ildeki satırlarda en çok tekrar eden Risk_Durumu (dominant) hesaplanır.
    Tabloda hiç geçmeyen iller JSON'a eklenmez — haritada gri kalır.
    """
    results: list[dict] = []
    for sehir in df["Il"].unique().tolist():
        alt = df[df["Il"] == sehir]
        counts: pd.Series = alt["Risk_Durumu"].value_counts()
        max_c = counts.max()
        tied = [r for r in counts[counts == max_c].index]
        risk = max(tied, key=lambda r: _RISK_SIRASI.get(r, 0))
        results.append({"city": sehir, "risk_durumu": risk})
    return results


# ---------------------------------------------------------------------------
# Trend verisi — yıllar arası üretim miktarları
# ---------------------------------------------------------------------------

def get_crop_trends() -> list[dict]:
    """
    Su-isteyen ürünler (Mısır, Pamuk) artıyor; dayanıklılar (Buğday, Arpa) azalıyor.
    Her çağrıda ±400 ton sapmayla grafik dalgalanır; trend yönü korunur.
    """
    bases = [
        {"year": "2021", "Mısır": 4200, "Buğday": 7800, "Arpa": 3900, "Ayçiçeği": 2400, "Pamuk": 1800},
        {"year": "2022", "Mısır": 4800, "Buğday": 7200, "Arpa": 3600, "Ayçiçeği": 2550, "Pamuk": 2200},
        {"year": "2023", "Mısır": 5400, "Buğday": 6700, "Arpa": 3200, "Ayçiçeği": 2650, "Pamuk": 2700},
        {"year": "2024", "Mısır": 5900, "Buğday": 6100, "Arpa": 2900, "Ayçiçeği": 2750, "Pamuk": 3100},
        {"year": "2025", "Mısır": 6500, "Buğday": 5600, "Arpa": 2500, "Ayçiçeği": 2800, "Pamuk": 3600},
    ]
    result = []
    for row in bases:
        noisy = {"year": row["year"]}
        for urun in ["Mısır", "Buğday", "Arpa", "Ayçiçeği", "Pamuk"]:
            noisy[urun] = max(100, row[urun] + random.randint(-400, 400))
        result.append(noisy)
    return result
