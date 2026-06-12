# 🚖 ELGA TAXI — Telegram Mini App

Telegram ichida ishlaydigan taksi buyurtma ilovasi:

- ✅ **Avto-kirish** — Telegram `initData` orqali (SMS/parol yo'q)
- 🎙️ **AI ovozli buyurtma** — gapirasiz, AI manzilni o'zi to'ldiradi
- 📝 Buyurtma formasi, joylashuv, tariflar, buyurtmalar tarixi
- 🎨 Telegram mavzusiga moslashadi (qora/oq rejim)

## Tuzilma

```
elga-taxi/
├── backend/            FastAPI backend
│   └── app/
│       ├── main.py            endpointlar
│       ├── telegram_auth.py   initData imzosini tekshirish
│       ├── security.py        JWT
│       ├── ai.py              ovoz -> matn -> buyurtma (OpenAI)
│       └── store.py           SQLite (users, orders)
├── client/             Telegram Mini App (HTML/CSS/JS)
└── render.yaml         Render deploy
```

## Qanday ishlaydi (avto-kirish)

1. Mijoz bot ichidagi tugmadan Mini App'ni ochadi.
2. Telegram ilovaga **imzolangan** `initData` beradi (user_id, ism, hash…).
3. Client uni `POST /api/auth/telegram` ga yuboradi.
4. Backend imzoni **bot token** bilan qayta hisoblab tekshiradi — mos kelsa,
   ma'lumot haqiqiy → JWT beradi. Soxta initData ishlamaydi (token kerak).

## Ovozli buyurtma oqimi

```
🎤 mic -> audio -> POST /api/voice
      -> Whisper (ovoz->matn) -> LLM (matn->buyurtma)
      -> {qayerdan, qayerga, qachon, izoh} -> forma to'ladi
```

## Lokal ishga tushirish

```bash
cd elga-taxi/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # qiymatlarni to'ldiring
# Brauzerda test uchun .env da: ALLOW_BROWSER_DEV=1
uvicorn app.main:app --reload
```

So'ng oching: http://localhost:8000  (client shu yerdan tarqatiladi)

## Deploy (Render)

1. Reponi Render'ga ulang, `elga-taxi/render.yaml` ni tanlang.
2. Env'larda `BOT_TOKEN` va `OPENAI_API_KEY` ni kiriting (`JWT_SECRET` avtomatik).
3. Deploy bo'lgach HTTPS URL olasiz, masalan: `https://elga-taxi.onrender.com`

## BotFather sozlamasi (oxirgi qadam)

1. [@BotFather](https://t.me/BotFather) → `/mybots` → botingiz → **Bot Settings**
2. **Menu Button** → **Configure menu button** → URL: deploy URL (HTTPS)
3. Tamom — mijozlar bot ichidagi tugmadan ilovani ochib, **darrov kiradi**.

> Eslatma: Mini App **HTTPS** talab qiladi. `localhost` faqat dev uchun.

## Muhit o'zgaruvchilari

| Nomi | Tavsif |
|------|--------|
| `BOT_TOKEN` | Telegram bot tokeni (BotFather) — **maxfiy** |
| `JWT_SECRET` | JWT imzo kaliti — uzun random qiymat |
| `OPENAI_API_KEY` | Ovozli buyurtma uchun OpenAI kaliti |
| `STT_MODEL` | Ovoz->matn modeli (default `whisper-1`) |
| `PARSE_MODEL` | Matn->buyurtma modeli (default `gpt-4o-mini`) |
| `ALLOW_BROWSER_DEV` | Brauzerda test (`1`). Productionda `0`! |
| `INITDATA_MAX_AGE` | initData amal qilish muddati (sekund) |
