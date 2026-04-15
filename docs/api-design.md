# 医生服务系统 API 文档

## 1. 文档说明

### 1.1 项目名称

智慧医养大数据公共服务平台 —— 医生服务系统

### 1.2 文档目标

本文档用于统一前后端、测试、部署和联调阶段的接口规范，覆盖以下模块：

- 认证与权限
- 医生工作台
- 老人健康管理
- 健康评估与风险预警
- 随访管理
- 干预记录
- 数据分析与看板
- 文件上传与对象存储
- 系统管理与运维支持

### 1.3 接口风格

- 协议：HTTP/HTTPS
- 风格：RESTful
- 数据格式：JSON
- 字符编码：UTF-8
- 鉴权方式：Bearer Token（JWT）
- 时间格式：ISO 8601，示例：`2026-04-13T10:30:00+08:00`

### 1.4 环境地址

- 开发环境：`http://localhost/api/v1`
- 测试环境：`http://test.example.com/api/v1`
- 生产环境：`https://prod.example.com/api/v1`

---

## 2. 通用规范

### 2.1 请求头

```http
Content-Type: application/json
Authorization: Bearer <access_token>
X-Request-Id: <optional-request-id>
```

### 2.2 统一响应格式

#### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

#### 分页响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [],
    "page": 1,
    "page_size": 20,
    "total": 128,
    "total_pages": 7
  }
}
```

#### 错误响应

```json
{
  "code": 40001,
  "message": "参数错误",
  "data": null,
  "errors": [
    {
      "field": "phone",
      "reason": "手机号格式不正确"
    }
  ]
}
```

### 2.3 统一状态码约定

| code  | 含义                |
| ----- | ------------------- |
| 0     | 成功                |
| 40000 | 请求失败            |
| 40001 | 参数错误            |
| 40002 | 缺少必要参数        |
| 40003 | 数据格式非法        |
| 40100 | 未登录或 token 无效 |
| 40101 | token 已过期        |
| 40300 | 无权限访问          |
| 40400 | 资源不存在          |
| 40900 | 资源冲突            |
| 42200 | 业务校验失败        |
| 50000 | 服务器内部错误      |
| 50010 | 文件存储服务异常    |
| 50020 | 数据分析任务异常    |

### 2.4 分页参数规范

| 参数       | 类型   | 必填 | 默认值     | 说明                   |
| ---------- | ------ | ---- | ---------- | ---------------------- |
| page       | int    | 否   | 1          | 页码，从 1 开始        |
| page_size  | int    | 否   | 20         | 每页条数，建议最大 100 |
| keyword    | string | 否   | -          | 关键字搜索             |
| sort_by    | string | 否   | created_at | 排序字段               |
| sort_order | string | 否   | desc       | `asc` / `desc`         |

### 2.5 业务字段枚举示例

#### 性别

- `male`
- `female`
- `unknown`

#### 风险等级

- `low`
- `medium`
- `high`
- `critical`

#### 预警状态

- `pending`
- `processing`
- `resolved`
- `ignored`

#### 随访状态

- `todo`
- `in_progress`
- `completed`
- `overdue`
- `cancelled`

#### 干预状态

- `planned`
- `ongoing`
- `completed`
- `stopped`

---

## 3. 数据模型概要

### 3.1 User

```json
{
  "id": 1,
  "username": "doctor01",
  "real_name": "张医生",
  "phone": "13800000000",
  "email": "doctor01@example.com",
  "status": "active",
  "roles": [
    {
      "id": 1,
      "name": "doctor",
      "display_name": "医生"
    }
  ],
  "created_at": "2026-04-13T10:00:00+08:00"
}
```

### 3.2 Elder

```json
{
  "id": 101,
  "name": "李某某",
  "gender": "female",
  "birth_date": "1948-05-10",
  "id_card": "500101194805102233",
  "phone": "13900000000",
  "address": "重庆市xx区xx街道",
  "account_status": "active",
  "emergency_contact_name": "李某儿子",
  "emergency_contact_phone": "13700000000",
  "tags": ["高血压", "重点随访"],
  "created_at": "2026-04-13T10:00:00+08:00"
}
```

### 3.3 Health Record

```json
{
  "id": 1001,
  "elder_id": 101,
  "height_cm": 160,
  "weight_kg": 62.5,
  "blood_pressure_systolic": 145,
  "blood_pressure_diastolic": 92,
  "blood_glucose": 7.8,
  "heart_rate": 82,
  "temperature": 36.7,
  "chronic_diseases": ["hypertension"],
  "allergies": ["penicillin"],
  "recorded_at": "2026-04-13T09:00:00+08:00"
}
```

### 3.4 Assessment

```json
{
  "id": 2001,
  "elder_id": 101,
  "score": 78,
  "risk_level": "medium",
  "summary": "存在血压偏高和随访频次不足问题",
  "suggestions": ["建议一周内完成血压复测", "建议安排重点人群随访"],
  "created_by": 1,
  "created_at": "2026-04-13T11:00:00+08:00"
}
```

### 3.5 Alert

```json
{
  "id": 3001,
  "elder_id": 101,
  "type": "blood_pressure_abnormal",
  "title": "血压异常预警",
  "description": "连续两次收缩压超过 140",
  "risk_level": "high",
  "status": "pending",
  "source": "rule_engine",
  "triggered_at": "2026-04-13T11:10:00+08:00"
}
```

### 3.6 Follow-up

```json
{
  "id": 4001,
  "elder_id": 101,
  "plan_type": "phone",
  "planned_at": "2026-04-15T09:00:00+08:00",
  "status": "todo",
  "assigned_to": 1,
  "notes": "重点关注近期血压情况"
}
```

### 3.7 Intervention

```json
{
  "id": 5001,
  "elder_id": 101,
  "followup_id": 4001,
  "type": "medication_guidance",
  "status": "completed",
  "content": "指导按时服药并记录每日血压",
  "performed_by": 1,
  "performed_at": "2026-04-15T10:00:00+08:00"
}
```

---

## 4. 认证与权限 API

### 4.1 用户登录

- **URL**: `POST /auth/login`
- **说明**: 用户账号密码登录，返回 access_token 和用户信息
- **是否鉴权**: 否

#### 请求参数

```json
{
  "username": "doctor01",
  "password": "123456",
  "captcha_id": "abc123",
  "captcha_code": "7K9P"
}
```

#### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "access_token": "jwt-token",
    "token_type": "Bearer",
    "expires_in": 7200,
    "user": {
      "id": 1,
      "username": "doctor01",
      "real_name": "张医生",
      "roles": ["doctor"]
    }
  }
}
```

