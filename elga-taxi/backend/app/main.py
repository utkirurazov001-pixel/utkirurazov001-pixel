"""ELGA TAXI — Mini App backend (FastAPI).

Endpointlar:
  POST /api/auth/telegram   — initData ni tekshirib, JWT beradi (avto-kirish)
  POST /api/voice           — ovozli buyurtma: ovoz -> matn -> tuzilgan buyurtma
  POST /api/orders          — buyurtma yaratish
  GET  /api/orders          — foydalanuvchi buyurtmalari
  POST /api/me/phone        — telefon raqamini saqlash
  GET  /api/me              — joriy foydalanuvchi
"""
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import ai, store
from .config import settings
from .security import create_token, get_current_user_id
from .telegram_auth import verify_init_data

app = FastAPI(title="ELGA TAXI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.CORS_ORIGINS == "*" else settings.CORS_ORIGINS.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    store.init_db()


# ---------- Auth ----------

class TelegramAuthIn(BaseModel):
    init_data: str


@app.post("/api/auth/telegram")
def auth_telegram(body: TelegramAuthIn):
    user = verify_init_data(body.init_data)

    # Faqat development uchun: brauzerda test qilishga ruxsat (productionda o'chiq)
    if user is None and settings.ALLOW_BROWSER_DEV:
        user = {"id": 0, "first_name": "Dev", "username": "dev"}

    if user is None:
        raise HTTPException(status_code=401, detail="initData yaroqsiz")

    tg_id = int(user["id"])
    store.upsert_user(tg_id, user.get("first_name", ""), user.get("username"))
    saved = store.get_user(tg_id) or {}
    return {
        "token": create_token(tg_id),
        "user": {
            "telegram_id": tg_id,
            "first_name": user.get("first_name", ""),
            "username": user.get("username"),
            "phone": saved.get("phone"),
        },
    }


# ---------- Foydalanuvchi ----------

@app.get("/api/me")
def me(uid: int = Depends(get_current_user_id)):
    user = store.get_user(uid)
    if not user:
        raise HTTPException(status_code=404, detail="Topilmadi")
    return user


class PhoneIn(BaseModel):
    phone: str


@app.post("/api/me/phone")
def set_phone(body: PhoneIn, uid: int = Depends(get_current_user_id)):
    store.set_user_phone(uid, body.phone.strip())
    return {"ok": True}


# ---------- Ovozli buyurtma (AI) ----------

@app.post("/api/voice")
async def voice_order(
    audio: UploadFile = File(...),
    uid: int = Depends(get_current_user_id),
):
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Bo'sh audio")
    try:
        text = ai.transcribe(data, audio.filename or "voice.webm")
        order = ai.parse_order(text)
    except Exception as exc:  # noqa: BLE001 — foydalanuvchiga tushunarli xato qaytaramiz
        raise HTTPException(status_code=502, detail=f"AI xatosi: {exc}")
    return {"transcript": text, "order": order}


# ---------- Buyurtmalar ----------

class OrderIn(BaseModel):
    from_address: str | None = None
    to_address: str | None = None
    when_text: str | None = None
    notes: str | None = None


@app.post("/api/orders")
def create_order(body: OrderIn, uid: int = Depends(get_current_user_id)):
    if not body.from_address or not body.to_address:
        raise HTTPException(status_code=400, detail="Qayerdan va qayerga majburiy")
    return store.create_order(uid, body.model_dump())


@app.get("/api/orders")
def my_orders(uid: int = Depends(get_current_user_id)):
    return store.list_orders(uid)


@app.get("/api/health")
def health():
    return {"ok": True}


# ---------- Statik client (Mini App) ----------
# Backend va clientni bitta domendan tarqatish uchun (CORS muammosiz).
import os  # noqa: E402

_client_dir = os.path.join(os.path.dirname(__file__), "..", "..", "client")
if os.path.isdir(_client_dir):
    app.mount("/", StaticFiles(directory=_client_dir, html=True), name="client")
