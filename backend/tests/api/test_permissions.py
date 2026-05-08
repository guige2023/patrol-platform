"""
Tests for RBAC permission checking (Z6: B-P1-1 三套权限统一).

Covers:
- _check_user_permissions uses in-memory user.roles (no N+1 DB query)
- Legacy user.role string field backward compat
- super_admin / * wildcard grants all permissions
- Missing permission raises 403
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

# Import after TESTING=1 is set in conftest
from app.dependencies import _check_user_permissions
from app.models.user import Role


class MockUser:
    """Minimal mock User with selectable roles/role field."""
    def __init__(self, roles=None, role_str=None, is_active=True):
        self.id = uuid4()
        self.roles = roles or []
        self._role_str = role_str
        self.is_active = is_active

    @property
    def role(self):
        return self._role_str


class MockRole:
    def __init__(self, code, permissions):
        self.code = code
        self.permissions = permissions


class MockDBSession:
    """Minimal mock AsyncSession — only accessed when falling back to user.role field."""
    def __init__(self):
        self.execute_calls = []

    async def execute(self, query):
        self.execute_calls.append(query)
        result = AsyncMock()
        result.scalar_one_or_none = MagicMock(return_value=None)
        return result


@pytest.mark.asyncio
async def test_super_admin_role_has_all_permissions():
    """超级管理员角色拥有所有权限（in-memory roles, no DB query）。"""
    role = MockRole("super_admin", ["user:read", "user:write"])
    user = MockUser(roles=[role])
    db = MockDBSession()

    # Should not raise — super_admin bypasses permission check
    result = await _check_user_permissions(user, db, ("anything:write",))
    assert result == user
    # No DB queries for super_admin
    assert len(db.execute_calls) == 0


@pytest.mark.asyncio
async def test_wildcard_permission_grants_all():
    """'*' wildcard in permissions grants all access（in-memory, no DB query）。"""
    role = MockRole("operator", ["*"])
    user = MockUser(roles=[role])
    db = MockDBSession()

    result = await _check_user_permissions(user, db, ("anything:read", "anything:write"))
    assert result == user
    assert len(db.execute_calls) == 0


@pytest.mark.asyncio
async def test_missing_permission_raises_403():
    """缺少必需权限时返回 403（in-memory roles, no DB query）。"""
    role = MockRole("operator", ["plan:read"])
    user = MockUser(roles=[role])
    db = MockDBSession()

    with pytest.raises(Exception) as exc_info:
        await _check_user_permissions(user, db, ("user:write",))
    assert exc_info.value.status_code == 403
    assert "缺少权限" in exc_info.value.detail
    assert len(db.execute_calls) == 0


@pytest.mark.asyncio
async def test_has_required_permission_succeeds():
    """拥有所需权限时通过检查（in-memory, no DB query）。"""
    role = MockRole("operator", ["user:read", "user:write", "plan:read"])
    user = MockUser(roles=[role])
    db = MockDBSession()

    result = await _check_user_permissions(user, db, ("user:write", "plan:read"))
    assert result == user
    assert len(db.execute_calls) == 0


@pytest.mark.asyncio
async def test_multiple_roles_union_permissions():
    """多角色时 permissions 取并集（in-memory）。"""
    role1 = MockRole("role1", ["user:read"])
    role2 = MockRole("role2", ["user:write"])
    user = MockUser(roles=[role1, role2])
    db = MockDBSession()

    # user:read from role1, user:write from role2
    result = await _check_user_permissions(user, db, ("user:write",))
    assert result == user

    with pytest.raises(Exception) as exc_info:
        await _check_user_permissions(user, db, ("plan:write",))
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_legacy_role_string_field_fallback():
    """当 user.roles 为空时，回退到 legacy user.role 字符串字段（触发 DB 查询）。"""
    user = MockUser(roles=[], role_str="operator")
    db = MockDBSession()

    # Should fall back to DB query
    with pytest.raises(Exception) as exc_info:
        await _check_user_permissions(user, db, ("user:write",))
    # DB was queried
    assert len(db.execute_calls) == 1


@pytest.mark.asyncio
async def test_legacy_role_super_admin_bypass():
    """Legacy user.role='super_admin' 也应 bypass（无 DB 查询因为角色字符串已知）。"""
    user = MockUser(roles=[], role_str="super_admin")
    db = MockDBSession()

    result = await _check_user_permissions(user, db, ("anything",))
    assert result == user
    # No DB query — role_str == 'super_admin' is handled before DB lookup
    assert len(db.execute_calls) == 0


@pytest.mark.asyncio
async def test_no_role_raises_403():
    """用户没有任何角色时返回 403。"""
    user = MockUser(roles=[], role_str=None)
    db = MockDBSession()

    with pytest.raises(Exception) as exc_info:
        await _check_user_permissions(user, db, ("user:read",))
    assert exc_info.value.status_code == 403
