import os
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from math import ceil

from pydantic import BaseModel

from app.core.logger import logger
from app.models.box import Box, get_box
from app.core.config import settings
from app.core.seam_client import create_access_code_for_devices, delete_access_code

# Pfad für die JSON-Datei
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
BOOKINGS_FILE = os.path.join(DATA_DIR, "bookings.json")



def _calculate_price_for_period_for_booking(box: Box, duration_minutes: int) -> dict:
    """
    Berechnet Preis + Einheiten für eine Buchung basierend auf der Box.

    Nutzt nach Möglichkeit die Felder der Box:
    - pricing_mode ("hourly" | "daily")
    - price_per_m2_hour
    - price_per_m2_day

    Fällt auf Default-Werte zurück, wenn die Felder (z.B. bei alten Daten)
    nicht vorhanden sind.
    """

    # Fallbacks, falls alte Box-Objekte noch keine neuen Felder haben
    mode = getattr(box, "pricing_mode", None) or "daily"
    size_m2 = getattr(box, "size_m2", 1.0) or 1.0
    price_per_m2_hour = getattr(box, "price_per_m2_hour", 0.5)
    price_per_m2_day = getattr(box, "price_per_m2_day", 8.0)

    if mode == "hourly":
        total_hours = max(1, ceil(duration_minutes / 60))
        price = size_m2 * price_per_m2_hour * total_hours
        return {
            "pricing_mode": "hourly",
            "unit_label": "hour",
            "billed_units": total_hours,
            "price_for_period": round(price, 2),
        }

    # daily
    total_days = max(1, ceil(duration_minutes / (60 * 24)))
    price = size_m2 * price_per_m2_day * total_days
    return {
        "pricing_mode": "daily",
        "unit_label": "day",
        "billed_units": total_days,
        "price_for_period": round(price, 2),
    }



class BookingCreate(BaseModel):
    user_name: str
    box_id: str
    duration_minutes: int


class Booking(BaseModel):
    id: str
    user_name: str
    box_id: str

    # Primäres Schloss – das der Box
    device_id: str

    # zusätzl. Schlösser, z. B. Eingangstüren
    extra_device_ids: List[str] = []

    access_code: str
    seam_access_code_id: Optional[str] = None

    # Seam-Access-Code-IDs für die extra_device_ids
    extra_seam_access_code_ids: List[str] = []

    created_at: datetime
    valid_until: datetime
    user_id: Optional[str] = None

    # Pricing
    pricing_mode: Optional[str] = None
    unit_label: Optional[str] = None
    billed_units: Optional[int] = None
    price_for_period: Optional[float] = None

class BookingPublic(BaseModel):
    """
    Vereinfachte Darstellung für Kundenantworten.
    """
    id: str
    box_id: str
    box_name: Optional[str] = None
    user_name: str
    created_at: datetime
    valid_until: datetime
    access_code: str

    # Preisangaben
    pricing_mode: Optional[str] = None
    unit_label: Optional[str] = None
    billed_units: Optional[int] = None
    price_for_period: Optional[float] = None

class BookingAdmin(BaseModel):
    """
    Detaillierte Darstellung einer Buchung für Admins.
    Enthält alle technischen Felder, auch interne IDs.
    """
    id: str
    user_name: str
    user_id: Optional[str] = None
    box_id: str
    device_id: str
    access_code: str
    seam_access_code_id: Optional[str] = None
    created_at: datetime
    valid_until: datetime

    # Pricing-Informationen
    pricing_mode: Optional[str] = None
    unit_label: Optional[str] = None
    billed_units: Optional[int] = None
    price_for_period: Optional[float] = None

def to_admin_booking(booking: Booking) -> BookingAdmin:
    """
    Wandelt ein vollständiges Booking in eine Admin-Ansicht um.
    """
    return BookingAdmin(
        id=booking.id,
        user_name=booking.user_name,
        user_id=booking.user_id,
        box_id=booking.box_id,
        device_id=booking.device_id,
        access_code=booking.access_code,
        seam_access_code_id=booking.seam_access_code_id,
        created_at=booking.created_at,
        valid_until=booking.valid_until,
        pricing_mode=booking.pricing_mode,
        unit_label=booking.unit_label,
        billed_units=booking.billed_units,
        price_for_period=booking.price_for_period,
    )

