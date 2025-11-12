from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import bookings, locks, camera, boxes, auth
from app.core.config import settings


def create_app() -> FastAPI:
    # Doku-URLs abhängig von ENVIRONMENT
    if settings.ENVIRONMENT == "production":
        docs_url = None
        redoc_url = None
        openapi_url = None
    else:
        docs_url = "/docs"
        redoc_url = "/redoc"
        openapi_url = "/openapi.json"

    app = FastAPI(
        title="SelfStorage Prototype API",
        version="0.1.0",
        description="Backend für Self-Storage-Prototyp (TTLock + Seam + Kamera)",
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
    )

    # CORS-Middleware
    # In development: i.d.R. ["*"]
    # In production: nur explizit erlaubte Origins (settings.CORS_ORIGINS)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else [],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Router registrieren
    app.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
    app.include_router(locks.router, prefix="/locks", tags=["Locks"])
    app.include_router(camera.router, prefix="/camera", tags=["Camera"])
    app.include_router(boxes.router, prefix="/boxes", tags=["Boxes"])
    app.include_router(auth.router, prefix="/auth", tags=["Auth"])
    
    return app


app = create_app()