### 4.2 获取当前用户信息

- **URL**: `GET /auth/me`
- **说明**: 获取当前登录用户信息与权限列表

#### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "username": "doctor01",
    "real_name": "张医生",
    "phone": "13800000000",
    "roles": ["doctor"],
    "permissions": [
      "elder:read",
      "elder:update",
      "assessment:create",
      "alert:read",
      "followup:create"
    ]
  }
}
```

### 4.3 刷新 token

- **URL**: `POST /auth/refresh`

#### 请求参数

```json
{
  "refresh_token": "refresh-token"
}
```

### 4.4 退出登录

- **URL**: `POST /auth/logout`
- **说明**: 将当前 token 拉入黑名单或删除会话

### 4.5 修改密码

- **URL**: `POST /auth/change-password`

#### 请求参数

```json
{
  "old_password": "123456",
  "new_password": "NewPassword@123"
}
```

### 4.6 获取验证码

- **URL**: `GET /auth/captcha`
- **说明**: 返回验证码 id 与 base64 图片

---

## 5. 医生工作台 API

### 5.1 工作台统计概览

- **URL**: `GET /dashboard/overview`
- **说明**: 返回当前医生或当前机构的统计信息

#### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "elder_total": 1200,
    "high_risk_total": 86,
    "pending_alert_total": 23,
    "todo_followup_total": 18,
    "completed_followup_today": 12,
    "assessment_total_today": 9
  }
}
```

