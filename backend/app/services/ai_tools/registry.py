"""Tool registry: register specs, filter schemas for a caller, dispatch calls."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Literal, Optional, Set

from sqlalchemy import insert

from app.models.audit_log import AuditLog
from app.services.ai_tools.context import (
    ToolContext,
    ToolPermissionError,
    ToolResult,
    ToolScopeError,
)

logger = logging.getLogger(__name__)


ToolHandler = Callable[[dict, ToolContext], Awaitable[ToolResult]]


@dataclass
class ToolSpec:
    name: str
    description: str
    parameters: dict  # JSON-Schema for the tool's arguments
    handler: ToolHandler
    allowed_roles: Set[str] = field(default_factory=set)
    required_permission: Optional[str] = None
    action: Literal["read", "write"] = "read"
    ui_bubble_type: str = "text"

    def schema(self) -> dict:
        """OpenAI-compatible function-calling schema."""
        desc = self.description
        if self.action == "write":
            desc = f"[ACTION: WRITE] {desc}"
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": desc,
                "parameters": self.parameters,
            },
        }


_REGISTRY: Dict[str, ToolSpec] = {}


def register(spec: ToolSpec) -> None:
    if spec.name in _REGISTRY:
        logger.warning("tool %s already registered; overwriting", spec.name)
    _REGISTRY[spec.name] = spec


def get_spec(name: str) -> Optional[ToolSpec]:
    return _REGISTRY.get(name)


def _caller_allowed(spec: ToolSpec, ctx: ToolContext) -> bool:
    if spec.allowed_roles and ctx.role_code not in spec.allowed_roles:
        return False
    if spec.required_permission and not ctx.has_permission(spec.required_permission):
        return False
    return True


def schemas_for(ctx: ToolContext) -> List[dict]:
    """Return the list of tool schemas the caller is allowed to invoke.

    Used to build the `tools` array sent to the LLM — keeping this list
    filtered means the model never even sees tools it couldn't call, so
    random hallucinations are bounded to what's actually authorized.
    """
    out: List[dict] = []
    for spec in _REGISTRY.values():
        if _caller_allowed(spec, ctx):
            out.append(spec.schema())
    return out


async def _write_audit(
    ctx: ToolContext, *, operation: str, resource_type: str,
    resource_id: Optional[int], new_value: Any,
) -> None:
    """Best-effort audit log write. Never raises — audit failure must
    not block the user-facing tool result."""
    try:
        stmt = insert(AuditLog).values(
            user_id=ctx.current_user.id,
            operation=operation,
            resource_type=resource_type,
            resource_id=resource_id,
            new_value=new_value,
        )
        await ctx.db.execute(stmt)
        await ctx.db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("audit write failed for %s", operation)


async def dispatch(name: str, args: dict, ctx: ToolContext) -> ToolResult:
    """Execute a tool call with full safety checks.

    Layers (in order):
      1. Tool exists in the registry.
      2. Caller's role + permission allows this tool (defense in depth —
         schema filtering already does this, but models can be coerced
         into fabricating tool_calls via prompt injection).
      3. Handler runs. Scope errors (elder/family touching an elder
         outside their link) are caught here and turned into a clean
         failure result.
      4. On write tools that complete successfully, emit an audit log.
    """
    spec = _REGISTRY.get(name)
    if spec is None:
        logger.info("dispatch: unknown tool %s", name)
        return ToolResult.fail(f"Unknown tool: {name}")

    if not _caller_allowed(spec, ctx):
        logger.info(
            "dispatch: caller %s (role=%s) denied tool %s",
            ctx.current_user.id,
            ctx.role_code,
            name,
        )
        return ToolResult.fail(
            f"You do not have permission to call `{name}`.",
            bubble=spec.ui_bubble_type or "text",
        )

    try:
        result = await spec.handler(args or {}, ctx)
    except ToolScopeError as e:
        logger.info("dispatch: scope violation on %s by user %s: %s", name, ctx.current_user.id, e)
        return ToolResult.fail(str(e), bubble=spec.ui_bubble_type or "text")
    except ToolPermissionError as e:
        return ToolResult.fail(str(e), bubble=spec.ui_bubble_type or "text")
    except Exception as e:  # noqa: BLE001
        logger.exception("tool %s handler crashed", name)
        return ToolResult.fail(f"Tool {name} failed: {e}", bubble=spec.ui_bubble_type or "text")

    if spec.action == "write" and result.ok:
        await _write_audit(
            ctx,
            operation=f"ai_tool:{name}",
            resource_type=name,
            resource_id=result.ui_payload.get("id") if isinstance(result.ui_payload, dict) else None,
            new_value={"args": args, "trace_id": ctx.trace_id},
        )

    return result


def registered_names() -> List[str]:
    return list(_REGISTRY.keys())
