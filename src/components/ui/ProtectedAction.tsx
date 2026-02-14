import { type ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';

interface ProtectedActionProps {
  permission: string | string[];
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function ProtectedAction({
  permission,
  requireAll = false,
  fallback = null,
  children,
}: ProtectedActionProps) {
  const { can, canAll, canAny } = usePermission();

  const hasPermission = Array.isArray(permission)
    ? requireAll
      ? canAll(...permission)
      : canAny(...permission)
    : can(permission);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
