import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["PERIOD_SELECTABLE"] = "true"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_meta(client):
    m = client.get("/api/v1/meta").json()
    assert len(m["regiones"]) == 5 and len(m["recursos"]) == 3
    assert m["municipios"][0]["departamento"] and m["departamentos"][0]["region"]
    assert m["economia"]["factor_emision_kg_kwh"] == 0.22
    assert [e["value"] for e in m["edificios"]] == ["legacy", "nogal"]


def test_series_por_recurso_trae_teorico_y_util(client):
    r = client.get("/api/v1/matriz/series").json()
    assert r["grupo"] == "recurso" and len(r["periods"]) == 36
    assert {s["key"] for s in r["teorico"]} == {"solar", "eolica", "geo"} == {s["key"] for s in r["util"]}


def test_agrupa_un_nivel_mas_abajo(client):
    r = client.get("/api/v1/matriz/resumen", params={"recurso": "solar", "region": "caribe"}).json()
    assert r["grupo"] == "departamento" and {i["key"] for i in r["items"]} == {"guajira", "cesar", "atlantico"}
    r = client.get("/api/v1/matriz/resumen", params={"recurso": "solar", "departamento": "guajira"}).json()
    assert r["grupo"] == "municipio" and len(r["items"]) == 2


def test_util_menor_que_teorico(client):
    t = client.get("/api/v1/matriz/resumen").json()["total"]
    assert 0 < t["util"] < t["teorico"] and 0 < t["pct"] < 100


def test_periodo_elegible_solo_si_esta_habilitado(client):
    r = client.get("/api/v1/matriz/series", params={"desde": "2024-01", "hasta": "2024-06"}).json()
    assert len(r["periods"]) == 6


def test_csv(client):
    r = client.get("/api/v1/matriz/export.csv")
    assert r.headers["content-type"].startswith("text/csv")
    assert r.text.splitlines()[0].endswith("periodo,recurso,potencial_teorico_gwh,energia_util_gwh")


def test_ean_legacy_mas_nogal_igual_total(client):
    tot = sum(i["consumo_kwh"] for i in client.get("/api/v1/ean/mensual").json()["items"])
    parts = sum(i["consumo_kwh"] for b in ("legacy", "nogal") for i in client.get("/api/v1/ean/mensual", params={"edificio": b}).json()["items"])
    assert tot == parts


def test_ean_cargas_suman_100(client):
    for b in ("todos", "legacy", "nogal"):
        items = client.get("/api/v1/ean/cargas", params={"edificio": b}).json()["items"]
        assert abs(sum(i["pct"] for i in items) - 100) < 0.5


def test_ean_csv_incluye_ahorro_y_emisiones(client):
    r = client.get("/api/v1/ean/export.csv", params={"edificio": "legacy", "tarifa": 1000, "factor": 0.2, "meses": [1]})
    head, row = r.text.splitlines()[:2]
    assert "ahorro_cop" in head and "emisiones_evitadas_kgco2e" in head
    cols = row.split(",")
    gen = float(cols[4])
    assert float(cols[7]) == round(gen * 1000) and abs(float(cols[9]) - round(gen * 0.2, 1)) < 0.11
