from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from mock_data import (
    generate_mock_data,
    get_map_data,
    get_crop_trends,
    generate_cks_analyses,
    get_dynamic_risk_map,
    generate_credit_applications,
)

app = FastAPI(title="Tarımsal Kredi API")

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


@app.get("/api/cks-analyses")
def get_cks_analyses():
    return generate_cks_analyses()


@app.get("/api/risk-map")
def get_risk_map():
    df = generate_mock_data()
    return get_dynamic_risk_map(df)


@app.get("/api/credit-applications")
def get_credit_applications():
    return generate_credit_applications()
