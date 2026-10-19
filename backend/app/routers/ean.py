import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..catalog import EDIFICIOS
from ..db import get_db
from ..models import EanCarga, EanLectura

router = APIRouter(prefix="/ean", tags=["ean"])
Edificio = Literal["todos", "legacy", "nogal"]


def _lecturas(db: Session, edificio: str, anio: int, meses: list[int] | None = None):
    q = select(EanLectura).where(EanLectura.year == anio).order_by(EanLectura.month, EanLectura.building)
    if edificio != "todos":
        q = q.where(EanLectura.building == edificio)
    if meses:
        q = q.where(EanLectura.month.in_(meses))
    return db.scalars(q).all()


@router.get("/mensual")
def mensual(edificio: Edificio = "todos", anio: int = 2025, db: Session = Depends(get_db)):
    items = [{"mes": r.month, "edificio": r.building, "consumo_kwh": r.consumo_kwh, "generacion_kwh": r.generacion_kwh}
             for r in _lecturas(db, edificio, anio)]
    return {"unit": "kWh", "anio": anio, "items": items}


@router.get("/cargas")
def cargas(edificio: Edificio = "todos", anio: int = 2025, db: Session = Depends(get_db)):
    """Con 'todos', pondera el porcentaje de cada edificio por su consumo anual."""
    cons: dict[str, float] = {}
    for r in _lecturas(db, "todos", anio):
        cons[r.building] = cons.get(r.building, 0) + r.consumo_kwh
    rows = db.scalars(select(EanCarga).order_by(EanCarga.id)).all()
    if edificio != "todos":
        rows = [r for r in rows if r.building == edificio]
        weights = {edificio: 1.0}
    else:
        weights = cons
    total_w = sum(weights.values()) or 1
    acc: dict[str, float] = {}
    for r in rows:
        acc[r.carga] = acc.get(r.carga, 0) + r.pct * weights.get(r.building, 0) / total_w
    return {"unit": "%", "items": [{"carga": k, "pct": round(v, 1)} for k, v in acc.items()]}


@router.get("/export.csv")
def export_csv(edificio: Edificio = "todos", anio: int = 2025, meses: list[int] | None = Query(None), db: Session = Depends(get_db)):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["anio", "mes", "edificio", "consumo_kwh", "generacion_kwh", "pct_solar"])
    for r in _lecturas(db, edificio, anio, meses):
        w.writerow([r.year, r.month, EDIFICIOS[r.building], r.consumo_kwh, r.generacion_kwh,
                    round(r.generacion_kwh / r.consumo_kwh * 100, 1)])
    return Response("\ufeff" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="ean_{edificio}_{anio}.csv"'})
