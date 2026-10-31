from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    seed_on_startup: bool = True
    # El periodo solo es elegible por el usuario si la fuente de datos (geovisor/APIs) lo soporta.
    period_selectable: bool = False
    # Parámetros económicos y de huella de carbono (valores de referencia editables en la interfaz).
    tarifa_cop_kwh: float = 800.0          # PLACEHOLDER: reemplazar por la tarifa real de las facturas de la U
    factor_emision_kg_kwh: float = 0.220   # UPME, factor de la red para inventarios de GEI (2024): 0,220 tCO2e/MWh


settings = Settings()
