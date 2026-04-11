# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-11

### Added
- 完整前后端分离架构 (FastAPI + React 18)
- 16个 SQLAlchemy 模型 (User, Unit, Cadre, Knowledge, Plan, InspectionGroup, Draft, Clue, Rectification, Alert, Attachment, AuditLog, ModuleConfig, RuleConfig, Notification, Role/Permission)
- 15个 API 路由模块
- 安全核心: JWT认证, bcrypt密码, Fernet加密, RBAC权限, 审计日志
- RuleEngine 框架 (回避检测, 智能排程)
- Docker Compose 一键部署
- React 前端完整页面 (单位/干部/知识库/计划/巡察组/底稿/线索/整改/看板/管理)
- 多状态工作流 (计划: draft→submitted→approved→published)
- 整改红黄灯预警机制

## [0.1.0] - 2026-04-11

### Added
- 项目初始化
- 架构设计文档
