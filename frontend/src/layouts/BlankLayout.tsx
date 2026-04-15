import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Blank layout for pages that don't need the sidebar (e.g., login).
 */
const BlankLayout: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Outlet />
    </div>
  );
};

export default BlankLayout;