### 5.2 近期待办列表

- **URL**: `GET /dashboard/todos`

#### 查询参数

| 参数  | 类型 | 必填 | 说明    |
| ----- | ---- | ---- | ------- |
| limit | int  | 否   | 默认 10 |

### 5.3 工作台趋势数据

- **URL**: `GET /dashboard/trends`

#### 查询参数

| 参数  | 类型   | 必填 | 说明                 |
| ----- | ------ | ---- | -------------------- |
| range | string | 否   | `7d` / `30d` / `90d` |

---

## 6. 老人健康管理 API

### 6.1 创建老人档案

- **URL**: `POST /elders`

#### 请求参数

```json
{
  "name": "李某某",
  "gender": "female",
  "birth_date": "1948-05-10",
  "id_card": "500101194805102233",
  "phone": "13900000000",
  "address": "重庆市xx区xx街道",
  "emergency_contact_name": "李某儿子",
  "emergency_contact_phone": "13700000000",
  "tags": ["高血压", "重点随访"]
}
```

### 6.2 老人列表

- **URL**: `GET /elders`

#### 查询参数

| 参数           | 类型   | 必填 | 说明                   |
| -------------- | ------ | ---- | ---------------------- |
| page           | int    | 否   | 页码                   |
| page_size      | int    | 否   | 每页条数               |
| keyword        | string | 否   | 姓名/手机号/身份证搜索 |
| gender         | string | 否   | 性别                   |
| tag            | string | 否   | 标签                   |
| account_status | string | 否   | 账户状态               |
| risk_level     | string | 否   | 风险等级筛选           |

### 6.3 获取老人详情

- **URL**: `GET /elders/{elder_id}`

### 6.4 更新老人信息

- **URL**: `PUT /elders/{elder_id}`

### 6.5 删除老人档案

- **URL**: `DELETE /elders/{elder_id}`
- **说明**: 建议逻辑删除

### 6.6 重置老人账户密码

- **URL**: `POST /elders/{elder_id}/reset-password`

### 6.7 启用/禁用老人账户

- **URL**: `POST /elders/{elder_id}/account-status`

#### 请求参数

```json
{
  "account_status": "disabled"
}
```

### 6.8 获取老人标签列表

- **URL**: `GET /elders/tags`

---

## 7. 健康记录 API

### 7.1 新增健康记录

- **URL**: `POST /elders/{elder_id}/health-records`

#### 请求参数

```json
{
  "height_cm": 160,
  "weight_kg": 62.5,
  "blood_pressure_systolic": 145,
  "blood_pressure_diastolic": 92,
  "blood_glucose": 7.8,
  "heart_rate": 82,
  "temperature": 36.7,
  "chronic_diseases": ["hypertension"],
  "allergies": ["penicillin"],
  "recorded_at": "2026-04-13T09:00:00+08:00"
}
```

### 7.2 健康记录列表

- **URL**: `GET /elders/{elder_id}/health-records`

### 7.3 健康记录详情

- **URL**: `GET /elders/{elder_id}/health-records/{record_id}`

### 7.4 更新健康记录

- **URL**: `PUT /elders/{elder_id}/health-records/{record_id}`

### 7.5 删除健康记录

- **URL**: `DELETE /elders/{elder_id}/health-records/{record_id}`

### 7.6 导入健康记录数据

- **URL**: `POST /elders/{elder_id}/health-records/import`
- **说明**: 支持 CSV/Excel 导入
- **Content-Type**: `multipart/form-data`

---

## 8. 医疗与照护记录 API

### 8.1 新增医疗记录

