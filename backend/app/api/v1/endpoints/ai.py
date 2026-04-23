"""AI assistant endpoints: chat streaming and model configuration.

The AI assistant is a thin proxy to an OpenAI-compatible provider
(default: OpenRouter). Model / credentials are stored in the
`system_configs` table and bootstrapped from the .env file on first read.
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_permission
from app.models.audit_log import SystemConfig
from app.models.user import User
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter()


# Mapping of public config field name -> system_configs.config_key
_AI_KEYS: Dict[str, str] = {
    "base_url": "ai.base_url",
    "api_key": "ai.api_key",
    "model": "ai.model",
    "temperature": "ai.temperature",
    "max_tokens": "ai.max_tokens",
    "reasoning_enabled": "ai.reasoning_enabled",
    "system_prompt": "ai.system_prompt",
}

_DEFAULTS: Dict[str, Any] = {
    "base_url": "",
    "api_key": "",
    "model": "minimax/minimax-m2.7",
    "temperature": 0.7,
    "max_tokens": 2048,
    "reasoning_enabled": True,
    "system_prompt": (
        "你是智慧医养大数据公共服务平台的 AI 助手，面向医生、老人、家属和管理员。"
        "请用简洁、友善、专业的中文回答用户问题。"
        "涉及健康建议时，需提醒用户以医生诊断为准。"
    ),
}


def _coerce(field: str, raw: Optional[str]) -> Any:
    if raw is None:
        return _DEFAULTS[field]
    if field == "temperature":
        try:
            return float(raw)
        except ValueError:
            return _DEFAULTS[field]
    if field == "max_tokens":
        try:
            return int(raw)
        except ValueError:
            return _DEFAULTS[field]
    if field == "reasoning_enabled":
        return str(raw).strip().lower() in ("1", "true", "yes", "on")
    return raw


async def _load_config(db: AsyncSession) -> Dict[str, Any]:
    """Load AI config from system_configs, falling back to env then defaults."""
    stmt = select(SystemConfig).where(SystemConfig.config_key.in_(_AI_KEYS.values()))
    rows = (await db.execute(stmt)).scalars().all()
    by_key = {r.config_key: r.config_value for r in rows}

    cfg = dict(_DEFAULTS)
    # Env-driven bootstrap values are used only when the DB has no value.
    env_base = (os.getenv("AI_BASE_URL") or "").strip()
    env_key = (os.getenv("AI_API_KEY") or "").strip()
    if env_base and env_base.lower() != "your_api_key":
        cfg["base_url"] = env_base
    if env_key and env_key.lower() != "your_api_key":
        cfg["api_key"] = env_key

    for field, key in _AI_KEYS.items():
        if key in by_key:
            cfg[field] = _coerce(field, by_key[key])
    return cfg


async def _save_config(db: AsyncSession, updates: Dict[str, Any]) -> None:
    for field, value in updates.items():
        key = _AI_KEYS.get(field)
        if not key:
            continue
        if isinstance(value, bool):
            str_val = "true" if value else "false"
        else:
            str_val = "" if value is None else str(value)
        stmt = select(SystemConfig).where(SystemConfig.config_key == key)
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row is None:
            db.add(SystemConfig(config_key=key, config_value=str_val))
        else:
            row.config_value = str_val
    await db.commit()


def _mask(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 10:
        return "***"
    return f"{key[:6]}***{key[-4:]}"


# ---------- Schemas ----------


class ChatMessage(BaseModel):
    role: str = Field(pattern=r"^(system|user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None


class ConfigUpdate(BaseModel):
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    reasoning_enabled: Optional[bool] = None
    system_prompt: Optional[str] = None


class TestConfig(BaseModel):
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = "minimax/minimax-m2.7"


# ---------- Public (any authenticated user) ----------


@router.get("/public-config")
async def get_public_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Minimal config visible to all chat users — no secrets."""
    cfg = await _load_config(db)
    return success_response(
        {
            "model": cfg["model"],
            "configured": bool(cfg["base_url"] and cfg["api_key"]),
            "reasoning_enabled": cfg["reasoning_enabled"],
        }
    )


