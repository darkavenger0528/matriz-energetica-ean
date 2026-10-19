import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

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
    assert [e["value"] for e in m["edificios"]] == ["legacy", "nogal"]


def test_agregado_por_recurso(client):
    r = client.get("/api/v1/matriz/agregado", params={"agrupar": "recurso"}).json()
    assert {i["key"] for i in r["items"]} == {"solar", "eolica", "geo"}
    assert all(i["value"] > 0 for i in r["items"])


def test_filtro_region_y_potenciales(client):
    r = client.get("/api/v1/matriz/agregado", params={"agrupar": "potencial", "potencial": ["teorico", "tecnico"], "level": "region", "territorio": "caribe"}).json()
    assert {i["key"] for i in r["items"]} == {"teorico", "tecnico"}


def test_tendencia_cubre_periodo(client):
    r = client.get("/api/v1/matriz/tendencia", params={"desde": "2024-01", "hasta": "2024-06", "agrupar": "recurso"}).json()
    assert len(r["periods"]) == 6 and all(len(s["values"]) == 6 for s in r["series"])


def test_csv(client):
    r = client.get("/api/v1/matriz/export.csv")
    assert r.headers["content-type"].startswith("text/csv")
    assert r.text.splitlines()[0].endswith("periodo,recurso,valor_gwh")


def test_ean_legacy_mas_nogal_igual_total(client):
    tot = sum(i["consumo_kwh"] for i in client.get("/api/v1/ean/mensual").json()["items"])
    parts = sum(i["consumo_kwh"] for b in ("legacy", "nogal") for i in client.get("/api/v1/ean/mensual", params={"edificio": b}).json()["items"])
    assert tot == parts


def test_ean_cargas_suman_100(client):
    for b in ("todos", "legacy", "nogal"):
        items = client.get("/api/v1/ean/cargas", params={"edificio": b}).json()["items"]
        assert abs(sum(i["pct"] for i in items) - 100) < 0.5
