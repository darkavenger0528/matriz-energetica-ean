"""Datos sintéticos deterministas (misma lógica del boceto). Sustituir por ETL real (UPME / XM / medidores EAN)."""
import hashlib
import math

from sqlalchemy import func, insert, select
from sqlalchemy.orm import Session

from .catalog import DEPARTAMENTOS, MUNICIPIOS, RECURSOS
from .models import EanCarga, EanLectura, Potencial

BASE = {"solar": 900, "eolica": 650, "geo": 220}
POT_FACTOR = {"teorico": 1, "tecnico": 0.55, "instalado": 0.12}
PHASE = {"solar": 0, "eolica": 2.1, "geo": 0.4}
CONSUMO = [205e3, 198e3, 210e3, 215e3, 208e3, 212e3, 220e3, 218e3, 206e3, 209e3, 215e3, 225e3]
GENERACION = [38e3, 35e3, 33e3, 30e3, 29e3, 34e3, 37e3, 36e3, 31e3, 30e3, 32e3, 40e3]
CARGAS = {
    "legacy": {"Iluminación": 30, "Aires acondicionados": 24, "Ascensores": 20, "Equipos de laboratorio": 18, "Otros (tomacorrientes, cómputo)": 8},
    "nogal": {"Iluminación": 38, "Aires acondicionados": 20, "Ascensores": 16, "Equipos de laboratorio": 14, "Otros (tomacorrientes, cómputo)": 12},
}


def _h(s: str) -> float:
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def _value(res, sub, pot, muni, year, month) -> float:
    seasonal = 1 + 0.22 * math.sin(month / 12 * 2 * math.pi + PHASE[res])
    trend = 1 + (year - 2023) * 0.06
    scale = 0.5 + _h(f"scale|{muni}")
    noise = 0.85 + _h(f"{muni}|{res}|{sub}|{pot}|{year}|{month}") * 0.3
    return round(BASE[res] * POT_FACTOR[pot] * seasonal * trend * scale * noise, 2)


def seed(db: Session) -> None:
    if not db.scalar(select(func.count()).select_from(Potencial)):
        rows = []
        for muni, (_, dep) in MUNICIPIOS.items():
            reg = DEPARTAMENTOS[dep][1]
            for res, meta in RECURSOS.items():
                for sub in meta["subtipos"]:
                    for pot in POT_FACTOR:
                        for year in (2023, 2024, 2025):
                            for month in range(1, 13):
                                rows.append(dict(period=year * 100 + month, region=reg, departamento=dep, municipio=muni,
                                                 resource=res, subtype=sub, potential=pot,
                                                 value=_value(res, sub, pot, muni, year, month)))
        db.execute(insert(Potencial), rows)

    if not db.scalar(select(func.count()).select_from(EanLectura)):
        lect = []
        for m in range(12):
            share_c = 0.58 + (_h(f"c{m}") - 0.5) * 0.04
            share_g = 0.62 + (_h(f"g{m}") - 0.5) * 0.04
            for b, sc, sg in (("legacy", share_c, share_g), ("nogal", 1 - share_c, 1 - share_g)):
                lect.append(dict(year=2025, month=m + 1, building=b,
                                 consumo_kwh=round(CONSUMO[m] * sc), generacion_kwh=round(GENERACION[m] * sg)))
        db.execute(insert(EanLectura), lect)
        db.execute(insert(EanCarga), [dict(building=b, carga=c, pct=p) for b, d in CARGAS.items() for c, p in d.items()])
    db.commit()
