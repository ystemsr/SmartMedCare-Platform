import React from 'react';
import { Avatar, Card, Skeleton, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon?: ReactNode;
  color?: string;
  suffix?: string;
  loading?: boolean;
}

/**
 * Dashboard statistic card with icon and optional coloring.
 */
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color,
  suffix,
  loading,
}) => {
  return (
    <Card sx={{ height: '100%', p: 2.5 }}>
      <Stack direction="row" spacing={2.5} alignItems="center">
        {icon && (
          <Avatar
            sx={{
              width: 56,
              height: 56,
              bgcolor: `${color || '#1677ff'}18`,
              color: color || '#1677ff',
            }}
          >
            {icon}
          </Avatar>
        )}
        <div>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          {loading ? (
            <Skeleton variant="text" width={96} height={42} />
          ) : (
            <Typography variant="h4">
              {value}
              {suffix ? (
                <Typography component="span" variant="h6" color="text.secondary" sx={{ ml: 0.5 }}>
                  {suffix}
                </Typography>
              ) : null}
            </Typography>
          )}
        </div>
      </Stack>
    </Card>
  );
};

export default StatCard;
