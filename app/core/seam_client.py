import requests
from datetime import datetime
from app.core.config import settings
from app.core.logger import logger
from typing import Optional, List, Tuple

SEAM_BASE_URL = "https://connect.getseam.com"


def get_devices():
    """Fragt alle registrierten Geräte in deinem Seam-Account ab und gibt Antwort + Status zurück."""
    if not settings.SEAM_API_KEY:
        logger.error("get_devices: SEAM_API_KEY not set.")
        return {
            "ok": False,
            "error": "SEAM_API_KEY not set. Bitte .env prüfen.",
            "devices": []
        }

    headers = {
        "Authorization": f"Bearer {settings.SEAM_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        logger.info("Seam: GET /devices/list")
        response = requests.get(f"{SEAM_BASE_URL}/devices/list", headers=headers)
    except Exception as e:
        logger.error(f"Seam: Exception bei GET /devices/list: {e}")
        return {
            "ok": False,
            "error": f"Exception beim Request: {e}",
            "devices": []
        }

    try:
        data = response.json()
    except Exception:
        logger.error(
            f"Seam: Konnte Antwort von /devices/list nicht als JSON lesen. "
            f"Status={response.status_code}, Text={response.text}"
        )
        data = {"raw_text": response.text}

    logger.info(f"Seam: GET /devices/list -> status={response.status_code}")
    return {
        "ok": response.ok,
        "status_code": response.status_code,
        "data": data,
    }

def create_access_code(
    device_id: str,
    starts_at: datetime,
    ends_at: datetime,
    code: Optional[str] = None,
):
    """
    Erzeugt einen temporären Access-Code in Seam für ein bestimmtes Gerät.
    Wenn 'code' angegeben ist, wird genau dieser Code versucht zu setzen
    (z. B. wenn mehrere Geräte denselben Code bekommen sollen).
    """
    if not settings.SEAM_API_KEY:
        logger.error("create_access_code: SEAM_API_KEY not set.")
        raise RuntimeError("SEAM_API_KEY not set. Bitte .env prüfen.")

    headers = {
        "Authorization": f"Bearer {settings.SEAM_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "device_id": device_id,
        "starts_at": starts_at.isoformat() + "Z",
        "ends_at": ends_at.isoformat() + "Z",
    }

    # Falls ein bestimmter Code übergeben wurde (z. B. für mehrere Geräte)
    if code is not None:
        payload["code"] = code

    logger.info(
        f"Seam: POST /access_codes/create für device_id={device_id}, "
        f"start={payload['starts_at']}, end={payload['ends_at']}, "
        f"custom_code={'ja' if code else 'nein'}"
    )

    response = requests.post(
        f"{SEAM_BASE_URL}/access_codes/create",
        headers=headers,
        json=payload,
    )

    try:
        data = response.json()
    except Exception:
        logger.error(
            f"Seam: Antwort von /access_codes/create nicht als JSON lesbar. "
            f"Status={response.status_code}, Text={response.text}"
        )
        raise RuntimeError(f"Fehler beim Erzeugen des Access-Codes: {response.status_code} - {response.text}")

    if not response.ok or not data.get("ok", False):
        logger.error(f"Seam-Fehler beim Access-Code-Erzeugen: {data}")
        raise RuntimeError(f"Seam-Fehler beim Access-Code-Erzeugen: {data}")

    access_code = data.get("access_code", {})

    logger.info(
        f"Seam: Access-Code erzeugt: code={access_code.get('code')}, "
        f"access_code_id={access_code.get('access_code_id')}, device_id={access_code.get('device_id')}"
    )

    return {
        "code": access_code.get("code"),
        "access_code_id": access_code.get("access_code_id"),
        "device_id": access_code.get("device_id", device_id),
        "raw": data,
    }

from typing import List, Tuple

def create_access_code_for_devices(
    device_ids: List[str],
    starts_at: datetime,
    ends_at: datetime,
) -> Tuple[str, str, List[str]]:
    """
    Erzeugt für mehrere Geräte denselben Code:
    - Auf dem ersten Gerät wird der Code generiert
    - Auf allen weiteren Geräten wird derselbe Code gesetzt

    Rückgabe:
      (code, primary_access_code_id, extra_access_code_ids)
    """
    if not device_ids:
        raise RuntimeError("create_access_code_for_devices: device_ids is empty")

    primary_device_id = device_ids[0]
    extra_device_ids = device_ids[1:]

    # 1️⃣ Auf dem ersten Gerät Code generieren
    first_result = create_access_code(
        device_id=primary_device_id,
        starts_at=starts_at,
        ends_at=ends_at,
    )
    code = first_result["code"]
    primary_access_code_id = first_result["access_code_id"]

    extra_access_code_ids: List[str] = []

    # 2️⃣ Den gleichen Code auf allen weiteren Geräten setzen
    for dev_id in extra_device_ids:
        try:
            res = create_access_code(
                device_id=dev_id,
                starts_at=starts_at,
                ends_at=ends_at,
                code=code,  # denselben Code verwenden!
            )
            extra_access_code_ids.append(res["access_code_id"])
            logger.info(f"Access-Code erfolgreich auf extra device {dev_id} gesetzt.")
        except Exception as e:
            logger.error(f"Fehler beim Setzen des Codes auf device {dev_id}: {e}")

    return code, primary_access_code_id, extra_access_code_ids

def delete_access_code(access_code_id: str):
    """
    Löscht einen Access-Code in Seam anhand seiner access_code_id.
    Wird genutzt, wenn eine Buchung endet oder storniert wird.
    """
    if not settings.SEAM_API_KEY:
        logger.error("delete_access_code: SEAM_API_KEY not set.")
        raise RuntimeError("SEAM_API_KEY not set. Bitte .env prüfen.")

    headers = {
        "Authorization": f"Bearer {settings.SEAM_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "access_code_id": access_code_id,
    }

    logger.info(
        f"Seam: POST /access_codes/delete für access_code_id={access_code_id}"
    )

    response = requests.post(
        f"{SEAM_BASE_URL}/access_codes/delete",
        headers=headers,
        json=payload,
    )

    try:
        data = response.json()
    except Exception:
        logger.error(
            f"Seam: Antwort von /access_codes/delete nicht als JSON lesbar. "
            f"Status={response.status_code}, Text={response.text}"
        )
        raise RuntimeError(
            f"Fehler beim Löschen des Access-Codes: "
            f"{response.status_code} - {response.text}"
        )

    if not response.ok or not data.get("ok", False):
        logger.error(f"Seam-Fehler beim Access-Code-Löschen: {data}")
        raise RuntimeError(f"Seam-Fehler beim Access-Code-Löschen: {data}")

    logger.info(
        f"Seam: Access-Code gelöscht: access_code_id={access_code_id}"
    )

    return {
        "ok": True,
        "data": data,
    }