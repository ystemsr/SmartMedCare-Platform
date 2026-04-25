"""ToolContext + ToolResult — the handles every tool handler receives and returns.

A `ToolContext` is built once per chat turn and carries:
  - the DB session;
  - the caller's `User` + pre-flattened permission codes;
  - the resolved `role_code` (admin > doctor > elder > family);
  - for elder/family callers, the set of `scoped_elder_ids` they may
    legitimately act on (their own elder_id, or the elder_ids of the
    linked elders via `family_members`). `None` means unrestricted
    (admin/doctor). Every elder-scoped handler MUST call
    `ctx.enforce_elder_scope(elder_id)` before returning data.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, List, Optional, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.elder import Elder
from app.models.family_member import FamilyMember
from app.models.user import User


ROLE_PRIORITY: List[str] = ["admin", "doctor", "elder", "family"]


class ToolPermissionError(Exception):
    """Raised when the caller lacks permission for a tool."""


class ToolScopeError(Exception):
    """Raised when an elder/family caller tries to touch an elder outside their scope."""


@dataclass
class ToolResult:
    """Dual-channel tool output.

    - `model_text`: compact natural-language / markdown summary fed to
      the LLM as the tool-role message content.
    - `ui_payload`: structured JSON the frontend bubble renders. The
      shape is keyed by `ui_bubble_type`.
    """

    ok: bool
    model_text: str
    ui_payload: dict
    ui_bubble_type: str
    error: Optional[str] = None

    @classmethod
    def fail(cls, message: str, *, bubble: str = "text") -> "ToolResult":
        return cls(
            ok=False,
            model_text=f"[tool error] {message}",
            ui_payload={"error": message},
            ui_bubble_type=bubble,
            error=message,
        )


@dataclass
class ToolContext:
    db: AsyncSession
    current_user: User
    role_code: str
    permissions: Set[str] = field(default_factory=set)
    scoped_elder_ids: Optional[List[int]] = None  # None => unrestricted
    trace_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])

    def enforce_elder_scope(self, elder_id: int) -> None:
        if self.scoped_elder_ids is None:
            return
        if elder_id not in self.scoped_elder_ids:
            raise ToolScopeError(
                f"elder_id={elder_id} is outside your access scope"
            )

    def has_permission(self, code: str) -> bool:
        return code in self.permissions


def _primary_role(user: User) -> str:
    role_names = {ur.role.name for ur in (user.user_roles or []) if ur.role}
    for code in ROLE_PRIORITY:
        if code in role_names:
            return code
    return ""


def _flatten_permissions(user: User) -> Set[str]:
    out: Set[str] = set()
    for ur in (user.user_roles or []):
        role = ur.role
        if role is None:
            continue
        for rp in (role.role_permissions or []):
            if rp.permission is not None:
                out.add(rp.permission.code)
    return out


async def _resolve_elder_scope(
    db: AsyncSession, user: User, role_code: str
) -> Optional[List[int]]:
    """For elder/family callers, return the list of elder_ids they may touch.

    - elder: their own elder_id (via `elders.user_id = user.id`).
    - family: linked elder_ids via `family_members.user_id = user.id`.
    - admin/doctor: None (unrestricted; fine-grained per-elder doctor
      scoping is already enforced inside ElderService for ownership).
    """
    if role_code in ("admin", "doctor"):
        return None

    if role_code == "elder":
        stmt = select(Elder.id).where(
            Elder.user_id == user.id,
            Elder.deleted_at.is_(None),
        )
        rows = (await db.execute(stmt)).scalars().all()
        return [int(r) for r in rows]

    if role_code == "family":
        stmt = select(FamilyMember.elder_id).where(
            FamilyMember.user_id == user.id,
            FamilyMember.deleted_at.is_(None),
        )
        rows = (await db.execute(stmt)).scalars().all()
        return [int(r) for r in rows]

    # Unknown role => empty scope (can't touch any elder)
    return []


async def build_context(db: AsyncSession, user: User) -> ToolContext:
    role_code = _primary_role(user) or ""
    permissions = _flatten_permissions(user)
    scope = await _resolve_elder_scope(db, user, role_code)
    return ToolContext(
        db=db,
        current_user=user,
        role_code=role_code,
        permissions=permissions,
        scoped_elder_ids=scope,
    )
