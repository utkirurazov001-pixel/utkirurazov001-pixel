"""Oddiy SQLite ma'lumotlar bazasi (foydalanuvchilar + buyurtmalar).

MVP uchun yetarli. Render free planda disk efemer (qayta ishga tushganda
o'chadi) — productionda Postgres'ga o'tkazish tavsiya etiladi.
"""
import sqlite3
import time
from contextlib import contextmanager

from .config import settings


@contextmanager
def _conn():
    conn = sqlite3.connect(settings.DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                telegram_id INTEGER PRIMARY KEY,
                first_name  TEXT,
                username    TEXT,
                phone       TEXT,
                created_at  INTEGER
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id  INTEGER,
                from_address TEXT,
                to_address   TEXT,
                when_text    TEXT,
                notes        TEXT,
                status       TEXT DEFAULT 'new',
                created_at   INTEGER
            )
            """
        )


def upsert_user(telegram_id: int, first_name: str, username: str | None) -> None:
    with _conn() as c:
        c.execute(
            """
            INSERT INTO users (telegram_id, first_name, username, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(telegram_id) DO UPDATE SET
                first_name = excluded.first_name,
                username   = excluded.username
            """,
            (telegram_id, first_name, username, int(time.time())),
        )


def set_user_phone(telegram_id: int, phone: str) -> None:
    with _conn() as c:
        c.execute("UPDATE users SET phone = ? WHERE telegram_id = ?", (phone, telegram_id))


def get_user(telegram_id: int) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)).fetchone()
        return dict(row) if row else None


def create_order(telegram_id: int, data: dict) -> dict:
    with _conn() as c:
        cur = c.execute(
            """
            INSERT INTO orders (telegram_id, from_address, to_address, when_text, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                telegram_id,
                data.get("from_address"),
                data.get("to_address"),
                data.get("when_text"),
                data.get("notes"),
                int(time.time()),
            ),
        )
        oid = cur.lastrowid
        row = c.execute("SELECT * FROM orders WHERE id = ?", (oid,)).fetchone()
        return dict(row)


def list_orders(telegram_id: int) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM orders WHERE telegram_id = ? ORDER BY id DESC LIMIT 20",
            (telegram_id,),
        ).fetchall()
        return [dict(r) for r in rows]
