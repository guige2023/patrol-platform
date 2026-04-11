"""初始化数据库和默认管理员账号"""
import asyncio
import sys
sys.path.insert(0, '.')

from app.database import AsyncSessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.user import User
from app.models.unit import Unit
from app.models.role import Role
from app.models.module_config import ModuleConfig


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSessionLocal() as db:
        # 创建默认管理员
        admin = User(
            username="admin",
            email="admin@patrol.local",
            hashed_password=get_password_hash("admin123"),
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
        
        # 创建默认单位
        root_unit = Unit(
            name="巡察工作领导小组",
            org_code="ROOT",
            unit_type="organization",
            level=0,
        )
        db.add(root_unit)
        
        # 初始化模块配置
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
            m = ModuleConfig(module_code=code, module_name=name, is_enabled=True)
            db.add(m)
        
        await db.commit()
        print("数据库初始化完成! 管理员账号: admin / admin123")


if __name__ == "__main__":
    asyncio.run(init_db())
