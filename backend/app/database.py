from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import String, TypeDecorator
from app.config import settings


Base = declarative_base()


class GUIDTypeDecorator(TypeDecorator):
    """跨数据库 UUID 类型：PostgreSQL 用原生 UUID，SQLite 用 String(36)"""
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID
            return dialect.type_descriptor(UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return value


engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=20, max_overflow=30)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


class UnitOfWork:
    """
    Unit of Work 包装 AsyncSession，保证每次 commit 前都 flush。

    核心原则：所有数据库 commit 必须经过 UnitOfWork，自动在 commit 前调用 flush()。
    JSON 列修改后 flush() 是必须的，否则 SQLAlchemy 的脏检查会跳过写入。

    用法:
        async def endpoint(uow: UnitOfWork):
            await uow.execute(select(...))
            await uow.add(obj)
            await uow.commit()   # flush + commit

    注意: UnitOfWork 实现了 __getattr__ 代理，所有 session 方法（如 execute,
    add, delete, refresh）都直接代理到内部 session，所以代码可以写 uow.execute()
    而不是 uow.session.execute()。
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    @property
    def session(self) -> AsyncSession:
        """暴露底层 session，供需要 AsyncSession 的外部函数使用"""
        return self._session

    def __getattr__(self, name: str):
        """透明代理 session 的所有方法（如 execute, add, delete, refresh 等）
        注意：commit/rollback/close 三个方法不走 __getattr__，用类自己的实现"""
        return getattr(self._session, name)

    # 下面三个用自己实现，不走 __getattr__（否则会被 session.commit 覆盖）
    async def commit(self) -> None:
        """
        可靠的 commit：先 flush 所有待处理变更，再 commit。

        问题背景：
        当修改 JSON 列（如 model.attachments = new_list）时，SQLAlchemy async
        的脏检查基于对象引用而非内容。重新赋值的列表如果引用相同，
        SQLAlchemy 认为"没改"，导致 commit 跳过写入。

        解决：commit 前强制 flush()，让 SQLAlchemy 立即同步所有待处理变更到数据库。
        """
        await self._session.flush()
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()

    async def close(self) -> None:
        await self._session.close()


async def get_uow():
    """Unit of Work 工厂函数，通过 FastAPI 依赖注入使用"""
    async with AsyncSessionLocal() as session:
        uow = UnitOfWork(session)
        try:
            yield uow
        finally:
            await uow.close()
