import React from 'react';
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { Prediction } from '../../types/bigdata';

interface PredictionResultProps {
  prediction: Prediction;
  title?: string;
  subtitle?: string;
}

function toPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const PredictionResult: React.FC<PredictionResultProps> = ({ prediction, title, subtitle }) => {
  const highRiskColor = prediction.high_risk ? '#cf1322' : '#52c41a';
  const followupColor = prediction.followup_needed ? '#d9822b' : '#1677ff';
  const scoreColor =
    prediction.health_score >= 75
      ? '#1f9d63'
      : prediction.health_score >= 50
        ? '#d9822b'
        : '#cf1322';

  return (
    <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box
        sx={{
          px: 3,
          py: 2.5,
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.main}14 0%, ${theme.palette.secondary.main}0D 100%)`,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          {title ?? '预测结果'}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>

      <CardContent>
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          }}
        >
          <MetricBlock
            label="高风险概率"
            value={toPct(prediction.high_risk_prob)}
            footer={
              <Chip
                size="small"
                variant="outlined"
                label={prediction.high_risk ? '判定：高风险' : '判定：非高风险'}
                sx={{ color: highRiskColor, borderColor: highRiskColor, fontWeight: 600 }}
              />
            }
            color={highRiskColor}
          />
          <MetricBlock
            label="需要随访概率"
            value={toPct(prediction.followup_prob)}
            footer={
              <Chip
                size="small"
                variant="outlined"
                label={prediction.followup_needed ? '建议：立即随访' : '建议：暂不需要'}
                sx={{ color: followupColor, borderColor: followupColor, fontWeight: 600 }}
              />
            }
            color={followupColor}
          />
          <MetricBlock
            label="综合健康评分"
            value={prediction.health_score.toFixed(1)}
            footer={
              <Typography variant="caption" color="text.secondary">
                分值越高代表健康状况越好 (0-100)
              </Typography>
            }
            color={scoreColor}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

interface MetricBlockProps {
  label: string;
  value: string;
  footer: React.ReactNode;
  color: string;
}

const MetricBlock: React.FC<MetricBlockProps> = ({ label, value, footer, color }) => (
  <Stack spacing={1} sx={{ p: 2, borderRadius: 3, bgcolor: `${color}0D` }}>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h3" fontWeight={700} sx={{ color, lineHeight: 1.1 }}>
      {value}
    </Typography>
    <Box>{footer}</Box>
  </Stack>
);

export default PredictionResult;
