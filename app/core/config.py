import os
from dotenv import load_dotenv
from typing import Optional, List

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
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")  # "development" | "production" | "staging"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # --- Daten-Dateien ---
    BOXES_FILE: str = "data/boxes.json"
    BOOKINGS_FILE: str = "data/bookings.json"
    USERS_FILE: str = "data/users.json"

    # --- CORS ---
    CORS_ORIGINS: List[str] = []

    # --- Geräte-Setup ---
    # Optional: Kommagetrennte Liste von Eingangsschlössern,
    # die zusätzlich zum Box-Schloss freigeschaltet werden sollen.
    ENTRANCE_DEVICE_IDS: Optional[str] = os.getenv("ENTRANCE_DEVICE_IDS")

    def __init__(self) -> None:
        # CORS initialisieren
        origins_raw = os.getenv("CORS_ORIGINS", "")
        if origins_raw.strip():
            self.CORS_ORIGINS = [o.strip() for o in origins_raw.split(",")]
        else:
            # Standardwerte abhängig von ENVIRONMENT
            if self.ENVIRONMENT == "development":
                self.CORS_ORIGINS = ["*"]
            else:
                self.CORS_ORIGINS = []

        # Logging-Hinweis (nur für dev hilfreich)
        print(f"[Settings] Environment: {self.ENVIRONMENT}")
        print(f"[Settings] CORS_ORIGINS: {self.CORS_ORIGINS}")
        if self.ENTRANCE_DEVICE_IDS:
            print(f"[Settings] ENTRANCE_DEVICE_IDS: {self.ENTRANCE_DEVICE_IDS}")
        else:
            print("[Settings] ENTRANCE_DEVICE_IDS: (nicht gesetzt)")


# Globale Instanz
settings = Settings()