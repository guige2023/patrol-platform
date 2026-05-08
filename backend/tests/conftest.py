import os
# Must be set BEFORE any app imports to prevent settings validation from failing
os.environ["TESTING"] = "1"

import pytest


@pytest.fixture(autouse=True)
def reset_db_engine():
    """Reset the lazy DB engine/sessionmaker cache between tests.

    The app's database module uses module-level lazy globals (_engine,
    _async_session_local, _LazySessionLocalProxy._instance) that cache the engine
    bound to a specific event loop. When pytest-asyncio starts a new event loop
    for each test, the cached engine still references the old loop → 'attached to
    a different loop' errors.

    This fixture calls reset_for_testing() BEFORE each test so that the next test
    creates a fresh engine with the correct current event loop.
    """
    import app.database as db
    old_engine = db._engine

    # Reset all lazy singletons
    db.reset_for_testing()

    yield

    # Cleanup: dispose the engine from this test's session
    if old_engine is not None:
        import asyncio
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
        try:
            asyncio.ensure_future(old_engine.dispose())
        except RuntimeError:
            pass

    db.reset_for_testing()
