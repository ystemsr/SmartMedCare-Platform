import React, { useState } from 'react';
import { Play } from 'lucide-react';
import PageHeader from '../../components/bigdata/PageHeader';
import { Alert, Button, Card, CardBody, Input, Textarea } from '@/components/ui';
import { runHiveQuery } from '../../api/bigdata';
import { message } from '../../utils/message';

const DEFAULT_SQL = `-- 只支持 SELECT 查询\nSELECT *\nFROM ods_elder\nLIMIT 20`;

const HiveQueryPage: React.FC = () => {
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [limit, setLimit] = useState<number>(200);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    const trimmed = sql.trim();
    if (!trimmed) {
      message.warning('请输入 SQL 语句');
      return;
    }
    if (!/^\s*(--|select|with)/i.test(trimmed)) {
      message.warning('仅支持 SELECT 查询');
      return;
    }

    setLoading(true);
    setError(null);
    const started = performance.now();
    try {
      const res = await runHiveQuery({ sql: trimmed, limit });
      setColumns(res.data.columns);
      setRows(res.data.rows);
      setElapsed(performance.now() - started);
    } catch (err) {
      setColumns([]);
      setRows([]);
      setElapsed(performance.now() - started);
      setError(err instanceof Error ? err.message : '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const renderCell = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div>
      <PageHeader
        title="Hive 查询"
        description="通过 Hive 引擎执行 SELECT 查询并查看结果（只读）"
      />

      <Card style={{ marginBottom: 20 }}>
        <CardBody>
          <Textarea
            rows={7}
            value={sql}
            onChange={(event) => setSql(event.target.value)}
            placeholder="SELECT * FROM ods_elder LIMIT 100"
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
            <div style={{ width: 180 }}>
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
        </CardBody>
      </Card>

      {error && (
        <Alert severity="error" style={{ marginBottom: 16 }}>
          {error}
        </Alert>
      )}

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
            <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700 }}>查询结果</div>
            <div style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)' }}>
              {rows.length > 0 ? `${rows.length} 行` : '尚未有结果'}
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
              输入 SQL 并点击“执行查询”查看结果
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
                        style={{ textAlign: 'center', padding: 24, color: 'var(--smc-text-2)' }}
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
                              fontFamily: 'monospace',
                              fontSize: 13,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {renderCell(cell)}
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
  );
};

export default HiveQueryPage;
