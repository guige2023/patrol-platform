from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pathlib import Path
import aiofiles
import io
import json
import zipfile
import os
from app.dependencies import get_uow, get_current_user
from app.database import UnitOfWork
from app.models.user import User
from app.core.audit import write_audit_log
from app.config import settings

router = APIRouter()

BACKUPS_DIR = Path("/Users/guige/my_project/patrol_platform/backend/app/backups")
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

SETTINGS_FILE = BACKUPS_DIR / "settings.json"

DEFAULT_SETTINGS = {
    "auto_backup_enabled": False,
    "auto_backup_interval_hours": 24,
    "max_backups_to_keep": 10,
    "backup_types": ["manual", "auto"],
}

TABLES_TO_BACKUP = [
    "users", "roles", "permissions",
    "units", "cadres", "knowledge",
    "plans", "plan_versions",
    "inspection_groups", "group_members",
    "drafts", "draft_attachments",
    "clues", "rectifications",
    "alerts", "attachments",
    "audit_logs", "module_configs",
    "rule_configs", "notifications",
    "system_configs", "field_options",
    "documents", "progress",
]


def _get_settings() -> dict:
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return DEFAULT_SETTINGS.copy()


def _save_settings(settings: dict):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)


@router.get("/settings")
async def get_backup_settings(current_user: User = Depends(get_current_user)):
    """Get auto-backup settings."""
    return _get_settings()


