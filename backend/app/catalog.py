"""Catálogos estáticos (territorios, recursos, edificios). Fuente única para API y seed."""

REGIONES = {"caribe": "Caribe", "andina": "Andina", "pacifico": "Pacífico", "orinoquia": "Orinoquía", "amazonia": "Amazonía"}

DEPARTAMENTOS = {
    "guajira": ("La Guajira", "caribe"), "cesar": ("Cesar", "caribe"), "atlantico": ("Atlántico", "caribe"),
    "cundinamarca": ("Cundinamarca", "andina"), "boyaca": ("Boyacá", "andina"), "antioquia": ("Antioquia", "andina"),
    "choco": ("Chocó", "pacifico"), "valle": ("Valle del Cauca", "pacifico"), "narino": ("Nariño", "pacifico"),
    "meta": ("Meta", "orinoquia"), "casanare": ("Casanare", "orinoquia"),
    "caqueta": ("Caquetá", "amazonia"), "putumayo": ("Putumayo", "amazonia"),
}

# Placeholder: reemplazar por el listado DIVIPOLA real al cargar datos oficiales.
MUNICIPIOS = {
    f"{k}-{n}": (f"{name} · Municipio {n.upper()}", k)
    for k, (name, _) in DEPARTAMENTOS.items() for n in ("a", "b")
}

RECURSOS = {
    "solar": {"label": "Solar", "color": "#dfdf3f", "subtipos": {"fv": "Fotovoltaico", "termico": "Térmico"}},
    "eolica": {"label": "Eólica", "color": "#00c0b3", "subtipos": {"horizontal": "Eje horizontal", "vertical": "Eje vertical"}},
    "geo": {"label": "Geotermia", "color": "#533278", "subtipos": {"electricidad": "Electricidad", "comunidades": "Comunidades energéticas"}},
}

POTENCIALES = {
    "teorico": {"label": "Teórico", "color": "#005e85"},
    "tecnico": {"label": "Técnico", "color": "#009579"},
    "instalado": {"label": "Instalado", "color": "#3bac52"},
}

EDIFICIOS = {"legacy": "Legacy", "nogal": "Nogal"}

PERIODO = {"desde": "2023-01", "hasta": "2025-12"}
