import os
import json
from typing import List, Optional

from pydantic import BaseModel

from app.core.config import settings
from app.core.logger import logger

BOXES_FILE = settings.BOXES_FILE  # z. B. "data/boxes.json"


# --------- Pydantic-Modelle ---------


class BoxBase(BaseModel):
    """
    Basis-Definition einer Box.

    Wichtige Felder:
    - id: interne ID, z. B. "LOCKER-01"
    - name: Anzeigename
    - size_m2: Fläche in m²
    - device_id: zugehöriges Seam/TTLock-Gerät

    Neue Felder:
    - allow_hourly / allow_daily / allow_monthly:
        Steuern, welche Zeitmodelle überhaupt buchbar sind.
    - price_per_hour / price_per_day / price_per_31days:
        Preise pro Box (nicht pro m²).
        price_per_31days kannst du als "Monatspreis" (31 Tage) benutzen.
    """

    id: str
    name: str
    size_m2: float
    device_id: str

    # Welche Abrechnungsarten sind erlaubt?
    allow_hourly: bool = False
    allow_daily: bool = True
    allow_monthly: bool = False  # "Monat" = 31 Tage

    # Box-spezifische Preise (Gesamtpreis, nicht pro m²)
    price_per_hour: Optional[float] = None
    price_per_day: Optional[float] = None
    price_per_31days: Optional[float] = None


class BoxCreate(BoxBase):
    """
    Payload für das Anlegen einer neuen Box per API.
    Entspricht BoxBase, kann aber später noch erweitert werden.
    """
    pass


class BoxUpdate(BaseModel):
    """
    Felder, die per PATCH geändert werden können.
    Alle optional.
    """

    name: Optional[str] = None
    size_m2: Optional[float] = None
    device_id: Optional[str] = None

    allow_hourly: Optional[bool] = None
    allow_daily: Optional[bool] = None
    allow_monthly: Optional[bool] = None

    price_per_hour: Optional[float] = None
    price_per_day: Optional[float] = None
    price_per_31days: Optional[float] = None


class Box(BoxBase):
    """
    Vollständige Box, wie sie im System genutzt wird.
    Aktuell identisch mit BoxBase.
    """
    pass


# --------- Hilfsfunktionen für JSON-Storage ---------


def _ensure_boxes_file_exists() -> None:
    """
    Legt die boxes.json an, falls sie noch nicht existiert.
    """
    if not os.path.exists(BOXES_FILE):
        logger.warning(f"Boxes-Datei {BOXES_FILE} existiert nicht – wird neu erstellt.")
        os.makedirs(os.path.dirname(BOXES_FILE), exist_ok=True)
        with open(BOXES_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _box_from_dict(data: dict) -> Box:
    """
    Hilfsfunktion, um aus einem Dict eine Box zu bauen.
    Setzt sinnvolle Defaults, falls neue Felder fehlen
    (z. B. bei älteren JSON-Dateien).
    """
    return Box(
        id=data["id"],
        name=data.get("name", data["id"]),
        size_m2=float(data.get("size_m2", 1.0)),
        device_id=data.get("device_id", ""),

        allow_hourly=data.get("allow_hourly", False),
        allow_daily=data.get("allow_daily", True),
        allow_monthly=data.get("allow_monthly", False),

        price_per_hour=data.get("price_per_hour"),
        price_per_day=data.get("price_per_day"),
        price_per_31days=data.get("price_per_31days"),
    )


def _box_to_dict(box: Box) -> dict:
    """
    Umwandlung Box -> Dict für das Speichern in JSON.
    """
    return box.model_dump()


def load_boxes() -> List[Box]:
    """
    Lädt alle Boxen aus der JSON-Datei.
    """
    _ensure_boxes_file_exists()

    try:
        with open(BOXES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        logger.error(f"boxes.json ({BOXES_FILE}) ist beschädigt – leere Liste wird verwendet.")
        data = []

    boxes: List[Box] = []
    for raw in data:
        try:
            boxes.append(_box_from_dict(raw))
        except Exception as e:
            logger.error(f"Fehler beim Laden einer Box aus JSON: {e} – Daten: {raw}")

    logger.info(f"{len(boxes)} Box(en) aus {BOXES_FILE} geladen.")
    return boxes


def save_boxes(boxes: List[Box]) -> None:
    """
    Speichert alle Boxen in die JSON-Datei.
    """
    os.makedirs(os.path.dirname(BOXES_FILE), exist_ok=True)
    data = [_box_to_dict(b) for b in boxes]

    with open(BOXES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    logger.info(f"{len(boxes)} Box(en) nach {BOXES_FILE} geschrieben.")


# --------- Öffentliche Funktionen für andere Module ---------


def list_boxes() -> List[Box]:
    """
    Gibt alle Boxen zurück.
    """
    return load_boxes()


def get_box(box_id: str) -> Optional[Box]:
    """
    Holt eine einzelne Box anhand ihrer ID.
    """
    for b in load_boxes():
        if b.id == box_id:
            return b
    return None


def create_box(payload: BoxCreate) -> Box:
    """
    Legt eine neue Box an.
    Wirft RuntimeError, wenn ID bereits existiert.
    """
    boxes = load_boxes()

    if any(b.id == payload.id for b in boxes):
        raise RuntimeError(f"Box mit id={payload.id} existiert bereits.")

    new_box = Box(**payload.model_dump())
    boxes.append(new_box)
    save_boxes(boxes)

    logger.info(f"Neue Box angelegt: {new_box.id} ({new_box.name})")
    return new_box


def update_box(box_id: str, payload: BoxUpdate) -> Optional[Box]:
    """
    Aktualisiert eine existierende Box.
    Gibt die aktualisierte Box zurück oder None, wenn nicht gefunden.
    """
    boxes = load_boxes()
    updated_box: Optional[Box] = None

    for idx, box in enumerate(boxes):
        if box.id != box_id:
            continue

        update_data = payload.model_dump(exclude_unset=True)
        updated_box = box.model_copy(update=update_data)
        boxes[idx] = updated_box
        break

    if updated_box is None:
        return None

    save_boxes(boxes)
    logger.info(f"Box aktualisiert: {updated_box.id} ({updated_box.name})")
    return updated_box