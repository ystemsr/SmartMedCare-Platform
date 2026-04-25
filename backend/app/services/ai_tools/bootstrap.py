"""Import every tool module so their `register(...)` calls fire.

Call `register_all()` once at app startup. Safe to call multiple times —
the registry overwrites duplicates (with a warning) rather than erroring.
"""

import logging

logger = logging.getLogger(__name__)

_done = False


def register_all() -> None:
    global _done
    if _done:
        return
    # Order matters only cosmetically; imports are idempotent.
    from app.services.ai_tools import (  # noqa: F401
        utility_tools,
        elder_tools,
        health_tools,
        alert_tools,
        assessment_tools,
        followup_tools,
        intervention_tools,
        analytics_tools,
        system_tools,
    )
    from app.services.ai_tools import registry

    _done = True
    logger.info(
        "AI tools registered (%d): %s",
        len(registry.registered_names()),
        ", ".join(sorted(registry.registered_names())),
    )