- **URL**: `POST /elders/{elder_id}/medical-records`

#### 请求参数

```json
{
  "visit_date": "2026-04-10",
  "hospital_name": "某某医院",
  "department": "心内科",
  "diagnosis": "高血压",
  "medications": ["缬沙坦"],
  "remarks": "建议继续观察"
}
```

### 8.2 医疗记录列表

- **URL**: `GET /elders/{elder_id}/medical-records`

### 8.3 新增照护记录

- **URL**: `POST /elders/{elder_id}/care-records`

#### 请求参数

```json
{
  "care_type": "daily_care",
  "care_date": "2026-04-12",
  "content": "协助测量血压并提醒按时服药",
  "caregiver_name": "王护理员"
}
```

### 8.4 照护记录列表

- **URL**: `GET /elders/{elder_id}/care-records`

---

## 9. 健康评估 API

### 9.1 创建评估

- **URL**: `POST /assessments`
- **说明**: 可手动创建，也可根据健康数据自动计算

#### 请求参数

```json
{
  "elder_id": 101,
  "assessment_type": "comprehensive",
  "score": 78,
  "risk_level": "medium",
  "summary": "存在血压偏高和随访频次不足问题",
  "suggestions": ["建议一周内复测血压", "建议纳入重点随访"]
}
```

### 9.2 评估列表

- **URL**: `GET /assessments`

#### 查询参数

| 参数            | 类型   | 必填 | 说明     |
| --------------- | ------ | ---- | -------- |
| page            | int    | 否   | 页码     |
| page_size       | int    | 否   | 每页条数 |
| elder_id        | int    | 否   | 老人 ID  |
| risk_level      | string | 否   | 风险等级 |
| assessment_type | string | 否   | 评估类型 |
| date_start      | string | 否   | 开始时间 |
| date_end        | string | 否   | 结束时间 |

### 9.3 评估详情

- **URL**: `GET /assessments/{assessment_id}`

### 9.4 更新评估

- **URL**: `PUT /assessments/{assessment_id}`

### 9.5 删除评估

- **URL**: `DELETE /assessments/{assessment_id}`

### 9.6 根据最新健康数据生成评估

- **URL**: `POST /assessments/generate`

#### 请求参数

```json
{
  "elder_id": 101,
  "force_recalculate": true
}
```

---

## 10. 风险预警 API

### 10.1 预警列表

- **URL**: `GET /alerts`

#### 查询参数

| 参数       | 类型   | 必填 | 说明     |
| ---------- | ------ | ---- | -------- |
| page       | int    | 否   | 页码     |
| page_size  | int    | 否   | 每页条数 |
| elder_id   | int    | 否   | 老人 ID  |
| type       | string | 否   | 预警类型 |
| status     | string | 否   | 预警状态 |
| risk_level | string | 否   | 风险等级 |
| date_start | string | 否   | 开始时间 |
| date_end   | string | 否   | 结束时间 |

### 10.2 获取预警详情

- **URL**: `GET /alerts/{alert_id}`

### 10.3 手动创建预警

- **URL**: `POST /alerts`

#### 请求参数

```json
{
  "elder_id": 101,
  "type": "manual_followup_needed",
  "title": "需人工重点关注",
  "description": "近期三次记录存在指标波动",
  "risk_level": "high"
}
```

### 10.4 更新预警状态

- **URL**: `PATCH /alerts/{alert_id}/status`

#### 请求参数

```json
{
  "status": "processing",
  "remark": "已安排医生电话随访"
}
```

### 10.5 批量处理预警

- **URL**: `POST /alerts/batch-status`

#### 请求参数

```json
{
  "ids": [3001, 3002, 3003],
  "status": "resolved",
  "remark": "已完成处理"
}
```

### 10.6 触发规则引擎重新检测

- **URL**: `POST /alerts/recheck`

#### 请求参数

```json
{
  "elder_id": 101
}
```

