#!/usr/bin/env python3
"""
权限与角色初始化脚本。
运行方式: python scripts/init_permissions.py

初始化内容：
1. permissions 表：所有权限定义（read/write/approve 三层分离）
2. roles 表：操作员 + 审批员默认角色

安全说明：
- 已存在的角色不会被覆盖
- super_admin 角色的 permissions 保持 ["*"] 不变
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import _get_async_session_local, UnitOfWork
from app.models.user import Permission, Role


# 所有权限定义
PERMISSIONS = [
    # 基础读权限
    {"code": "user:read", "name": "查看用户", "description": "查看用户列表和详情"},
    {"code": "unit:read", "name": "查看单位", "description": "查看单位档案"},
    {"code": "cadre:read", "name": "查看干部", "description": "查看干部人才库"},
    {"code": "clue:read", "name": "查看线索", "description": "查看线索管理"},
    {"code": "plan:read", "name": "查看计划", "description": "查看巡察计划"},
    {"code": "draft:read", "name": "查看底稿", "description": "查看巡察底稿"},
    {"code": "rectification:read", "name": "查看整改", "description": "查看整改任务"},
    {"code": "knowledge:read", "name": "查看知识库", "description": "查看知识库"},
    {"code": "audit:read", "name": "查看审计日志", "description": "查看操作日志"},
    {"code": "role:read", "name": "查看角色", "description": "查看角色列表"},
    {"code": "field_option:read", "name": "查看字段配置", "description": "查看字段选项配置"},
    {"code": "system_config:read", "name": "查看系统配置", "description": "查看系统设置"},
    {"code": "backup:read", "name": "查看备份", "description": "查看备份记录"},

    # 写权限（创建/编辑/提交）
    {"code": "user:write", "name": "管理用户", "description": "创建、编辑用户（不含删除）"},
    {"code": "unit:write", "name": "管理单位", "description": "创建、编辑单位档案"},
    {"code": "cadre:write", "name": "管理干部", "description": "创建、编辑干部信息"},
    {"code": "clue:write", "name": "管理线索", "description": "创建、编辑、移交线索"},
    {"code": "plan:write", "name": "管理计划", "description": "创建、编辑、提交巡察计划"},
    {"code": "draft:write", "name": "管理底稿", "description": "创建、编辑、提交底稿（不含审批）"},
    {"code": "rectification:write", "name": "管理整改", "description": "创建、编辑、签收、提交整改（不含审批）"},
    {"code": "knowledge:write", "name": "管理知识库", "description": "创建、编辑、上传知识库文档"},
    {"code": "role:write", "name": "管理角色", "description": "创建、编辑、删除角色"},
    {"code": "field_option:write", "name": "管理字段配置", "description": "编辑字段选项配置"},
    {"code": "system_config:write", "name": "管理系统配置", "description": "修改系统设置"},
    {"code": "backup:write", "name": "管理备份", "description": "创建备份、恢复数据"},

    # 审批权限（审核/验收/确认）
    {"code": "plan:approve", "name": "审批计划", "description": "审批通过/驳回巡察计划"},
    {"code": "draft:approve", "name": "审批底稿", "description": "初审、终审、审批通过/驳回底稿"},
    {"code": "rectification:approve", "name": "审批整改", "description": "验收、确认、驳回整改任务"},
    {"code": "clue:approve", "name": "审批线索", "description": "审核、结案线索"},
    {"code": "audit:write", "name": "管理审计日志", "description": "导出、清理审计日志"},
]

# 默认角色定义
DEFAULT_ROLES = [
    {
        "name": "操作员",
        "code": "operator",
        "description": "一线操作人员，可创建和提交业务数据，等待审批",
        "permissions": [
            "user:read", "unit:read", "cadre:read",
            "clue:read", "clue:write",
            "plan:read", "plan:write",
            "draft:read", "draft:write",
            "rectification:read", "rectification:write",
            "knowledge:read", "knowledge:write",
            "audit:read",
            "field_option:read",
            "backup:read",
        ],
    },
    {
        "name": "审批员",
        "code": "approver",
        "description": "审批人员，负责审核和验收一线提交的整改、底稿、计划等",
        "permissions": [
            "user:read",
            "unit:read", "cadre:read",
            "clue:read", "clue:write", "clue:approve",
            "plan:read", "plan:write", "plan:approve",
            "draft:read", "draft:approve",
            "rectification:read", "rectification:approve",
            "knowledge:read", "knowledge:write",
            "audit:read",
            "field_option:read",
            "backup:read",
        ],
    },
]


async def init_permissions():
    async with _get_async_session_local()() as session:
        uow = UnitOfWork(session)

        # 1. 插入 permissions（upsert：存在则跳过）
        perm_count = 0
        for perm_def in PERMISSIONS:
            result = await uow.execute(
                __import__("sqlalchemy").select(Permission).where(Permission.code == perm_def["code"])
            )
            existing = result.scalar_one_or_none()
            if not existing:
                perm = Permission(
                    code=perm_def["code"],
                    name=perm_def["name"],
                    description=perm_def.get("description"),
                )
                uow.add(perm)
                perm_count += 1
            else:
                # 更新 name/description（不影响现有角色 permissions 引用）
                existing.name = perm_def["name"]
                existing.description = perm_def.get("description")

        # 2. 插入 roles（upsert：存在则跳过）
        role_count = 0
        for role_def in DEFAULT_ROLES:
            result = await uow.execute(
                __import__("sqlalchemy").select(Role).where(Role.code == role_def["code"])
            )
            existing = result.scalar_one_or_none()
            if not existing:
                role = Role(
                    name=role_def["name"],
                    code=role_def["code"],
                    description=role_def["description"],
                    permissions=role_def["permissions"],
                    is_active=True,
                )
                uow.add(role)
                role_count += 1
            # 已存在的不修改（保留手动调整）

        await uow.commit()
        return perm_count, role_count


if __name__ == "__main__":
    import uuid
    from datetime import datetime

    async def main():
        perm_count, role_count = await init_permissions()
        print(f"✓ 权限初始化完成：新增 {perm_count} 条权限定义，新增 {role_count} 条角色")

    asyncio.run(main())
