from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
    Depends,
    status,
)
from pydantic import BaseModel

from app.models.box import (
    Box,
    BoxUpdate,
    BoxCreate,
    list_boxes,
    get_box,
    update_box,
    create_box,
)
from app.models.booking import (
    list_bookings,
    get_active_booking_for_box,
)
from app.core.rate_limiter import enforce_rate_limit
from app.core.auth import (
    get_current_user,
    get_current_admin_user,
    get_current_user_optional,
)
from app.models.user import User

router = APIRouter()


class BoxPublic(BaseModel):
    """
    Kundensicht auf eine Box:
    - keine technischen Details wie device_id
    - dafür: Preis für den angefragten Zeitraum
    - Info, ob stunden-/tage-/monatsweise abgerechnet wird
    """
    id: str
    name: str
    size_m2: float
    pricing_mode: str          # "hourly" | "daily" | "monthly"
    unit_label: str            # "hour" | "day" | "month"
    billed_units: int          # abgerechnete Einheiten
    price_for_period: float    # Gesamtpreis für diesen Zeitraum


def _calculate_price_for_period(box: Box, duration_minutes: int) -> dict:
    """
    Berechnet den Preis einer Box für einen gewünschten Zeitraum auf Basis
    der in der Box konfigurierten Felder:

    - box.allow_hourly / allow_daily / allow_monthly
    - box.price_per_hour / price_per_day / price_per_31days

    WICHTIG:
    - Wir wählen automatisch das für den Zeitraum sinnvollste/preiswerteste Modell.
    - Für alte Daten ohne price_per_* verwenden wir Fallback-Defaults
      (0,50 €/m²/h, 8 €/m²/Tag, Monat = 31 Tage).
    """
    from math import ceil

    # Dauer in verschiedenen Einheiten
    hours = max(1, ceil(duration_minutes / 60))
    days = max(1, ceil(duration_minutes / (60 * 24)))
    months = max(1, ceil(duration_minutes / (60 * 24 * 31)))  # 31 Tage als "Monat"

    # Fallback-Defaults (für alte Daten ohne explizite Preise)
    default_price_per_hour = 0.5 * box.size_m2
    default_price_per_day = 8.0 * box.size_m2
    default_price_per_31days = default_price_per_day * 31

    price_per_hour = box.price_per_hour if box.price_per_hour is not None else default_price_per_hour
    price_per_day = box.price_per_day if box.price_per_day is not None else default_price_per_day
    price_per_31days = box.price_per_31days if box.price_per_31days is not None else default_price_per_31days

    candidates = []

    # Stundenmodell
    if box.allow_hourly:
        total_price = price_per_hour * hours
        candidates.append(
            ("hourly", "hour", hours, total_price)
        )

    # Tagesmodell
    if box.allow_daily:
        total_price = price_per_day * days
        candidates.append(
            ("daily", "day", days, total_price)
        )

    # Monatsmodell (31 Tage)
    if box.allow_monthly:
        total_price = price_per_31days * months
        candidates.append(
            ("monthly", "month", months, total_price)
        )

    # Falls aus irgendeinem Grund keine Abrechnungsart aktiv ist:
    if not candidates:
        # Fallback: behandle die Box wie "daily" mit Default-Preis
        total_price = default_price_per_day * days
        return {
            "pricing_mode": "daily",
            "unit_label": "day",
            "billed_units": days,
            "price_for_period": round(total_price, 2),
        }

    # Wähle das günstigste Modell für den angefragten Zeitraum
    mode, unit_label, billed_units, total_price = min(
        candidates, key=lambda c: c[3]
    )

    return {
        "pricing_mode": mode,
        "unit_label": unit_label,
        "billed_units": billed_units,
        "price_for_period": round(total_price, 2),
    }


# ---------- USER / ÖFFENTLICH: Verfügbare Boxen mit Preis ----------
# WICHTIG: Steht VOR "/{box_id}", sonst fängt "/{box_id}" die Route "/available" ab!


