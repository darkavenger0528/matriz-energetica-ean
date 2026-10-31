from fastapi import APIRouter

from .. import catalog as c
from ..config import settings

router = APIRouter(tags=["meta"])


def _opts(d):
    return [{"value": k, "label": v} for k, v in d.items()]


@router.get("/meta")
def meta():
    return {
        "regiones": _opts(c.REGIONES),
        "departamentos": [{"value": k, "label": n, "region": r} for k, (n, r) in c.DEPARTAMENTOS.items()],
        "municipios": [{"value": k, "label": n, "departamento": d} for k, (n, d) in c.MUNICIPIOS.items()],
        "recursos": [{"value": k, "label": v["label"], "color": v["color"], "subtipos": _opts(v["subtipos"])} for k, v in c.RECURSOS.items()],
        "potenciales": [{"value": k, "label": v["label"], "color": v["color"]} for k, v in c.POTENCIALES.items()],
        "edificios": _opts(c.EDIFICIOS),
        "periodo": {**c.PERIODO, "seleccionable": settings.period_selectable},
        "economia": {"tarifa_cop_kwh": settings.tarifa_cop_kwh, "factor_emision_kg_kwh": settings.factor_emision_kg_kwh,
                     "fuente_factor": "UPME, factor de emisión de la red para inventarios de GEI (2024)"},
    }
