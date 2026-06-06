"""JWT token yaratish va tekshirish + FastAPI dependency."""
import time

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

_bearer = HTTPBearer(auto_error=True)


def create_token(user_id: int) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + settings.JWT_EXPIRE_DAYS * 86400,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def get_current_user_id(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> int:
    try:
        payload = jwt.decode(creds.credentials, settings.JWT_SECRET, algorithms=["HS256"])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token yaroqsiz yoki muddati o'tgan",
        )
