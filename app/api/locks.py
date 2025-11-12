from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from app.models.booking import is_code_valid, get_booking_by_code
from app.core.seam_client import get_devices
from app.core.config import settings
from app.core.rate_limiter import enforce_rate_limit

router = APIRouter()


def _check_api_key(x_api_key: Optional[str] = None) -> None:
    """
    Einfacher API-Key-Schutz + Rate-Limit für Lock-Endpunkte.
    """
    if not settings.API_KEY:
        # Entwicklungsmodus ohne API-Key
        return

    if x_api_key != settings.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

    # Rate-Limit: z.B. 60 Requests pro Minute für Lock-Operationen
    enforce_rate_limit(
        key=f"locks:{x_api_key}",
        max_requests=60,
        window_seconds=60,
    )


class CodePayload(BaseModel):
    code: str


@router.get("/status")
def get_lock_status(
    x_api_key: Optional[str] = Header(default=None),
):
    """
    Platzhalter-Status – später können wir hier echte Geräte-Infos anzeigen.
    Geschützt per API-Key.
    """
    _check_api_key(x_api_key)
    return {"status": "locked", "device_id": "demo_lock"}


@router.post("/validate_code")
def validate_code(
    payload: CodePayload,
    x_api_key: Optional[str] = Header(default=None),
):
    """
    Einfache Validierung nur anhand des Codes.
    Nützlich für Tests oder Debugging (ohne device_id).
    """
    _check_api_key(x_api_key)

    valid = is_code_valid(payload.code)
    booking = get_booking_by_code(payload.code)

    return {
        "valid": valid,
        "code": payload.code,
        "booking_id": booking.id if booking else None,
        "box_id": booking.box_id if booking else None,
    }


@router.get("/validate")
def validate_access_code(
    code: str = Query(..., description="Der vom Nutzer eingegebene Access-Code"),
    device_id: str = Query(..., description="Das Gerät (z. B. Schloss-ID), das prüfen will"),
    x_api_key: Optional[str] = Header(default=None),
):
    """
    Wird von einem Schloss oder Gateway aufgerufen, um zu prüfen,
    ob der Access-Code für dieses konkrete Gerät (device_id) gültig ist.

    Rückgabe:
      {
        "valid": true/false,
        "box_id": ...,
        "user_name": ...,
        "valid_until": ...
      }
    """
    _check_api_key(x_api_key)

    if not code.strip():
        raise HTTPException(status_code=400, detail="Code darf nicht leer sein.")

    booking = get_booking_by_code(code)
    if not booking:
        return {"valid": False}

    # Prüfen, ob Code überhaupt für dieses Gerät gilt (Box-Lock oder extra_device_ids)
    if not is_code_valid(code, device_id):
        return {"valid": False}

    return {
        "valid": True,
        "box_id": booking.box_id,
        "user_name": booking.user_name,
        "valid_until": booking.valid_until,
    }


@router.get("/seam/devices")
def list_seam_devices(
    x_api_key: Optional[str] = Header(default=None),
):
    """
    Listet Geräte aus deinem Seam-Account.
    Nur mit API-Key aufrufbar.
    """
    _check_api_key(x_api_key)
    devices_response = get_devices()
    return devices_response