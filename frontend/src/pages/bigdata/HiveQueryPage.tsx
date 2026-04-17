import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PageHeader from '../../components/bigdata/PageHeader';
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
    <Box>
      <PageHeader
        title="Hive 查询"
        description="通过 Hive 引擎执行 SELECT 查询并查看结果（只读）"
      />

      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <TextField
            fullWidth
            multiline
            minRows={7}
            value={sql}
            onChange={(event) => setSql(event.target.value)}
            placeholder="SELECT * FROM ods_elder LIMIT 100"
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.875rem' } }}
          />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ mt: 2 }}
          >
            <TextField
              label="结果上限"
              type="number"
              size="small"
              value={limit}
              onChange={(event) => setLimit(Math.max(1, Number(event.target.value) || 1))}
              sx={{ width: 160 }}
              inputProps={{ min: 1, max: 10000 }}
            />
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained"
              startIcon={<PlayArrowRoundedIcon />}
              onClick={handleRun}
              disabled={loading}
              size="large"
            >
              {loading ? '执行中...' : '执行查询'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              查询结果
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {rows.length > 0 ? `${rows.length} 行` : '尚未有结果'}
              {elapsed !== null && ` · 耗时 ${(elapsed / 1000).toFixed(2)} s`}
            </Typography>
          </Stack>

          {columns.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
              输入 SQL 并点击"执行查询"查看结果
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {columns.map((col) => (
                      <TableCell key={col} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex} hover>
                      {row.map((cell, colIndex) => (
                        <TableCell
                          key={colIndex}
                          sx={{ fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        >
                          {renderCell(cell)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={columns.length} align="center">
                        <Typography color="text.secondary" sx={{ py: 3 }}>
                          查询未返回任何数据
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default HiveQueryPage;
