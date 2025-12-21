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
    // Account management
    canCreateAccount: rbac.hasAnyPermission(['account-onboarding', 'account:create']),
    canUpdateAccount: rbac.hasAnyPermission(['account-suspension', 'account:update']),
    canDeleteAccount: rbac.hasAnyPermission(['account-offboarding', 'account:delete']),
    canViewAccounts: rbac.hasAnyRole(['super-admin', 'account-gov']),
    
    // Super admin management
    canManageSuperAdmins: rbac.hasAnyRole(['super-admin', 'account-super-admin']),
    canCreateSuperAdmin: rbac.hasAnyPermission(['account-super-admin-create']),
    canUpdateSuperAdmin: rbac.hasAnyPermission(['account-super-admin-update']),
    canDeleteSuperAdmin: rbac.hasAnyPermission(['account-super-admin-delete']),
    
    // General access
    canAccessAdminPanel: rbac.hasAnyRole(['super-admin', 'account-gov', 'account-super-admin']),
  };
};
