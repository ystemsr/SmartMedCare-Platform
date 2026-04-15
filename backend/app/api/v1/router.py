"""Central API v1 router — aggregates all endpoint routers."""

from fastapi import APIRouter

api_router = APIRouter()

# ===== Auth & System routes (feat/backend-auth-system) =====
# from app.api.v1.endpoints import auth, users, roles, health, system
# api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
# api_router.include_router(users.router, prefix="/users", tags=["用户管理"])
# api_router.include_router(roles.router, prefix="/roles", tags=["角色管理"])
# api_router.include_router(health.router, prefix="/system", tags=["系统"])
# api_router.include_router(system.router, prefix="/system", tags=["系统配置"])

# ===== Elder & Health routes (feat/backend-elder-health) =====
from app.api.v1.endpoints import elders, assessments, files
api_router.include_router(elders.router, prefix="/elders", tags=["老人管理"])
api_router.include_router(assessments.router, prefix="/assessments", tags=["健康评估"])
api_router.include_router(files.router, prefix="/files", tags=["文件管理"])

# ===== Alert & Followup routes (feat/backend-alert-followup) =====
# from app.api.v1.endpoints import alerts, followups, interventions, dashboard
# api_router.include_router(alerts.router, prefix="/alerts", tags=["风险预警"])
# api_router.include_router(followups.router, prefix="/followups", tags=["随访管理"])
# api_router.include_router(interventions.router, prefix="/interventions", tags=["干预记录"])
# api_router.include_router(dashboard.router, prefix="/dashboard", tags=["工作台"])
