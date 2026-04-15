import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Blank layout for pages that don't need the sidebar (e.g., login, register).
 * Pages handle their own full-screen layout and background.
 */
const BlankLayout: React.FC = () => {
  return <Outlet />;
};

export default BlankLayout;
