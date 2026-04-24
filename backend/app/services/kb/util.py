"""Small helpers shared across the KB services."""

from __future__ import annotations

from typing import Optional

# Leave a little headroom below the VARCHAR(512) column limit so multi-byte
# UTF-8 encodings have breathing room even after MySQL counts in characters.
_MAX_NAME_LEN = 255


def sanitize_filename(raw: Optional[str]) -> str:
    """Normalize an uploaded filename for safe storage and display.

    Steps:
      1. Drop any leading directory components some older browsers include.
      2. Strip control characters (newlines/tabs/NULs) so the name can't
         corrupt log lines or the RAG prompt we hand to the LLM.
      3. Collapse to a sane length, preserving the extension when possible.

    Returns "unnamed" when nothing useful is left.
    """
    name = (raw or "").strip()
    if not name:
        return "unnamed"
    # Both POSIX and Windows path separators — handle either.
    name = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    name = "".join(
        ch for ch in name if ch.isprintable() and ch not in ("\r", "\n", "\t")
    ).strip()
    if not name:
        return "unnamed"
    if len(name) > _MAX_NAME_LEN:
        dot = name.rfind(".")
        # Keep the extension only if it looks like a real one (short suffix).
        if 0 < dot and len(name) - dot <= 12:
            ext = name[dot:]
            name = name[: _MAX_NAME_LEN - len(ext)] + ext
        else:
            name = name[:_MAX_NAME_LEN]
    return name