def to_public_booking(booking: Booking) -> BookingPublic:
    """
    Wandelt eine vollständige Booking in eine kundenfreundliche Darstellung um.
    """
    box = get_box(booking.box_id)
    return BookingPublic(
        id=booking.id,
        box_id=booking.box_id,
        box_name=box.name if box else None,
        user_name=booking.user_name,
        created_at=booking.created_at,
        valid_until=booking.valid_until,
        access_code=booking.access_code,
        pricing_mode=booking.pricing_mode,
        unit_label=booking.unit_label,
        billed_units=booking.billed_units,
        price_for_period=booking.price_for_period,
    )



def _booking_to_dict(b: Booking) -> dict:
    return {
        "id": b.id,
        "user_name": b.user_name,
        "box_id": b.box_id,
        "device_id": b.device_id,
        "extra_device_ids": b.extra_device_ids,
        "access_code": b.access_code,
        "seam_access_code_id": b.seam_access_code_id,
        "extra_seam_access_code_ids": b.extra_seam_access_code_ids,
        "created_at": b.created_at.isoformat(),
        "valid_until": b.valid_until.isoformat(),
        "user_id": b.user_id,
        "pricing_mode": b.pricing_mode,
        "unit_label": b.unit_label,
        "billed_units": b.billed_units,
        "price_for_period": b.price_for_period,
    }

def _booking_from_dict(d: dict) -> Booking:
    """
    Baut aus einem dict (z. B. aus bookings.json) ein Booking-Objekt.
    Achtung: Wir nutzen .get() mit Default-Werten, damit alte Einträge
    ohne extra-Felder weiterhin geladen werden können.
    """
    return Booking(
        id=d["id"],
        user_name=d["user_name"],
        box_id=d["box_id"],

        device_id=d["device_id"],
        extra_device_ids=d.get("extra_device_ids", []),

        access_code=d["access_code"],
        seam_access_code_id=d.get("seam_access_code_id"),
        extra_seam_access_code_ids=d.get("extra_seam_access_code_ids", []),

        created_at=datetime.fromisoformat(d["created_at"]),
        valid_until=datetime.fromisoformat(d["valid_until"]),

        user_id=d.get("user_id"),

        pricing_mode=d.get("pricing_mode"),
        unit_label=d.get("unit_label"),
        billed_units=d.get("billed_units"),
        price_for_period=d.get("price_for_period"),
    )

