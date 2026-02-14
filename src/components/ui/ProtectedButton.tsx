import { Button, type ButtonProps } from '@/components/ui/button';
import { usePermission } from '@/hooks/usePermission';
import { type ReactNode } from 'react';

interface ProtectedButtonProps extends ButtonProps {
  permission: string | string[];
  requireAll?: boolean; // If true, requires all permissions
  fallback?: ReactNode; // Component to display if no permission
  hideIfNoPermission?: boolean; // Default true
}

export function ProtectedButton({
  permission,
  requireAll = false,
  fallback = null,
  hideIfNoPermission = true,
  children,
  disabled,
  ...props
}: ProtectedButtonProps) {
  const { can, canAll, canAny } = usePermission();

  const hasPermission = Array.isArray(permission)
    ? requireAll
      ? canAll(...permission)
      : canAny(...permission)
    : can(permission);

  if (!hasPermission) {
    if (hideIfNoPermission) return null;
    if (fallback) return <>{fallback}</>;
    // Show disabled button with tooltip
    return (
      <Button {...props} disabled={true} title="Permission insuffisante">
        {children}
      </Button>
    );
  }

  return (
    <Button {...props} disabled={disabled}>
      {children}
    </Button>
  );
}
