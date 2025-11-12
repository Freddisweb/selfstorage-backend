import os
from dotenv import load_dotenv
from typing import Optional, List
from pathlib import Path

# .env-Datei laden
load_dotenv()


class Settings:
    """
    Globale Anwendungskonfiguration.
    Wird automatisch aus Umgebungsvariablen (.env) geladen.
    """

    # --- API Keys & Secrets ---
    SEAM_API_KEY: Optional[str] = os.getenv("SEAM_API_KEY")
    API_KEY: Optional[str] = os.getenv("API_KEY")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change_me")
    JWT_ALGORITHM: str = "HS256"

    # --- Laufzeitumgebung ---
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # --- Persistente Daten ---
    # Pfad zum Datenverzeichnis (auf Render = /var/data/selfstorage)
    DATA_DIR: Path = Path(
        os.getenv("DATA_DIR", Path(__file__).resolve().parents[2] / "data")
    )

    # Dynamische JSON-Dateipfade
    @property
    def BOXES_FILE(self) -> str:
        return str(self.DATA_DIR / "boxes.json")

    @property
    def BOOKINGS_FILE(self) -> str:
        return str(self.DATA_DIR / "bookings.json")

    @property
    def USERS_FILE(self) -> str:
        return str(self.DATA_DIR / "users.json")

    @property
    def SITE_FILE(self) -> str:
        return str(self.DATA_DIR / "site.json")

    # --- CORS ---
    CORS_ORIGINS: List[str] = []

    # --- Geräte-Setup ---
    ENTRANCE_DEVICE_IDS: Optional[str] = os.getenv("ENTRANCE_DEVICE_IDS")

    def __init__(self) -> None:
        # CORS initialisieren
        origins_raw = os.getenv("CORS_ORIGINS", "")
        if origins_raw.strip():
            self.CORS_ORIGINS = [o.strip() for o in origins_raw.split(",")]
        else:
            if self.ENVIRONMENT == "development":
                self.CORS_ORIGINS = ["*"]
            else:
                self.CORS_ORIGINS = []

        # Logging-Hinweis
        print(f"[Settings] Environment: {self.ENVIRONMENT}")
        print(f"[Settings] CORS_ORIGINS: {self.CORS_ORIGINS}")
        print(f"[Settings] DATA_DIR: {self.DATA_DIR}")
        if self.ENTRANCE_DEVICE_IDS:
            print(f"[Settings] ENTRANCE_DEVICE_IDS: {self.ENTRANCE_DEVICE_IDS}")
        else:
            print("[Settings] ENTRANCE_DEVICE_IDS: (nicht gesetzt)")


# Globale Instanz
settings = Settings()