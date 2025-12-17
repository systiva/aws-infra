import React from 'react';
import { useRBAC } from '../hooks/useRBAC';

interface PermissionGuardProps {
  requiredPermission?: string;
  requiredPermissions?: string[];
  requiredRole?: string;
  requiredRoles?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  requiredPermission,
  requiredPermissions,
  requiredRole,
  requiredRoles,
  fallback = null,
  children
}) => {
  const rbac = useRBAC();

  // Check single permission
  if (requiredPermission && !rbac.hasPermission(requiredPermission)) {
    return <>{fallback}</>;
  }

  // Check multiple permissions (user needs at least one)
  if (requiredPermissions && !rbac.hasAnyPermission(requiredPermissions)) {
    return <>{fallback}</>;
  }

  // Check single role
  if (requiredRole && !rbac.hasRole(requiredRole)) {
    return <>{fallback}</>;
  }

  // Check multiple roles (user needs at least one)
  if (requiredRoles && !rbac.hasAnyRole(requiredRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