---

## 11. 随访管理 API

### 11.1 创建随访计划

- **URL**: `POST /followups`

#### 请求参数

```json
{
  "elder_id": 101,
  "alert_id": 3001,
  "plan_type": "phone",
  "planned_at": "2026-04-15T09:00:00+08:00",
  "assigned_to": 1,
  "notes": "重点关注血压复测结果"
}
```

### 11.2 随访列表

- **URL**: `GET /followups`

#### 查询参数

| 参数        | 类型   | 必填 | 说明           |
| ----------- | ------ | ---- | -------------- |
| page        | int    | 否   | 页码           |
| page_size   | int    | 否   | 每页条数       |
| elder_id    | int    | 否   | 老人 ID        |
| assigned_to | int    | 否   | 负责人         |
| status      | string | 否   | 随访状态       |
| plan_type   | string | 否   | 电话/上门/视频 |
| date_start  | string | 否   | 开始时间       |
| date_end    | string | 否   | 结束时间       |

### 11.3 随访详情

- **URL**: `GET /followups/{followup_id}`

### 11.4 更新随访计划

- **URL**: `PUT /followups/{followup_id}`

### 11.5 记录随访结果

- **URL**: `POST /followups/{followup_id}/records`

#### 请求参数

```json
{
  "actual_time": "2026-04-15T09:30:00+08:00",
  "result": "已联系到老人，近期血压略高",
  "next_action": "建议继续监测并一周后复访",
  "status": "completed"
}
```

### 11.6 更新随访状态

- **URL**: `PATCH /followups/{followup_id}/status`

#### 请求参数

```json
{
  "status": "overdue"
}
```

### 11.7 删除随访计划

- **URL**: `DELETE /followups/{followup_id}`

---

## 12. 干预记录 API

### 12.1 创建干预记录

- **URL**: `POST /interventions`

#### 请求参数

```json
{
  "elder_id": 101,
  "followup_id": 4001,
  "type": "medication_guidance",
  "status": "planned",
  "content": "指导按时服药并每日记录血压",
  "planned_at": "2026-04-15T10:00:00+08:00"
}
```

### 12.2 干预记录列表

- **URL**: `GET /interventions`

### 12.3 干预记录详情

- **URL**: `GET /interventions/{intervention_id}`

### 12.4 更新干预记录

- **URL**: `PUT /interventions/{intervention_id}`

### 12.5 更新干预状态

- **URL**: `PATCH /interventions/{intervention_id}/status`

#### 请求参数

```json
{
  "status": "completed",
  "result": "老人已开始按要求记录血压"
}
```

### 12.6 删除干预记录

- **URL**: `DELETE /interventions/{intervention_id}`

---

## 13. 数据处理与分析 API

### 13.1 分析总览

- **URL**: `GET /analytics/overview`
- **说明**: 返回平台级统计数据

#### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "elder_total": 1200,
    "male_total": 540,
    "female_total": 660,
    "high_risk_total": 86,
    "medium_risk_total": 240,
    "pending_alert_total": 23,
    "followup_completion_rate": 0.87
  }
}
```

### 13.2 老龄分布统计

- **URL**: `GET /analytics/age-distribution`

### 13.3 慢病分布统计

- **URL**: `GET /analytics/chronic-disease-distribution`

### 13.4 风险等级分布

- **URL**: `GET /analytics/risk-distribution`

### 13.5 预警趋势

- **URL**: `GET /analytics/alert-trend`

#### 查询参数

| 参数        | 类型   | 必填 | 说明                     |
| ----------- | ------ | ---- | ------------------------ |
| range       | string | 否   | `7d` / `30d` / `90d`     |
| granularity | string | 否   | `day` / `week` / `month` |

### 13.6 随访完成率统计

- **URL**: `GET /analytics/followup-completion`

### 13.7 干预效果分析

- **URL**: `GET /analytics/intervention-effectiveness`

### 13.8 获取指定老人风险画像

- **URL**: `GET /analytics/elders/{elder_id}/risk-profile`

#### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "elder_id": 101,
    "risk_score": 82.5,
    "risk_level": "high",
    "factors": [
      { "name": "高血压波动", "weight": 0.35 },
      { "name": "近期未随访", "weight": 0.25 },
      { "name": "慢病数量", "weight": 0.2 }
    ],
    "updated_at": "2026-04-13T12:00:00+08:00"
  }
}
```

