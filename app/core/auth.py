import hashlib
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings
from app.models.user import get_user_by_email, get_user_by_id, User

# Dieses Schema wird NUR für Endpoints verwendet,
# die ein Login zwingend verlangen (get_current_user / Admin)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    """
    Einfache Passwort-Hash-Funktion.
    Für einen Prototyp okay, für Produktion später durch bcrypt/argon2 ersetzen.
    """
    salted = (password + settings.SECRET_KEY).encode("utf-8")  # Salt = SECRET_KEY
    return hashlib.sha256(salted).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


def create_access_token(
    subject: str,
    expires_minutes: Optional[int] = None,
) -> str:
    if expires_minutes is None:
        expires_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES

    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode = {"sub": subject, "exp": expire}

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Standard-Dependency für Endpoints, die ein gültiges Login erfordern.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired.",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
        )

    subject = payload.get("sub")
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    user = get_user_by_id(subject)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    return user


def get_current_user_optional(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> Optional[User]:
    """
    Variante von get_current_user, die KEINEN Fehler wirft, wenn:
    - kein Authorization-Header gesendet wird
    - der Header kein Bearer-Token enthält
    - oder das Token ungültig/abgelaufen ist.

    In diesen Fällen wird einfach None zurückgegeben.

    Perfekt für öffentliche Endpoints wie /boxes/available,
    die optional wissen dürfen, ob jemand eingeloggt ist.
    """
    if not authorization:
        return None

    # Erwartetes Format: "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token = parts[1]

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except (jwt.ExpiredSignatureError, jwt.PyJWTError):
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    user = get_user_by_id(user_id)
    if user is None or not user.is_active:
        return None

    return user


def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Nur für Admin-Endpunkte.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )
    return current_user