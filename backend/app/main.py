"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logger import setup_logging
from app.core.minio_client import init_minio
from app.core.redis_client import close_redis, init_redis
from app.services.weather import WeatherService
from app.tasks.pipeline_scheduler import PipelineScheduler
from app.api.v1.router import api_router
from app.utils.response import (
    INTERNAL_ERROR,
    PARAM_ERROR,
    UNAUTHORIZED,
    FORBIDDEN,
    NOT_FOUND,
    error_response,
)

setup_logging()
logger = logging.getLogger(__name__)

# Map HTTP status codes to application error codes
HTTP_TO_APP_CODE = {
    400: PARAM_ERROR,
    401: UNAUTHORIZED,
    403: FORBIDDEN,
    404: NOT_FOUND,
    422: PARAM_ERROR,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle."""
    logger.info("Starting %s application", settings.APP_NAME)
    await init_redis()
    await init_minio()
    await WeatherService.start()
    await PipelineScheduler.start()
    yield
    await PipelineScheduler.stop()
    await WeatherService.stop()
    await close_redis()
    logger.info("Application shutdown complete")


app = FastAPI(
    title="SmartMedCare API",
    version="1.0.0",
    description="Intelligence Medical & Elderly Care Big Data Public Service Platform",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount v1 API router
app.include_router(api_router, prefix="/api/v1")


def _clean_pydantic_reason(msg: str) -> str:
    """Strip Pydantic's 'Value error, ' prefix from custom ValueError messages."""
    prefix = "Value error, "
    return msg[len(prefix):] if msg.startswith(prefix) else msg


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handle Pydantic / FastAPI request validation errors.

    Surfaces the first field-level reason as the top-level message so the
    frontend shows a meaningful cause (e.g. "密码长度至少 6 位") instead of a
    generic "Parameter validation failed".
    """
    errors = []
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", []) if p != "body"]
        field = ".".join(loc)
        reason = _clean_pydantic_reason(err.get("msg", ""))
        errors.append({"field": field, "reason": reason})

    if errors:
        first = errors[0]
        top_message = (
            f"{first['field']}: {first['reason']}" if first.get("field") else first["reason"]
        )
    else:
        top_message = "Parameter validation failed"

    return JSONResponse(
        status_code=422,
        content=error_response(
            code=PARAM_ERROR,
            message=top_message,
            errors=errors,
        ),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    """Map FastAPI HTTPExceptions to the unified response format."""
    app_code = HTTP_TO_APP_CODE.get(exc.status_code, INTERNAL_ERROR)
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(code=app_code, message=str(exc.detail)),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Catch-all handler for unhandled exceptions."""
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content=error_response(
            code=INTERNAL_ERROR,
            message="Internal server error",
        ),
    )
