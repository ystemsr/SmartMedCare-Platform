import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Spinner from '../components/ui/Spinner';

/**
 * Blank layout for pages that don't need the sidebar (e.g., login, register).
 * Pages handle their own full-screen layout and background.
 */
const BlankLayout: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
          }}
        >
          <Spinner size="lg" />
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );
};

export default BlankLayout;
