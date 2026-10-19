import csv
import io
from dataclasses import dataclass
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import catalog as c
from ..db import get_db
from ..models import Potencial as P

router = APIRouter(prefix="/matriz", tags=["matriz"])

Level = Literal["region", "departamento", "municipio"]
LEVEL_COL = {"region": P.region, "departamento": P.departamento, "municipio": P.municipio}
LEVEL_LABELS = {
    "region": c.REGIONES,
    "departamento": {k: v[0] for k, v in c.DEPARTAMENTOS.items()},
    "municipio": {k: v[0] for k, v in c.MUNICIPIOS.items()},
}
YM = r"^\d{4}-(0[1-9]|1[0-2])$"


@dataclass
class Filters:
    level: str
    territorio: str | None
    recurso: str
    subtipo: str
    potencial: list[str]
    d: int
    h: int
    agrupar: str


def filters(
    level: Level = "region",
    territorio: str | None = None,
    recurso: str = "todos",
    subtipo: str = "todas",
    potencial: list[str] = Query(["tecnico"]),
    desde: str = Query(c.PERIODO["desde"], pattern=YM),
    hasta: str = Query(c.PERIODO["hasta"], pattern=YM),
    agrupar: Literal["recurso", "potencial", "territorio"] = "recurso",
) -> Filters:
    d, h = int(desde.replace("-", "")), int(hasta.replace("-", ""))
    return Filters(level, territorio or None, recurso, subtipo, potencial, min(d, h), max(d, h), agrupar)


def _conds(f: Filters):
    cs = [P.period.between(f.d, f.h), P.potential.in_(f.potencial)]
    if f.territorio:
        cs.append(LEVEL_COL[f.level] == f.territorio)
    if f.recurso != "todos":
        cs.append(P.resource == f.recurso)
        if f.subtipo != "todas":
            cs.append(P.subtype == f.subtipo)
    return cs


def _group(f: Filters):
    col = {"recurso": P.resource, "potencial": P.potential, "territorio": LEVEL_COL[f.level]}[f.agrupar]
    labels = {"recurso": {k: v["label"] for k, v in c.RECURSOS.items()},
              "potencial": {k: v["label"] for k, v in c.POTENCIALES.items()},
              "territorio": LEVEL_LABELS[f.level]}[f.agrupar]
    return col, labels


def _periods(f: Filters):
    out, y, m = [], f.d // 100, f.d % 100
    while y * 100 + m <= f.h:
        out.append(y * 100 + m)
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _fmt(p: int) -> str:
    return f"{p // 100}-{p % 100:02d}"


@router.get("/agregado")
def agregado(f: Filters = Depends(filters), db: Session = Depends(get_db)):
    col, labels = _group(f)
    rows = db.execute(select(col, func.sum(P.value)).where(*_conds(f)).group_by(col)).all()
    order = list(labels)
    items = [{"key": k, "label": labels.get(k, k), "value": round(v, 1)} for k, v in rows]
    items.sort(key=lambda i: order.index(i["key"]) if i["key"] in order else 999)
    return {"unit": "GWh", "items": items}


@router.get("/tendencia")
def tendencia(f: Filters = Depends(filters), db: Session = Depends(get_db)):
    col, labels = _group(f)
    rows = db.execute(select(col, P.period, func.sum(P.value)).where(*_conds(f)).group_by(col, P.period)).all()
    periods = _periods(f)
    data: dict[str, dict[int, float]] = {}
    for k, p, v in rows:
        data.setdefault(k, {})[p] = v
    series = [{"key": k, "label": labels.get(k, k), "values": [round(data[k].get(p, 0), 1) for p in periods]} for k in labels if k in data]
    return {"unit": "GWh", "periods": [_fmt(p) for p in periods], "series": series}


@router.get("/export.csv")
def export_csv(f: Filters = Depends(filters), db: Session = Depends(get_db)):
    col, labels = _group(f)
    rows = db.execute(select(P.period, col, func.sum(P.value)).where(*_conds(f)).group_by(P.period, col).order_by(P.period, col)).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["periodo", f.agrupar, "valor_gwh"])
    for p, k, v in rows:
        w.writerow([_fmt(p), labels.get(k, k), round(v, 2)])
    return Response("\ufeff" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="matriz_{f.agrupar}_{_fmt(f.d)}_{_fmt(f.h)}.csv"'})
