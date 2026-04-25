"""AI assistant tool registry.

Exposes a role-aware registry that the chat endpoint uses to:
  1. build the list of `tools` sent to the LLM (filtered by caller role
     and permissions, so the model only sees what the caller is allowed
     to invoke); and
  2. dispatch a tool call produced by the model to the matching handler,
     returning both a model-facing text summary AND a structured UI
     payload the chat bubble can render.

Import side-effects: `bootstrap.register_all()` must be called once at
app startup to register every tool. The chat endpoint depends on this.
"""

from app.services.ai_tools.context import ToolContext, ToolResult, build_context
from app.services.ai_tools.registry import (
    ToolSpec,
    dispatch,
    get_spec,
    register,
    schemas_for,
)

__all__ = [
    "ToolContext",
    "ToolResult",
    "ToolSpec",
    "build_context",
    "dispatch",
    "get_spec",
    "register",
    "schemas_for",
]