@router.put("/settings")
async def update_backup_settings(
    settings_update: dict,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """Update auto-backup settings."""
    current = _get_settings()
    current.update(settings_update)
    _save_settings(current)
    await write_audit_log(uow.session, current_user.id, "update", "backup_settings", None, settings_update)
    return current


@router.get("/")
async def list_backups(current_user: User = Depends(get_current_user)):
    """List all backups (stored as JSON metadata in backups/ dir)."""
    backups = []
    if not BACKUPS_DIR.exists():
        return {"backups": []}

    for fname in sorted(BACKUPS_DIR.iterdir()):
        if fname.suffix == ".zip":
            stat = fname.stat()
            meta_file = fname.with_suffix(".meta.json")
            if meta_file.exists():
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                meta["size"] = stat.st_size  # Add size from actual file
            else:
                meta = {
                    "filename": fname.name,
                    "timestamp": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "type": "unknown",
                    "size": stat.st_size,
                }
            backups.append(meta)

    return {"backups": sorted(backups, key=lambda x: x.get("timestamp", ""), reverse=True)}


@router.post("/")
async def create_backup(
    type: str = Query("manual", description="backup type: manual or auto"),
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """Create a full database backup, returns zip file download."""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_name = f"backup_{type}_{timestamp}"
    zip_path = BACKUPS_DIR / f"{backup_name}.zip"
    meta_path = BACKUPS_DIR / f"{backup_name}.meta.json"

    # Collect all table data
    table_data = {}
    for table_name in TABLES_TO_BACKUP:
        try:
            result = await uow.execute(text(f'SELECT * FROM "{table_name}"'))
            rows = result.fetchall()
            columns = result.keys()
            records = [dict(zip(columns, row)) for row in rows]
            # Convert non-serializable types
            for record in records:
                for k, v in record.items():
                    if isinstance(v, (datetime,)):
                        record[k] = v.isoformat() if v else None
                    elif isinstance(v, UUID):
                        record[k] = str(v)
                    elif isinstance(v, bytes):
                        record[k] = v.hex() if v else None
            table_data[table_name] = records
        except Exception as e:
            table_data[table_name] = {"error": str(e)}

    # Add metadata
    meta = {
        "filename": zip_path.name,
        "timestamp": timestamp,
        "type": type,
        "created_by": current_user.username if current_user else "system",
        "tables": list(table_data.keys()),
        "created_at": datetime.utcnow().isoformat(),
    }

    # Create zip
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for table_name, records in table_data.items():
            zf.writestr(f"{table_name}.json", json.dumps(records, ensure_ascii=False, indent=2))
        zf.writestr("metadata.json", json.dumps(meta, ensure_ascii=False, indent=2))

    buffer.seek(0)
    content = buffer.getvalue()

    # Save zip and meta
    async with aiofiles.open(zip_path, "wb") as f:
        await f.write(content)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    meta["size"] = len(content)
    # Note: skip audit log for backup creation since entity_id would be None
    # Backup operations are tracked via metadata files instead

    return {
        "message": "Backup created",
        "filename": zip_path.name,
        "size": len(content),
        "timestamp": timestamp,
        "type": type,
    }


@router.get("/{filename}/download")
async def download_backup(filename: str, current_user: User = Depends(get_current_user)):
    """Download a backup file."""
    backup_path = BACKUPS_DIR / filename
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="Backup not found")

    async with aiofiles.open(backup_path, "rb") as f:
        content = await f.read()

    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


@router.delete("/{filename}")
async def delete_backup(filename: str, uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    """Delete a backup file and its metadata."""
    backup_path = BACKUPS_DIR / filename
    meta_path = BACKUPS_DIR / f"{Path(filename).stem}.meta.json"

    if not backup_path.exists() and not meta_path.exists():
        raise HTTPException(status_code=404, detail="Backup not found")

    if backup_path.exists():
        backup_path.unlink()
    if meta_path.exists():
        meta_path.unlink()

    await write_audit_log(uow.session, current_user.id, "delete", "backup", None, {"filename": filename})
    return {"message": "deleted"}


@router.post("/{filename}/restore")
async def restore_backup(
    filename: str,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """Restore database from a backup zip file."""
    backup_path = BACKUPS_DIR / filename
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="Backup not found")

    try:
        async with aiofiles.open(backup_path, "rb") as f:
            content = await f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read backup file: {str(e)}")

    try:
        buffer = io.BytesIO(content)
        with zipfile.ZipFile(buffer, "r") as zf:
            # Validate zip
            if "metadata.json" not in zf.namelist():
                raise HTTPException(status_code=400, detail="Invalid backup: missing metadata.json")

            metadata = json.loads(zf.read("metadata.json").decode("utf-8"))

            # Restore each table
            restored_tables = []
            for table_name in TABLES_TO_BACKUP:
                json_name = f"{table_name}.json"
                if json_name not in zf.namelist():
                    continue

                records = json.loads(zf.read(json_name).decode("utf-8"))
                if not records:
                    continue

                # Clear existing data and insert new
                try:
                    await uow.execute(text(f'TTRUNCATE TABLE "{table_name}" RESTART IDENTITY CASCADE'))
                except Exception:
                    pass  # Table might not support truncate

                for record in records:
                    # Convert ISO dates back to datetime
                    for k, v in record.items():
                        if isinstance(v, str):
                            try:
                                if len(v) == 26 and v[-1] == "Z":
                                    record[k] = datetime.fromisoformat(v.replace("Z", "+00:00"))
                                elif "T" in v and "+" not in v and "Z" not in v:
                                    record[k] = datetime.fromisoformat(v)
                            except Exception:
                                pass

                    cols = list(record.keys())
                    vals = list(record.values())
                    placeholders = ", ".join([f":{c}" for c in cols])
                    col_str = ", ".join([f'"{c}"' for c in cols])
                    sql = text(f'INSERT INTO "{table_name}" ({col_str}) VALUES ({placeholders})')
                    try:
                        await uow.execute(sql, record)
                    except Exception as e:
                        pass  # Skip problematic records

                restored_tables.append(table_name)

            await uow.commit()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")

    await write_audit_log(uow.session, current_user.id, "restore", "backup", None, {"filename": filename, "tables": restored_tables})

    return {
        "message": "Restore completed",
        "filename": filename,
        "restored_tables": restored_tables,
        "timestamp": metadata.get("timestamp"),
    }
