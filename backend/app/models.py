from sqlalchemy import Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Potencial(Base):
    """Potencial energético mensual por municipio, recurso, subtipo y tipo de potencial (GWh)."""

    __tablename__ = "potencial_energetico"
    id: Mapped[int] = mapped_column(primary_key=True)
    period: Mapped[int] = mapped_column(Integer, index=True)  # YYYYMM
    region: Mapped[str] = mapped_column(String(20), index=True)
    departamento: Mapped[str] = mapped_column(String(30), index=True)
    municipio: Mapped[str] = mapped_column(String(40), index=True)
    resource: Mapped[str] = mapped_column(String(10), index=True)
    subtype: Mapped[str] = mapped_column(String(20))
    potential: Mapped[str] = mapped_column(String(10), index=True)
    value: Mapped[float] = mapped_column(Float)


class EanLectura(Base):
    """Consumo y generación solar mensual (kWh) por edificio."""

    __tablename__ = "ean_lectura"
    __table_args__ = (UniqueConstraint("year", "month", "building"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int] = mapped_column(Integer, index=True)
    month: Mapped[int] = mapped_column(Integer)
    building: Mapped[str] = mapped_column(String(10), index=True)
    consumo_kwh: Mapped[float] = mapped_column(Float)
    generacion_kwh: Mapped[float] = mapped_column(Float)


class EanCarga(Base):
    """Distribución porcentual de cargas atendidas por los paneles, por edificio."""

    __tablename__ = "ean_carga"
    id: Mapped[int] = mapped_column(primary_key=True)
    building: Mapped[str] = mapped_column(String(10), index=True)
    carga: Mapped[str] = mapped_column(String(60))
    pct: Mapped[float] = mapped_column(Float)