@router.get("/available", response_model=List[BoxPublic])
def get_available_boxes(
    start_in_minutes: int = Query(
        default=0,
        description="Ab wann? 0 = ab jetzt, sonst Minuten in der Zukunft.",
    ),
    duration_minutes: int = Query(
        default=60,
        description="Dauer der gewünschten Buchung in Minuten.",
    ),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    ÖFFENTLICH + USER: Liefert alle Boxen, die im gewünschten Zeitraum frei sind.

    - Kann anonym aufgerufen werden (ohne Authorization-Header)
    - oder mit Login (Kunde/Admin)

    Kundensicht:
    - keine device_id
    - dafür ein Preis für den angefragten Zeitraum
    - und Info, ob stunden-/tage-/monatsweise berechnet wurde
    """
    # Rate-Limit je nach Situation:
    if current_user is not None:
        rate_key = f"user_boxes_available:{current_user.id}"
    else:
        rate_key = "user_boxes_available:anonymous"

    enforce_rate_limit(
        key=rate_key,
        max_requests=60,
        window_seconds=60,
    )

    now = datetime.utcnow()
    window_start = now + timedelta(minutes=start_in_minutes)
    window_end = window_start + timedelta(minutes=duration_minutes)

    all_boxes = list_boxes()
    bookings = list_bookings()

    result: List[BoxPublic] = []

    for box in all_boxes:
        conflict = False

        for b in bookings:
            if b.box_id != box.id:
                continue

            booking_start = b.created_at
            booking_end = b.valid_until

            # Zeitfenster überlappen sich, wenn NICHT gilt:
            # booking_end <= window_start oder booking_start >= window_end
            if not (booking_end <= window_start or booking_start >= window_end):
                conflict = True
                break

        if conflict:
            continue

        pricing = _calculate_price_for_period(box, duration_minutes)

        result.append(
            BoxPublic(
                id=box.id,
                name=box.name,
                size_m2=box.size_m2,
                pricing_mode=pricing["pricing_mode"],
                unit_label=pricing["unit_label"],
                billed_units=pricing["billed_units"],
                price_for_period=pricing["price_for_period"],
            )
        )

    return result


# ---------- ADMIN: Box-Liste / Details / Create / Update ----------


@router.get("/", response_model=List[Box])
def get_all_boxes(
    current_admin: User = Depends(get_current_admin_user),
):
    """
    ADMIN: Gibt alle Boxen zurück.
    """
    enforce_rate_limit(
        key=f"admin_boxes_list:{current_admin.id}",
        max_requests=120,
        window_seconds=60,
    )
    return list_boxes()


@router.get("/status")
def get_boxes_status(
    current_admin: User = Depends(get_current_admin_user),
):
    """
    ADMIN: Liefert den aktuellen Status aller Boxen (frei / belegt),
    inkl. Info zu einer ggf. aktiven Buchung.
    """
    now = datetime.utcnow()
    boxes = list_boxes()
    bookings = list_bookings()

    result = []

    for box in boxes:
        active_booking = get_active_booking_for_box(box.id, at=now)

        if active_booking:
            status_str = "occupied"
            occupied_until = active_booking.valid_until
            booking_info = {
                "booking_id": active_booking.id,
                "user_name": active_booking.user_name,
                "valid_until": active_booking.valid_until,
                "access_code": active_booking.access_code,
            }
        else:
            status_str = "free"
            occupied_until = None
            booking_info = None

        result.append(
            {
                "box_id": box.id,
                "name": box.name,
                "size_m2": box.size_m2,
                "device_id": box.device_id,
                "status": status_str,
                "occupied_until": occupied_until,
                "current_booking": booking_info,
            }
        )

    return result


@router.get("/{box_id}", response_model=Box)
def get_single_box(
    box_id: str,
    current_admin: User = Depends(get_current_admin_user),
):
    """
    ADMIN: Einzelne Box-Details (inkl. device_id, Preis-Konfiguration).
    """
    enforce_rate_limit(
        key=f"admin_box_detail:{current_admin.id}",
        max_requests=120,
        window_seconds=60,
    )

    box = get_box(box_id)
    if not box:
        raise HTTPException(status_code=404, detail="Box not found")
    return box


@router.post("/", response_model=Box, status_code=status.HTTP_201_CREATED)
def create_box_admin(
    payload: BoxCreate,
    current_admin: User = Depends(get_current_admin_user),
):
    """
    ADMIN: Legt eine neue Box an.

    Du kannst hier direkt festlegen:
    - allow_hourly / allow_daily / allow_monthly
    - price_per_hour / price_per_day / price_per_31days

    Wenn keine Preise gesetzt sind, greifen die Default-Preise:
    - 0,50 €/m²/h
    - 8,00 €/m²/Tag
    - Monat = 31 * Tagespreis
    """
    enforce_rate_limit(
        key=f"admin_box_create:{current_admin.id}",
        max_requests=30,
        window_seconds=60,
    )

    # Optional: minimaler Check – mindestens eine Abrechnungsart aktivieren
    if not (payload.allow_hourly or payload.allow_daily or payload.allow_monthly):
        raise HTTPException(
            status_code=400,
            detail="Mindestens eine Abrechnungsart (hourly/daily/monthly) muss aktiviert sein.",
        )

    try:
        box = create_box(payload)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return box


@router.patch("/{box_id}", response_model=Box)
def update_box_admin(
    box_id: str,
    payload: BoxUpdate,
    current_admin: User = Depends(get_current_admin_user),
):
    """
    ADMIN: Aktualisiert eine existierende Box.
    Änderbare Felder:
    - name, size_m2, device_id
    - allow_hourly, allow_daily, allow_monthly
    - price_per_hour, price_per_day, price_per_31days
    """
    enforce_rate_limit(
        key=f"admin_box_update:{current_admin.id}",
        max_requests=60,
        window_seconds=60,
    )

    box = update_box(box_id, payload)
    if not box:
        raise HTTPException(status_code=404, detail="Box not found")

    return box