### 13.9 触发分析任务

- **URL**: `POST /analytics/jobs/run`
- **说明**: 手动触发数据分析任务

#### 请求参数

```json
{
  "job_type": "daily_risk_analysis",
  "date": "2026-04-13"
}
```

### 13.10 查询分析任务状态

- **URL**: `GET /analytics/jobs/{job_id}`

---

## 14. 文件管理 API

### 14.1 上传文件

- **URL**: `POST /files/upload`
- **Content-Type**: `multipart/form-data`
- **说明**: 上传到 MinIO，并返回文件元数据

#### 表单字段

| 参数     | 类型   | 必填 | 说明                            |
| -------- | ------ | ---- | ------------------------------- |
| file     | file   | 是   | 文件本体                        |
| category | string | 否   | 文件分类，如 `report`、`avatar` |
| elder_id | int    | 否   | 关联老人 ID                     |

#### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "file_id": 9001,
    "file_name": "report.pdf",
    "object_key": "elder/101/report-001.pdf",
    "content_type": "application/pdf",
    "size": 204800,
    "url": "https://minio.example.com/..."
  }
}
```

### 14.2 获取文件详情

- **URL**: `GET /files/{file_id}`

### 14.3 获取文件下载地址

- **URL**: `GET /files/{file_id}/download-url`

### 14.4 删除文件

- **URL**: `DELETE /files/{file_id}`

### 14.5 关联文件到业务记录

- **URL**: `POST /files/{file_id}/bind`

#### 请求参数

```json
{
  "biz_type": "assessment",
  "biz_id": 2001
}
```

---

## 15. 用户、角色、权限 API

### 15.1 用户列表

- **URL**: `GET /users`

### 15.2 创建用户

- **URL**: `POST /users`

#### 请求参数

```json
{
  "username": "doctor02",
  "real_name": "李医生",
  "phone": "13811111111",
  "email": "doctor02@example.com",
  "password": "InitPassword@123",
  "role_ids": [1]
}
```

### 15.3 用户详情

- **URL**: `GET /users/{user_id}`

### 15.4 更新用户

- **URL**: `PUT /users/{user_id}`

### 15.5 删除用户

- **URL**: `DELETE /users/{user_id}`

### 15.6 角色列表

- **URL**: `GET /roles`

### 15.7 创建角色

- **URL**: `POST /roles`

### 15.8 更新角色权限

- **URL**: `PUT /roles/{role_id}/permissions`

#### 请求参数

```json
{
  "permissions": [
    "elder:read",
    "elder:update",
    "assessment:create",
    "alert:read"
  ]
}
```

### 15.9 权限树

- **URL**: `GET /permissions/tree`

---

## 16. 系统配置与运维 API

### 16.1 获取系统配置

- **URL**: `GET /system/configs`

### 16.2 更新系统配置

- **URL**: `PUT /system/configs/{key}`

#### 请求参数

```json
{
  "value": "7"
}
```

### 16.3 审计日志列表

- **URL**: `GET /system/audit-logs`

### 16.4 登录日志列表

- **URL**: `GET /system/login-logs`

### 16.5 系统健康检查

- **URL**: `GET /system/health`
- **说明**: 检查 MySQL、Redis、MinIO、服务状态

#### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "app": "ok",
    "mysql": "ok",
    "redis": "ok",
    "minio": "ok",
    "timestamp": "2026-04-13T12:30:00+08:00"
  }
}
```

