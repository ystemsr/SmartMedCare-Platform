# Database Design

## Overview

The SmartMedCare platform uses MySQL 8.0 with InnoDB engine and `utf8mb4_unicode_ci` collation. All business entity tables follow the conventions defined in `CLAUDE.md`.

## Table Conventions

- **Primary Key:** `id BIGINT UNSIGNED AUTO_INCREMENT`
- **Timestamps:** `created_at`, `updated_at` (auto-managed by MySQL)
- **Soft Delete:** `deleted_at DATETIME DEFAULT NULL` on business entity tables
- **Naming:** All table and column names use `snake_case`
- **Engine:** InnoDB with `utf8mb4_unicode_ci` character set

Tables that do NOT use soft delete (physical deletion is appropriate):
- `user_roles` — join table
- `role_permissions` — join table
- `file_bindings` — binding mapping
- `audit_logs` — immutable audit trail
- `login_logs` — immutable login trail
- `system_configs` — configuration key-value store

## Entity-Relationship Summary

```
users 1──N user_roles N──1 roles
roles 1──N role_permissions N──1 permissions

elders 1──N elder_tags
elders 1──N health_records
elders 1──N medical_records
elders 1──N care_records
elders 1──N assessments
elders 1──N alerts
elders 1──N followups
elders 1──N interventions
elders 1──1 elder_risk_profiles

alerts  1──N followups (optional link)
followups 1──N followup_records
followups 1──N interventions (optional link)

users ──> assessments.created_by
users ──> followups.assigned_to
users ──> interventions.performed_by
users ──> file_records.uploaded_by
users ──> audit_logs.user_id
users ──> login_logs.user_id

file_records 1──N file_bindings
```

## Tables by Module

### Authentication & Authorization

| Table | Description |
|-------|-------------|
| `users` | System users (doctors, admins). Soft delete enabled. |
| `roles` | Named roles (admin, doctor). Unique on `name`. |
| `permissions` | Permission codes (e.g., `elder:read`). Unique on `code`. |
| `user_roles` | Many-to-many join between users and roles. |
| `role_permissions` | Many-to-many join between roles and permissions. |

### Elder Management

| Table | Description |
|-------|-------------|
| `elders` | Core elderly person records. Unique on `id_card`. |
| `elder_tags` | Tags associated with an elder (e.g., chronic conditions, priority flags). |

### Health Data

| Table | Description |
|-------|-------------|
| `health_records` | Vital signs and health metrics per elder per visit. |
| `medical_records` | Hospital visit records with diagnosis and medications. |
| `care_records` | Daily care activities performed by caregivers. |

### Assessment & Risk

| Table | Description |
|-------|-------------|
| `assessments` | Health assessments with score, risk level, and suggestions. |
| `alerts` | Risk warning events triggered by rules or manually. |
| `elder_risk_profiles` | Computed risk profile per elder (unique per elder). |

### Follow-up & Intervention

| Table | Description |
|-------|-------------|
| `followups` | Planned follow-up visits linked to elders and optionally alerts. |
| `followup_records` | Actual execution records for each follow-up. |
| `interventions` | Intervention actions linked to elders and optionally follow-ups. |

### File Management

| Table | Description |
|-------|-------------|
| `file_records` | Metadata for files stored in MinIO. |
| `file_bindings` | Links files to business records (assessment, intervention, etc.). |

### Analytics

| Table | Description |
|-------|-------------|
| `analytics_jobs` | Tracks data analysis job execution status. Unique on `job_id`. |
| `dashboard_snapshots` | Cached daily dashboard statistics as JSON. |

### Audit & System

| Table | Description |
|-------|-------------|
| `audit_logs` | Immutable log of data changes for compliance. |
| `login_logs` | Tracks user login/logout events with IP and user agent. |
| `system_configs` | Key-value store for runtime configuration. |

## Index Strategy

- **Foreign keys:** All FK columns are indexed automatically by InnoDB.
- **Unique constraints:** `users.username`, `elders.id_card`, `roles.name`, `permissions.code`, `analytics_jobs.job_id`, `system_configs.config_key`, `elder_risk_profiles.elder_id`.
- **Status columns:** Indexed for filtered queries (`users.status`, `elders.account_status`, `alerts.status`, `followups.status`).
- **Date/time columns:** Indexed for range queries (`health_records.recorded_at`, `alerts.triggered_at`, `followups.planned_at`, `audit_logs.created_at`).
- **Composite indexes:** `file_bindings(biz_type, biz_id)`, `audit_logs(resource_type, resource_id)`.

## Seed Data

The `001_init.sql` script includes:
1. An admin user (username: `admin`, password: `Admin@123`)
2. Two roles: `admin` and `doctor`
3. All 21 permissions from the API specification
4. Full permission assignment to the admin role
5. Relevant permission assignment to the doctor role
6. Admin role assignment to the admin user
