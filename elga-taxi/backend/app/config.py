"""Sozlamalar — barchasi environment variables orqali olinadi."""
import os


class Settings:
    # Telegram botingizning tokeni (BotFather bergan). MAXFIY saqlanadi.
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")

    # JWT imzolash uchun maxfiy kalit. Productionda kuchli random qiymat qo'ying.
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    JWT_EXPIRE_DAYS: int = int(os.getenv("JWT_EXPIRE_DAYS", "30"))

    # AI (ovozli buyurtma + matn tahlili) uchun OpenAI kaliti.
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    # Ovozni matnga aylantiruvchi model (Whisper).
    STT_MODEL: str = os.getenv("STT_MODEL", "whisper-1")
    # Matndan buyurtma ajratib oluvchi model.
    PARSE_MODEL: str = os.getenv("PARSE_MODEL", "gpt-4o-mini")

    # initData qancha vaqt amal qiladi (sekund). 0 = tekshirilmaydi.
    INITDATA_MAX_AGE: int = int(os.getenv("INITDATA_MAX_AGE", "86400"))

    # Brauzerda (Telegramdan tashqari) test qilish uchun. Productionda 0!
    ALLOW_BROWSER_DEV: bool = os.getenv("ALLOW_BROWSER_DEV", "0") == "1"

    # SQLite bazasi joylashuvi.
    DB_PATH: str = os.getenv("DB_PATH", "elga.db")

    # CORS uchun ruxsat etilgan manzillar (vergul bilan). "*" = hammasi.
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")


settings = Settings()
