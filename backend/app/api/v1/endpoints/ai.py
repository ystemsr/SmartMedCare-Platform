"""AI assistant endpoints: chat streaming and model configuration.

The AI assistant is a thin proxy to an OpenAI-compatible provider
(default: OpenRouter). Model / credentials are stored in the
`system_configs` table and bootstrapped from the .env file on first read.
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional, Union

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete as sa_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_permission
from app.models.ai_chat import AIConversation, AIMessage
from app.models.audit_log import SystemConfig
from app.models.base import _utcnow
from app.models.user import User
from app.services.brave_search import (
    BRAVE_TOOL_SCHEMA,
    brave_search_many,
    format_results_for_model,
    is_available as brave_is_available,
)
from app.services.kb import build_rag_prompt, retrieve as kb_retrieve
from app.services.kb.embedding import is_available as kb_embedding_is_available
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter()


# Role codes that have their own dedicated system prompt. Order matters
# when a user holds multiple roles — earlier entries win (admin beats
# doctor, doctor beats family, etc.).
ROLE_CODES: List[str] = ["admin", "doctor", "elder", "family"]

# Mapping of public config field name -> system_configs.config_key
_AI_KEYS: Dict[str, str] = {
    "base_url": "ai.base_url",
    "api_key": "ai.api_key",
    # `model` is the actual model name of the DEFAULT selection. `models`
    # is the JSON-encoded list of [{display_name, model}] offered to the
    # chat UI — users pick one and the choice is sent back as body.model.
    "model": "ai.model",
    "models": "ai.models",
    "temperature": "ai.temperature",
    "max_tokens": "ai.max_tokens",
    "reasoning_enabled": "ai.reasoning_enabled",
    # Shared fallback — used when a role-specific prompt is empty.
    "system_prompt": "ai.system_prompt",
    # Per-role prompts. Each role sees only its own prompt during chat.
    "system_prompt_admin": "ai.system_prompt.admin",
    "system_prompt_doctor": "ai.system_prompt.doctor",
    "system_prompt_elder": "ai.system_prompt.elder",
    "system_prompt_family": "ai.system_prompt.family",
}

_SHARED_DEFAULT_PROMPT = (
    "你是智慧医养大数据公共服务平台的 AI 助手。"
    "请用简洁、友善、专业的中文回答用户问题。"
    "涉及健康建议时，需提醒用户以医生诊断为准。"
)

_ROLE_DEFAULT_PROMPTS: Dict[str, str] = {
    "admin": (
        "你是智慧医养大数据公共服务平台的管理员助手。"
        "协助管理员处理系统运维、用户与权限管理、数据治理、统计报表解读等工作。"
        "回答需准确、严谨，必要时引用平台功能路径或配置项。"
    ),
    "doctor": (
        "你是智慧医养大数据公共服务平台的医生助手。"
        "协助医生完成健康评估、风险研判、随访与干预建议等临床辅助工作。"
        "请用专业、克制的语气回答，涉及诊疗建议时需提示以临床判断为准，不替代医生决策。"
    ),
    "elder": (
        "你是智慧医养大数据公共服务平台的老人助手。"
        "请用温和、亲切、通俗易懂的口吻回答老人关心的健康、用药、作息、就医流程等问题。"
        "避免使用过多专业术语；遇到紧急症状，优先提示及时就医或联系家属。"
    ),
    "family": (
        "你是智慧医养大数据公共服务平台的家属助手。"
        "协助家属了解老人健康状况、随访记录、用药与照护建议。"
        "回答需兼具通俗与准确，必要时提示家属与医生沟通或紧急就医。"
    ),
}

_DEFAULT_MODELS: List[Dict[str, Any]] = [
    {"display_name": "MiniMax M2.7", "model": "minimax/minimax-m2.7", "vision": False},
]

_DEFAULTS: Dict[str, Any] = {
    "base_url": "",
    "api_key": "",
    "model": "minimax/minimax-m2.7",
    "models": list(_DEFAULT_MODELS),
    "temperature": 0.7,
    "max_tokens": 2048,
    "reasoning_enabled": True,
    "system_prompt": _SHARED_DEFAULT_PROMPT,
    "system_prompt_admin": _ROLE_DEFAULT_PROMPTS["admin"],
    "system_prompt_doctor": _ROLE_DEFAULT_PROMPTS["doctor"],
    "system_prompt_elder": _ROLE_DEFAULT_PROMPTS["elder"],
    "system_prompt_family": _ROLE_DEFAULT_PROMPTS["family"],
}


def _normalize_models(raw: Any) -> List[Dict[str, Any]]:
    """Coerce a user-supplied models value into a clean list.

    Accepts either a JSON string or a python list. Drops entries that
    have no `model` field; fills a missing `display_name` with the
    model's own name so the chat UI always has something to show.
    Preserves order; de-duplicates on the actual `model` name. The
    `vision` flag declares whether the model accepts image inputs;
    defaults to False for backwards compatibility.
    """
    if isinstance(raw, str):
        try:
            raw = json.loads(raw) if raw.strip() else []
        except json.JSONDecodeError:
            return []
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    seen: set = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        model = (item.get("model") or "").strip()
        if not model or model in seen:
            continue
        display = (item.get("display_name") or "").strip() or model
        vision = bool(item.get("vision"))
        out.append({"display_name": display, "model": model, "vision": vision})
        seen.add(model)
    return out


def _primary_role(user: User) -> Optional[str]:
    """Pick the most privileged role among a user's roles."""
    role_names = {ur.role.name for ur in (user.user_roles or []) if ur.role}
    for code in ROLE_CODES:
        if code in role_names:
            return code
    return None