@router.post("/chat/stream")
async def chat_stream(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Server-sent-events stream of the assistant's reply.

    Each SSE `data:` line is a JSON object with optional `content` and
    `reasoning` fields (incremental deltas). An `event: done` line marks
    the end; `event: error` carries failure details.
    """
    cfg = await _load_config(db)
    base_url = (cfg["base_url"] or "").rstrip("/")
    api_key = cfg["api_key"] or ""
    model = body.model or cfg["model"]

    if not base_url or not api_key:
        raise HTTPException(
            status_code=400, detail="AI 模型尚未配置，请联系管理员在「AI 模型配置」中填写"
        )

    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    if cfg.get("system_prompt") and (not messages or messages[0]["role"] != "system"):
        messages.insert(0, {"role": "system", "content": cfg["system_prompt"]})

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": cfg["temperature"],
        "max_tokens": cfg["max_tokens"],
    }
    if cfg.get("reasoning_enabled"):
        # OpenRouter-compatible reasoning flag; harmless for providers that
        # ignore it.
        payload["reasoning"] = {"enabled": True}

    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "HTTP-Referer": "https://smartmedcare.local",
        "X-Title": "SmartMedCare",
    }

    async def event_stream():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST", url, headers=headers, json=payload
                ) as resp:
                    if resp.status_code != 200:
                        err_bytes = await resp.aread()
                        err_text = err_bytes.decode("utf-8", errors="replace")[:500]
                        logger.warning(
                            "AI upstream %s: %s", resp.status_code, err_text
                        )
                        yield (
                            "event: error\n"
                            f"data: {json.dumps({'message': f'上游错误 HTTP {resp.status_code}: {err_text}'}, ensure_ascii=False)}\n\n"
                        )
                        return

                    async for raw_line in resp.aiter_lines():
                        if not raw_line:
                            continue
                        line = raw_line.strip()
                        if not line.startswith("data:"):
                            continue
                        data_part = line[5:].strip()
                        if data_part == "[DONE]":
                            yield "event: done\ndata: {}\n\n"
                            return
                        try:
                            obj = json.loads(data_part)
                        except json.JSONDecodeError:
                            continue
                        choices = obj.get("choices") or []
                        if not choices:
                            continue
                        delta = choices[0].get("delta") or {}
                        out: Dict[str, Any] = {}
                        content = delta.get("content")
                        reasoning = delta.get("reasoning")
                        # Some providers nest reasoning under a dict
                        if isinstance(reasoning, dict):
                            reasoning = reasoning.get("content") or reasoning.get(
                                "text"
                            )
                        if content:
                            out["content"] = content
                        if reasoning:
                            out["reasoning"] = reasoning
                        finish = choices[0].get("finish_reason")
                        if finish:
                            out["finish_reason"] = finish
                        if out:
                            yield f"data: {json.dumps(out, ensure_ascii=False)}\n\n"
            yield "event: done\ndata: {}\n\n"
        except httpx.HTTPError as e:
            logger.error("AI stream HTTP error: %s", e)
            yield (
                "event: error\n"
                f"data: {json.dumps({'message': f'网络错误: {e}'}, ensure_ascii=False)}\n\n"
            )
        except Exception as e:  # noqa: BLE001
            logger.exception("AI stream unexpected error")
            yield (
                "event: error\n"
                f"data: {json.dumps({'message': f'内部错误: {e}'}, ensure_ascii=False)}\n\n"
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------- Admin (system:config) ----------


@router.get("/config")
async def get_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("system:config")),
):
    """Return full config for admin panel. `api_key` is masked."""
    cfg = await _load_config(db)
    api_key = cfg.pop("api_key", "") or ""
    cfg["api_key_masked"] = _mask(api_key)
    cfg["has_api_key"] = bool(api_key)
    return success_response(cfg)


@router.put("/config")
async def update_config(
    body: ConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("system:config")),
):
    updates = body.model_dump(exclude_none=True)
    # Treat empty string api_key as "keep current" — frontend uses empty
    # field to mean "don't change".
    if "api_key" in updates and not updates["api_key"]:
        updates.pop("api_key")
    await _save_config(db, updates)
    cfg = await _load_config(db)
    api_key = cfg.pop("api_key", "") or ""
    cfg["api_key_masked"] = _mask(api_key)
    cfg["has_api_key"] = bool(api_key)
    return success_response(cfg)


@router.post("/config/test")
async def test_config(
    body: TestConfig,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("system:config")),
):
    """Quick sanity-check that a (base_url, api_key) pair works.

    If the admin omits fields, the stored config is used instead — so
    they can verify an existing saved key without re-typing it.
    """
    cfg = await _load_config(db)
    base_url = (body.base_url or cfg["base_url"] or "").rstrip("/")
    api_key = body.api_key or cfg["api_key"] or ""
    model = body.model or "minimax/minimax-m2.7"
    if not base_url or not api_key:
        return error_response(40001, "Base URL 和 API Key 不能为空")
    url = f"{base_url}/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://smartmedcare.local",
                    "X-Title": "SmartMedCare",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "user", "content": "ping"},
                    ],
                    "max_tokens": 32,
                },
            )
    except httpx.HTTPError as e:
        return error_response(50000, f"连接失败: {e}")

    if resp.status_code != 200:
        return error_response(
            50000,
            f"调用失败 HTTP {resp.status_code}: {resp.text[:200]}",
        )
    try:
        data = resp.json()
        reply = (data.get("choices") or [{}])[0].get("message", {}).get(
            "content", ""
        )
    except Exception:  # noqa: BLE001
        reply = ""
    return success_response({"ok": True, "model": model, "reply": reply})
