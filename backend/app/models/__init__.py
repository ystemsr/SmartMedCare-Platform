"""
Import all models so Alembic can discover them.
Each section is maintained by a specific feature branch.
"""
from app.models.base import Base  # noqa: F401

# ===== Auth & System models (feat/backend-auth-system) =====
from app.models.user import User, UserRole  # noqa: F401
from app.models.role import Role, Permission, RolePermission  # noqa: F401
from app.models.audit_log import AuditLog, LoginLog, SystemConfig  # noqa: F401

# ===== Elder & Health models (feat/backend-elder-health) =====
from app.models.elder import Elder, ElderTag  # noqa: F401
from app.models.health_archive import HealthRecord, MedicalRecord, CareRecord  # noqa: F401
from app.models.assessment import Assessment  # noqa: F401
from app.models.file_record import FileRecord, FileBinding  # noqa: F401

# ===== Alert & Followup models (feat/backend-alert-followup) =====
from app.models.alert import Alert  # noqa: F401
from app.models.followup import Followup, FollowupRecord  # noqa: F401
from app.models.intervention import Intervention  # noqa: F401
from app.models.analytics import AnalyticsJob, ElderRiskProfile, DashboardSnapshot  # noqa: F401

# ===== Elder & Family Role models =====
from app.models.invite_code import ElderInviteCode  # noqa: F401
from app.models.family_member import FamilyMember  # noqa: F401

# ===== AI Knowledge Base (RAG) =====
from app.models.knowledge_base import KBDocument, KBChunk  # noqa: F401

# ===== Big Data & ML models (feat/bigdata-backend) =====
from app.models.bigdata import BigDataJob, PredictionResult  # noqa: F401
from app.models.hive_history import HiveQueryHistory, HiveSavedQuery  # noqa: F401
from app.models.survey_task import SurveyTask  # noqa: F401
from app.models.prediction_task import PredictionTask  # noqa: F401
