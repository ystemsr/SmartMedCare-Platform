import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useNavigate } from 'react-router-dom';
import { useTable } from '../../hooks/useTable';
import { getElders } from '../../api/elders';
import { formatGender } from '../../utils/formatter';
import type { Elder, ElderListQuery } from '../../types/elder';

const ElderArchiveListPage: React.FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');

  const fetchFn = useCallback(
    (params: ElderListQuery & { page: number; page_size: number }) => getElders(params),
    [],
  );

  const { data, loading, setQuery } = useTable<Elder, ElderListQuery>(fetchFn);

  const handleSearch = useCallback(() => {
    setQuery((prev) => ({ ...prev, keyword: keyword.trim() } as ElderListQuery));
  }, [keyword, setQuery]);

  const items = useMemo(
    () =>
      data.map((elder) => (
        <Box key={elder.id} sx={{ width: { xs: '100%', sm: '50%', md: '33.333%', lg: '25%' } }}>
          <Card
            variant="outlined"
            sx={{
              height: '100%',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <CardActionArea
              onClick={() => navigate(`/elders/${elder.id}/archive`)}
              sx={{ height: '100%', alignItems: 'stretch' }}
            >
              <Box sx={{ p: 2.5, height: '100%' }}>
                <Stack spacing={1.5} sx={{ height: '100%' }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {elder.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatGender(elder.gender)} · {elder.phone || '-'}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                      标签
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {elder.tags?.length ? (
                        elder.tags.map((tag) => (
                          <Chip key={tag} label={tag} color="primary" variant="outlined" size="small" />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          暂无标签
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    点击查看健康档案
                  </Typography>
                </Stack>
              </Box>
            </CardActionArea>
          </Card>
        </Box>
      )),
    [data, navigate],
  );

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            老人健康档案
          </Typography>
          <Typography variant="body2" color="text.secondary">
            查看并进入单个老人的健康档案详情
          </Typography>
        </Box>

        <TextField
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleSearch();
            }
          }}
          placeholder="搜索姓名/手机号/身份证"
          size="small"
          sx={{ width: { xs: '100%', sm: 340 } }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
          <CircularProgress size={36} />
        </Box>
      ) : data.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4 }}>
          <Typography variant="body2" color="text.secondary" align="center">
            暂无老人档案
          </Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {items}
        </Box>
      )}
    </Stack>
  );
};

export default ElderArchiveListPage;
