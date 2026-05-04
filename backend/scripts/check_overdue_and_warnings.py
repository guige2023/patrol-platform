#!/usr/bin/env python3
"""
定时检查超期整改/临近截止/底稿停滞/计划即将启动，
写入 alerts 和 warnings 表。
由 Hermes cron job 每小时调用一次。
"""
import asyncio
import sys
import os

# 将 backend 目录加入 path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import _get_async_session_local, UnitOfWork
from app.services.notification_service import check_overdue_and_warnings


async def main():
    async with _get_async_session_local()() as session:
        uow = UnitOfWork(session)
        try:
            await check_overdue_and_warnings(uow)
            print("check_overdue_and_warnings: OK")
        except Exception as e:
            print(f"check_overdue_and_warnings: ERROR {e}")
            raise


if __name__ == "__main__":
    asyncio.run(main())

