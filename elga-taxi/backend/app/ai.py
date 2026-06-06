"""AI ovozli buyurtma: ovoz -> matn (Whisper) -> tuzilgan buyurtma (LLM).

Oqim:
  1) Mijoz ovozli xabar yuboradi (mic).
  2) `transcribe()` ovozni matnga aylantiradi (o'zbek/rus/ingliz).
  3) `parse_order()` matndan {qayerdan, qayerga, qachon, izoh} ni ajratadi.
"""
import io
import json

from openai import OpenAI

from .config import settings

_client: OpenAI | None = None


def _openai() -> OpenAI:
    global _client
    if _client is None:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY o'rnatilmagan")
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def transcribe(audio_bytes: bytes, filename: str = "voice.webm") -> str:
    """Ovozli faylni matnga aylantiradi."""
    buf = io.BytesIO(audio_bytes)
    buf.name = filename  # OpenAI SDK fayl nomi (kengaytma) bo'yicha formatni aniqlaydi
    result = _openai().audio.transcriptions.create(
        model=settings.STT_MODEL,
        file=buf,
    )
    return (result.text or "").strip()


_SYSTEM_PROMPT = (
    "Sen ELGA TAXI uchun buyurtma yig'uvchi yordamchisan. Foydalanuvchining "
    "tabiiy tildagi (o'zbek/rus) gapidan taksi buyurtmasini ajratib ol. "
    "Faqat berilgan ma'lumotni qaytar, hech narsa o'ylab topma. "
    "Topilmagan maydonni null qoldir."
)

_TOOL = {
    "type": "function",
    "function": {
        "name": "create_taxi_order",
        "description": "Foydalanuvchi gapidan taksi buyurtmasi maydonlarini ajratadi",
        "parameters": {
            "type": "object",
            "properties": {
                "from_address": {
                    "type": ["string", "null"],
                    "description": "Qayerdan (manzil/mo'ljal). Masalan: 'Chilonzor 9-kvartal'",
                },
                "to_address": {
                    "type": ["string", "null"],
                    "description": "Qayerga (manzil/mo'ljal). Masalan: 'Aeroport'",
                },
                "when_text": {
                    "type": ["string", "null"],
                    "description": "Qachon. Masalan: 'hozir', '30 daqiqadan keyin', 'ertaga 8:00'",
                },
                "notes": {
                    "type": ["string", "null"],
                    "description": "Qo'shimcha izoh. Masalan: 'bolalar o'rindig'i kerak'",
                },
            },
            "required": ["from_address", "to_address", "when_text", "notes"],
            "additionalProperties": False,
        },
    },
}


def parse_order(text: str) -> dict:
    """Erkin matndan tuzilgan buyurtma maydonlarini ajratadi."""
    if not text:
        return {"from_address": None, "to_address": None, "when_text": None, "notes": None}

    resp = _openai().chat.completions.create(
        model=settings.PARSE_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        tools=[_TOOL],
        tool_choice={"type": "function", "function": {"name": "create_taxi_order"}},
        temperature=0,
    )
    tool_calls = resp.choices[0].message.tool_calls
    if not tool_calls:
        return {"from_address": None, "to_address": None, "when_text": None, "notes": None}
    args = json.loads(tool_calls[0].function.arguments)
    return {
        "from_address": args.get("from_address"),
        "to_address": args.get("to_address"),
        "when_text": args.get("when_text"),
        "notes": args.get("notes"),
    }
