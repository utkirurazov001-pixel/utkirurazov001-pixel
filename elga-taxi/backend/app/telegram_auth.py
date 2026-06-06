"""Telegram Mini App `initData` ni tekshirish.

Telegram foydalanuvchi ma'lumotini bot token'dan olingan maxfiy kalit bilan
imzolaydi (HMAC-SHA256). Bu yerda biz xuddi shu kalit bilan imzoni qayta
hisoblab solishtiramiz — mos kelsa, ma'lumot HAQIQIY (Telegram'dan kelgan,
soxta emas) deb hisoblanadi.

Hujjat: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from .config import settings


def verify_init_data(init_data: str) -> dict | None:
    """initData stringini tekshiradi. Haqiqiy bo'lsa user dict qaytaradi, aks holda None."""
    if not settings.BOT_TOKEN:
        raise RuntimeError("BOT_TOKEN o'rnatilmagan")
    if not init_data:
        return None

    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    # data_check_string: kalitlar alfavit bo'yicha, har biri "key=value", \n bilan
    data_check_string = "\n".join(f"{k}={parsed[k]}" for k in sorted(parsed))

    secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        return None

    # Replay (qayta ishlatish) hujumiga qarshi: auth_date juda eski bo'lmasin
    if settings.INITDATA_MAX_AGE:
        try:
            auth_date = int(parsed.get("auth_date", "0"))
        except ValueError:
            return None
        if time.time() - auth_date > settings.INITDATA_MAX_AGE:
            return None

    user_raw = parsed.get("user")
    if not user_raw:
        return None
    try:
        return json.loads(user_raw)
    except json.JSONDecodeError:
        return None
