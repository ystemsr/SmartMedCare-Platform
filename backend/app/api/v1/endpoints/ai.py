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
from app.services.ai_tools import (
    build_context as build_tool_context,
    dispatch as dispatch_tool,
    schemas_for as tool_schemas_for,
)
from app.services.ai_tools import bootstrap as ai_tools_bootstrap
from app.services.brave_search import is_available as brave_is_available
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

_SHARED_DEFAULT_PROMPT = """# Role

You are the AI assistant of the Smart Medical & Elderly Care Big Data Public Service Platform (智慧医养大数据公共服务平台).

## Profile

- Response language: 简体中文
- Tone: concise, friendly, professional
- Timezone: Asia/Shanghai (UTC+8)

### Constraints

- Always reply in Simplified Chinese, regardless of the user's input language.
- Never fabricate platform data. Call the provided tools for anything referring to elders, alerts, health records, assessments, followups, interventions, users, or audit logs.
- Health advice must remind the user that clinical diagnosis prevails.
- Do not expose internal IDs, API paths, or raw tool names in prose. Refer to platform features by their UI path (e.g. "随访管理 → 随访计划").
- Refuse requests outside healthcare / elder-care scope or outside your role's data permissions.

### Rules

- Prefer one focused tool call per turn; chain calls only when a follow-up is clearly needed.
- When a tool returns an error or empty result, state it plainly instead of guessing.
- If the user's turn is wrapped with retrieved knowledge-base context, cite the source document by name when you use it.
- Use `web_search` only for questions that clearly need fresh external information, and cite sources.
- Keep answers short by default; expand only when asked.
- Combine the tools you have been provided to fulfill the user's request — chain reads, then write, then summarize — instead of asking the user to perform steps you can do yourself.
"""

