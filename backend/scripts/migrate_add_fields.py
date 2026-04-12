"""Migration script to add new columns to existing tables."""
import asyncio
import sys
import json
sys.path.insert(0, '.')

from sqlalchemy import text
from app.database import AsyncSessionLocal, engine


async def migrate():
    async with engine.begin() as conn:
        # Check current DB type
        dialect = engine.dialect.name

        # --- system_configs table ---
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS system_configs (
                id VARCHAR(36) PRIMARY KEY,
                key VARCHAR(100) UNIQUE NOT NULL,
                value TEXT NOT NULL,
                description VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # --- units: add last_inspection_year, inspection_history ---
        if dialect == 'sqlite':
            # Check if column exists
            result = await conn.execute(text("PRAGMA table_info(units)"))
            columns = [row[1] for row in result.fetchall()]
            if 'last_inspection_year' not in columns:
                await conn.execute(text("ALTER TABLE units ADD COLUMN last_inspection_year INTEGER"))
            if 'inspection_history' not in columns:
                await conn.execute(text("ALTER TABLE units ADD COLUMN inspection_history VARCHAR(1000)"))
        else:
            # PostgreSQL
            try:
                await conn.execute(text("ALTER TABLE units ADD COLUMN last_inspection_year INTEGER"))
            except Exception:
                pass
            try:
                await conn.execute(text("ALTER TABLE units ADD COLUMN inspection_history VARCHAR(1000)"))
            except Exception:
                pass

        # --- cadres: add category ---
        if dialect == 'sqlite':
            result = await conn.execute(text("PRAGMA table_info(cadres)"))
            columns = [row[1] for row in result.fetchall()]
            if 'category' not in columns:
                await conn.execute(text("ALTER TABLE cadres ADD COLUMN category VARCHAR(100)"))
        else:
            try:
                await conn.execute(text("ALTER TABLE cadres ADD COLUMN category VARCHAR(100)"))
            except Exception:
                pass

        # --- knowledge: add attachments ---
        if dialect == 'sqlite':
            result = await conn.execute(text("PRAGMA table_info(knowledge)"))
            columns = [row[1] for row in result.fetchall()]
            if 'attachments' not in columns:
                await conn.execute(text("ALTER TABLE knowledge ADD COLUMN attachments TEXT"))
        else:
            try:
                await conn.execute(text("ALTER TABLE knowledge ADD COLUMN attachments JSON"))
            except Exception:
                pass

    print("Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
