import React from 'react';
import { useRBAC } from '../hooks/useRBAC';

interface RoleGuardProps {
  allowedRoles?: string[];
  requiredPermissions?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  requiredPermissions,
  fallback = <div className="access-denied">Access Denied</div>,
  children
}) => {
  const rbac = useRBAC();

  // Check role access
  const hasRoleAccess = allowedRoles ? rbac.hasAnyRole(allowedRoles) : true;
  
  // Check permission access
  const hasPermissionAccess = requiredPermissions ? rbac.hasAnyPermission(requiredPermissions) : true;

  // User must have both role access AND permission access
  if (hasRoleAccess && hasPermissionAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