### 16.6 服务运行信息

- **URL**: `GET /system/runtime`

---

## 17. Webhook / 异步任务接口（可选）

### 17.1 接收数据处理任务回调

- **URL**: `POST /callbacks/analytics-job`
- **说明**: 数据分析服务完成任务后回调业务系统

#### 请求参数

```json
{
  "job_id": "job_20260413_001",
  "job_type": "daily_risk_analysis",
  "status": "success",
  "result_summary": {
    "updated_elder_count": 1200,
    "high_risk_count": 86
  }
}
```

---

## 18. 权限建议矩阵

| 权限标识             | 说明         |
| -------------------- | ------------ |
| auth:login           | 登录         |
| elder:create         | 创建老人档案 |
| elder:read           | 查看老人档案 |
| elder:update         | 修改老人档案 |
| elder:delete         | 删除老人档案 |
| health_record:create | 新增健康记录 |
| health_record:read   | 查看健康记录 |
| assessment:create    | 创建评估     |
| assessment:read      | 查看评估     |
| alert:read           | 查看预警     |
| alert:update         | 处理预警     |
| followup:create      | 创建随访     |
| followup:update      | 更新随访     |
| intervention:create  | 创建干预     |
| analytics:read       | 查看分析看板 |
| analytics:run        | 触发分析任务 |
| file:upload          | 上传文件     |
| user:manage          | 用户管理     |
| role:manage          | 角色管理     |
| system:config        | 系统配置管理 |
| system:audit         | 审计日志查看 |

---

## 19. 前后端联调建议

### 19.1 接口版本控制

统一使用 `/api/v1` 前缀。后续重大调整可扩展为 `/api/v2`。

### 19.2 删除策略

业务主表建议采用逻辑删除，避免老人档案、评估、预警、随访等核心数据被物理删除后不可追溯。

### 19.3 幂等性建议

以下接口建议支持幂等：

- 创建随访计划
- 创建干预记录
- 上传文件
- 触发分析任务

可通过 `X-Idempotency-Key` 请求头实现。

### 19.4 审计要求

以下操作必须记录审计日志：

- 登录/退出
- 用户和角色变更
- 老人档案修改
- 评估结果修改
- 预警处理
- 随访结果提交
- 干预记录变更
- 系统配置修改

---

## 20. 推荐后端路由结构

```text
/api/v1
├─ /auth
├─ /dashboard
├─ /elders
│  ├─ /{elder_id}/health-records
│  ├─ /{elder_id}/medical-records
│  └─ /{elder_id}/care-records
├─ /assessments
├─ /alerts
├─ /followups
├─ /interventions
├─ /analytics
├─ /files
├─ /users
├─ /roles
├─ /permissions
└─ /system
```

---

## 21. 推荐数据库表对应关系

| 模块       | 核心表                                                   |
| ---------- | -------------------------------------------------------- |
| 认证与权限 | users, roles, permissions, user_roles, role_permissions  |
| 老人管理   | elders, elder_accounts, elder_tags                       |
| 健康数据   | health_records, medical_records, care_records            |
| 评估预警   | assessments, alerts                                      |
| 随访干预   | followups, followup_records, interventions               |
| 文件管理   | file_records, file_bindings                              |
| 分析任务   | analytics_jobs, elder_risk_profiles, dashboard_snapshots |
| 审计运维   | audit_logs, login_logs, system_configs                   |

---

## 22. 版本修订记录

| 版本 | 日期       | 说明          |
| ---- | ---------- | ------------- |
| v1.0 | 2026-04-13 | 初版 API 文档 |

---

## 23. 后续可扩展接口

后续可以在 v1 基础上增加：

- 短信/消息通知接口
- AI 风险解释接口
- 报表导出接口（PDF/Excel）
- 多机构数据隔离接口
- 数据仓库同步接口
- 外部医疗平台对接接口
