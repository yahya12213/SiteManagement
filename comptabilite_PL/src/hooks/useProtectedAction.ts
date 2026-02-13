import { usePermission } from './usePermission';
import { useCallback } from 'react';

export function useProtectedAction() {
  const { can } = usePermission();

  const withPermission = useCallback(
    (permission: string, action: () => void) => {
      return () => {
        if (can(permission)) {
          action();
        } else {
          console.warn(`Action blocked: missing permission "${permission}"`);
          alert('Permission insuffisante pour cette action');
        }
      };
    },
    [can]
  );

  return { withPermission };
}
