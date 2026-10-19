"""Exporta los datos de la BD a un JSON estático para la demo en GitHub Pages.

Uso:  python backend/scripts/export_static.py frontend/public/data
Si DATABASE_URL apunta a una BD real, exporta esos datos; si no, usa una SQLite temporal con el seed.
"""
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", f"sqlite:///{tempfile.mkdtemp()}/export.db")

from sqlalchemy import select  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import EanCarga, EanLectura, Potencial  # noqa: E402
from app.routers.matriz import LEVEL_LABELS  # noqa: E402
from app.routers.meta import meta  # noqa: E402
from app.seed import seed  # noqa: E402
from app import catalog as c  # noqa: E402


def main(out_dir: str) -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
        rows = [[p.period, p.region, p.departamento, p.municipio, p.resource, p.subtype, p.potential, p.value]
                for p in db.scalars(select(Potencial))]
        lect = [[r.year, r.month, r.building, r.consumo_kwh, r.generacion_kwh]
                for r in db.scalars(select(EanLectura).order_by(EanLectura.month, EanLectura.building))]
        cargas = [[r.building, r.carga, r.pct] for r in db.scalars(select(EanCarga).order_by(EanCarga.id))]
    data = {
        "meta": meta(),
        "labels": {**LEVEL_LABELS, "recurso": {k: v["label"] for k, v in c.RECURSOS.items()},
                   "potencial": {k: v["label"] for k, v in c.POTENCIALES.items()}},
        "rows": rows,
        "ean": {"lecturas": lect, "cargas": cargas, "edificios": c.EDIFICIOS},
    }
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "data.json").write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"OK: {len(rows)} filas -> {out / 'data.json'}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "frontend/public/data")
