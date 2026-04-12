"""初始化数据库和默认管理员账号（幂等）"""
import asyncio
import sys
import json
sys.path.insert(0, '.')

from sqlalchemy import select
from app.database import AsyncSessionLocal, engine, Base
from app.services.auth import AuthService
from app.models.user import User, Role
from app.models.unit import Unit
from app.models.module_config import ModuleConfig
from app.models.system_config import SystemConfig


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # 创建默认管理员（幂等）
        existing_admin = await db.execute(select(User).where(User.username == "admin"))
        if not existing_admin.scalar_one_or_none():
            admin = User(
                username="admin",
                email="admin@patrol.local",
                hashed_password=AuthService.get_password_hash("admin123"),
                full_name="系统管理员",
                is_active=True,
            )
            db.add(admin)

            # 创建默认角色
            admin_role = Role(
                name="超级管理员",
                code="super_admin",
                description="拥有所有权限",
                permissions=["*"],
            )
            db.add(admin_role)
            admin.roles.append(admin_role)

        # 创建默认单位（幂等）
        existing_unit = await db.execute(select(Unit).where(Unit.org_code == "ROOT"))
        if not existing_unit.scalar_one_or_none():
            root_unit = Unit(
                name="巡察工作领导小组",
                org_code="ROOT",
                unit_type="organization",
                level=0,
            )
            db.add(root_unit)

        # 初始化模块配置（幂等）
        modules = [
            ("unit", "单位档案模块"),
            ("cadre", "干部人才库模块"),
            ("knowledge", "知识库模块"),
            ("plan", "巡察计划模块"),
            ("inspection_group", "巡察组模块"),
            ("draft", "底稿管理模块"),
            ("clue", "线索管理模块"),
            ("rectification", "整改督办模块"),
            ("alert", "预警模块"),
            ("dashboard", "数据看板模块"),
        ]
        for code, name in modules:
            existing = await db.execute(select(ModuleConfig).where(ModuleConfig.module_code == code))
            if not existing.scalar_one_or_none():
                m = ModuleConfig(module_code=code, module_name=name, is_enabled=True)
                db.add(m)

        # 初始化系统配置（幂等）
        default_configs = [
            ("district_name", "XX新区", "新区名称"),
            ("patrol_cycle_years", "5", "巡察周期年数"),
            ("patrol_duration_days", "30", "每次巡察持续工作日天数"),
            ("key_areas", json.dumps([
                "贯彻落实党中央重大决策部署情况",
                "落实全面从严治党主体责任情况",
                "党风廉政建设和反腐败工作情况",
                "执行民主集中制和选人用人情况",
                "落实巡视巡察整改情况",
                "其他需要关注的重点领域"
            ]), "重点领域预设列表"),
            ("patrol_cycle_start_date", "2021-01-01", "当前巡察周期起始日期"),
        ]
        for key, value, description in default_configs:
            existing = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
            if not existing.scalar_one_or_none():
                config = SystemConfig(key=key, value=value, description=description)
                db.add(config)

        await db.commit()
        print("数据库初始化完成! 管理员账号: admin / admin123")


if __name__ == "__main__":
    asyncio.run(init_db())
