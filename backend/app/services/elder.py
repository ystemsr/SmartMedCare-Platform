"""Business logic for elder management."""

import logging
import secrets
import string

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.repositories.elder import ElderRepository
from app.schemas.elder import ElderCreate, ElderResponse, ElderUpdate
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)


def _role_names(user) -> set[str]:
    """Return role-name set for the given user (relies on loaded user_roles)."""
    return {ur.role.name for ur in getattr(user, "user_roles", [])}


class ElderService:
    """Elder management business operations."""

    @staticmethod
    def _is_admin(user) -> bool:
        return "admin" in _role_names(user)

    @staticmethod
    def _is_doctor_only(user) -> bool:
        roles = _role_names(user)
        return "doctor" in roles and "admin" not in roles

    @staticmethod
    async def _doctor_owns(
        db: AsyncSession, elder_id: int, doctor_user_id: int
    ) -> bool:
        """Return True if the elder's primary_doctor_id matches the given id."""
        elder = await ElderRepository.get_by_id(db, elder_id)
        return elder is not None and elder.primary_doctor_id == doctor_user_id

    @staticmethod
    async def _attach_doctor_name(db: AsyncSession, response: ElderResponse) -> None:
        """Populate primary_doctor_name from users table."""
        if response.primary_doctor_id is None:
            return
        from sqlalchemy import select as sa_select
        from app.models.user import User

        row = (
            await db.execute(
                sa_select(User.real_name, User.username).where(
                    User.id == response.primary_doctor_id
                )
            )
        ).first()
        if row is not None:
            response.primary_doctor_name = row[0] or row[1]

    @staticmethod
    async def create_elder(
        db: AsyncSession,
        data: ElderCreate,
        creator=None,
    ) -> ElderResponse:
        """Create a new elder profile with tags.

        When the creator is a doctor (and not also an admin), the new elder
        is automatically assigned to them regardless of any client-supplied
        primary_doctor_id; non-admin clients cannot pick another doctor.
        """
        if creator is not None and ElderService._is_doctor_only(creator):
            data = data.model_copy(update={"primary_doctor_id": creator.id})

        elder = await ElderRepository.create(db, data, tags=data.tags)
        await db.commit()
        await db.refresh(elder)
        logger.info(
            "Elder created: id=%s name=%s primary_doctor_id=%s",
            elder.id, elder.name, elder.primary_doctor_id,
        )
        response = ElderResponse.model_validate(elder)
        await ElderService._attach_doctor_name(db, response)
        return response

    @staticmethod
    async def get_elder(
        db: AsyncSession, elder_id: int, viewer=None
    ) -> ElderResponse | None:
        """Get elder details by ID, with latest prediction attached.

        If the viewer is a doctor-only user, elders managed by someone else
        are hidden (returns None → endpoint raises 404).
        """
        elder = await ElderRepository.get_by_id(db, elder_id)
        if elder is None:
            return None
        if viewer is not None and ElderService._is_doctor_only(viewer):
            if elder.primary_doctor_id != viewer.id:
                return None
        response = ElderResponse.model_validate(elder)

        from app.repositories.bigdata import PredictionResultRepository

        latest = await PredictionResultRepository.get_latest_for_elder(db, elder_id)
        if latest is not None:
            response.latest_risk_score = float(latest.health_score)
            response.latest_high_risk = bool(latest.high_risk)
            response.latest_prediction_at = latest.predicted_at
        await ElderService._attach_doctor_name(db, response)
        return response

    @staticmethod
    async def list_elders(
        db: AsyncSession,
        pagination: PaginationParams,
        gender: str | None = None,
        tag: str | None = None,
        account_status: str | None = None,
        risk_level: str | None = None,
        viewer=None,
    ):
        """List elders with pagination and filters.

        Doctor-only viewers are automatically scoped to elders where
        primary_doctor_id matches their user id. Admins see everything.
        """
        scoped_doctor_id: int | None = None
        if viewer is not None and ElderService._is_doctor_only(viewer):
            scoped_doctor_id = viewer.id

        result = await ElderRepository.get_list(
            db, pagination, gender=gender, tag=tag,
            account_status=account_status, risk_level=risk_level,
            primary_doctor_id=scoped_doctor_id,
        )

        # Enrich with username and family_count
        if result.items:
            elder_ids = [item.id for item in result.items]

            # Batch fetch family counts
            from app.repositories.family_member import FamilyMemberRepository
            family_counts = await FamilyMemberRepository.count_by_elder_ids(db, elder_ids)

            # Batch fetch usernames via Elder -> user_id -> User
            from sqlalchemy import select as sa_select
            from app.models.elder import Elder
            from app.models.user import User

            stmt = sa_select(Elder.id, User.username).outerjoin(
                User, Elder.user_id == User.id
            ).where(Elder.id.in_(elder_ids))
            rows = await db.execute(stmt)
            username_map = {r[0]: r[1] for r in rows.all()}

            # Batch fetch latest predictions per elder (no N+1)
            from app.repositories.bigdata import PredictionResultRepository

            latest_preds = await PredictionResultRepository.get_latest_for_elders(
                db, elder_ids
            )

            # Batch resolve primary doctor display names in one query.
            doctor_ids = {
                item.primary_doctor_id
                for item in result.items
                if item.primary_doctor_id is not None
            }
            doctor_name_map: dict[int, str] = {}
            if doctor_ids:
                doctor_rows = await db.execute(
                    sa_select(User.id, User.real_name, User.username).where(
                        User.id.in_(doctor_ids)
                    )
                )
                doctor_name_map = {
                    r[0]: (r[1] or r[2]) for r in doctor_rows.all()
                }

            for item in result.items:
                item.username = username_map.get(item.id)
                item.family_count = family_counts.get(item.id, 0)
                if item.primary_doctor_id is not None:
                    item.primary_doctor_name = doctor_name_map.get(
                        item.primary_doctor_id
                    )
                pred = latest_preds.get(item.id)
                if pred is not None:
                    item.latest_risk_score = float(pred.health_score)
                    item.latest_high_risk = bool(pred.high_risk)
                    item.latest_prediction_at = pred.predicted_at

        return result

    @staticmethod
    async def update_elder(
        db: AsyncSession, elder_id: int, data: ElderUpdate, editor=None
    ) -> ElderResponse | None:
        """Update elder info and optionally sync tags.

        Only admins may (re)assign primary_doctor_id. For doctor-only editors
        we also verify the target elder is theirs; otherwise the update is
        rejected (returns None → 404 at the endpoint).
        """
        if (
            editor is not None
            and not ElderService._is_admin(editor)
            and "primary_doctor_id" in data.model_fields_set
        ):
            # Non-admin editors cannot (re)assign the primary doctor. Strip the
            # field so exclude_unset in the repo leaves the DB value alone.
            filtered = data.model_dump(exclude_unset=True)
            filtered.pop("primary_doctor_id", None)
            data = ElderUpdate(**filtered)

        if editor is not None and ElderService._is_doctor_only(editor):
            existing = await ElderRepository.get_by_id(db, elder_id)
            if existing is None or existing.primary_doctor_id != editor.id:
                return None

        elder = await ElderRepository.update(db, elder_id, data, tags=data.tags)
        if elder is None:
            return None
        await db.commit()
        await db.refresh(elder)
        logger.info("Elder updated: id=%s", elder_id)
        response = ElderResponse.model_validate(elder)
        await ElderService._attach_doctor_name(db, response)
        return response

    @staticmethod
    async def delete_elder(
        db: AsyncSession, elder_id: int, editor=None
    ) -> bool:
        """Soft delete an elder."""
        if editor is not None and ElderService._is_doctor_only(editor):
            if not await ElderService._doctor_owns(db, elder_id, editor.id):
                return False
        result = await ElderRepository.delete(db, elder_id)
        if result:
            await db.commit()
            logger.info("Elder deleted: id=%s", elder_id)
        return result

    @staticmethod
    async def reset_password(
        db: AsyncSession, elder_id: int, editor=None
    ) -> str | None:
        """Reset elder account password. Returns the plain-text password."""
        if editor is not None and ElderService._is_doctor_only(editor):
            if not await ElderService._doctor_owns(db, elder_id, editor.id):
                return None
        # Generate a random 12-char password
        alphabet = string.ascii_letters + string.digits
        plain_password = "".join(secrets.choice(alphabet) for _ in range(12))
        hashed = hash_password(plain_password)

        success = await ElderRepository.reset_password(db, elder_id, hashed)
        if not success:
            return None
        await db.commit()
        logger.info("Elder password reset: id=%s", elder_id)
        return plain_password

    @staticmethod
    async def update_account_status(
        db: AsyncSession, elder_id: int, status: str, editor=None
    ) -> bool:
        """Enable or disable an elder account."""
        if editor is not None and ElderService._is_doctor_only(editor):
            if not await ElderService._doctor_owns(db, elder_id, editor.id):
                return False
        result = await ElderRepository.update_account_status(db, elder_id, status)
        if result:
            await db.commit()
            logger.info("Elder account status updated: id=%s status=%s", elder_id, status)
        return result

    @staticmethod
    async def get_tags(db: AsyncSession) -> list[str]:
        """Get all distinct elder tags."""
        return await ElderRepository.get_all_tags(db)

    @staticmethod
    async def activate_account(
        db: AsyncSession, elder_id: int, editor=None
    ) -> dict | str:
        """Create a user account for an elder and link it.

        Returns dict with username and password on success, or error string.
        """
        elder = await ElderRepository.get_by_id(db, elder_id)
        if elder is None:
            return "老人档案不存在"
        if (
            editor is not None
            and ElderService._is_doctor_only(editor)
            and elder.primary_doctor_id != editor.id
        ):
            return "老人档案不存在"
        if elder.user_id is not None:
            return "该老人已有关联账户"

        # Generate username from phone or elder_<id>
        username = f"elder_{elder.id}" if not elder.phone else elder.phone

        # Check username uniqueness
        from app.repositories.user import UserRepository
        existing = await UserRepository.get_by_username(db, username)
        if existing:
            username = f"elder_{elder.id}"
            existing = await UserRepository.get_by_username(db, username)
            if existing:
                return "用户名已存在，请联系管理员"

        # Generate random password
        alphabet = string.ascii_letters + string.digits
        plain_password = "".join(secrets.choice(alphabet) for _ in range(12))
        hashed = hash_password(plain_password)

        # Create user
        from app.models.user import User, UserRole
        user = User(
            username=username,
            real_name=elder.name,
            phone=elder.phone,
            password_hash=hashed,
            status="active",
        )
        db.add(user)
        await db.flush()

        # Assign elder role (role_id=3)
        user_role = UserRole(user_id=user.id, role_id=3)
        db.add(user_role)

        # Link elder to user
        elder.user_id = user.id
        elder.account_status = "active"

        await db.commit()
        logger.info("Elder account activated: elder_id=%s user_id=%s", elder_id, user.id)
        return {"username": username, "password": plain_password}
