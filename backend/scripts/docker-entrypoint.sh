#!/bin/bash
set -e

echo "Running database migrations..."
cd /app

# Run alembic migrations
alembic upgrade head

# Initialize database (creates admin user, roles, system config if not exists)
echo "Initializing database..."
python scripts/init_db.py

echo "Starting uvicorn server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
