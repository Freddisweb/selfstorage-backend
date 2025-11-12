import logging
import os

# Basis-Verzeichnis des Projekts ermitteln
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
LOG_DIR = os.path.join(BASE_DIR, "data", "logs")
LOG_FILE = os.path.join(LOG_DIR, "app.log")

os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("selfstorage")
logger.setLevel(logging.INFO)

# Format für Log-Meldungen
formatter = logging.Formatter(
    "%(asctime)s - %(levelname)s - %(name)s - %(message)s"
)

# Konsole
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)

# Datei
file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
file_handler.setFormatter(formatter)

# Handler nur einmal anhängen (wichtig beim Reload)
if not logger.handlers:
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)