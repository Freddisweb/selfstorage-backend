import json
import os
from typing import List

from pydantic import BaseModel
from app.core.config import settings


class SiteConfig(BaseModel):
    """
    Konfiguration für einen Standort / eine Halle.
    Aktuell:
    - entrance_device_ids: Seam-Device-IDs der Eingangsschlösser
    """
    entrance_device_ids: List[str] = []


def _load_site_config() -> SiteConfig:
    path = getattr(settings, "SITE_CONFIG_FILE", "data/site.json")

    if not os.path.exists(path):
        # Fallback: leere Konfiguration
        return SiteConfig()

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return SiteConfig(**data)


# globale Konfiguration im Speicher
_SITE_CONFIG: SiteConfig = _load_site_config()


def get_site_config() -> SiteConfig:
    return _SITE_CONFIG