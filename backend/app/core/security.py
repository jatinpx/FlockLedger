from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def verify_and_upgrade_password(plain: str, hashed: str) -> tuple[bool, str | None]:
    valid, new_hash = pwd_context.verify_and_update(plain, hashed)
    return valid, new_hash


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str | int, extra: dict[str, Any] | None = None) -> str:
    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=settings.access_token_expire_minutes),
    }
    if extra:
        to_encode.update(extra)
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
