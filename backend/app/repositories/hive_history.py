"""Repositories for Hive query history and saved queries."""

from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hive_history import HiveQueryHistory, HiveSavedQuery


class HiveQueryHistoryRepository:
    @staticmethod
    async def create(
        db: AsyncSession,
        *,
        user_id: int,
        sql: str,
        row_count: int = 0,
        duration_ms: int = 0,
        status: str = "success",
        error_message: Optional[str] = None,
    ) -> HiveQueryHistory:
        row = HiveQueryHistory(
            user_id=user_id,
            sql=sql,
            row_count=row_count,
            duration_ms=duration_ms,
            status=status,
            error_message=error_message,
        )
        db.add(row)
        await db.flush()
        await db.refresh(row)
        return row

    @staticmethod
    async def list_for_user(
        db: AsyncSession, user_id: int, limit: int = 50
    ) -> list[HiveQueryHistory]:
        stmt = (
            select(HiveQueryHistory)
            .where(
                HiveQueryHistory.user_id == user_id,
                HiveQueryHistory.deleted_at.is_(None),
            )
            .order_by(desc(HiveQueryHistory.created_at))
            .limit(limit)
        )
        return list((await db.execute(stmt)).scalars().all())


class HiveSavedQueryRepository:
    @staticmethod
    async def create(
        db: AsyncSession,
        *,
        user_id: int,
        name: str,
        sql: str,
        description: Optional[str] = None,
    ) -> HiveSavedQuery:
        row = HiveSavedQuery(
            user_id=user_id, name=name, sql=sql, description=description
        )
        db.add(row)
        await db.flush()
        await db.refresh(row)
        return row

    @staticmethod
    async def list_for_user(
        db: AsyncSession, user_id: int
    ) -> list[HiveSavedQuery]:
        stmt = (
            select(HiveSavedQuery)
            .where(
                HiveSavedQuery.user_id == user_id,
                HiveSavedQuery.deleted_at.is_(None),
            )
            .order_by(desc(HiveSavedQuery.updated_at))
        )
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def get_by_id(
        db: AsyncSession, saved_id: int, user_id: int
    ) -> Optional[HiveSavedQuery]:
        stmt = select(HiveSavedQuery).where(
            HiveSavedQuery.id == saved_id,
            HiveSavedQuery.user_id == user_id,
            HiveSavedQuery.deleted_at.is_(None),
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def update(
        db: AsyncSession, row: HiveSavedQuery, data: dict
    ) -> HiveSavedQuery:
        for k, v in data.items():
            setattr(row, k, v)
        await db.flush()
        await db.refresh(row)
        return row

    @staticmethod
    async def soft_delete(db: AsyncSession, row: HiveSavedQuery) -> None:
        from datetime import datetime, timezone

        row.deleted_at = datetime.now(timezone.utc)
        await db.flush()
