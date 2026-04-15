-- SmartMedCare Platform — Full Database Schema
-- Encoding: UTF-8 / utf8mb4_unicode_ci
-- Engine: InnoDB

SET NAMES utf8mb4;
SET CHARACTER_SET_CLIENT = utf8mb4;
SET CHARACTER_SET_CONNECTION = utf8mb4;
SET CHARACTER_SET_RESULTS = utf8mb4;

-- ============================================================
-- 1. Authentication & Authorization
-- ============================================================

CREATE TABLE IF NOT EXISTS `users` (
    `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `username`      VARCHAR(64)  NOT NULL,
    `real_name`     VARCHAR(64)  NOT NULL DEFAULT '',
    `phone`         VARCHAR(20)  NOT NULL DEFAULT '',
    `email`         VARCHAR(128) NOT NULL DEFAULT '',
    `password_hash` VARCHAR(256) NOT NULL,
    `status`        ENUM('active','disabled') NOT NULL DEFAULT 'active',
    `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`    DATETIME DEFAULT NULL,
    UNIQUE KEY `uk_username` (`username`),
    INDEX `idx_status` (`status`),
    INDEX `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `roles` (
    `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name`         VARCHAR(64)  NOT NULL,
    `display_name` VARCHAR(128) NOT NULL DEFAULT '',
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`   DATETIME DEFAULT NULL,
    UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permissions` (
    `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `code`        VARCHAR(64)  NOT NULL,
    `name`        VARCHAR(128) NOT NULL DEFAULT '',
    `description` VARCHAR(256) NOT NULL DEFAULT '',
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`  DATETIME DEFAULT NULL,
    UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_roles` (
    `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`    BIGINT UNSIGNED NOT NULL,
    `role_id`    BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_user_role` (`user_id`, `role_id`),
    CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_permissions` (
    `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `role_id`       BIGINT UNSIGNED NOT NULL,
    `permission_id` BIGINT UNSIGNED NOT NULL,
    `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_role_perm` (`role_id`, `permission_id`),
    CONSTRAINT `fk_role_perms_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_role_perms_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. Elder Management
-- ============================================================

CREATE TABLE IF NOT EXISTS `elders` (
    `id`                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name`                    VARCHAR(64)  NOT NULL,
    `gender`                  ENUM('male','female','unknown') NOT NULL DEFAULT 'unknown',
    `birth_date`              DATE         DEFAULT NULL,
    `id_card`                 VARCHAR(18)  DEFAULT NULL,
    `phone`                   VARCHAR(20)  NOT NULL DEFAULT '',
    `address`                 VARCHAR(512) NOT NULL DEFAULT '',
    `account_status`          ENUM('active','disabled') NOT NULL DEFAULT 'active',
    `account_password_hash`   VARCHAR(256) NOT NULL DEFAULT '',
    `emergency_contact_name`  VARCHAR(64)  NOT NULL DEFAULT '',
    `emergency_contact_phone` VARCHAR(20)  NOT NULL DEFAULT '',
    `created_at`              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`              DATETIME DEFAULT NULL,
    UNIQUE KEY `uk_id_card` (`id_card`),
    INDEX `idx_name` (`name`),
    INDEX `idx_phone` (`phone`),
    INDEX `idx_account_status` (`account_status`),
    INDEX `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `elder_tags` (
    `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `elder_id`   BIGINT UNSIGNED NOT NULL,
    `tag_name`   VARCHAR(64) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME DEFAULT NULL,
    INDEX `idx_elder_id` (`elder_id`),
    INDEX `idx_tag_name` (`tag_name`),
    CONSTRAINT `fk_elder_tags_elder` FOREIGN KEY (`elder_id`) REFERENCES `elders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. Health Records
-- ============================================================

CREATE TABLE IF NOT EXISTS `health_records` (
    `id`                       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `elder_id`                 BIGINT UNSIGNED NOT NULL,
    `height_cm`                DECIMAL(5,1)  DEFAULT NULL,
    `weight_kg`                DECIMAL(5,1)  DEFAULT NULL,
    `blood_pressure_systolic`  INT           DEFAULT NULL,
    `blood_pressure_diastolic` INT           DEFAULT NULL,
    `blood_glucose`            DECIMAL(5,1)  DEFAULT NULL,
    `heart_rate`               INT           DEFAULT NULL,
    `temperature`              DECIMAL(4,1)  DEFAULT NULL,
    `chronic_diseases`         JSON          DEFAULT NULL,
    `allergies`                JSON          DEFAULT NULL,
    `recorded_at`              DATETIME      DEFAULT NULL,
    `created_at`               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`               DATETIME DEFAULT NULL,
    INDEX `idx_elder_id` (`elder_id`),
    INDEX `idx_recorded_at` (`recorded_at`),
    CONSTRAINT `fk_health_records_elder` FOREIGN KEY (`elder_id`) REFERENCES `elders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `medical_records` (
    `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `elder_id`      BIGINT UNSIGNED NOT NULL,
    `visit_date`    DATE         DEFAULT NULL,
    `hospital_name` VARCHAR(256) NOT NULL DEFAULT '',
    `department`    VARCHAR(128) NOT NULL DEFAULT '',
    `diagnosis`     VARCHAR(512) NOT NULL DEFAULT '',
    `medications`   JSON         DEFAULT NULL,
    `remarks`       TEXT         DEFAULT NULL,
    `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`    DATETIME DEFAULT NULL,
    INDEX `idx_elder_id` (`elder_id`),
    INDEX `idx_visit_date` (`visit_date`),
    CONSTRAINT `fk_medical_records_elder` FOREIGN KEY (`elder_id`) REFERENCES `elders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `care_records` (
    `id`             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `elder_id`       BIGINT UNSIGNED NOT NULL,
    `care_type`      VARCHAR(64)  NOT NULL DEFAULT '',
    `care_date`      DATE         DEFAULT NULL,
    `content`        TEXT         DEFAULT NULL,
    `caregiver_name` VARCHAR(64)  NOT NULL DEFAULT '',
    `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`     DATETIME DEFAULT NULL,
    INDEX `idx_elder_id` (`elder_id`),
    INDEX `idx_care_date` (`care_date`),
    CONSTRAINT `fk_care_records_elder` FOREIGN KEY (`elder_id`) REFERENCES `elders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. Assessments
-- ============================================================

CREATE TABLE IF NOT EXISTS `assessments` (
    `id`              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `elder_id`        BIGINT UNSIGNED NOT NULL,
    `assessment_type` VARCHAR(64)  NOT NULL DEFAULT 'comprehensive',
    `score`           INT          DEFAULT NULL,
    `risk_level`      ENUM('low','medium','high','critical') NOT NULL DEFAULT 'low',
    `summary`         TEXT         DEFAULT NULL,
    `suggestions`     JSON         DEFAULT NULL,
    `created_by`      BIGINT UNSIGNED DEFAULT NULL,
    `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`      DATETIME DEFAULT NULL,
    INDEX `idx_elder_id` (`elder_id`),
    INDEX `idx_risk_level` (`risk_level`),
    INDEX `idx_assessment_type` (`assessment_type`),
    INDEX `idx_created_by` (`created_by`),
    CONSTRAINT `fk_assessments_elder` FOREIGN KEY (`elder_id`) REFERENCES `elders`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_assessments_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. Alerts (Risk Warnings)
-- ============================================================

CREATE TABLE IF NOT EXISTS `alerts` (
    `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `elder_id`     BIGINT UNSIGNED NOT NULL,
    `type`         VARCHAR(64)  NOT NULL DEFAULT '',
    `title`        VARCHAR(256) NOT NULL DEFAULT '',
    `description`  TEXT         DEFAULT NULL,
    `risk_level`   ENUM('low','medium','high','critical') NOT NULL DEFAULT 'low',
    `status`       ENUM('pending','processing','resolved','ignored') NOT NULL DEFAULT 'pending',
    `source`       VARCHAR(64)  NOT NULL DEFAULT '',
    `remark`       TEXT         DEFAULT NULL,
    `triggered_at` DATETIME     DEFAULT NULL,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`   DATETIME DEFAULT NULL,
    INDEX `idx_elder_id` (`elder_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_risk_level` (`risk_level`),
    INDEX `idx_type` (`type`),
    INDEX `idx_triggered_at` (`triggered_at`),
    CONSTRAINT `fk_alerts_elder` FOREIGN KEY (`elder_id`) REFERENCES `elders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. Follow-ups
-- ============================================================

CREATE TABLE IF NOT EXISTS `followups` (
    `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `elder_id`    BIGINT UNSIGNED NOT NULL,
    `alert_id`    BIGINT UNSIGNED DEFAULT NULL,
    `plan_type`   VARCHAR(64)  NOT NULL DEFAULT '',
    `planned_at`  DATETIME     DEFAULT NULL,
    `status`      ENUM('todo','in_progress','completed','overdue','cancelled') NOT NULL DEFAULT 'todo',
    `assigned_to` BIGINT UNSIGNED DEFAULT NULL,
    `notes`       TEXT         DEFAULT NULL,
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`  DATETIME DEFAULT NULL,
    INDEX `idx_elder_id` (`elder_id`),
    INDEX `idx_alert_id` (`alert_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_assigned_to` (`assigned_to`),
    INDEX `idx_planned_at` (`planned_at`),
    CONSTRAINT `fk_followups_elder` FOREIGN KEY (`elder_id`) REFERENCES `elders`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_followups_alert` FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_followups_user` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `followup_records` (
    `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `followup_id` BIGINT UNSIGNED NOT NULL,
    `actual_time` DATETIME     DEFAULT NULL,
    `result`      TEXT         DEFAULT NULL,
    `next_action` TEXT         DEFAULT NULL,
    `status`      VARCHAR(32)  NOT NULL DEFAULT '',
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`  DATETIME DEFAULT NULL,
    INDEX `idx_followup_id` (`followup_id`),
    CONSTRAINT `fk_followup_records_followup` FOREIGN KEY (`followup_id`) REFERENCES `followups`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. Interventions
-- ============================================================

CREATE TABLE IF NOT EXISTS `interventions` (
    `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `elder_id`     BIGINT UNSIGNED NOT NULL,
    `followup_id`  BIGINT UNSIGNED DEFAULT NULL,
    `type`         VARCHAR(64)  NOT NULL DEFAULT '',
    `status`       ENUM('planned','ongoing','completed','stopped') NOT NULL DEFAULT 'planned',
    `content`      TEXT         DEFAULT NULL,
    `planned_at`   DATETIME     DEFAULT NULL,
    `performed_by` BIGINT UNSIGNED DEFAULT NULL,
    `performed_at` DATETIME     DEFAULT NULL,
    `result`       TEXT         DEFAULT NULL,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`   DATETIME DEFAULT NULL,
    INDEX `idx_elder_id` (`elder_id`),
    INDEX `idx_followup_id` (`followup_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_performed_by` (`performed_by`),
    CONSTRAINT `fk_interventions_elder` FOREIGN KEY (`elder_id`) REFERENCES `elders`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_interventions_followup` FOREIGN KEY (`followup_id`) REFERENCES `followups`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_interventions_user` FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. File Management
-- ============================================================

CREATE TABLE IF NOT EXISTS `file_records` (
    `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `file_name`    VARCHAR(256) NOT NULL DEFAULT '',
    `object_key`   VARCHAR(512) NOT NULL DEFAULT '',
    `content_type` VARCHAR(128) NOT NULL DEFAULT '',
    `size`         BIGINT       NOT NULL DEFAULT 0,
    `category`     VARCHAR(64)  NOT NULL DEFAULT '',
    `elder_id`     BIGINT UNSIGNED DEFAULT NULL,
    `uploaded_by`  BIGINT UNSIGNED DEFAULT NULL,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`   DATETIME DEFAULT NULL,
    INDEX `idx_elder_id` (`elder_id`),
    INDEX `idx_uploaded_by` (`uploaded_by`),
    INDEX `idx_category` (`category`),
    CONSTRAINT `fk_file_records_elder` FOREIGN KEY (`elder_id`) REFERENCES `elders`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_file_records_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `file_bindings` (
    `id`       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `file_id`  BIGINT UNSIGNED NOT NULL,
    `biz_type` VARCHAR(64)     NOT NULL DEFAULT '',
    `biz_id`   BIGINT          NOT NULL,
    INDEX `idx_file_id` (`file_id`),
    INDEX `idx_biz` (`biz_type`, `biz_id`),
    CONSTRAINT `fk_file_bindings_file` FOREIGN KEY (`file_id`) REFERENCES `file_records`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. Analytics & Data Jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS `analytics_jobs` (
    `id`             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `job_type`       VARCHAR(64)  NOT NULL DEFAULT '',
    `job_id`         VARCHAR(128) NOT NULL,
    `status`         VARCHAR(32)  NOT NULL DEFAULT 'pending',
    `result_summary` JSON         DEFAULT NULL,
    `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`     DATETIME DEFAULT NULL,
    UNIQUE KEY `uk_job_id` (`job_id`),
    INDEX `idx_job_type` (`job_type`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `elder_risk_profiles` (
    `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `elder_id`   BIGINT UNSIGNED NOT NULL,
    `risk_score` DECIMAL(5,2)    DEFAULT NULL,
    `risk_level` ENUM('low','medium','high','critical') NOT NULL DEFAULT 'low',
    `factors`    JSON            DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME DEFAULT NULL,
    UNIQUE KEY `uk_elder_id` (`elder_id`),
    CONSTRAINT `fk_risk_profiles_elder` FOREIGN KEY (`elder_id`) REFERENCES `elders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dashboard_snapshots` (
    `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `snapshot_data` JSON     DEFAULT NULL,
    `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`    DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. Audit & System
-- ============================================================

CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`       BIGINT UNSIGNED DEFAULT NULL,
    `operation`     VARCHAR(64)  NOT NULL DEFAULT '',
    `resource_type` VARCHAR(64)  NOT NULL DEFAULT '',
    `resource_id`   BIGINT       DEFAULT NULL,
    `old_value`     JSON         DEFAULT NULL,
    `new_value`     JSON         DEFAULT NULL,
    `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_resource` (`resource_type`, `resource_id`),
    INDEX `idx_created_at` (`created_at`),
    CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `login_logs` (
    `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`     BIGINT UNSIGNED DEFAULT NULL,
    `login_time`  DATETIME     DEFAULT NULL,
    `ip_address`  VARCHAR(45)  NOT NULL DEFAULT '',
    `user_agent`  TEXT         DEFAULT NULL,
    `status`      VARCHAR(32)  NOT NULL DEFAULT '',
    `logout_time` DATETIME     DEFAULT NULL,
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_login_time` (`login_time`),
    CONSTRAINT `fk_login_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `system_configs` (
    `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `config_key`   VARCHAR(128) NOT NULL,
    `config_value` TEXT         DEFAULT NULL,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Seed Data
-- ============================================================

-- Admin user (password: Admin@123)
INSERT INTO `users` (`id`, `username`, `real_name`, `phone`, `email`, `password_hash`, `status`)
VALUES (1, 'admin', '系统管理员', '13800000000', 'admin@smartmedcare.com',
        '$2b$12$WJ60h0/3QceKDd1fWRPjQe2sC3z9.H0/BPToV4AaqQr9ayy7PUQA.', 'active');

-- Roles
INSERT INTO `roles` (`id`, `name`, `display_name`) VALUES
(1, 'admin',  '管理员'),
(2, 'doctor', '医生');

-- Permissions (21 from API doc section 18)
INSERT INTO `permissions` (`id`, `code`, `name`, `description`) VALUES
( 1, 'auth:login',           '登录',         '用户登录权限'),
( 2, 'elder:create',         '创建老人档案', '创建老人基本信息档案'),
( 3, 'elder:read',           '查看老人档案', '查看老人基本信息及列表'),
( 4, 'elder:update',         '修改老人档案', '修改老人基本信息'),
( 5, 'elder:delete',         '删除老人档案', '逻辑删除老人档案'),
( 6, 'health_record:create', '新增健康记录', '新增老人健康体征记录'),
( 7, 'health_record:read',   '查看健康记录', '查看老人健康体征记录'),
( 8, 'assessment:create',    '创建评估',     '创建或生成健康评估'),
( 9, 'assessment:read',      '查看评估',     '查看健康评估结果'),
(10, 'alert:read',           '查看预警',     '查看风险预警列表及详情'),
(11, 'alert:update',         '处理预警',     '更新预警状态及备注'),
(12, 'followup:create',      '创建随访',     '创建随访计划'),
(13, 'followup:update',      '更新随访',     '更新随访计划和记录结果'),
(14, 'intervention:create',  '创建干预',     '创建干预记录'),
(15, 'analytics:read',       '查看分析看板', '查看数据统计和分析看板'),
(16, 'analytics:run',        '触发分析任务', '手动触发数据分析任务'),
(17, 'file:upload',          '上传文件',     '上传文件到对象存储'),
(18, 'user:manage',          '用户管理',     '用户的增删改查'),
(19, 'role:manage',          '角色管理',     '角色和权限的管理'),
(20, 'system:config',        '系统配置管理', '系统配置的查看和修改'),
(21, 'system:audit',         '审计日志查看', '查看审计日志和登录日志');

-- Admin role: assign ALL permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(1,  1), (1,  2), (1,  3), (1,  4), (1,  5),
(1,  6), (1,  7), (1,  8), (1,  9), (1, 10),
(1, 11), (1, 12), (1, 13), (1, 14), (1, 15),
(1, 16), (1, 17), (1, 18), (1, 19), (1, 20),
(1, 21);

-- Doctor role: assign relevant permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(2,  1),  -- auth:login
(2,  3),  -- elder:read
(2,  4),  -- elder:update
(2,  6),  -- health_record:create
(2,  7),  -- health_record:read
(2,  8),  -- assessment:create
(2,  9),  -- assessment:read
(2, 10),  -- alert:read
(2, 11),  -- alert:update
(2, 12),  -- followup:create
(2, 13),  -- followup:update
(2, 14),  -- intervention:create
(2, 15),  -- analytics:read
(2, 17);  -- file:upload

-- Assign admin role to admin user
INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES (1, 1);
