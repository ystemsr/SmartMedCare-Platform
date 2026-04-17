import React, { type ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <Stack
    direction={{ xs: 'column', md: 'row' }}
    spacing={2}
    justifyContent="space-between"
    alignItems={{ xs: 'flex-start', md: 'center' }}
    sx={{ mb: 3 }}
  >
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: 0.2 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      )}
    </Box>
    {actions && <Box>{actions}</Box>}
  </Stack>
);

export default PageHeader;