def _resolve_prompt(cfg: Dict[str, Any], role: Optional[str]) -> str:
    """Return the system prompt that should be injected for `role`.

    Priority: role-specific prompt (if set) > shared `system_prompt`.
    """
    if role:
        rp = (cfg.get(f"system_prompt_{role}") or "").strip()
        if rp:
            return rp
    return (cfg.get("system_prompt") or "").strip()


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
    if field == "models":
        return _normalize_models(raw)
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

    # Reconcile the models list with the legacy single-model field.
    # If the list is empty but a legacy `ai.model` is set, adopt it as
    # a single entry. If both are set but the default is no longer in
    # the list, snap back to the first entry so the chat UI always has
    # a valid selection.
    models = cfg.get("models") or []
    legacy_model = (cfg.get("model") or "").strip()
    if not models and legacy_model:
        models = [{"display_name": legacy_model, "model": legacy_model}]
    if models:
        available = {m["model"] for m in models}
        if legacy_model not in available:
            legacy_model = models[0]["model"]
    cfg["models"] = models
    cfg["model"] = legacy_model
    return cfg


async def _save_config(db: AsyncSession, updates: Dict[str, Any]) -> None:
    for field, value in updates.items():
        key = _AI_KEYS.get(field)
        if not key:
            continue
        if field == "models":
            normalized = _normalize_models(value)
            str_val = json.dumps(normalized, ensure_ascii=False)
        elif isinstance(value, bool):
            str_val = "true" if value else "false"
        elif isinstance(value, (list, dict)):
            str_val = json.dumps(value, ensure_ascii=False)
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
    # OpenAI-compatible: a plain string OR a list of content parts.
    # Image parts use `{"type": "image_url", "image_url": {"url": "..."}}`
    # where the URL is typically a data URL (data:image/jpeg;base64,...).
    content: Union[str, List[Dict[str, Any]]]


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None
    # When True, force the model to invoke the web-search tool on the
    # first turn. When None/False, the model decides whether to search.
    web_search: Optional[bool] = None
    # When True, retrieve relevant chunks from the user's role-scoped
    # knowledge base and wrap the latest user question with the RAG
    # prompt template before forwarding to the upstream model.
    use_knowledge_base: Optional[bool] = None


class ModelEntry(BaseModel):
    display_name: str = ""
    model: str
    vision: bool = False


