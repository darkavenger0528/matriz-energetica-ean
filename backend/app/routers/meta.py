from fastapi import APIRouter

from .. import catalog as c

router = APIRouter(tags=["meta"])


def _opts(d):
    return [{"value": k, "label": v} for k, v in d.items()]


@router.get("/meta")
def meta():
    return {
        "regiones": _opts(c.REGIONES),
        "departamentos": [{"value": k, "label": f"{n} ({c.REGIONES[r]})"} for k, (n, r) in c.DEPARTAMENTOS.items()],
        "municipios": [{"value": k, "label": n} for k, (n, _) in c.MUNICIPIOS.items()],
        "recursos": [{"value": k, "label": v["label"], "color": v["color"], "subtipos": _opts(v["subtipos"])} for k, v in c.RECURSOS.items()],
        "potenciales": [{"value": k, "label": v["label"], "color": v["color"]} for k, v in c.POTENCIALES.items()],
        "edificios": _opts(c.EDIFICIOS),
        "periodo": c.PERIODO,
    }
