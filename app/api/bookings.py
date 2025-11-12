from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.booking import (
    Booking,
    BookingPublic,
    BookingCreate,
    create_booking,
    list_bookings,
    delete_booking,
    to_public_booking,
)
from app.core.rate_limiter import enforce_rate_limit
from app.core.auth import get_current_user, get_current_admin_user
from app.models.user import User

router = APIRouter()


# ----------------- ADMIN-ENDPOINTS -----------------


@router.get("/", response_model=List[Booking])
def get_bookings_admin(
    box_id: Optional[str] = Query(default=None),
    user_name: Optional[str] = Query(default=None),
    active_only: Optional[bool] = Query(
        default=None,
        description="true = nur aktive, false = nur abgelaufene, leer = alle",
    ),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    ADMIN: Gibt alle Buchungen zurück, optional gefiltert.
    Nur für eingeloggte Admin-User.
    """
    bookings = list_bookings()

    if box_id:
        bookings = [b for b in bookings if b.box_id == box_id]

    if user_name:
        bookings = [b for b in bookings if b.user_name.lower() == user_name.lower()]

    if active_only is not None:
        now = datetime.utcnow()
        if active_only:
            bookings = [b for b in bookings if b.valid_until >= now]
        else:
            bookings = [b for b in bookings if b.valid_until < now]

    return bookings


@router.post("/", response_model=BookingPublic)
def create_booking_admin(
    payload: BookingCreate,
    current_admin: User = Depends(get_current_admin_user),
):
    """
    ADMIN: Legt eine neue Buchung an (z.B. Walk-in-Kunden).
    """
    enforce_rate_limit(
        key=f"admin_bookings_create:{current_admin.id}",
        max_requests=60,
        window_seconds=60,
    )

    try:
        booking = create_booking(payload, user_id=None)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return to_public_booking(booking)


# ----------------- USER-ENDPOINTS -----------------
# WICHTIG: /me kommt VOR "/{booking_id}", sonst fängt "/{booking_id}" die Route ab.


@router.get("/me", response_model=List[BookingPublic])
def get_my_bookings(
    active_only: Optional[bool] = Query(
        default=None,
        description="true = nur aktive, false = nur abgelaufene, leer = alle",
    ),
    current_user: User = Depends(get_current_user),
):
    """
    USER: Gibt nur die Buchungen des aktuell eingeloggten Nutzers zurück.
    Antwort in der Public-Variante (ohne interne Felder wie device_ids).
    """
    enforce_rate_limit(
        key=f"user_bookings_list:{current_user.id}",
        max_requests=60,
        window_seconds=60,
    )

    bookings = [
        b for b in list_bookings()
        if b.user_id == current_user.id
    ]

    if active_only is not None:
        now = datetime.utcnow()
        if active_only:
            bookings = [b for b in bookings if b.valid_until >= now]
        else:
            bookings = [b for b in bookings if b.valid_until < now]

    return [to_public_booking(b) for b in bookings]


@router.post("/me", response_model=BookingPublic)
def create_my_booking(
    payload: BookingCreate,
    current_user: User = Depends(get_current_user),
):
    """
    USER: Legt eine neue Buchung für den aktuell eingeloggten Nutzer an.
    - user_id wird aus dem Token gesetzt
    """
    enforce_rate_limit(
        key=f"user_bookings_create:{current_user.id}",
        max_requests=30,
        window_seconds=60,
    )

    try:
        booking = create_booking(payload, user_id=current_user.id)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return to_public_booking(booking)


@router.delete("/{booking_id}")
def delete_booking_admin(
    booking_id: str,
    current_admin: User = Depends(get_current_admin_user),
):
    """
    ADMIN: Löscht eine Buchung und den zugehörigen Access-Code in Seam.
    """
    enforce_rate_limit(
        key=f"admin_bookings_delete:{current_admin.id}",
        max_requests=60,
        window_seconds=60,
    )

    success = delete_booking(booking_id)
    if not success:
        raise HTTPException(status_code=404, detail="Booking not found")

    return {"ok": True, "booking_id": booking_id}