def _load_bookings_from_disk() -> None:
    """Lädt bestehende Buchungen aus der JSON-Datei (falls vorhanden)."""
    global BOOKINGS

    if not os.path.exists(BOOKINGS_FILE):
        BOOKINGS = []
        logger.info(f"Keine bestehende bookings.json gefunden. Starte mit leerer Liste.")
        return

    try:
        with open(BOOKINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        BOOKINGS = [_booking_from_dict(item) for item in data]
        logger.info(f"{len(BOOKINGS)} Buchungen aus {BOOKINGS_FILE} geladen.")
    except Exception as e:
        logger.warning(f"Konnte {BOOKINGS_FILE} nicht laden: {e}")
        BOOKINGS = []

# Globale In-Memory-Liste aller Buchungen
BOOKINGS: List[Booking] = _load_bookings_from_disk()


def list_bookings() -> List[Booking]:
    """
    Gibt die aktuelle Liste aller Buchungen zurück.
    Wird u. a. vom API-Layer (app/api/bookings.py, boxes.py) verwendet.
    """
    return BOOKINGS


def get_booking_by_id(booking_id: str) -> Optional[Booking]:
    """
    Holt eine einzelne Buchung anhand ihrer ID.
    Gibt None zurück, wenn keine Buchung mit dieser ID existiert.
    """
    bookings = list_bookings()
    for b in bookings:
        if b.id == booking_id:
            return b
    return None

def get_booking_by_code(code: str) -> Optional[Booking]:
    """
    Sucht eine aktuell gültige Buchung anhand des Access-Codes.
    Gibt nur Buchungen zurück, deren valid_until in der Zukunft liegt.
    """
    now = datetime.utcnow()

    for b in BOOKINGS:
        if b.access_code == code and b.valid_until >= now:
            return b

    return None


def is_code_valid(code: str, device_id: Optional[str] = None) -> bool:
    """
    Prüft, ob ein Code aktuell gültig ist.
    Optional kann zusätzlich überprüft werden, ob der Code
    zu einem bestimmten Gerät (device_id) passt.

    - Kein Treffer -> False
    - Treffer + kein device_id übergeben -> True
    - Treffer + device_id passt zu primary oder extra -> True
    - sonst -> False
    """
    booking = get_booking_by_code(code)
    if not booking:
        return False

    # Wenn keine device_id geprüft werden soll: gültig
    if device_id is None:
        return True

    # Primary-Lock
    if booking.device_id == device_id:
        return True

    # Extra-Locks (z. B. Eingangstüren)
    if device_id in booking.extra_device_ids:
        return True

    # Code existiert, aber nicht für dieses Gerät
    return False

def _save_bookings_to_disk() -> None:
    """Speichert alle aktuellen Buchungen in die JSON-Datei."""
    os.makedirs(DATA_DIR, exist_ok=True)
    data = [_booking_to_dict(b) for b in BOOKINGS]

    try:
        with open(BOOKINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        logger.info(f"{len(BOOKINGS)} Buchungen in {BOOKINGS_FILE} gespeichert.")
    except Exception as e:
        logger.warning(f"Konnte {BOOKINGS_FILE} nicht speichern: {e}")

def create_booking(data: BookingCreate, user_id: Optional[str] = None) -> Booking:

    """
    Erzeugt eine neue Buchung:
    - prüft, ob die Box frei ist
    - berechnet den Preis
    - erzeugt einen Access-Code über Seam auf allen relevanten Geräten
      (Eingang + Box)
    - speichert die Buchung in BOOKINGS + bookings.json
    """
    now = datetime.utcnow()
    valid_until = now + timedelta(minutes=data.duration_minutes)

    # Box laden
    box = get_box(data.box_id)
    if box is None:
        logger.warning(f"create_booking: Box {data.box_id} nicht gefunden.")
        raise RuntimeError(f"Box mit ID {data.box_id} nicht gefunden.")

    primary_device_id = box.device_id

    # Doppelbuchungs-Check: gibt es schon eine aktive Buchung für diese Box?
    for existing in BOOKINGS:
        if existing.box_id == data.box_id and existing.valid_until > now:
            msg = f"Box {data.box_id} ist bereits bis {existing.valid_until} belegt."
            logger.warning(f"create_booking: {msg}")
            raise RuntimeError(msg)

    # Preis berechnen
    pricing = _calculate_price_for_period_for_booking(
        box,
        data.duration_minutes,
    )

    # ---- Geräteliste aufbauen: Eingänge + Box ----
    entrance_ids_raw = getattr(settings, "ENTRANCE_DEVICE_IDS", None)
    entrance_device_ids: List[str] = []
    if entrance_ids_raw:
        entrance_device_ids = [
            dev_id.strip()
            for dev_id in entrance_ids_raw.split(",")
            if dev_id.strip()
        ]

    # Alle Geräte, die denselben Code bekommen sollen:
    # erst Eingänge, dann das Box-Lock
    device_ids: List[str] = entrance_device_ids + [primary_device_id]

    # Doppelte IDs vermeiden
    seen = set()
    unique_device_ids: List[str] = []
    for dev_id in device_ids:
        if dev_id not in seen:
            seen.add(dev_id)
            unique_device_ids.append(dev_id)

    if not unique_device_ids:
        logger.error("create_booking: Keine Zielgeräte für Access-Code konfiguriert.")
        raise RuntimeError("Keine Zielgeräte für Access-Code konfiguriert.")

    logger.info(
        f"create_booking: Erzeuge Access-Code für Geräte {unique_device_ids}, "
        f"Box={data.box_id}, User={data.user_name}, Dauer={data.duration_minutes} Minuten, "
        f"user_id={user_id}, pricing={pricing}."
    )

    # ---- Access-Code über Seam erzeugen ----
    try:
        code, primary_access_code_id, extra_access_code_ids = create_access_code_for_devices(
            device_ids=unique_device_ids,
            starts_at=now,
            ends_at=valid_until,
        )
    except Exception as e:
        logger.exception("Fehler beim Erzeugen von Access-Codes in Seam.")
        raise RuntimeError(f"Fehler beim Erzeugen der Access-Codes: {e}")

    # Primary ist immer das Box-Lock
    extra_device_ids: List[str] = [d for d in unique_device_ids if d != primary_device_id]

    # Sicherheitscheck: Längen der Listen vergleichen (nur Log, kein Abbruch)
    if len(extra_device_ids) != len(extra_access_code_ids):
        logger.error(
            "Mismatch zwischen extra_device_ids und extra_access_code_ids: "
            f"{extra_device_ids} vs {extra_access_code_ids}"
        )

    booking = Booking(
        id=str(uuid.uuid4()),
        user_name=data.user_name,
        box_id=data.box_id,
        device_id=primary_device_id,
        extra_device_ids=extra_device_ids,
        access_code=code,
        seam_access_code_id=primary_access_code_id,
        extra_seam_access_code_ids=extra_access_code_ids,
        created_at=now,
        valid_until=valid_until,
        user_id=user_id,
        pricing_mode=pricing["pricing_mode"],
        unit_label=pricing["unit_label"],
        billed_units=pricing["billed_units"],
        price_for_period=pricing["price_for_period"],
    )

    BOOKINGS.append(booking)
    _save_bookings_to_disk()

    logger.info(
        f"Neue Buchung angelegt: id={booking.id}, box={booking.box_id}, "
        f"user={booking.user_name}, user_id={booking.user_id}, "
        f"valid_until={booking.valid_until}, code={booking.access_code}, "
        f"primary_device={booking.device_id}, extra_devices={booking.extra_device_ids}, "
        f"pricing_mode={booking.pricing_mode}, "
        f"billed_units={booking.billed_units}, "
        f"price_for_period={booking.price_for_period}"
    )

    return booking

def delete_booking(booking_id: str) -> bool:
    """
    Löscht eine Buchung und alle zugehörigen Access-Codes in Seam.

    Rückgabe:
        True  -> Booking wurde gefunden und (logisch) gelöscht
        False -> Booking mit dieser ID existiert nicht
    """
    global BOOKINGS

    booking = next((b for b in BOOKINGS if b.id == booking_id), None)
    if not booking:
        logger.warning(f"delete_booking: Booking {booking_id} nicht gefunden.")
        return False

    logger.info(
        f"delete_booking: Lösche Booking {booking_id} "
        f"(box={booking.box_id}, user={booking.user_name}, "
        f"primary_code_id={booking.seam_access_code_id}, "
        f"extra_code_ids={booking.extra_seam_access_code_ids})"
    )

    # 1) Primären Access-Code löschen
    if booking.seam_access_code_id:
        try:
            delete_access_code(booking.seam_access_code_id)
            logger.info(
                f"delete_booking: primary Access-Code {booking.seam_access_code_id} erfolgreich gelöscht."
            )
        except Exception as e:
            logger.exception(
                f"Fehler beim Löschen des primary Access-Codes {booking.seam_access_code_id}: {e}"
            )

    # 2) Zusätzliche Access-Codes löschen (z. B. Eingangsschlösser)
    for ac_id in booking.extra_seam_access_code_ids:
        try:
            delete_access_code(ac_id)
            logger.info(
                f"delete_booking: extra Access-Code {ac_id} erfolgreich gelöscht."
            )
        except Exception as e:
            logger.exception(
                f"Fehler beim Löschen eines extra Access-Codes {ac_id}: {e}"
            )

    # 3) Booking aus der In-Memory-Liste entfernen
    BOOKINGS = [b for b in BOOKINGS if b.id != booking_id]

    # 4) Änderungen auf Disk schreiben
    _save_bookings_to_disk()

    logger.info(f"delete_booking: Booking {booking_id} gelöscht.")
    return True

def get_active_booking_for_box(box_id: str, at: Optional[datetime] = None) -> Optional[Booking]:
    """
    Gibt die aktuell aktive Buchung für eine Box zurück (falls vorhanden).
    Eine Buchung gilt als aktiv, wenn:
      created_at <= at <= valid_until
    Falls mehrere Überschneidungen existieren (sollte nicht vorkommen),
    wird die zuerst gefundene zurückgegeben.
    """
    if at is None:
        at = datetime.utcnow()

    for b in BOOKINGS:
        if b.box_id != box_id:
            continue
        if b.created_at <= at <= b.valid_until:
            return b

    return None

# Beim Import dieses Moduls automatisch Buchungen von der Platte laden
_load_bookings_from_disk()

def cleanup_expired_access_codes() -> dict:
    """
    Geht alle abgelaufenen Buchungen durch (valid_until < jetzt)
    und löscht deren Access-Codes in Seam (primary + extra).
    Die Buchungen selbst bleiben erhalten, nur die Seam-IDs werden
    aufgeräumt.

    Rückgabe: Statistik über die bereinigten Einträge.
    """
    now = datetime.utcnow()

    expired_bookings = [b for b in BOOKINGS if b.valid_until < now]
    expired_count = len(expired_bookings)

    updated_bookings = 0
    primary_deleted = 0
    extra_deleted = 0

    for b in expired_bookings:
        changed = False

        # Primary-Code löschen
        if b.seam_access_code_id:
            try:
                delete_access_code(b.seam_access_code_id)
                primary_deleted += 1
                logger.info(
                    f"cleanup_expired_access_codes: Primary-Code {b.seam_access_code_id} "
                    f"für Booking {b.id} gelöscht."
                )
            except Exception as e:
                logger.exception(
                    f"Fehler beim Löschen des primary Access-Codes {b.seam_access_code_id} "
                    f"für Booking {b.id}: {e}"
                )
            b.seam_access_code_id = None
            changed = True

        # Extra-Codes löschen (z. B. Eingangsschlösser)
        if b.extra_seam_access_code_ids:
            for ac_id in b.extra_seam_access_code_ids:
                try:
                    delete_access_code(ac_id)
                    extra_deleted += 1
                    logger.info(
                        f"cleanup_expired_access_codes: Extra-Code {ac_id} "
                        f"für Booking {b.id} gelöscht."
                    )
                except Exception as e:
                    logger.exception(
                        f"Fehler beim Löschen eines extra Access-Codes {ac_id} "
                        f"für Booking {b.id}: {e}"
                    )

            b.extra_seam_access_code_ids = []
            changed = True

        if changed:
            updated_bookings += 1

    # Änderungen in bookings.json schreiben
    if updated_bookings > 0:
        _save_bookings_to_disk()
        logger.info(
            f"cleanup_expired_access_codes: {updated_bookings} Buchungen aktualisiert, "
            f"{primary_deleted} primary- und {extra_deleted} extra-Codes gelöscht."
        )
    else:
        logger.info("cleanup_expired_access_codes: Keine abgelaufenen Access-Codes zu löschen.")

    return {
        "expired_bookings_checked": expired_count,
        "bookings_updated": updated_bookings,
        "primary_codes_deleted": primary_deleted,
        "extra_codes_deleted": extra_deleted,
    }