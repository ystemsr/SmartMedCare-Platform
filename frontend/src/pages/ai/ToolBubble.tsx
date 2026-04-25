import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { ToolBubbleType } from '../../api/ai';

/* =======================================================================
 * ToolCall — shared shape for non-search tool invocations tracked on an
 * assistant message. `search` bubbles go through the dedicated
 * SearchBubble component; everything else lands here.
 * ===================================================================== */
export interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'done' | 'error';
  ui_bubble_type: ToolBubbleType;
  payload?: Record<string, unknown>;
  ok?: boolean;
  /** Preview shown in the pending header (e.g. which elder_id is being
   *  looked up). Not rendered inside the card body. */
  argsPreview?: Record<string, unknown>;
}

/* =======================================================================
 * Translation maps. Tools emit canonical snake_case / english tokens
 * (so the LLM can reason over stable identifiers); we translate those
 * to Chinese at render time. When a token is not in the map we fall
 * back to the raw value — that's the right default for user-authored
 * types like a doctor's custom assessment_type string.
 * ===================================================================== */

const ZH_GENDER: Record<string, string> = {
  male: '男',
  female: '女',
  unknown: '未知',
};

const ZH_ACCOUNT_STATUS: Record<string, string> = {
  active: '正常',
  disabled: '已禁用',
};

const ZH_RISK_LEVEL: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '极高',
};

const ZH_ALERT_STATUS: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  ignored: '已忽略',
};

const ZH_FOLLOWUP_STATUS: Record<string, string> = {
  todo: '待办',
  in_progress: '进行中',
  completed: '已完成',
  canceled: '已取消',
  cancelled: '已取消',
};

const ZH_INTERVENTION_STATUS: Record<string, string> = {
  planned: '已计划',
  ongoing: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  canceled: '已取消',
};

const ZH_ALERT_TYPE: Record<string, string> = {
  bp_high: '血压偏高',
  bp_low: '血压偏低',
  hr_high: '心率偏快',
  hr_low: '心率偏慢',
  temperature: '体温异常',
  fever: '发热',
  low_temperature: '低体温',
  glucose_high: '血糖偏高',
  glucose_low: '血糖偏低',
  fall: '跌倒',
  inactivity: '活动异常',
};

const ZH_FOLLOWUP_PLAN_TYPE: Record<string, string> = {
  visit: '上门随访',
  phone: '电话随访',
  video: '视频随访',
  clinic: '门诊随访',
  wechat: '微信随访',
};

const ZH_INTERVENTION_TYPE: Record<string, string> = {
  medication: '用药调整',
  hospital_referral: '转诊',
  lifestyle: '生活方式干预',
  rehabilitation: '康复训练',
  psychological: '心理干预',
  education: '健康教育',
  nutrition: '营养干预',
  exercise: '运动干预',
};

const ZH_ASSESSMENT_TYPE: Record<string, string> = {
  comprehensive: '综合评估',
  barthel: 'Barthel 生活能力',
  adl: 'ADL 日常生活',
  mmse: 'MMSE 认知评估',
  adl_instrumental: 'IADL 工具性日常生活',
  fall_risk: '跌倒风险评估',
  nutrition: '营养评估',
};

const ZH_ABNORMAL_FLAG: Record<string, string> = {
  bp_high: '收缩压偏高',
  bp_diastolic_high: '舒张压偏高',
  glucose_high: '血糖偏高',
  hr_high: '心率偏快',
  hr_low: '心率偏慢',
  fever: '发热',
};

const ZH_USER_ROLE: Record<string, string> = {
  admin: '管理员',
  doctor: '医生',
  elder: '老人',
  family: '家属',
};

const ZH_USER_STATUS: Record<string, string> = {
  active: '正常',
  disabled: '已停用',
};

const ZH_KB_STATUS: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  ready: '就绪',
  failed: '失败',
};

function tr(map: Record<string, string>, value: unknown): string {
  const s = value == null ? '' : String(value);
  return map[s] || s;
}

/* =======================================================================
 * Per-tool label copy. Every user-facing chip in the bubble header
 * comes from here — never let raw tool names or snake_case keys leak
 * into the UI.
 * ===================================================================== */

