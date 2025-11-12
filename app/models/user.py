import os
import json
import uuid
from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.core.logger import logger

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
USERS_FILE = os.path.join(DATA_DIR, "users.json")


class User(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    hashed_password: str
    is_active: bool = True
    is_admin: bool = False
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    password: str


USERS: List[User] = []


def _user_to_dict(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "hashed_password": u.hashed_password,
        "is_active": u.is_active,
        "is_admin": u.is_admin,
        "created_at": u.created_at.isoformat(),
    }


def _user_from_dict(d: dict) -> User:
    return User(
        id=d["id"],
        email=d["email"],
        full_name=d.get("full_name"),
        hashed_password=d["hashed_password"],
        is_active=d.get("is_active", True),
        is_admin=d.get("is_admin", False),
        created_at=datetime.fromisoformat(d["created_at"]),
    )


def _load_users_from_disk() -> None:
    global USERS

    if not os.path.exists(USERS_FILE):
        USERS = []
        logger.info("Keine bestehende users.json gefunden. Starte mit leerer Userliste.")
        return

    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        USERS = [_user_from_dict(item) for item in data]
        logger.info(f"{len(USERS)} Benutzer aus {USERS_FILE} geladen.")
    except Exception as e:
        logger.warning(f"Konnte {USERS_FILE} nicht laden: {e}")
        USERS = []


def _save_users_to_disk() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    data = [_user_to_dict(u) for u in USERS]

    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        logger.info(f"{len(USERS)} Benutzer in {USERS_FILE} gespeichert.")
    except Exception as e:
        logger.warning(f"Konnte {USERS_FILE} nicht speichern: {e}")


def get_user_by_email(email: str) -> Optional[User]:
    for u in USERS:
        if u.email.lower() == email.lower():
            return u
    return None


def get_user_by_id(user_id: str) -> Optional[User]:
    for u in USERS:
        if u.id == user_id:
            return u
    return None


def create_user(data: UserCreate, hashed_password: str, is_admin: bool = False) -> User:
    if get_user_by_email(data.email) is not None:
        raise ValueError("User mit dieser E-Mail existiert bereits.")

    user = User(
        id=str(uuid.uuid4()),
        email=data.email,
        full_name=data.full_name,
        hashed_password=hashed_password,
        is_active=True,
        is_admin=is_admin,
        created_at=datetime.utcnow(),
    )

    USERS.append(user)
    _save_users_to_disk()

    logger.info(f"Neuer Benutzer angelegt: email={user.email}, is_admin={user.is_admin}")

    return user


# Beim Import laden
_load_users_from_disk()