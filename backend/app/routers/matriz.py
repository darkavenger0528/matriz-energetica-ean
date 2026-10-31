import csv
import io
from dataclasses import dataclass

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import catalog as c
from ..config import settings
from ..db import get_db
from ..models import Potencial as P

router = APIRouter(prefix="/matriz", tags=["matriz"])

TEORICO, UTIL = "teorico", "tecnico"  # "energía útil" = potencial técnico en los datos de ejemplo
LEVEL_COL = {"region": P.region, "departamento": P.departamento, "municipio": P.municipio}
LEVEL_LABELS = {
    "region": c.REGIONES,
    "departamento": {k: v[0] for k, v in c.DEPARTAMENTOS.items()},
    "municipio": {k: v[0] for k, v in c.MUNICIPIOS.items()},
}
YM = r"^\d{4}-(0[1-9]|1[0-2])$"


@dataclass
class Filters:
    region: str | None
    departamento: str | None
    municipio: str | None
    recurso: str
    subtipo: str
    d: int
    h: int


def filters(
    region: str | None = None,
    departamento: str | None = None,
    municipio: str | None = None,
    recurso: str = "todos",
    subtipo: str = "todas",
    desde: str | None = Query(None, pattern=YM),
    hasta: str | None = Query(None, pattern=YM),
) -> Filters:
    d, h = int(c.PERIODO["desde"].replace("-", "")), int(c.PERIODO["hasta"].replace("-", ""))
    if settings.period_selectable and desde and hasta:  # si no es elegible se usa la serie completa
        d, h = sorted((int(desde.replace("-", "")), int(hasta.replace("-", ""))))
    return Filters(region or None, departamento or None, municipio or None, recurso, subtipo, d, h)


def _conds(f: Filters):
    cs = [P.period.between(f.d, f.h), P.potential.in_([TEORICO, UTIL])]
    for col, v in ((P.region, f.region), (P.departamento, f.departamento), (P.municipio, f.municipio)):
        if v:
            cs.append(col == v)
    if f.recurso != "todos":
        cs.append(P.resource == f.recurso)
        if f.subtipo != "todas":
            cs.append(P.subtype == f.subtipo)
    return cs


def _group(f: Filters):
    """Con 'todos' los recursos se agrupa por recurso; con un recurso, por el nivel territorial inmediatamente inferior al elegido."""
    if f.recurso == "todos":
        return P.resource, {k: v["label"] for k, v in c.RECURSOS.items()}, "recurso"
    level = "municipio" if (f.municipio or f.departamento) else "departamento" if f.region else "region"
    return LEVEL_COL[level], LEVEL_LABELS[level], level


def _periods(f: Filters):
    out, y, m = [], f.d // 100, f.d % 100
    while y * 100 + m <= f.h:
        out.append(y * 100 + m)
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _fmt(p: int) -> str:
    return f"{p // 100}-{p % 100:02d}"


@router.get("/series")
def series(f: Filters = Depends(filters), db: Session = Depends(get_db)):
    """Serie mensual del potencial teórico y de la energía útil, por grupo."""
    col, labels, grupo = _group(f)
    rows = db.execute(select(col, P.potential, P.period, func.sum(P.value)).where(*_conds(f)).group_by(col, P.potential, P.period)).all()
    periods = _periods(f)
    data: dict = {}
    for k, pot, per, v in rows:
        data.setdefault(pot, {}).setdefault(k, {})[per] = v

    def build(pot):
        return [{"key": k, "label": labels[k], "values": [round(data.get(pot, {}).get(k, {}).get(p, 0), 1) for p in periods]}
                for k in labels if k in data.get(pot, {})]

    return {"unit": "GWh", "grupo": grupo, "periods": [_fmt(p) for p in periods], "teorico": build(TEORICO), "util": build(UTIL)}


@router.get("/resumen")
def resumen(f: Filters = Depends(filters), db: Session = Depends(get_db)):
    col, labels, grupo = _group(f)
    rows = db.execute(select(col, P.potential, func.sum(P.value)).where(*_conds(f)).group_by(col, P.potential)).all()
    acc: dict = {}
    for k, pot, v in rows:
        acc.setdefault(k, {})[pot] = v
    items = []
    for k in labels:
        if k in acc:
            t, u = acc[k].get(TEORICO, 0), acc[k].get(UTIL, 0)
            items.append({"key": k, "label": labels[k], "teorico": round(t, 1), "util": round(u, 1), "pct": round(u / t * 100, 1) if t else 0})
    tt, tu = sum(i["teorico"] for i in items), sum(i["util"] for i in items)
    return {"unit": "GWh", "grupo": grupo, "items": items,
            "total": {"teorico": round(tt, 1), "util": round(tu, 1), "pct": round(tu / tt * 100, 1) if tt else 0}}


@router.get("/export.csv")
def export_csv(f: Filters = Depends(filters), db: Session = Depends(get_db)):
    col, labels, grupo = _group(f)
    rows = db.execute(select(P.period, col, P.potential, func.sum(P.value)).where(*_conds(f)).group_by(P.period, col, P.potential)).all()
    acc: dict = {}
    for per, k, pot, v in rows:
        acc.setdefault((per, k), {})[pot] = v
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["periodo", grupo, "potencial_teorico_gwh", "energia_util_gwh"])
    for (per, k) in sorted(acc, key=lambda x: (x[0], x[1])):
        w.writerow([_fmt(per), labels.get(k, k), round(acc[(per, k)].get(TEORICO, 0), 2), round(acc[(per, k)].get(UTIL, 0), 2)])
    return Response("\ufeff" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="matriz_{grupo}_{_fmt(f.d)}_{_fmt(f.h)}.csv"'})