const TOOL_LABELS: Partial<Record<string, string>> = {
  web_search: '联网搜索',
  get_current_time: '查询当前时间',
  get_weather: '查询天气',
  search_elders: '检索老人档案',
  get_elder_profile: '读取老人档案',
  get_my_elder: '读取关联老人',
  list_health_records: '读取健康记录',
  list_my_health_records: '读取本人/关联老人记录',
  get_latest_vitals: '读取最新体征',
  get_my_latest_vitals: '读取本人/关联老人体征',
  list_alerts: '检索预警',
  list_my_alerts: '检索关联预警',
  get_alert_detail: '读取预警详情',
  process_alert: '标记预警为处理中',
  resolve_alert: '关闭预警',
  ignore_alert: '忽略预警',
  list_assessments: '检索健康评估',
  get_assessment_detail: '读取评估详情',
  get_assessment_feature_catalog: '读取评估特征目录',
  run_health_assessment: '运行健康评估',
  list_followups: '检索随访',
  list_my_followups: '检索关联随访',
  create_followup: '创建随访计划',
  add_followup_record: '登记随访记录',
  list_interventions: '检索干预记录',
  create_intervention: '创建干预记录',
  get_dashboard_overview: '读取平台概览',
  get_risk_distribution: '读取风险分布',
  get_alert_trend: '读取预警趋势',
  get_followup_completion_rate: '读取随访完成率',
  get_age_distribution: '读取年龄分布',
  list_users: '检索用户',
  get_recent_audit_logs: '读取审计日志',
  list_kb_documents: '读取知识库文档',
  get_family_invite_code: '查询家属邀请码',
  // Backward compat: legacy bubbles in saved chat history used the old name.
  generate_family_invite_code: '查询家属邀请码',
};

/* ---------- generic helpers ---------- */

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function asString(v: unknown): string {
  return v == null ? '' : String(v);
}
function asNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmtTs(v: unknown): string {
  return asString(v).slice(0, 16).replace('T', ' ');
}
function fmtDate(v: unknown): string {
  return asString(v).slice(0, 10);
}

/* ---------- header summary ---------- */

function summarizeBubble(call: ToolCall): string {
  const label = TOOL_LABELS[call.name] || call.name;
  if (call.status === 'pending') return `正在${label}…`;
  if (call.status === 'error' || call.ok === false) {
    const err =
      (call.payload &&
        typeof call.payload === 'object' &&
        'error' in call.payload &&
        typeof (call.payload as { error?: unknown }).error === 'string'
        ? (call.payload as { error: string }).error
        : '') || '失败';
    return `${label} · ${err}`;
  }
  const p = call.payload || {};
  const total = typeof p.total === 'number' ? p.total : undefined;
  if (total !== undefined) return `${label} · 共 ${total} 条`;
  if (call.ui_bubble_type === 'elder_profile' && typeof p.name === 'string') {
    return `${label} · ${p.name}`;
  }
  if (call.ui_bubble_type === 'weather' && typeof p.city === 'string') {
    return `${label} · ${p.city}`;
  }
  return `${label} · 已完成`;
}

function hasDetails(call: ToolCall): boolean {
  if (call.status !== 'done') return false;
  if (!call.payload || typeof call.payload !== 'object') return false;
  return true;
}

