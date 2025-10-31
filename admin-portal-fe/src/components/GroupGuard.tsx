import React from 'react';
import { useRBAC } from '../hooks/useRBAC';

interface GroupGuardProps {
  allowedGroups?: string[];
  requiredPermissions?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const GroupGuard: React.FC<GroupGuardProps> = ({
  allowedGroups,
  requiredPermissions,
  fallback = <div className="access-denied">Access Denied</div>,
  children
}) => {
  const rbac = useRBAC();

  // Check group access
  const hasGroupAccess = allowedGroups ? 
    allowedGroups.some(group => rbac.groups.some(userGroup => userGroup.name === group)) : true;
  
  // Check permission access
  const hasPermissionAccess = requiredPermissions ? 
    rbac.hasAnyPermission(requiredPermissions) : true;

  // User must have both group access AND permission access
  if (hasGroupAccess && hasPermissionAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};