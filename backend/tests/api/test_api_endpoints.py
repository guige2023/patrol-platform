"""
API Endpoint Tests - Tests key API endpoints to catch routing and configuration issues.

Run with: pytest backend/tests/api/test_api_endpoints.py -v
"""

import pytest
import os
from httpx import AsyncClient, ASGITransport
from app.main import app

pytest_asyncio = pytest.importorskip("pytest_asyncio")

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")


@pytest_asyncio.fixture
async def client():
    """Async HTTP client for testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_client(client):
    """Authenticated HTTP client."""
    if not ADMIN_PASSWORD:
        pytest.skip("Set ADMIN_PASSWORD to run authenticated API tests")
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]

    client.headers["Authorization"] = f"Bearer {token}"
    return client


class TestKnowledgeEndpoints:
    """Test knowledge library attachment endpoints."""

    async def test_knowledge_list(self, auth_client):
        """Test GET /api/v1/knowledge/"""
        response = await auth_client.get("/api/v1/knowledge/")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "items" in data["data"]

    async def test_knowledge_attachments_list(self, auth_client):
        """Test GET /api/v1/knowledge/{id}/attachments"""
        # First get a knowledge ID
        list_response = await auth_client.get("/api/v1/knowledge/")
        items = list_response.json()["data"]["items"]
        if items:
            knowledge_id = items[0]["id"]
            response = await auth_client.get(f"/api/v1/knowledge/{knowledge_id}/attachments")
            # Should return 200 even if no attachments
            assert response.status_code == 200


class TestPlanEndpoints:
    """Test plan endpoints."""

    async def test_plan_list(self, auth_client):
        """Test GET /api/v1/plans/"""
        response = await auth_client.get("/api/v1/plans/")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "items" in data["data"]

    async def test_plan_years(self, auth_client):
        """Test GET /api/v1/plans/years"""
        response = await auth_client.get("/api/v1/plans/years")
        assert response.status_code == 200


class TestGroupEndpoints:
    """Test inspection group endpoints."""

    async def test_group_list(self, auth_client):
        """Test GET /api/v1/groups/"""
        response = await auth_client.get("/api/v1/groups/")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data


class TestUnitEndpoints:
    """Test unit endpoints."""

    async def test_unit_list(self, auth_client):
        """Test GET /api/v1/units/"""
        response = await auth_client.get("/api/v1/units/")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data

    async def test_unit_tree(self, auth_client):
        """Test GET /api/v1/units/tree"""
        response = await auth_client.get("/api/v1/units/tree")
        assert response.status_code == 200


class TestCadreEndpoints:
    """Test cadre endpoints."""

    async def test_cadre_list(self, auth_client):
        """Test GET /api/v1/cadres/"""
        response = await auth_client.get("/api/v1/cadres/")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data


class TestSystemConfigEndpoints:
    """Test system config endpoints."""

    async def test_system_configs(self, auth_client):
        """Test GET /api/v1/system-configs/"""
        response = await auth_client.get("/api/v1/system-configs/")
        assert response.status_code == 200


class TestAuthEndpoints:
    """Test authentication endpoints."""

    async def test_login(self, client):
        """Test POST /api/v1/auth/login"""
        if not ADMIN_PASSWORD:
            pytest.skip("Set ADMIN_PASSWORD to run login test")
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    async def test_me(self, auth_client):
        """Test GET /api/v1/auth/me"""
        response = await auth_client.get("/api/v1/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "username" in data


class TestDraftEndpoints:
    """Test draft endpoints."""

    async def test_draft_list(self, auth_client):
        """Test GET /api/v1/drafts/"""
        response = await auth_client.get("/api/v1/drafts/")
        assert response.status_code == 200


class TestClueEndpoints:
    """Test clue endpoints."""

    async def test_clue_list(self, auth_client):
        """Test GET /api/v1/clues/"""
        response = await auth_client.get("/api/v1/clues/")
        assert response.status_code == 200


class TestRectificationEndpoints:
    """Test rectification endpoints."""

    async def test_rectification_list(self, auth_client):
        """Test GET /api/v1/rectifications/"""
        response = await auth_client.get("/api/v1/rectifications/")
        assert response.status_code == 200


class TestNotificationEndpoints:
    """Test notification endpoints."""

    async def test_notification_list(self, auth_client):
        """Test GET /api/v1/notifications/"""
        response = await auth_client.get("/api/v1/notifications/")
        assert response.status_code == 200

    async def test_notification_unread_count(self, auth_client):
        """Test GET /api/v1/notifications/unread-count"""
        response = await auth_client.get("/api/v1/notifications/unread-count")
        assert response.status_code == 200


class TestWarningEndpoints:
    """Test warning endpoints."""

    async def test_warning_list(self, auth_client):
        """Test GET /api/v1/warnings/"""
        response = await auth_client.get("/api/v1/warnings/")
        assert response.status_code == 200

    async def test_warning_unread_count(self, auth_client):
        """Test GET /api/v1/warnings/unread-count"""
        response = await auth_client.get("/api/v1/warnings/unread-count")
        assert response.status_code == 200


class TestSearchEndpoints:
    """Test search endpoints."""

    async def test_search(self, auth_client):
        """Test GET /api/v1/search/"""
        response = await auth_client.get("/api/v1/search/", params={"q": "test"})
        assert response.status_code == 200