const GearIcon: React.FC = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ToolBubble: React.FC<{ call: ToolCall }> = ({ call }) => {
  // Structure mirrors ThinkingBubble: one `expanded` flag drives both
  // the `.expanded` CSS class AND the AnimatePresence exit animation.
  // The only addition is `bodyVisible` — a pre-exit step that fades
  // the inner content via CSS opacity WITHOUT touching height or the
  // class. Once the body is visually empty we flip `expanded` and the
  // standard thinking-bubble-style simultaneous {height, opacity} exit
  // takes over. Because the card has no visible content at that
  // moment, the simultaneous width snap (from .expanded class drop) is
  // invisible to the user.
  const [expanded, setExpanded] = useState(false);
  const [bodyVisible, setBodyVisible] = useState(false);
  const collapseTimer = useRef<number | null>(null);
  const label = useMemo(() => summarizeBubble(call), [call]);
  const pending = call.status === 'pending';
  const canExpand = hasDetails(call);

  // Duration of the content-fade pre-phase. Matches the CSS transition
  // on `.ai-search-details.body-hidden` below. Must be short — if it's
  // too long the user notices a gap between "I clicked" and "something
  // started happening".
  const BODY_FADE_MS = 150;

  useEffect(
    () => () => {
      if (collapseTimer.current != null) {
        window.clearTimeout(collapseTimer.current);
      }
    },
    [],
  );

  const toggle = (e: React.MouseEvent) => {
    if (!canExpand) return;
    e.stopPropagation();
    if (collapseTimer.current != null) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
    if (!expanded) {
      // Expand: widen immediately (class on), mount body, CSS fades
      // opacity in (body-hidden class off) in parallel with framer-
      // motion's height animation.
      setBodyVisible(true);
      setExpanded(true);
    } else {
      // Collapse — two steps:
      //   1. fade body opacity to 0 via CSS (height held by layout)
      //   2. after fade, trigger AnimatePresence exit which drops the
      //      .expanded class and animates height + opacity to 0 in
      //      the thinking-bubble's synchronous style.
      setBodyVisible(false);
      collapseTimer.current = window.setTimeout(() => {
        collapseTimer.current = null;
        setExpanded(false);
      }, BODY_FADE_MS);
    }
  };

  return (
    <div className="ai-search-wrap">
      <div className={`ai-search${expanded ? ' expanded' : ''}`}>
        <div
          className={`ai-search-head${canExpand ? ' clickable' : ''}`}
          onClick={toggle}
        >
          {pending ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="ai-search-spinner"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            </motion.div>
          ) : (
            <span className="ai-search-globe">
              <GearIcon />
            </span>
          )}
          <span className="ai-search-label">{label}</span>
          {canExpand && (
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="ai-search-caret"
            >
              <ChevronDown size={14} strokeWidth={2.5} />
            </motion.span>
          )}
        </div>

        {/* Conditionally mounted so the collapsed bubble does NOT
         *  inherit the intrinsic width of the (hidden) body — a wide
         *  table rendered with max-height:0 still contributes its
         *  natural width to the parent's min-content, which was
         *  keeping collapsed cards as wide as the expanded ones.
         *  AnimatePresence handles enter/exit, framer-motion animates
         *  height 0↔auto; the card's overall height stays bounded
         *  because the inner `.ai-search-details` caps content at
         *  280px with its own scrollbar. */}
        {/* Identical shape to ThinkingBubble: a single height+opacity
         *  animation, same 0.3s easeInOut on both open and close. The
         *  only difference is that by the time exit fires, the inner
         *  `.ai-search-details` has already been CSS-faded to
         *  opacity:0 (see `body-hidden` class), so the close looks
         *  like a pure height collapse of an empty rectangle. */}
        <AnimatePresence initial={false}>
          {expanded && canExpand && (
            <motion.div
              key="tool-details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="ai-search-details-wrap"
            >
              <div
                className={`ai-search-details${
                  bodyVisible ? '' : ' body-hidden'
                }`}
              >
                <ToolBubbleBody call={call} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const ToolBubbleBody: React.FC<{ call: ToolCall }> = ({ call }) => {
  const payload = (call.payload || {}) as Record<string, unknown>;
  switch (call.ui_bubble_type) {
    case 'elder_list':
      return <ElderListBody payload={payload} />;
    case 'elder_profile':
      return <ElderProfileBody payload={payload} />;
    case 'alert_list':
      return <AlertListBody payload={payload} />;
    case 'alert_card':
      return <AlertCardBody payload={payload} />;
    case 'health_records':
      return <HealthRecordsBody payload={payload} />;
    case 'assessment':
      return <AssessmentBody payload={payload} />;
    case 'followup_list':
      return <FollowupListBody payload={payload} />;
    case 'intervention_list':
      return <InterventionListBody payload={payload} />;
    case 'chart':
      return <ChartBody payload={payload} />;
    case 'table':
      return <TableBody payload={payload} toolName={call.name} />;
    case 'weather':
      return <WeatherBody payload={payload} />;
    case 'text':
    default:
      return <TextBody payload={payload} />;
  }
};

/* ---------- shared atoms ---------- */

const Cell: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={`ai-tool-cell${className ? ' ' + className : ''}`}>{children}</div>;

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="ai-tool-row">{children}</div>
);

const KV: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="ai-tool-kv-row">
    <span className="ai-tool-kv-label">{label}</span>
    <span className="ai-tool-kv-value">{value || '-'}</span>
  </div>
);

const RiskBadge: React.FC<{ level?: unknown }> = ({ level }) => {
  const s = asString(level);
  if (!s) return <span>-</span>;
  return (
    <span className={`ai-tool-badge risk-${s}`}>{tr(ZH_RISK_LEVEL, s)}</span>
  );
};

const StatusBadge: React.FC<{ status?: unknown; map?: Record<string, string> }> = ({
  status,
  map = ZH_ALERT_STATUS,
}) => {
  const s = asString(status);
  if (!s) return <span>-</span>;
  return <span className={`ai-tool-badge status-${s}`}>{tr(map, s)}</span>;
};

/* ---------- elder_list ---------- */

interface ElderListItem {
  id: number;
  name: string;
  gender?: string;
  age?: number | null;
  phone_masked?: string;
  primary_doctor_name?: string | null;
  account_status?: string;
  risk_level?: string | null;
}

const ElderListBody: React.FC<{ payload: Record<string, unknown> }> = ({
  payload,
}) => {
  const items = asArray<ElderListItem>(payload.items);
  if (items.length === 0) return <div className="ai-tool-empty">没有匹配记录</div>;
  return (
    <div className="ai-tool-table">
      <div className="ai-tool-thead">
        <Cell>档案编号</Cell>
        <Cell>姓名</Cell>
        <Cell>性别</Cell>
        <Cell>年龄</Cell>
        <Cell>风险等级</Cell>
        <Cell>主管医生</Cell>
        <Cell>账号状态</Cell>
      </div>
      {items.map((it) => (
        <Row key={it.id}>
          <Cell>{it.id}</Cell>
          <Cell>{it.name}</Cell>
          <Cell>{tr(ZH_GENDER, it.gender) || '-'}</Cell>
          <Cell>{it.age ?? '-'}</Cell>
          <Cell>
            {it.risk_level ? <RiskBadge level={it.risk_level} /> : '-'}
          </Cell>
          <Cell>{it.primary_doctor_name || '未分配'}</Cell>
          <Cell>{tr(ZH_ACCOUNT_STATUS, it.account_status) || '-'}</Cell>
        </Row>
      ))}
    </div>
  );
};

/* ---------- elder_profile ---------- */

const ElderProfileBody: React.FC<{ payload: Record<string, unknown> }> = ({
  payload,
}) => {
  const p = payload;
  const latest = (p.latest_assessment || null) as
    | {
        assessment_type?: string;
        risk_level?: string;
        score?: number;
        created_at?: string;
      }
    | null;
  return (
    <div className="ai-tool-kv">
      <KV label="档案编号" value={asString(p.id)} />
      <KV label="姓名" value={asString(p.name)} />
      <KV label="性别" value={tr(ZH_GENDER, p.gender)} />
      <KV label="年龄" value={asString(p.age)} />
      <KV label="电话" value={asString(p.phone_masked)} />
      <KV label="身份证" value={asString(p.id_card_masked)} />
      <KV label="地址" value={asString(p.address)} />
      <KV
        label="账号状态"
        value={tr(ZH_ACCOUNT_STATUS, p.account_status)}
      />
      <KV
        label="风险等级"
        value={p.risk_level ? <RiskBadge level={p.risk_level} /> : '-'}
      />
      <KV
        label="主管医生"
        value={asString(p.primary_doctor_name) || '未分配'}
      />
      <KV
        label="紧急联系人"
        value={
          asString(p.emergency_contact_name)
            ? `${asString(p.emergency_contact_name)}（${asString(p.emergency_contact_phone)}）`
            : '未填写'
        }
      />
      {asArray<string>(p.tags).length > 0 && (
        <KV label="标签" value={asArray<string>(p.tags).join('、')} />
      )}
      {latest && (
        <KV
          label="最近评估"
          value={
            <>
              {tr(ZH_ASSESSMENT_TYPE, latest.assessment_type)}
              {latest.created_at ? ` · ${fmtDate(latest.created_at)}` : ''}
              {' · 得分 '}
              {latest.score ?? '-'}
              {' · 风险 '}
              <RiskBadge level={latest.risk_level} />
            </>
          }
        />
      )}
    </div>
  );
};

/* ---------- alert_list ---------- */

interface AlertItem {
  id: number;
  elder_name?: string | null;
  title: string;
  type?: string;
  risk_level: string;
  status: string;
  triggered_at?: string | null;
}

const AlertListBody: React.FC<{ payload: Record<string, unknown> }> = ({
  payload,
}) => {
  const items = asArray<AlertItem>(payload.items);
  if (items.length === 0) return <div className="ai-tool-empty">没有预警</div>;
  return (
    <div className="ai-tool-table">
      <div className="ai-tool-thead">
        <Cell>编号</Cell>
        <Cell>标题</Cell>
        <Cell>类型</Cell>
        <Cell>老人</Cell>
        <Cell>风险</Cell>
        <Cell>状态</Cell>
        <Cell>触发时间</Cell>
      </div>
      {items.map((it) => (
        <Row key={it.id}>
          <Cell>{it.id}</Cell>
          <Cell>{it.title}</Cell>
          <Cell>{tr(ZH_ALERT_TYPE, it.type) || '-'}</Cell>
          <Cell>{it.elder_name || '-'}</Cell>
          <Cell>
            <RiskBadge level={it.risk_level} />
          </Cell>
          <Cell>
            <StatusBadge status={it.status} />
          </Cell>
          <Cell>{fmtTs(it.triggered_at) || '-'}</Cell>
        </Row>
      ))}
    </div>
  );
};

/* ---------- alert_card ---------- */

const AlertCardBody: React.FC<{ payload: Record<string, unknown> }> = ({
  payload,
}) => {
  const p = payload;
  return (
    <div className="ai-tool-kv">
      <KV label="预警编号" value={asString(p.id)} />
      <KV label="标题" value={asString(p.title)} />
      <KV label="类型" value={tr(ZH_ALERT_TYPE, p.type) || asString(p.type)} />
      <KV label="老人" value={asString(p.elder_name) || asString(p.elder_id)} />
      <KV label="风险等级" value={<RiskBadge level={p.risk_level} />} />
      <KV label="当前状态" value={<StatusBadge status={p.status} />} />
      {p.previous_status != null && (
        <KV
          label="原状态"
          value={<StatusBadge status={p.previous_status} />}
        />
      )}
      <KV label="触发时间" value={fmtTs(p.triggered_at)} />
      {p.source != null && asString(p.source) && (
        <KV label="来源" value={asString(p.source)} />
      )}
      <KV label="描述" value={asString(p.description) || '（无）'} />
      {p.remark != null && asString(p.remark) && (
        <KV label="备注" value={asString(p.remark)} />
      )}
      {p.resolution != null && asString(p.resolution) && (
        <KV label="处理说明" value={asString(p.resolution)} />
      )}
      {p.reason != null && asString(p.reason) && (
        <KV label="忽略原因" value={asString(p.reason)} />
      )}
    </div>
  );
};

/* ---------- health_records ---------- */

const HealthRecordsBody: React.FC<{ payload: Record<string, unknown> }> = ({
  payload,
}) => {
  const items = asArray<Record<string, unknown>>(payload.items);
  const vitals = payload.vitals as Record<string, unknown> | undefined;

  if (vitals) {
    // Single-record (get_latest_vitals) layout
    const flags = asArray<string>(payload.abnormal_flags);
    const daysSince = asNumber(payload.days_since_last);
    return (
      <div className="ai-tool-kv">
        <KV
          label="记录时间"
          value={
            fmtTs(payload.recorded_at) +
            (daysSince != null ? `（距今 ${daysSince} 天）` : '')
          }
        />
        <KV
          label="血压"
          value={
            vitals.bp_sys != null && vitals.bp_dia != null
              ? `${vitals.bp_sys}/${vitals.bp_dia} mmHg`
              : '-'
          }
        />
        <KV
          label="心率"
          value={vitals.heart_rate != null ? `${vitals.heart_rate} bpm` : '-'}
        />
        <KV
          label="血糖"
          value={
            vitals.blood_glucose != null
              ? `${vitals.blood_glucose} mmol/L`
              : '-'
          }
        />
        <KV
          label="体温"
          value={vitals.temperature != null ? `${vitals.temperature} ℃` : '-'}
        />
        <KV
          label="身高"
          value={vitals.height_cm != null ? `${vitals.height_cm} cm` : '-'}
        />
        <KV
          label="体重"
          value={vitals.weight_kg != null ? `${vitals.weight_kg} kg` : '-'}
        />
        {flags.length > 0 && (
          <KV
            label="异常提示"
            value={flags.map((f) => tr(ZH_ABNORMAL_FLAG, f)).join('、')}
          />
        )}
      </div>
    );
  }

  if (items.length === 0) return <div className="ai-tool-empty">暂无健康记录</div>;
  return (
    <div className="ai-tool-table">
      <div className="ai-tool-thead">
        <Cell>时间</Cell>
        <Cell>血压（mmHg）</Cell>
        <Cell>心率（bpm）</Cell>
        <Cell>血糖（mmol/L）</Cell>
        <Cell>体温（℃）</Cell>
        <Cell>体重（kg）</Cell>
      </div>
      {items.map((it) => (
        <Row key={asString(it.id)}>
          <Cell>{fmtTs(it.recorded_at)}</Cell>
          <Cell>
            {it.bp_sys != null && it.bp_dia != null
              ? `${it.bp_sys}/${it.bp_dia}`
              : '-'}
          </Cell>
          <Cell>{asString(it.heart_rate) || '-'}</Cell>
          <Cell>{asString(it.blood_glucose) || '-'}</Cell>
          <Cell>{asString(it.temperature) || '-'}</Cell>
          <Cell>{asString(it.weight_kg) || '-'}</Cell>
        </Row>
      ))}
    </div>
  );
};

/* ---------- assessment ---------- */

const AssessmentBody: React.FC<{ payload: Record<string, unknown> }> = ({
  payload,
}) => {
  const suggestions = asArray<string>(payload.suggestions);
  return (
    <div className="ai-tool-kv">
      <KV label="评估编号" value={asString(payload.id)} />
      <KV
        label="老人"
        value={asString(payload.elder_name) || asString(payload.elder_id)}
      />
      <KV
        label="评估类型"
        value={
          tr(ZH_ASSESSMENT_TYPE, payload.assessment_type) ||
          asString(payload.assessment_type)
        }
      />
      <KV label="得分" value={asString(payload.score)} />
      <KV label="风险等级" value={<RiskBadge level={payload.risk_level} />} />
      {payload.created_at != null && (
        <KV label="创建时间" value={fmtTs(payload.created_at)} />
      )}
      <KV label="摘要" value={asString(payload.summary) || '（无）'} />
      {suggestions.length > 0 && (
        <div className="ai-tool-kv-row">
          <span className="ai-tool-kv-label">建议</span>
          <span className="ai-tool-kv-value">
            <ul className="ai-tool-sugg">
              {suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </span>
        </div>
      )}
      {payload.idempotent ? (
        <KV label="提示" value="今日已存在同类型评估，未重复创建" />
      ) : null}
    </div>
  );
};

/* ---------- followup_list ---------- */

const FollowupListBody: React.FC<{ payload: Record<string, unknown> }> = ({
  payload,
}) => {
  const items = asArray<Record<string, unknown>>(payload.items);

  // Single-record shape (create_followup / add_followup_record)
  if (items.length === 0 && payload.id) {
    return (
      <div className="ai-tool-kv">
        <KV label="随访编号" value={asString(payload.id)} />
        <KV
          label="老人"
          value={asString(payload.elder_name) || asString(payload.elder_id)}
        />
        <KV
          label="计划类型"
          value={
            tr(ZH_FOLLOWUP_PLAN_TYPE, payload.plan_type) ||
            asString(payload.plan_type)
          }
        />
        <KV label="计划时间" value={fmtTs(payload.planned_at)} />
        <KV
          label="状态"
          value={<StatusBadge status={payload.status} map={ZH_FOLLOWUP_STATUS} />}
        />
        <KV
          label="负责医生"
          value={asString(payload.assigned_to_name) || '未分配'}
        />
        {payload.notes != null && asString(payload.notes) && (
          <KV label="备注" value={asString(payload.notes)} />
        )}
        {payload.idempotent ? (
          <KV label="提示" value="已存在相同幂等键的计划，未重复创建" />
        ) : null}
      </div>
    );
  }

  if (items.length === 0) return <div className="ai-tool-empty">暂无随访</div>;
  return (
    <div className="ai-tool-table">
      <div className="ai-tool-thead">
        <Cell>编号</Cell>
        <Cell>老人</Cell>
        <Cell>计划类型</Cell>
        <Cell>计划时间</Cell>
        <Cell>状态</Cell>
        <Cell>负责医生</Cell>
        <Cell>记录数</Cell>
      </div>
      {items.map((it) => (
        <Row key={asString(it.id)}>
          <Cell>{asString(it.id)}</Cell>
          <Cell>{asString(it.elder_name) || asString(it.elder_id)}</Cell>
          <Cell>
            {tr(ZH_FOLLOWUP_PLAN_TYPE, it.plan_type) || asString(it.plan_type)}
          </Cell>
          <Cell>{fmtTs(it.planned_at)}</Cell>
          <Cell>
            <StatusBadge status={it.status} map={ZH_FOLLOWUP_STATUS} />
          </Cell>
          <Cell>{asString(it.assigned_to_name) || '未分配'}</Cell>
          <Cell>{asString(it.records_count ?? 0)}</Cell>
        </Row>
      ))}
    </div>
  );
};

/* ---------- intervention_list ---------- */

const InterventionListBody: React.FC<{ payload: Record<string, unknown> }> = ({
  payload,
}) => {
  const items = asArray<Record<string, unknown>>(payload.items);

  if (items.length === 0 && payload.id) {
    return (
      <div className="ai-tool-kv">
        <KV label="干预编号" value={asString(payload.id)} />
        <KV
          label="老人"
          value={asString(payload.elder_name) || asString(payload.elder_id)}
        />
        <KV
          label="干预类型"
          value={
            tr(ZH_INTERVENTION_TYPE, payload.type) || asString(payload.type)
          }
        />
        <KV
          label="状态"
          value={
            <StatusBadge status={payload.status} map={ZH_INTERVENTION_STATUS} />
          }
        />
        <KV label="计划时间" value={fmtTs(payload.planned_at)} />
        <KV label="内容" value={asString(payload.content)} />
        {payload.performed_by_name != null &&
          asString(payload.performed_by_name) && (
            <KV
              label="执行人"
              value={asString(payload.performed_by_name)}
            />
          )}
        {payload.performed_at != null && asString(payload.performed_at) && (
          <KV label="执行时间" value={fmtTs(payload.performed_at)} />
        )}
        {payload.result != null && asString(payload.result) && (
          <KV label="执行结果" value={asString(payload.result)} />
        )}
        {payload.idempotent ? (
          <KV label="提示" value="已存在相同幂等键的记录，未重复创建" />
        ) : null}
      </div>
    );
  }

  if (items.length === 0)
    return <div className="ai-tool-empty">暂无干预记录</div>;
  return (
    <div className="ai-tool-table">
      <div className="ai-tool-thead">
        <Cell>编号</Cell>
        <Cell>老人</Cell>
        <Cell>干预类型</Cell>
        <Cell>状态</Cell>
        <Cell>计划时间</Cell>
        <Cell>执行人</Cell>
      </div>
      {items.map((it) => (
        <Row key={asString(it.id)}>
          <Cell>{asString(it.id)}</Cell>
          <Cell>{asString(it.elder_name) || asString(it.elder_id)}</Cell>
          <Cell>
            {tr(ZH_INTERVENTION_TYPE, it.type) || asString(it.type)}
          </Cell>
          <Cell>
            <StatusBadge status={it.status} map={ZH_INTERVENTION_STATUS} />
          </Cell>
          <Cell>{fmtTs(it.planned_at)}</Cell>
          <Cell>{asString(it.performed_by_name) || '未分配'}</Cell>
        </Row>
      ))}
    </div>
  );
};

/* ---------- chart ---------- */

const ChartBody: React.FC<{ payload: Record<string, unknown> }> = ({
  payload,
}) => {
  // Stat cards (dashboard overview)
  const statCards = asArray<Record<string, unknown>>(payload.stat_cards);
  if (statCards.length > 0) {
    return (
      <div className="ai-tool-stat-cards">
        {statCards.map((c, i) => (
          <div key={i} className="ai-tool-stat-card">
            <div className="ai-tool-stat-label">{asString(c.label)}</div>
            <div className="ai-tool-stat-value">{asString(c.value)}</div>
          </div>
        ))}
      </div>
    );
  }

  // Generic series: risk_distribution / alert_trend / followup_completion /
  // age_distribution all go through here. For risk_distribution labels
  // come as "low"/"medium"/... — translate before displaying.
  const series = asArray<Record<string, unknown>>(payload.series);
  const buckets = asArray<Record<string, unknown>>(payload.buckets);
  const data = series.length > 0 ? series : buckets;
  if (data.length === 0) return <div className="ai-tool-empty">暂无数据</div>;
  const dimension = asString(payload.dimension);
  const max = Math.max(
    1,
    ...data.map((d) => asNumber(d.count ?? d.total ?? d.rate ?? 0) || 0),
  );
  return (
    <div className="ai-tool-bars">
      {data.map((d, i) => {
        const rawLabel = asString(d.date ?? d.period ?? d.range ?? d.label);
        const label =
          dimension === 'risk_level'
            ? tr(ZH_RISK_LEVEL, rawLabel) + '风险'
            : rawLabel;
        const val = asNumber(d.count ?? d.total ?? d.rate ?? 0) || 0;
        const w = `${Math.max(4, Math.round((val / max) * 100))}%`;
        return (
          <div key={i} className="ai-tool-bar-row">
            <span className="ai-tool-bar-label">{label}</span>
            <span className="ai-tool-bar-wrap">
              <span className="ai-tool-bar-fill" style={{ width: w }} />
            </span>
            <span className="ai-tool-bar-value">{val}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ---------- table (generic, per-tool config) ----------
 * Backend tools that land on the generic `table` bubble are:
 *   list_users, get_recent_audit_logs, list_kb_documents,
 *   list_assessments, get_assessment_feature_catalog.
 * Each needs bespoke columns — an auto "JSON.stringify every key" layout
 * leaks raw keys and internal ids (elder_id, created_by, ...) to the user.
 */

type ColumnDef = {
  key: string;
  label: string;
  render?: (v: unknown, row: Record<string, unknown>) => React.ReactNode;
};

const COLUMNS_BY_TOOL: Record<string, ColumnDef[]> = {
  list_users: [
    { key: 'id', label: '编号' },
    { key: 'real_name', label: '姓名', render: (v, r) => asString(v) || asString(r.username) },
    { key: 'username', label: '登录名' },
    { key: 'phone_masked', label: '电话' },
    {
      key: 'roles',
      label: '角色',
      render: (v) =>
        asArray<string>(v).map((r) => tr(ZH_USER_ROLE, r)).join('、') || '-',
    },
    {
      key: 'status',
      label: '状态',
      render: (v) => tr(ZH_USER_STATUS, v) || '-',
    },
  ],
  get_recent_audit_logs: [
    { key: 'id', label: '编号' },
    { key: 'created_at', label: '时间', render: (v) => fmtTs(v) },
    { key: 'username', label: '操作人' },
    { key: 'operation', label: '操作' },
    { key: 'resource_type', label: '资源' },
    { key: 'resource_id', label: '资源编号' },
  ],
  list_kb_documents: [
    { key: 'id', label: '编号' },
    { key: 'name', label: '文档名' },
    {
      key: 'role_code',
      label: '适用角色',
      render: (v) => tr(ZH_USER_ROLE, v) || asString(v),
    },
    { key: 'file_type', label: '类型' },
    {
      key: 'status',
      label: '状态',
      render: (v) => tr(ZH_KB_STATUS, v) || '-',
    },
    { key: 'chunk_count', label: '分片数' },
  ],
  list_assessments: [
    { key: 'id', label: '评估编号' },
    { key: 'elder_name', label: '老人', render: (v, r) => asString(v) || asString(r.elder_id) },
    {
      key: 'assessment_type',
      label: '评估类型',
      render: (v) => tr(ZH_ASSESSMENT_TYPE, v) || asString(v),
    },
    { key: 'score', label: '得分' },
    {
      key: 'risk_level',
      label: '风险',
      render: (v) => <RiskBadge level={v} />,
    },
    { key: 'created_at', label: '日期', render: (v) => fmtDate(v) },
  ],
  get_assessment_feature_catalog: [
    { key: 'key', label: '字段键' },
    { key: 'label', label: '名称' },
    { key: 'unit', label: '单位' },
    {
      key: 'required',
      label: '必填',
      render: (v) => (v ? '是' : '否'),
    },
  ],
};

const TableBody: React.FC<{
  payload: Record<string, unknown>;
  toolName: string;
}> = ({ payload, toolName }) => {
  const items = asArray<Record<string, unknown>>(
    payload.items ?? payload.features,
  );
  if (items.length === 0) return <div className="ai-tool-empty">暂无数据</div>;

  const columns: ColumnDef[] =
    COLUMNS_BY_TOOL[toolName] ||
    // Fallback: pick safe scalar keys from the first item.
    Object.keys(items[0])
      .filter(
        (k) =>
          !['feature_inputs', 'suggestions', 'created_by'].includes(k) &&
          !Array.isArray(items[0][k]) &&
          typeof items[0][k] !== 'object',
      )
      .map((k) => ({ key: k, label: k }));

  return (
    <div className="ai-tool-table">
      <div className="ai-tool-thead">
        {columns.map((c) => (
          <Cell key={c.key}>{c.label}</Cell>
        ))}
      </div>
      {items.slice(0, 50).map((it, idx) => (
        <Row key={idx}>
          {columns.map((c) => {
            const raw = it[c.key];
            const rendered = c.render
              ? c.render(raw, it)
              : typeof raw === 'object' && raw !== null
                ? JSON.stringify(raw).slice(0, 40)
                : asString(raw);
            return <Cell key={c.key}>{rendered || '-'}</Cell>;
          })}
        </Row>
      ))}
    </div>
  );
};

/* ---------- weather ---------- */

const WeatherBody: React.FC<{ payload: Record<string, unknown> }> = ({
  payload,
}) => {
  if (payload.available === false) {
    return <div className="ai-tool-empty">天气数据暂不可用</div>;
  }
  const city = asString(payload.city);
  const desc = asString(payload.description) || asString(payload.main);
  const icon = asString(payload.icon);
  const iconUrl = icon
    ? `https://openweathermap.org/img/wn/${icon}@2x.png`
    : '';

  const fmt = (v: unknown, unit: string) =>
    v == null || v === '' ? '-' : `${asString(v)}${unit}`;

  // 2-col × 3-row grid as requested: temp | feels, high | low, humidity | wind.
  const cells: Array<{ label: string; value: string }> = [
    { label: '气温', value: fmt(payload.temp, ' ℃') },
    { label: '体感', value: fmt(payload.feels_like, ' ℃') },
    { label: '最高', value: fmt(payload.temp_max, ' ℃') },
    { label: '最低', value: fmt(payload.temp_min, ' ℃') },
    { label: '湿度', value: fmt(payload.humidity, ' %') },
    { label: '风速', value: fmt(payload.wind_speed, ' m/s') },
  ];

  return (
    <div className="ai-tool-weather">
      <div className="ai-tool-weather-head">
        {iconUrl && (
          <img
            className="ai-tool-weather-icon"
            src={iconUrl}
            alt={desc}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="ai-tool-weather-head-text">
          <div className="ai-tool-weather-city">{city || '-'}</div>
          {desc && <div className="ai-tool-weather-desc">{desc}</div>}
        </div>
      </div>
      <div className="ai-tool-weather-grid">
        {cells.map((c) => (
          <div key={c.label} className="ai-tool-weather-cell">
            <span className="ai-tool-weather-cell-label">{c.label}</span>
            <span className="ai-tool-weather-cell-value">{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- text (fallback) ---------- */

const TextBody: React.FC<{ payload: Record<string, unknown> }> = ({
  payload,
}) => {
  if (payload.error) {
    return (
      <div className="ai-tool-empty" style={{ color: '#b04b4b' }}>
        {asString(payload.error)}
      </div>
    );
  }

  // Invite code shape (get_family_invite_code)
  if (payload.code) {
    return (
      <div className="ai-tool-kv">
        <KV label="邀请码" value={asString(payload.code)} />
        <KV label="可绑定上限" value={`${asString(payload.max_uses)} 人`} />
        <KV label="已绑定家属" value={`${asString(payload.used_count)} 人`} />
        <KV label="剩余可邀请" value={`${asString(payload.remaining_slots)} 人`} />
      </div>
    );
  }

  // Current time (get_current_time) — `iso` is model-only, `display`/
  // `weekday_zh`/`tz` are what the user cares about.
  if (payload.display || payload.weekday_zh) {
    return (
      <div className="ai-tool-kv">
        <KV label="时间" value={asString(payload.display)} />
        <KV
          label="星期"
          value={payload.weekday_zh ? `星期${asString(payload.weekday_zh)}` : ''}
        />
        <KV label="时区" value={asString(payload.tz)} />
      </div>
    );
  }

  // add_followup_record receipt or similar small writes — surface the
  // key fields we know about and hide the ones that are internal.
  const keys = Object.keys(payload).filter(
    (k) =>
      !['id', 'followup_id', 'idempotent'].includes(k) &&
      typeof payload[k] !== 'object',
  );
  if (keys.length > 0 && keys.length <= 6) {
    return (
      <div className="ai-tool-kv">
        {keys.map((k) => (
          <KV key={k} label={k} value={asString(payload[k])} />
        ))}
      </div>
    );
  }

  // Last resort.
  return (
    <pre className="ai-tool-json">{JSON.stringify(payload, null, 2)}</pre>
  );
};

export default ToolBubble;
