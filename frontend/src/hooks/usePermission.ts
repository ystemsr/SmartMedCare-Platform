import { useCallback } from 'react';
import { useAuthStore } from '../store/auth';

/**
 * Permission checking hook.
 * Returns helpers to check user permissions against the auth store.
 */
export function usePermission() {
  const permissions = useAuthStore((state) => state.permissions);

  /** Check if user has a specific permission */
  const hasPermission = useCallback(
    (permission: string): boolean => {
      return permissions.includes(permission);
    },
    [permissions],
  );

  /** Check if user has any of the given permissions */
  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      return perms.some((p) => permissions.includes(p));
    },
    [permissions],
  );

  return { hasPermission, hasAnyPermission };
}
