"""
Makine Öğrenmesi Eğitim Boru Hattı — Kredi Temerrüt Tahmini
============================================================
Bankanın şemasına uygun tarihsel veri üretir, RandomForest ile eğitir.
Hedef: Kredi_Temerrut (0: Ödedi, 1: Batırdı)
Model ve encoder joblib ile model.pkl / encoder.pkl olarak kaydedilir.
"""

import random
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder

# ---------------------------------------------------------------------------
# Tarihsel veri üretimi — banka şeması + hedef
# ---------------------------------------------------------------------------

_ILLER = [
    "Adana", "Ankara", "Konya", "İzmir", "Samsun", "Şanlıurfa", "Bursa",
    "Kayseri", "Eskişehir", "Gaziantep", "Mersin", "Diyarbakır", "Manisa",
    "Kocaeli", "Antalya", "Trabzon", "Malatya", "Erzurum", "Balıkesir",
]

_URUNLER = [
    "Mısır", "Buğday", "Pamuk", "Arpa", "Ayçiçeği", "Şeker Pancarı",
    "Mercimek", "Yonca", "Fındık", "Nohut", "Patates", "Soya Fasulyesi", "İncir",
]

# (Il, Urun1_Adi) → temerrüt olasılığı (modelin öğrenmesi gereken gizli kural)
_TEMERRUT_KURALLARI: dict[tuple[str, str], float] = {
    ("Konya", "Mısır"):        0.70,   # Kurak bölge + su isteyen → yüksek batırma
    ("Konya", "Şeker Pancarı"): 0.65,
    ("Konya", "Yonca"):        0.60,
    ("Adana", "Pamuk"):        0.10,   # Uygun bölge + uygun ürün → düşük batırma
    ("Adana", "Buğday"):       0.12,
    ("İzmir", "Pamuk"):        0.15,
    ("İzmir", "İncir"):        0.08,
    ("Şanlıurfa", "Pamuk"):    0.18,
    ("Şanlıurfa", "Mısır"):    0.55,   # Kurak, mısır riskli
    ("Samsun", "Fındık"):      0.08,
    ("Samsun", "Mısır"):      0.20,
    ("Erzurum", "Arpa"):       0.15,
    ("Erzurum", "Mısır"):      0.75,   # Doğu + mısır çok riskli
    ("Ankara", "Buğday"):      0.18,
    ("Ankara", "Mısır"):       0.58,
    ("Gaziantep", "Pamuk"):    0.14,
    ("Gaziantep", "Arpa"):     0.22,
    ("Eskişehir", "Şeker Pancarı"): 0.45,
    ("Eskişehir", "Buğday"):   0.18,
}
# Varsayılan temerrüt olasılığı (kural dışı kombinasyonlar)
_DEFAULT_TEMERRUT = 0.35


def _temerrut_olasiligi(il: str, urun: str) -> float:
    return _TEMERRUT_KURALLARI.get((il, urun), _DEFAULT_TEMERRUT)


def generate_historical_data(n: int = 5000) -> pd.DataFrame:
    """
    Banka şemasına uygun n satırlık tarihsel veri üretir.
    Sütunlar: Il, Urun1_Adi, Urun1_Alan, Kredi_Temerrut (0: Ödedi, 1: Batırdı).
    Temerrüt, il–ürün kurallarına göre olasılıksal atanır.
    """
    rng = random.Random(42)
    rows: list[dict] = []
    for _ in range(n):
        il   = rng.choice(_ILLER)
        urun = rng.choice(_URUNLER)
        alan = round(rng.uniform(1.0, 35.0), 1)
        p    = _temerrut_olasiligi(il, urun)
        temerrut = 1 if rng.random() < p else 0
        rows.append({
            "Il":          il,
            "Urun1_Adi":   urun,
            "Urun1_Alan":  alan,
            "Kredi_Temerrut": temerrut,
        })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Eğitim boru hattı
# ---------------------------------------------------------------------------

def main() -> None:
    print("Tarihsel veri üretiliyor (n=5000)...")
    df = generate_historical_data(5000)

    X = df[["Il", "Urun1_Adi", "Urun1_Alan"]].copy()
    y = df["Kredi_Temerrut"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Kategorik sütunları OneHotEncoder ile sayısallaştır
    ct = ColumnTransformer(
        [
            ("onehot", OneHotEncoder(drop="first", sparse_output=False), ["Il", "Urun1_Adi"]),
            ("passthrough", "passthrough", ["Urun1_Alan"]),
        ],
        remainder="drop",
    )
    X_train_enc = ct.fit_transform(X_train)
    X_test_enc  = ct.transform(X_test)

    print("RandomForestClassifier eğitiliyor...")
    model = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42)
    model.fit(X_train_enc, y_train)

    y_pred = model.predict(X_test_enc)
    acc = accuracy_score(y_test, y_pred)
    print(f"Test doğruluk oranı (Accuracy): {acc:.4f}")

    backend_dir = Path(__file__).resolve().parent
    model_path  = backend_dir / "model.pkl"
    encoder_path = backend_dir / "encoder.pkl"
    joblib.dump(model, model_path)
    joblib.dump(ct, encoder_path)
    print(f"Model kaydedildi: {model_path}")
    print(f"Encoder kaydedildi: {encoder_path}")


if __name__ == "__main__":
    main()
