from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from app.core.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_admin_user,
)
from app.core.config import settings
from app.core.rate_limiter import enforce_rate_limit
from app.models.user import UserCreate, create_user, get_user_by_email, User

router = APIRouter()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    is_active: bool
    is_admin: bool


def _check_api_key_for_registration(x_api_key: Optional[str] = None) -> None:
    """
    Optional: Registrierung von Usern nur erlauben, wenn ein gültiger API_KEY
    mitgesendet wird (z.B. für Admin-Setup).
    """
    if not settings.API_KEY:
        return

    if x_api_key != settings.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@router.post("/register", response_model=UserResponse)
def register_user(
    payload: UserCreate,
    x_api_key: Optional[str] = Header(default=None),
):
    """
    Legt einen neuen Benutzer an.
    Aktuell geschützt über API_KEY, damit nicht jeder frei Accounts erstellen kann.
    """
    _check_api_key_for_registration(x_api_key)

    # einfache Rate-Limitierung für Registrierungen
    enforce_rate_limit(
        key=f"auth_register:{x_api_key}",
        max_requests=10,
        window_seconds=60,
    )

    hashed = hash_password(payload.password)

    try:
        user = create_user(payload, hashed_password=hashed, is_admin=False)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
    )


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login mit E-Mail (als 'username' im Formular) und Passwort.
    Gibt ein JWT zurück, das für weitere Anfragen genutzt werden kann.
    """
    # einfache Rate-Limitierung für Logins nach Benutzername
    enforce_rate_limit(
        key=f"auth_login:{form_data.username}",
        max_requests=30,
        window_seconds=60,
    )

    user = get_user_by_email(form_data.username)
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid credentials.")

    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials.")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User inactive.")

    token = create_access_token(subject=user.id)

    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Gibt die Daten des aktuell eingeloggten Benutzers zurück.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
    )


@router.get("/admin-test")
def admin_test(current_admin: User = Depends(get_current_admin_user)):
    """
    Beispiel-Endpoint, der nur für Admins erreichbar ist.
    """
    return {"message": f"Hello, admin {current_admin.email}!"}