class ConfigUpdate(BaseModel):
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    models: Optional[List[ModelEntry]] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    reasoning_enabled: Optional[bool] = None
    system_prompt: Optional[str] = None
    system_prompt_admin: Optional[str] = None
    system_prompt_doctor: Optional[str] = None
    system_prompt_elder: Optional[str] = None
    system_prompt_family: Optional[str] = None


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
            "models": cfg["models"],
            "configured": bool(cfg["base_url"] and cfg["api_key"]),
            "reasoning_enabled": cfg["reasoning_enabled"],
            "web_search_available": brave_is_available(),
            "knowledge_base_available": kb_embedding_is_available(),
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
    # Only honor `body.model` if it's in the configured list — stops
    # arbitrary upstream calls and falls back to the default otherwise.
    models_list = cfg.get("models") or []
    allowed = {m["model"]: m for m in models_list}
    if body.model and body.model in allowed:
        model = body.model
    else:
        model = cfg["model"]
    selected_entry = allowed.get(model) or {}
    vision_supported = bool(selected_entry.get("vision"))

    if not base_url or not api_key:
        raise HTTPException(
            status_code=400, detail="AI 模型尚未配置，请联系管理员在「AI 模型配置」中填写"
        )

    # Reject image parts if the selected model isn't marked as vision-capable.
    has_images = any(
        isinstance(m.content, list)
        and any(
            isinstance(p, dict) and p.get("type") == "image_url"
            for p in m.content
        )
        for m in body.messages
    )
    if has_images and not vision_supported:
        raise HTTPException(
            status_code=400,
            detail="当前模型不支持图像输入，请切换到支持视觉的模型",
        )

    messages: List[Dict[str, Any]] = [
        {"role": m.role, "content": m.content} for m in body.messages
    ]
    role_code = _primary_role(current_user)
    system_prompt = _resolve_prompt(cfg, role_code)
    if system_prompt and (not messages or messages[0]["role"] != "system"):
        messages.insert(0, {"role": "system", "content": system_prompt})

    # --- Knowledge base retrieval (RAG) ------------------------------------
    # When enabled, retrieve chunks for the user's role and wrap the
    # latest user turn with the RAG prompt template. Retrieval failure
    # is non-fatal — we fall back to a plain chat. The `kb_event`
    # payload is emitted once at the start of the SSE stream so the UI
    # can render a knowledge-base bubble with the matched documents.
    kb_event: Optional[Dict[str, Any]] = None
    if body.use_knowledge_base and role_code:
        last_user_idx = next(
            (i for i in range(len(messages) - 1, -1, -1)
             if messages[i]["role"] == "user"),
            -1,
        )
        if last_user_idx >= 0:
            raw_content = messages[last_user_idx]["content"]
            # Multimodal content: extract text parts to use as the query
            # and rebuild the message preserving image parts after the
            # RAG-wrapped text.
            image_parts: List[Dict[str, Any]] = []
            if isinstance(raw_content, list):
                text_chunks: List[str] = []
                for part in raw_content:
                    if not isinstance(part, dict):
                        continue
                    if part.get("type") == "text":
                        text_chunks.append(str(part.get("text") or ""))
                    elif part.get("type") == "image_url":
                        image_parts.append(part)
                user_query = "\n".join(t for t in text_chunks if t).strip()
            else:
                user_query = raw_content or ""
            try:
                hits = await kb_retrieve(role_code, user_query)
            except Exception as e:  # noqa: BLE001
                logger.warning("kb retrieve failed: %s", e)
                hits = []
            # Only wrap the user's turn when we actually have relevant
            # context to inject. Previously the "(no relevant context)"
            # branch of the RAG template still went out, combined with
            # "don't try to make up an answer" — that actively suppressed
            # the model's general knowledge, so users saw the assistant
            # refuse to answer when KB simply had no match. Skipping the
            # wrap lets the assistant answer normally in that case while
            # still surfacing a "no match" indicator in the UI.
            if hits:
                wrapped_text = build_rag_prompt(user_query, hits)
                new_content: Union[str, List[Dict[str, Any]]]
                if image_parts:
                    new_content = [
                        {"type": "text", "text": wrapped_text},
                        *image_parts,
                    ]
                else:
                    new_content = wrapped_text
                messages[last_user_idx] = {
                    "role": "user",
                    "content": new_content,
                }
                logger.info(
                    "AI chat RAG: role=%s hits=%d injected into user turn",
                    role_code,
                    len(hits),
                )
            else:
                logger.info(
                    "AI chat RAG: role=%s no relevant hits — passing user turn through unchanged",
                    role_code,
                )
            kb_event = {
                "knowledge_base": {
                    "role_code": role_code,
                    "query": user_query,
                    "hits": [
                        {
                            "document_id": h.get("document_id"),
                            "document_name": h.get("document_name") or "",
                            "chunk_index": h.get("chunk_index"),
                            "score": float(h.get("score") or 0.0),
                            "content": h.get("content") or "",
                        }
                        for h in hits
                    ],
                }
            }

    # --- Tool-use wiring ---------------------------------------------------
    # The Brave-search tool is attached whenever a BRAVE_API_KEY is
    # configured; the model then decides when to call it. `web_search=true`
    # forces the first turn to invoke the tool; subsequent turns fall back
    # to "auto" so the model can reply naturally after reading results.
    brave_enabled = brave_is_available()
    force_first_search = bool(body.web_search) and brave_enabled
    base_payload: Dict[str, Any] = {
        "model": model,
        "stream": True,
        "temperature": cfg["temperature"],
        "max_tokens": cfg["max_tokens"],
    }
    if cfg.get("reasoning_enabled"):
        # OpenRouter-compatible reasoning flag; harmless for providers that
        # ignore it.
        base_payload["reasoning"] = {"enabled": True}
    if brave_enabled:
        base_payload["tools"] = [BRAVE_TOOL_SCHEMA]

    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "HTTP-Referer": "https://smartmedcare.local",
        "X-Title": "SmartMedCare",
    }

    MAX_TOOL_ITERATIONS = 3

    def _sse(obj: Dict[str, Any]) -> str:
        return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"

    async def event_stream():
        try:
            if kb_event is not None:
                yield _sse(kb_event)
            async with httpx.AsyncClient(timeout=None) as client:
                iteration = 0
                while True:
                    payload = dict(base_payload)
                    payload["messages"] = messages
                    if brave_enabled:
                        if iteration == 0 and force_first_search:
                            payload["tool_choice"] = {
                                "type": "function",
                                "function": {"name": "web_search"},
                            }
                        else:
                            payload["tool_choice"] = "auto"

                    tool_calls_buf: Dict[int, Dict[str, str]] = {}
                    finish_reason: Optional[str] = None

                    async with client.stream(
                        "POST", url, headers=headers, json=payload
                    ) as resp:
                        if resp.status_code != 200:
                            err_bytes = await resp.aread()
                            err_text = err_bytes.decode(
                                "utf-8", errors="replace"
                            )[:500]
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
                                break
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
                                reasoning = reasoning.get(
                                    "content"
                                ) or reasoning.get("text")
                            if content:
                                out["content"] = content
                            if reasoning:
                                out["reasoning"] = reasoning
                            # Tool-call streaming: accumulate name + args
                            for tc in delta.get("tool_calls") or []:
                                if not isinstance(tc, dict):
                                    continue
                                idx = tc.get("index")
                                if idx is None:
                                    idx = 0
                                buf = tool_calls_buf.setdefault(
                                    int(idx),
                                    {"id": "", "name": "", "arguments": ""},
                                )
                                if tc.get("id"):
                                    buf["id"] = tc["id"]
                                fn = tc.get("function") or {}
                                if fn.get("name"):
                                    buf["name"] = fn["name"]
                                if fn.get("arguments"):
                                    buf["arguments"] += fn["arguments"]
                            fr = choices[0].get("finish_reason")
                            if fr:
                                finish_reason = fr
                                out["finish_reason"] = fr
                            if out:
                                yield _sse(out)

                    # End of one upstream stream. Decide next step.
                    if finish_reason == "tool_calls" and tool_calls_buf:
                        ordered = [
                            tool_calls_buf[k]
                            for k in sorted(tool_calls_buf.keys())
                        ]
                        # Synthesize the assistant turn that triggered the
                        # tool call so the upstream model can match it to
                        # the tool results we're about to feed back.
                        tool_calls_msg = []
                        for i, b in enumerate(ordered):
                            tool_calls_msg.append(
                                {
                                    "id": b["id"] or f"call_{iteration}_{i}",
                                    "type": "function",
                                    "function": {
                                        "name": b["name"] or "web_search",
                                        "arguments": b["arguments"] or "{}",
                                    },
                                }
                            )
                        messages.append(
                            {
                                "role": "assistant",
                                "content": "",
                                "tool_calls": tool_calls_msg,
                            }
                        )

                        for tc in tool_calls_msg:
                            name = tc["function"]["name"]
                            try:
                                args = json.loads(
                                    tc["function"]["arguments"] or "{}"
                                )
                            except json.JSONDecodeError:
                                args = {}
                            if name == "web_search":
                                # Accept batch form (`queries`) and the
                                # legacy single `query` form some models
                                # may still emit.
                                raw_queries = args.get("queries")
                                if raw_queries is None and args.get("query"):
                                    raw_queries = [args.get("query")]
                                if isinstance(raw_queries, str):
                                    raw_queries = [raw_queries]
                                if not isinstance(raw_queries, list):
                                    raw_queries = []
                                queries = [
                                    str(q).strip()
                                    for q in raw_queries
                                    if str(q).strip()
                                ]
                                yield _sse(
                                    {
                                        "tool_call_start": {
                                            "id": tc["id"],
                                            "name": name,
                                            "queries": queries,
                                        }
                                    }
                                )
                                groups = await brave_search_many(queries)
                                yield _sse(
                                    {
                                        "tool_call_result": {
                                            "id": tc["id"],
                                            "queries": [
                                                g["query"] for g in groups
                                            ],
                                            "groups": groups,
                                        }
                                    }
                                )
                                # Content fed back to the LLM MUST be
                                # delivered under the `tool` role, keyed
                                # by `tool_call_id` — this matches the
                                # assistant's preceding tool_calls entry.
                                tool_content = format_results_for_model(groups)
                            else:
                                tool_content = "[unknown tool]"
                            messages.append(
                                {
                                    "role": "tool",
                                    "tool_call_id": tc["id"],
                                    "content": tool_content,
                                }
                            )

                        iteration += 1
                        if iteration >= MAX_TOOL_ITERATIONS:
                            yield (
                                "event: error\n"
                                f"data: {json.dumps({'message': '已达到工具调用次数上限'}, ensure_ascii=False)}\n\n"
                            )
                            return
                        continue  # next iteration: send tool results back

                    # Normal completion (or upstream sent [DONE]).
                    yield "event: done\ndata: {}\n\n"
                    return
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


