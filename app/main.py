from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import shutil
import json

from app.api import bookings, locks, camera, boxes, auth
from app.core.config import settings


def _seed_data_dir() -> None:
    """
    Stellt sicher, dass settings.DATA_DIR existiert und die erwarteten JSON-Dateien
    vorhanden sind. Fehlende Dateien werden aus dem Repo-Ordner /data kopiert.
    Wenn es auch dort keine Vorlage gibt, werden Minimal-JSONs angelegt.
    """
    data_dir = Path(settings.DATA_DIR)
    data_dir.mkdir(parents=True, exist_ok=True)

    # Quelle im Repo (read-only)
    repo_data_dir = Path(__file__).resolve().parents[1].parent / "data"
    # Erwartete Zieldateien
    targets = {
        "boxes.json": settings.BOXES_FILE,
        "bookings.json": settings.BOOKINGS_FILE,
        "users.json": settings.USERS_FILE,
        "site.json": settings.SITE_FILE,
    }

    for fname, target in targets.items():
        target_path = Path(target)
        if target_path.exists():
            continue

        src_path = repo_data_dir / fname
        if src_path.exists():
            try:
                shutil.copyfile(src_path, target_path)
                print(f"[Seed] Copied {src_path} -> {target_path}")
                continue
            except Exception as e:
                print(f"[Seed] Copy failed for {fname}: {e}")

        # Fallback: Minimal-Datei erzeugen
        minimal = []
        if fname == "site.json":
            minimal = {}
        try:
            with open(target_path, "w", encoding="utf-8") as f:
                json.dump(minimal, f, indent=2, ensure_ascii=False)
            print(f"[Seed] Created minimal {target_path}")
        except Exception as e:
            print(f"[Seed] Could not create {target_path}: {e}")


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

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else [],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Router
    app.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
    app.include_router(locks.router, prefix="/locks", tags=["Locks"])
    app.include_router(camera.router, prefix="/camera", tags=["Camera"])
    app.include_router(boxes.router, prefix="/boxes", tags=["Boxes"])
    app.include_router(auth.router, prefix="/auth", tags=["Auth"])

    # Startup-Seed
    @app.on_event("startup")
    def _on_startup() -> None:
        _seed_data_dir()

    # Health & Root
    @app.get("/", tags=["Health"])
    def root():
        return {
            "name": "SelfStorage API",
            "status": "ok",
            "environment": settings.ENVIRONMENT,
            "data_dir": str(settings.DATA_DIR),
            "docs": docs_url,
        }

    @app.get("/healthz", tags=["Health"])
    def healthz():
        return {"ok": True}

    return app


app = create_app()