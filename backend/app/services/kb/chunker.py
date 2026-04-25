"""Character-based chunker with configurable size + overlap.

The spec uses 字 (characters), so we chunk by character count rather
than by token count. We try to break on paragraph / sentence / whitespace
boundaries near the window edge to avoid mid-word splits, and fall back
to a hard cut when no boundary is near.
"""

from __future__ import annotations

from typing import List


_SOFT_BREAKS = ("\n\n", "\n", "。", "！", "？", ".", "!", "?", "；", ";", " ", "\t")


def _normalize(text: str) -> str:
    # Collapse Windows line endings and strip leading/trailing whitespace.
    return text.replace("\r\n", "\n").replace("\r", "\n").strip()


def _best_break(text: str, start: int, end: int) -> int:
    """Pick a break position inside [start, end] that prefers sentence /
    paragraph boundaries near the tail of the window."""
    if end >= len(text):
        return len(text)
    # Look in the last 25% of the window for a soft boundary.
    scan_from = max(start + int((end - start) * 0.75), start + 1)
    segment = text[scan_from:end]
    best = -1
    for token in _SOFT_BREAKS:
        idx = segment.rfind(token)
        if idx >= 0:
            pos = scan_from + idx + len(token)
            if pos > best:
                best = pos
    return best if best > start else end


def chunk_text(
    text: str,
    *,
    chunk_size: int,
    overlap: int,
) -> List[str]:
    """Split `text` into overlapping chunks of ~`chunk_size` characters."""
    if chunk_size <= 0:
        raise ValueError("chunk_size must be > 0")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be in [0, chunk_size)")

    normalized = _normalize(text)
    if not normalized:
        return []
    if len(normalized) <= chunk_size:
        return [normalized]

    chunks: List[str] = []
    cursor = 0
    while cursor < len(normalized):
        window_end = min(cursor + chunk_size, len(normalized))
        cut = _best_break(normalized, cursor, window_end)
        piece = normalized[cursor:cut].strip()
        if piece:
            chunks.append(piece)
        if cut >= len(normalized):
            break
        # Advance with overlap, but always make forward progress.
        next_cursor = cut - overlap
        if next_cursor <= cursor:
            next_cursor = cut
        cursor = next_cursor
    return chunks