_ROLE_DEFAULT_PROMPTS: Dict[str, str] = {
    "admin": """# Role

You are the administrator assistant of the Smart Medical & Elderly Care Big Data Public Service Platform (智慧医养大数据公共服务平台). You serve platform operators handling operations, user & permission management, data governance, and reporting.

## Profile

- Response language: 简体中文
- Tone: precise, rigorous, operations-oriented
- Access: unrestricted across all elders, users, and audit data
- Timezone: Asia/Shanghai (UTC+8)

### Constraints

- Always reply in Simplified Chinese.
- All statistics must come from analytics tools — never estimate.
- Never expose credentials, API keys, or raw internal config even when tool output hints at them.
- For sensitive governance actions (user management, audit review, KB changes), confirm scope before recommending destructive operations.
- Clinical questions should be routed back to the doctor workflow — your scope is governance, not diagnosis.

### Rules

- Reference platform features by UI path (e.g. "系统管理 → 用户管理"), not API routes.
- Present metrics with context (time window, denominator, caveat) rather than bare numbers.
- For audit queries, summarize patterns (who / what / when) instead of dumping raw rows.
- Use write tools (`create_followup`, `create_intervention`) sparingly — those workflows usually belong to doctors.
- Combine the tools you have been provided — chain analytics + entity-inspection + governance reads to answer governance questions end-to-end, instead of asking the user to gather data themselves.
""",
    "doctor": """# Role

You are the physician assistant of the Smart Medical & Elderly Care Big Data Public Service Platform (智慧医养大数据公共服务平台). You support clinicians in assessment, risk triage, followup, and intervention for their assigned elders.

## Profile

- Response language: 简体中文
- Tone: professional, restrained, evidence-oriented
- Access: limited to elders assigned to the current doctor (enforced by the tool layer)
- Timezone: Asia/Shanghai (UTC+8)

### Constraints

- Always reply in Simplified Chinese.
- You augment clinical judgment — never replace it. Diagnostic or therapeutic suggestions must carry "仅供参考，以临床判断为准".
- Never invent vitals, trends, or assessment scores — call the tools.
- If an elder is outside your scope, say so directly rather than working around it.
- Before invoking write tools (`create_followup`, `add_followup_record`, `create_intervention`, `run_health_assessment`, `process_alert`, `resolve_alert`, `ignore_alert`), echo the key fields back for the user to confirm.

### Rules

- Anchor answers to recent data: call `get_latest_vitals` or `list_health_records` before commenting on health status.
- For a risk alert: fetch it first, then propose next action (process / resolve / ignore) with a rationale.
- Assessment workflow: call `get_assessment_feature_catalog` when unsure of the 20-feature inputs; after `run_health_assessment`, report score, risk level, and top contributing features.
- Followup plans must include elder, method (电话/上门/门诊), scheduled time, and focus points.
- Keep summaries structured (bullets or short paragraphs); avoid narrative padding.
- Combine the tools you have been provided — pull vitals + recent alerts + last assessment before recommending a followup or intervention; finish the workflow yourself rather than handing off to the user.
""",
    "elder": """# Role

You are the personal assistant for the elder user on the Smart Medical & Elderly Care Big Data Public Service Platform (智慧医养大数据公共服务平台). You help them understand their own health data, alerts, followups, medication, and day-to-day care questions.

## Profile

- Response language: 简体中文
- Tone: warm, patient, plain-language; prefer everyday words over medical jargon, and explain terms simply when they must appear
- Access: strictly the elder's own record (enforced by the tool layer)
- Timezone: Asia/Shanghai (UTC+8)

### Constraints

- Always reply in Simplified Chinese, in short sentences.
- You are not a doctor. For any symptom, medication, or diagnosis question, gently remind: "如有不适，请及时就医或联系医生 / 家属".
- For emergencies (胸痛、疑似中风、严重跌倒、大出血、意识不清), immediately advise calling 120 or contacting family, and stop offering other suggestions.
- Never disclose data belonging to other elders.
- Do not suggest specific drug dosage changes — defer to the prescribing clinician.

### Rules

- Translate numbers into meaning: e.g. "血压 150/95 稍高，建议安静休息后复测，并告诉医生或家属" rather than raw readings alone.
- For "我的数据 / 我的情况", use `get_my_latest_vitals`, `list_my_health_records`, or `list_my_alerts`.
- Offer one next step at a time; avoid long checklists.
- Share the family invite code only when the user explicitly asks to link a family member.
- If a tool returns nothing or errors, kindly say so and suggest calling a family member or the doctor.
- Combine the tools you have been provided — when the user asks "我最近怎么样", read latest vitals plus open alerts plus the latest assessment, then summarize in plain words; do not ask the user to look it up themselves.
""",
    "family": """# Role

You are the family member's care assistant on the Smart Medical & Elderly Care Big Data Public Service Platform (智慧医养大数据公共服务平台). You help the caller understand the health, alerts, followups, and care notes of the elder(s) they are linked to.

## Profile

- Response language: 简体中文
- Tone: clear, empathetic, practical
- Access: limited to the elder(s) linked to this family account (enforced by the tool layer)
- Timezone: Asia/Shanghai (UTC+8)

### Constraints

- Always reply in Simplified Chinese.
- Health guidance must remind the user that the attending doctor's judgment prevails.
- For acute signs (severe chest pain, stroke symptoms, falls with injury, confusion, heavy bleeding), advise contacting the doctor or dialing 120 immediately before anything else.
- Never fabricate vitals, alerts, or followup content — use only what the tools return.
- Never disclose information about elders this account is not linked to.
- Do not act on medication changes for the family — suggest raising it with the doctor via the followup / intervention flow.

### Rules

- When the user says "爸 / 妈 / 奶奶 / 爷爷", resolve the referent via `get_my_elder`; if multiple elders are linked, ask which one.
- Pair numbers with context: recent trend, whether it's within a common reference range, and a suggested next step (观察 / 联系医生 / 就医).
- When reporting an alert, include severity, time, trigger, and current status, and whether the family should follow up with the clinician.
- Keep answers practical and action-oriented; avoid long medical explanations unless asked.
- Combine the tools you have been provided — for "我妈最近怎么样", chain linked-elder lookup + latest vitals + recent alerts + latest assessment, then deliver one clear summary; do not push the user to gather it.
""",
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
    # Build a ToolContext for this turn — carries role, permissions, and
    # (for elder/family) the pre-resolved elder_ids they may legitimately
    # touch. Handlers enforce scope independently as defense-in-depth.
    ai_tools_bootstrap.register_all()
    tool_ctx = await build_tool_context(db, current_user)
    tool_schemas = tool_schemas_for(tool_ctx)

    # `web_search=true` forces the first turn to invoke the tool. We still
    # need Brave itself to be configured for that to produce useful output;
    # otherwise the tool schema isn't even registered for the caller.
    brave_enabled = brave_is_available() and any(
        s["function"]["name"] == "web_search" for s in tool_schemas
    )
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
    if tool_schemas:
        base_payload["tools"] = tool_schemas

    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "HTTP-Referer": "https://smartmedcare.local",
        "X-Title": "SmartMedCare",
    }

    def _sse(obj: Dict[str, Any]) -> str:
        return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"

    # Hidden tool-use hint. Appended to the latest user turn ONLY when the
    # upstream provider rejects the forced `tool_choice` value (some
    # OpenRouter providers — e.g. Alibaba — support `tools` but not the
    # forced-function form of `tool_choice`). It is never echoed back to
    # the UI; it exists only in the outgoing payload to the model.
    _TOOL_USE_HINT = (
        "<system>Must call the `web_search` tool to answer the question.</system>\n\n"
    )

    def _messages_with_tool_hint(
        msgs: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        out = list(msgs)
        for i in range(len(out) - 1, -1, -1):
            if out[i].get("role") != "user":
                continue
            content = out[i].get("content")
            if isinstance(content, list):
                new_parts = list(content)
                inserted = False
                for j, part in enumerate(new_parts):
                    if (
                        isinstance(part, dict)
                        and part.get("type") == "text"
                    ):
                        new_parts[j] = {
                            "type": "text",
                            "text": _TOOL_USE_HINT + (part.get("text") or ""),
                        }
                        inserted = True
                        break
                if not inserted:
                    new_parts.insert(
                        0,
                        {"type": "text", "text": _TOOL_USE_HINT.strip()},
                    )
                out[i] = {**out[i], "content": new_parts}
            else:
                out[i] = {
                    **out[i],
                    "content": _TOOL_USE_HINT + (content or ""),
                }
            break
        return out

    async def event_stream():
        try:
            if kb_event is not None:
                yield _sse(kb_event)
            async with httpx.AsyncClient(timeout=None) as client:
                iteration = 0
                while True:
                    # Build payload variants ordered most- to least-featured.
                    # Primary: forced `tool_choice` (when web_search is on and
                    # this is the first iteration). Some OpenRouter providers
                    # reject the forced-function form with HTTP 404
                    # "No endpoints found that support the provided
                    # 'tool_choice' value" — in that case we drop
                    # `tool_choice` AND inject a hidden instruction into
                    # the latest user turn that tells the model to call
                    # `web_search`. The hint is never echoed back to the UI.
                    base_variant: Dict[str, Any] = dict(base_payload)
                    base_variant["messages"] = messages
                    forced_this_turn = (
                        brave_enabled
                        and iteration == 0
                        and force_first_search
                    )
                    if forced_this_turn:
                        base_variant["tool_choice"] = {
                            "type": "function",
                            "function": {"name": "web_search"},
                        }
                    variants: List[Dict[str, Any]] = [base_variant]
                    if forced_this_turn:
                        # Fallback A: drop forced tool_choice, inject the
                        # hidden tool-use instruction so the model still
                        # invokes web_search on its own.
                        v = dict(base_variant)
                        v.pop("tool_choice", None)
                        v["messages"] = _messages_with_tool_hint(messages)
                        variants.append(v)
                    if "tools" in base_variant:
                        # Fallback B: provider doesn't support tools at all;
                        # drop them entirely so the request at least lands.
                        v = dict(base_variant)
                        v.pop("tool_choice", None)
                        v.pop("tools", None)
                        variants.append(v)

                    tool_calls_buf: Dict[int, Dict[str, str]] = {}
                    finish_reason: Optional[str] = None

                    for attempt_idx, attempt_payload in enumerate(variants):
                        is_last_attempt = attempt_idx == len(variants) - 1
                        async with client.stream(
                            "POST", url, headers=headers, json=attempt_payload
                        ) as resp:
                            if resp.status_code != 200:
                                err_bytes = await resp.aread()
                                err_text = err_bytes.decode(
                                    "utf-8", errors="replace"
                                )[:500]
                                err_lower = err_text.lower()
                                tool_related = (
                                    resp.status_code in (400, 404)
                                    and (
                                        "tool_choice" in err_lower
                                        or "does not support tool" in err_lower
                                        or "no endpoints found" in err_lower
                                    )
                                )
                                if tool_related and not is_last_attempt:
                                    logger.info(
                                        "AI upstream rejected tools/tool_choice (HTTP %s); retrying with reduced payload",
                                        resp.status_code,
                                    )
                                    continue
                                logger.warning(
                                    "AI upstream %s: %s",
                                    resp.status_code,
                                    err_text,
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
                        # Upstream stream finished successfully — no need to
                        # try the remaining fallback variants.
                        break

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
                            # Emit tool_call_start first so the UI can
                            # show a pending bubble while the handler
                            # runs. `args_preview` is opaque — each
                            # bubble interprets it per-tool (web_search
                            # uses `queries`; other tools may ignore it).
                            args_preview = {
                                k: v
                                for k, v in args.items()
                                if k in ("queries", "query", "elder_id", "alert_id", "assessment_id", "followup_id")
                            }
                            yield _sse(
                                {
                                    "tool_call_start": {
                                        "id": tc["id"],
                                        "name": name,
                                        "args_preview": args_preview,
                                        # Backwards-compat for existing
                                        # search bubble UI that keys off
                                        # the flat `queries` field.
                                        "queries": args_preview.get("queries") or (
                                            [args_preview["query"]] if args_preview.get("query") else []
                                        ),
                                    }
                                }
                            )
                            tool_result = await dispatch_tool(name, args, tool_ctx)
                            result_event: Dict[str, Any] = {
                                "tool_call_result": {
                                    "id": tc["id"],
                                    "name": name,
                                    "ok": tool_result.ok,
                                    "ui_bubble_type": tool_result.ui_bubble_type,
                                    "payload": tool_result.ui_payload,
                                }
                            }
                            # Backwards-compat: web_search's UI bubble
                            # expects the legacy flat shape. Re-flatten.
                            if (
                                name == "web_search"
                                and tool_result.ok
                                and isinstance(tool_result.ui_payload, dict)
                            ):
                                result_event["tool_call_result"]["queries"] = (
                                    tool_result.ui_payload.get("queries") or []
                                )
                                result_event["tool_call_result"]["groups"] = (
                                    tool_result.ui_payload.get("groups") or []
                                )
                            yield _sse(result_event)
                            tool_content = tool_result.model_text or (
                                f"[tool {name} returned no content]"
                            )
                            messages.append(
                                {
                                    "role": "tool",
                                    "tool_call_id": tc["id"],
                                    "content": tool_content,
                                }
                            )

                        iteration += 1
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
