import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Star,
  History,
  Save,
  Download,
  Trash2,
  ChevronRight,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Code2,
} from 'lucide-react';
import PageHeader from '../../components/bigdata/PageHeader';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  Tabs,
  Textarea,
  confirm,
} from '@/components/ui';
import {
  createSavedQuery,
  deleteSavedQuery,
  getHiveHistory,
  hiveExportUrl,
  listSavedQueries,
  runHiveQuery,
} from '../../api/bigdata';
import { getToken } from '../../utils/storage';
import { message } from '../../utils/message';
import type {
  HiveQueryHistoryEntry,
  HiveSavedQuery,
} from '../../types/bigdata';
import { HIVE_PRESETS, type HivePreset } from '../../constants/hivePresets';

const DEFAULT_SQL = `SELECT *\nFROM smartmedcare.mart_elder_risk_summary\nLIMIT 20`;

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const HiveQueryPage: React.FC = () => {
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [limit, setLimit] = useState<number>(200);
  const [loading, setLoading] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sqlEditorOpen, setSqlEditorOpen] = useState(false);

  const [sideTab, setSideTab] = useState<'history' | 'saved'>('saved');
  const [history, setHistory] = useState<HiveQueryHistoryEntry[]>([]);
  const [saved, setSaved] = useState<HiveSavedQuery[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [exporting, setExporting] = useState(false);

  const resultsRef = useRef<HTMLDivElement | null>(null);

  const refreshSide = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([getHiveHistory(20), listSavedQueries()]);
      setHistory(h.data.items);
      setSaved(s.data.items);
    } catch {
      // silent; not critical
    }
  }, []);

  useEffect(() => {
    refreshSide();
  }, [refreshSide]);

  const runSql = useCallback(
    async (sqlText: string, limitValue: number) => {
      const trimmed = sqlText.trim();
      if (!trimmed) {
        message.warning('请输入 SQL 语句');
        return;
      }
      const noComments = trimmed
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      if (!/^\s*(select|with)/i.test(noComments)) {
        message.warning('仅支持 SELECT 查询');
        return;
      }

      setLoading(true);
      setError(null);
      const started = performance.now();
      try {
        const res = await runHiveQuery({ sql: trimmed, limit: limitValue });
        setColumns(res.data.columns);
        setRows(res.data.rows);
        setTruncated(Boolean(res.data.truncated));
        setElapsed(performance.now() - started);
        refreshSide();
        // Scroll result into view so preset users see the answer immediately.
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      } catch (err) {
        setColumns([]);
        setRows([]);
        setTruncated(false);
        setElapsed(performance.now() - started);
        setError(err instanceof Error ? err.message : '查询失败');
        refreshSide();
      } finally {
        setLoading(false);
      }
    },
    [refreshSide],
  );

  const handleRun = () => runSql(sql, limit);

  const handleRunPreset = async (preset: HivePreset) => {
    const nextLimit = preset.defaultLimit ?? limit;
    setSql(preset.sql);
    setLimit(nextLimit);
    setActivePresetId(preset.id);
    await runSql(preset.sql, nextLimit);
  };

  const handleEditPreset = (preset: HivePreset) => {
    setSql(preset.sql);
    if (preset.defaultLimit) setLimit(preset.defaultLimit);
    setActivePresetId(preset.id);
    setSqlEditorOpen(true);
    message.info('已把 SQL 填入编辑器，可修改后再执行');
  };

  const handleSave = async () => {
    if (!saveName.trim()) {
      message.warning('请填写模板名称');
      return;
    }
    setSavingName(true);
    try {
      await createSavedQuery({
        name: saveName.trim(),
        sql,
        description: saveDesc.trim() || undefined,
      });
      message.success('已保存查询模板');
      setSaveOpen(false);
      setSaveName('');
      setSaveDesc('');
      refreshSide();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSavingName(false);
    }
  };

  const handleDeleteSaved = async (id: number) => {
    const ok = await confirm({
      title: '删除查询模板',
      content: '确认删除该模板？',
      intent: 'danger',
    });
    if (!ok) return;
    try {
      await deleteSavedQuery(id);
      message.success('已删除');
      refreshSide();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleExport = async () => {
    const trimmed = sql.trim();
    if (!trimmed) {
      message.warning('请输入 SQL 语句');
      return;
    }
    setExporting(true);
    try {
      const token = getToken();
      const res = await fetch(hiveExportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sql: trimmed, limit: Math.max(limit, 10000) }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hive_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      message.success('已开始下载 CSV');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Hive 查询工作台"
        description="执行 SELECT 查询、保存常用模板、一键导出 CSV"
      />

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)',
          alignItems: 'start',
        }}
      >
        <Card>
          <div style={{ padding: '0 8px' }}>
            <Tabs
              activeKey={sideTab}
              onChange={(k) => setSideTab(k as 'history' | 'saved')}
              items={[
                { key: 'saved', label: '常用模板' },
                { key: 'history', label: '最近记录' },
              ]}
            />
          </div>
          <CardBody style={{ paddingTop: 8 }}>
            {sideTab === 'saved' ? (
              saved.length === 0 ? (
                <EmptyHint
                  icon={<Star size={20} />}
                  text="还没有收藏的查询模板"
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {saved.map((s) => (
                    <SideItem
                      key={s.id}
                      title={s.name}
                      subtitle={s.description || s.sql.slice(0, 80)}
                      onClick={() => setSql(s.sql)}
                      actions={
                        <button
                          aria-label="删除"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSaved(s.id);
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--smc-text-3)',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      }
                    />
                  ))}
                </div>
              )
            ) : history.length === 0 ? (
              <EmptyHint icon={<History size={20} />} text="尚未执行过查询" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {history.map((h) => (
                  <SideItem
                    key={h.id}
                    title={h.sql.slice(0, 60)}
                    subtitle={
                      <>
                        <Chip
                          tone={h.status === 'success' ? 'success' : 'error'}
                          outlined
                        >
                          {h.status === 'success'
                            ? `${h.row_count} 行`
                            : '失败'}
                        </Chip>
                        <span style={{ marginLeft: 8 }}>
                          {(h.duration_ms / 1000).toFixed(2)}s
                        </span>
                        <span style={{ marginLeft: 8, color: 'var(--smc-text-3)' }}>
                          {(h.created_at || '').replace('T', ' ').slice(0, 16)}
                        </span>
                      </>
                    }
                    onClick={() => setSql(h.sql)}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <div>
          {/* Preset query operations — one-click, no SQL needed */}
          <Card style={{ marginBottom: 16 }}>
            <CardBody>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <Sparkles size={18} color="var(--smc-primary)" />
                <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700 }}>
                  预置查询方案
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--smc-text-2)',
                  marginBottom: 14,
                  lineHeight: 1.55,
                }}
              >
                点击"立即执行"无需写 SQL 即可查看常用统计结果；"查看 SQL"会把语句填入下方编辑器供你修改。
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                }}
              >
                {HIVE_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const active = activePresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        padding: 14,
                        borderRadius: 10,
                        border: active
                          ? '1px solid var(--smc-primary)'
                          : '1px solid var(--smc-border)',
                        background: active
                          ? 'color-mix(in oklab, var(--smc-primary) 6%, transparent)'
                          : 'var(--smc-surface)',
                        transition: 'all 160ms ease',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            background: 'color-mix(in oklab, var(--smc-primary) 12%, transparent)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--smc-primary)',
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={18} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 'var(--smc-fs-md)',
                              fontWeight: 600,
                              color: 'var(--smc-text)',
                            }}
                          >
                            {preset.title}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--smc-text-2)',
                              marginTop: 4,
                              lineHeight: 1.55,
                            }}
                          >
                            {preset.description}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Button
                          size="sm"
                          variant="text"
                          startIcon={<Code2 size={13} />}
                          onClick={() => handleEditPreset(preset)}
                          disabled={loading}
                        >
                          查看 SQL
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          startIcon={<Play size={13} />}
                          onClick={() => handleRunPreset(preset)}
                          loading={loading && active}
                          disabled={loading}
                        >
                          立即执行
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Advanced SQL editor — collapsed by default */}
          <Card style={{ marginBottom: 16 }}>
            <CardBody>
              <button
                type="button"
                onClick={() => setSqlEditorOpen((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--smc-text)',
                  marginBottom: sqlEditorOpen ? 14 : 0,
                }}
                aria-expanded={sqlEditorOpen}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 'var(--smc-fs-md)', fontWeight: 700 }}>
                    SQL 模式（高级）
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--smc-text-2)',
                      marginTop: 4,
                    }}
                  >
                    手写 SELECT / WITH 查询。支持 CSV 导出和保存为模板。
                  </div>
                </div>
                {sqlEditorOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {sqlEditorOpen && (
                <>
                  <Textarea
                    rows={7}
                    value={sql}
                    onChange={(event) => setSql(event.target.value)}
                    placeholder="SELECT * FROM mart_overview LIMIT 100"
                    style={{ fontFamily: 'monospace', fontSize: 14 }}
                  />
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-end',
                  marginTop: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ width: 160 }}>
                  <Input
                    label="结果上限"
                    type="number"
                    value={limit}
                    onChange={(event) =>
                      setLimit(Math.max(1, Number(event.target.value) || 1))
                    }
                    min={1}
                    max={10000}
                  />
                </div>
                <div style={{ flex: 1 }} />
                <Button
                  variant="outlined"
                  startIcon={<Save size={14} />}
                  onClick={() => setSaveOpen(true)}
                >
                  保存为模板
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Download size={14} />}
                  onClick={handleExport}
                  loading={exporting}
                  disabled={exporting}
                >
                  导出 CSV
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  startIcon={<Play size={16} />}
                  onClick={handleRun}
                  loading={loading}
                  disabled={loading}
                >
                  {loading ? '执行中...' : '执行查询'}
                </Button>
              </div>
                </>
              )}
            </CardBody>
          </Card>

          {error && (
            <Alert severity="error" style={{ marginBottom: 16 }}>
              {error}
            </Alert>
          )}
          {truncated && !error && (
            <Alert severity="warning" style={{ marginBottom: 16 }}>
              结果已达到上限 {limit} 行，可能存在更多数据。建议增大上限或使用导出 CSV。
            </Alert>
          )}

          <div ref={resultsRef}>
          <Card>
            <CardBody>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700 }}>
                  查询结果
                </div>
                <div style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)' }}>
                  {rows.length > 0 ? `${rows.length.toLocaleString()} 行` : '尚未有结果'}
                  {elapsed !== null && ` · 耗时 ${(elapsed / 1000).toFixed(2)} s`}
                </div>
              </div>

              {columns.length === 0 ? (
                <div
                  style={{
                    padding: '48px 0',
                    textAlign: 'center',
                    color: 'var(--smc-text-2)',
                  }}
                >
                  输入 SQL 并点击"执行查询"查看结果
                </div>
              ) : (
                <div
                  style={{
                    border: '1px solid var(--smc-border)',
                    borderRadius: 'var(--smc-r-md)',
                    overflow: 'auto',
                    maxHeight: '60vh',
                  }}
                >
                  <table className="smc-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col}
                            style={{
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              position: 'sticky',
                              top: 0,
                              background: 'var(--smc-surface)',
                              zIndex: 1,
                            }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={columns.length}
                            style={{
                              textAlign: 'center',
                              padding: 24,
                              color: 'var(--smc-text-2)',
                            }}
                          >
                            查询未返回任何数据
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, colIndex) => (
                              <td
                                key={colIndex}
                                style={{
                                  fontFamily:
                                    typeof cell === 'number'
                                      ? 'inherit'
                                      : 'monospace',
                                  fontSize: 13,
                                  whiteSpace: 'nowrap',
                                  color:
                                    cell == null
                                      ? 'var(--smc-text-3)'
                                      : undefined,
                                  fontStyle:
                                    cell == null ? 'italic' : undefined,
                                  textAlign:
                                    typeof cell === 'number' ? 'right' : 'left',
                                  fontVariantNumeric:
                                    typeof cell === 'number'
                                      ? 'tabular-nums'
                                      : undefined,
                                }}
                              >
                                {cell == null ? 'NULL' : formatCell(cell)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
          </div>
        </div>
      </div>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="保存查询模板"
        width={480}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="text" onClick={() => setSaveOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={handleSave} loading={savingName}>
              保存
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="模板名称"
            required
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="例如：高风险老人清单"
          />
          <Textarea
            label="描述 (选填)"
            rows={3}
            value={saveDesc}
            onChange={(e) => setSaveDesc(e.target.value)}
          />
          <div
            style={{
              fontSize: 12,
              color: 'var(--smc-text-2)',
              padding: 10,
              background: 'var(--smc-surface-alt)',
              borderRadius: 8,
              fontFamily: 'monospace',
              maxHeight: 160,
              overflow: 'auto',
            }}
          >
            {sql}
          </div>
        </div>
      </Modal>
    </div>
  );
};

const EmptyHint: React.FC<{ icon: React.ReactNode; text: string }> = ({
  icon,
  text,
}) => (
  <div
    style={{
      padding: 24,
      textAlign: 'center',
      color: 'var(--smc-text-2)',
      fontSize: 13,
    }}
  >
    <div style={{ marginBottom: 6, color: 'var(--smc-text-3)' }}>{icon}</div>
    {text}
  </div>
);

const SideItem: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  onClick: () => void;
  actions?: React.ReactNode;
}> = ({ title, subtitle, onClick, actions }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '10px 12px',
      borderRadius: 8,
      border: 'none',
      background: 'transparent',
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'background 140ms ease',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLButtonElement).style.background =
        'var(--smc-surface-alt)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
    }}
  >
    <ChevronRight
      size={14}
      style={{ color: 'var(--smc-text-3)', marginTop: 3 }}
    />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--smc-text-2)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
    {actions}
  </button>
);

export default HiveQueryPage;
