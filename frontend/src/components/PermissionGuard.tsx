import React from 'react';
import { usePermission } from '../hooks/usePermission';

interface PermissionGuardProps {
  permission: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders children based on user permissions.
 * Accepts a single permission string or an array (any match = render).
 */
const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback = null,
}) => {
  const { hasPermission, hasAnyPermission } = usePermission();

  const allowed = Array.isArray(permission)
    ? hasAnyPermission(permission)
    : hasPermission(permission);

  return <>{allowed ? children : fallback}</>;
};

export default PermissionGuard;
