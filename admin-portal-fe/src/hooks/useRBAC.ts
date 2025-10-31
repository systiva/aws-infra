// RBAC React hooks
import { useAuth } from '../contexts/AuthContext';
import {
  hasPermission,
  hasAnyPermission,
  hasRole,
  hasAnyRole,
  canAccessRoute,
  getAccessibleRoutes,
  canAccess,
  getVisibleNavigationItems
} from '../utils/rbac';

export const useRBAC = () => {
  const { state } = useAuth();
  const user = state.user;

  return {
    // Permission checks
    hasPermission: (permission: string) => 
      user ? hasPermission(user.permissions, permission) : false,
    
    hasAnyPermission: (permissions: string[]) => 
      user ? hasAnyPermission(user.permissions, permissions) : false,
    
    // Role checks (using userRoles array)
    hasRole: (role: string) => 
      user ? hasRole(user.userRoles, role, user.groups) : false,
    
    hasAnyRole: (roles: string[]) => 
      user ? hasAnyRole(user.userRoles, roles, user.groups) : false,
    
    // Route access
    canAccessRoute: (route: string) => 
      user ? canAccessRoute(user.userRoles, route, user.groups) : false,
    
    getAccessibleRoutes: () => 
      user ? getAccessibleRoutes(user.userRoles, user.groups) : [],
    
    // Resource-action access
    canAccess: (resource: string, action: string) => 
      user ? canAccess(user.permissions, resource, action) : false,
    
    // Navigation
    getVisibleNavigationItems: () => 
      user ? getVisibleNavigationItems(user.userRoles, user.groups) : [],
    
    // Current user context
    userRoles: user?.userRoles || [],
    permissions: user?.permissions || [],
    groups: user?.groups || [],
    isAuthenticated: state.isAuthenticated,
  };
};

// Specific permission hooks for common operations
export const usePermissions = () => {
  const rbac = useRBAC();
  
  return {
    // Tenant management
    canCreateTenant: rbac.hasAnyPermission(['tenant-onboarding', 'tenant:create']),
    canUpdateTenant: rbac.hasAnyPermission(['tenant-suspension', 'tenant:update']),
    canDeleteTenant: rbac.hasAnyPermission(['tenant-offboarding', 'tenant:delete']),
    canViewTenants: rbac.hasAnyRole(['super-admin', 'tenant-gov']),
    
    // Super admin management
    canManageSuperAdmins: rbac.hasAnyRole(['super-admin', 'tenant-super-admin']),
    canCreateSuperAdmin: rbac.hasAnyPermission(['tenant-super-admin-create']),
    canUpdateSuperAdmin: rbac.hasAnyPermission(['tenant-super-admin-update']),
    canDeleteSuperAdmin: rbac.hasAnyPermission(['tenant-super-admin-delete']),
    
    // General access
    canAccessAdminPanel: rbac.hasAnyRole(['super-admin', 'tenant-gov', 'tenant-super-admin']),
  };
};