# ---------- Per-user chat history ----------


class ConversationMessage(BaseModel):
    """A message payload as stored/returned to the chat UI.

    We accept/return the opaque UI-shape dict (role, content, images,
    reasoning, searches, knowledge_base, …) so the frontend can round-
    trip without losing bubble metadata. Only `role` is validated here.
    """

    role: str = Field(pattern=r"^(user|assistant|system)$")
    # Arbitrary UI payload (everything else a bubble needs to render).
    # Kept extensible so we don't have to version the schema each time
    # the chat UI learns a new trick.
    model_config = {"extra": "allow"}


class ConversationCreate(BaseModel):
    title: Optional[str] = None
    messages: Optional[List[Dict[str, Any]]] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    messages: Optional[List[Dict[str, Any]]] = None


class ConversationImportItem(BaseModel):
    title: Optional[str] = None
    updated_at: Optional[int] = None  # unix millis from client
    messages: Optional[List[Dict[str, Any]]] = None


class ConversationImport(BaseModel):
    conversations: List[ConversationImportItem]


_DEFAULT_TITLE = "新对话"


def _sanitize_message(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Strip server-only / transient flags before persisting.

    `pending` is a UI-streaming flag and must never round-trip back as
    true after reload (otherwise the bubble gets stuck on the dot-
    loader). Everything else is kept verbatim.
    """
    if not isinstance(raw, dict):
        return {}
    cleaned = {k: v for k, v in raw.items() if k != "pending"}
    role = cleaned.get("role")
    if role not in ("user", "assistant", "system"):
        cleaned["role"] = "user"
    return cleaned


def _serialize_conv(conv: AIConversation, messages: List[AIMessage]) -> Dict[str, Any]:
    parsed: List[Dict[str, Any]] = []
    for m in messages:
        try:
            obj = json.loads(m.payload or "{}")
        except json.JSONDecodeError:
            obj = {}
        if not isinstance(obj, dict):
            obj = {}
        # Ensure role is always present (the canonical copy lives in the
        # column; `payload` is a snapshot and may drift if an older
        # client wrote it without the role field).
        obj.setdefault("role", m.role)
        parsed.append(obj)
    return {
        "id": conv.id,
        "title": conv.title or _DEFAULT_TITLE,
        "updated_at": int(conv.updated_at.timestamp() * 1000)
        if conv.updated_at
        else 0,
        "messages": parsed,
    }


async def _load_owned_conversation(
    db: AsyncSession, conv_id: int, user_id: int
) -> AIConversation:
    stmt = select(AIConversation).where(
        AIConversation.id == conv_id,
        AIConversation.user_id == user_id,
        AIConversation.deleted_at.is_(None),
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="对话不存在")
    return conv


async def _write_messages(
    db: AsyncSession, conv: AIConversation, messages: List[Dict[str, Any]]
) -> List[AIMessage]:
    # Full replace. Conversations stay small (dozens of messages), so the
    # simplicity of "wipe + insert" beats diffing, and keeps the ordering
    # stable without us juggling positions across partial edits.
    await db.execute(
        sa_delete(AIMessage).where(AIMessage.conversation_id == conv.id)
    )
    rows: List[AIMessage] = []
    for idx, raw in enumerate(messages):
        cleaned = _sanitize_message(raw)
        row = AIMessage(
            conversation_id=conv.id,
            position=idx,
            role=str(cleaned.get("role") or "user"),
            payload=json.dumps(cleaned, ensure_ascii=False),
        )
        db.add(row)
        rows.append(row)
    return rows


@router.get("/conversations")
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the caller's conversations (title + timestamp only).

    Messages are fetched lazily via GET /ai/conversations/{id}; keeping
    the list response small means the sidebar loads instantly even for
    users with hundreds of past chats.
    """
    stmt = (
        select(AIConversation)
        .where(
            AIConversation.user_id == current_user.id,
            AIConversation.deleted_at.is_(None),
        )
        .order_by(AIConversation.updated_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return success_response(
        [
            {
                "id": c.id,
                "title": c.title or _DEFAULT_TITLE,
                "updated_at": int(c.updated_at.timestamp() * 1000)
                if c.updated_at
                else 0,
            }
            for c in rows
        ]
    )


@router.get("/conversations/{conv_id}")
async def get_conversation(
    conv_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await _load_owned_conversation(db, conv_id, current_user.id)
    stmt = (
        select(AIMessage)
        .where(AIMessage.conversation_id == conv.id)
        .order_by(AIMessage.position.asc(), AIMessage.id.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return success_response(_serialize_conv(conv, list(rows)))


@router.post("/conversations")
async def create_conversation(
    body: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = (body.title or "").strip() or _DEFAULT_TITLE
    conv = AIConversation(user_id=current_user.id, title=title)
    db.add(conv)
    await db.flush()  # populate conv.id
    rows: List[AIMessage] = []
    if body.messages:
        rows = await _write_messages(db, conv, body.messages)
    await db.commit()
    await db.refresh(conv)
    return success_response(_serialize_conv(conv, rows))


@router.put("/conversations/{conv_id}")
async def update_conversation(
    conv_id: int,
    body: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await _load_owned_conversation(db, conv_id, current_user.id)
    touched = False
    if body.title is not None:
        new_title = body.title.strip() or _DEFAULT_TITLE
        if new_title != conv.title:
            conv.title = new_title
            touched = True
    rows: List[AIMessage] = []
    if body.messages is not None:
        rows = await _write_messages(db, conv, body.messages)
        touched = True
    if touched:
        conv.updated_at = _utcnow()
    # When `messages` wasn't in the patch, we still need to return the
    # existing messages for parity with GET so the caller can reuse the
    # response without a follow-up fetch.
    if body.messages is None:
        stmt = (
            select(AIMessage)
            .where(AIMessage.conversation_id == conv.id)
            .order_by(AIMessage.position.asc(), AIMessage.id.asc())
        )
        rows = list((await db.execute(stmt)).scalars().all())
    await db.commit()
    await db.refresh(conv)
    return success_response(_serialize_conv(conv, rows))


@router.delete("/conversations/{conv_id}")
async def delete_conversation(
    conv_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await _load_owned_conversation(db, conv_id, current_user.id)
    now = _utcnow()
    conv.deleted_at = now
    conv.updated_at = now
    await db.commit()
    return success_response({"id": conv_id})


@router.post("/conversations/import")
async def import_conversations(
    body: ConversationImport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One-shot import of legacy browser-localStorage conversations.

    Called by the chat UI the first time a user opens the assistant
    after the per-user migration. Each imported conversation becomes a
    fresh server-side record owned by the caller; the client then
    discards its local cache. Order is preserved by using the client's
    `updated_at` when present.
    """
    created: List[Dict[str, Any]] = []
    # Oldest first so the newest ends up at the top of the list when we
    # sort by `updated_at` on the next fetch.
    items = sorted(
        body.conversations,
        key=lambda c: c.updated_at or 0,
    )
    for item in items:
        title = (item.title or "").strip() or _DEFAULT_TITLE
        conv = AIConversation(user_id=current_user.id, title=title)
        db.add(conv)
        await db.flush()
        rows: List[AIMessage] = []
        if item.messages:
            rows = await _write_messages(db, conv, item.messages)
        # Preserve the client's wall-clock so the sidebar ordering after
        # import matches what the user saw before the upgrade.
        if item.updated_at:
            try:
                from datetime import datetime, timezone

                conv.updated_at = (
                    datetime.fromtimestamp(item.updated_at / 1000, tz=timezone.utc)
                    .replace(tzinfo=None)
                )
            except (ValueError, OSError, OverflowError):
                pass
        await db.flush()
        created.append(_serialize_conv(conv, rows))
    await db.commit()
    return success_response({"imported": len(created), "conversations": created})
