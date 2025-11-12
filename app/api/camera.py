from fastapi import APIRouter, Request

router = APIRouter()

@router.post("/event")
async def camera_event(request: Request):
    body = await request.json()
    # Hier kannst du später Logik einbauen, z. B. Alarmierungen, Logging, KI-Auswertung
    print("Camera event received:", body)
    return {"ok": True, "received": body}