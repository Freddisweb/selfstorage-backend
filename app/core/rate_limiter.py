import time
from collections import defaultdict
from typing import Dict, List

from fastapi import HTTPException


# einfache In-Memory-Struktur: key -> Liste von Zeitstempeln
_request_log: Dict[str, List[float]] = defaultdict(list)


def enforce_rate_limit(
    key: str,
    max_requests: int,
    window_seconds: int,
) -> None:
    """
    Sehr einfacher Rate-Limiter:
    - key: z.B. "bookings:<api_key>"
    - max_requests: maximal erlaubte Requests
    - window_seconds: Zeitfenster in Sekunden

    Wenn die Grenze überschritten wird, wirft die Funktion eine HTTPException 429.
    """
    now = time.time()
    window_start = now - window_seconds

    timestamps = _request_log[key]

    # alte Einträge aus dem Zeitfenster entfernen
    # (alle, die vor window_start liegen)
    while timestamps and timestamps[0] < window_start:
        timestamps.pop(0)

    if len(timestamps) >= max_requests:
        # Grenze überschritten -> 429 Too Many Requests
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please slow down.",
        )

    # aktuellen Request hinzufügen
    timestamps.append(now)