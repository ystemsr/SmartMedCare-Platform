import React from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';

/**
 * Blank layout for pages that don't need the sidebar (e.g., login).
 */
const BlankLayout: React.FC = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        background:
          'radial-gradient(circle at top left, rgba(31, 111, 235, 0.24), transparent 35%), linear-gradient(135deg, #f7fbff 0%, #e5f4f2 52%, #d9e7ff 100%)',
      }}
    >
      <Outlet />
    </Box>
  );
};

export default BlankLayout;
