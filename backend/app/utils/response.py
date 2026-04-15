"""Unified response helpers and error code constants."""

from typing import Any, Dict, List, Optional

# ---- Error Code Constants ----
SUCCESS = 0
REQUEST_FAILED = 40000
PARAM_ERROR = 40001
MISSING_PARAM = 40002
DATA_FORMAT_INVALID = 40003
UNAUTHORIZED = 40100
TOKEN_EXPIRED = 40101
FORBIDDEN = 40300
NOT_FOUND = 40400
CONFLICT = 40900
BUSINESS_VALIDATION_FAILED = 42200
INTERNAL_ERROR = 50000
FILE_STORAGE_ERROR = 50010
ANALYTICS_JOB_ERROR = 50020


def success_response(
    data: Any = None,
    message: str = "success",
) -> Dict[str, Any]:
    """Build a successful unified response dict."""
    return {
        "code": SUCCESS,
        "message": message,
        "data": data,
    }


def error_response(
    code: int,
    message: str,
    errors: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Build an error unified response dict."""
    resp: Dict[str, Any] = {
        "code": code,
        "message": message,
        "data": None,
    }
    if errors is not None:
        resp["errors"] = errors
    return resp
