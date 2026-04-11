"""跨数据库兼容的 GUID 类型"""
from sqlalchemy import String, TypeDecorator


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
