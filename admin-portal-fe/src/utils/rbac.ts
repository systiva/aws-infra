// RBAC (Role-Based Access Control) utilities

export interface Permission {
  resource: string;
  action: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
}

export interface RBACContext {
  userRoles: string[]; // All user roles
  permissions: string[];
  groups: (string | Group)[]; // Support both old string format and new object format
}

// Role-Route mapping
export const ROLE_ROUTES: Record<string, string[]> = {
  'tenant-gov': ['/register', '/directory'],
  'tenant-super-admin': ['/register', '/directory', '/super-admins'], // Platform admin can access all
};

// Permission checking utilities
export const hasPermission = (userPermissions: string[], requiredPermission: string): boolean => {
  return userPermissions.includes(requiredPermission);
};

export const hasAnyPermission = (userPermissions: string[], requiredPermissions: string[]): boolean => {
  return requiredPermissions.some(permission => userPermissions.includes(permission));
};

export const hasRole = (userRoles: string[], requiredRole: string, groups?: Group[]): boolean => {
  // Check if user has the required role in their roles array
  if (userRoles && userRoles.includes(requiredRole)) {
    return true;
  }
  
  // Check if user is in the required role group
  if (groups) {
    if (groups.some(group => group.name === requiredRole)) {
      return true;
    }
  }
  
  return false;
};

export const hasAnyRole = (userRoles: string[], requiredRoles: string[], groups?: Group[]): boolean => {
  // Check if user has any of the required roles in their roles array
  if (userRoles && userRoles.some(role => requiredRoles.includes(role))) {
    return true;
  }
  
  // Check if user is in any of the required role groups
  if (groups && groups.some(group => requiredRoles.includes(group.name))) {
    return true;
  }
  
  return false;
};

// Route access checking
export const canAccessRoute = (userRoles: string[], route: string, groups?: Group[]): boolean => {
  // Check routes for all user roles
  if (userRoles) {
    for (const role of userRoles) {
      const allowedRoutes = ROLE_ROUTES[role] || [];
      if (allowedRoutes.includes(route)) {
        return true;
      }
    }
  }
  
  // Check routes for any groups the user belongs to
  if (groups) {
    for (const group of groups) {
      const groupRoutes = ROLE_ROUTES[group.name] || [];
      if (groupRoutes.includes(route)) {
        return true;
      }
    }
  }
  
  return false;
};

// Get all accessible routes for a role
export const getAccessibleRoutes = (userRoles: string[], groups?: Group[]): string[] => {
  const routes = new Set<string>();
  
  // Add routes from all user roles
  if (userRoles) {
    userRoles.forEach(role => {
      const roleRoutes = ROLE_ROUTES[role] || [];
      roleRoutes.forEach(route => routes.add(route));
    });
  }
  
  // Add routes from groups
  if (groups) {
    groups.forEach(group => {
      const groupRoutes = ROLE_ROUTES[group.name] || [];
      groupRoutes.forEach(route => routes.add(route));
    });
  }
  
  return Array.from(routes);
};

// Resource-action based access control
export const canAccess = (userPermissions: string[], resource: string, action: string): boolean => {
  const permissionString = `${resource}-${action}`;
  return hasPermission(userPermissions, permissionString);
};

// Navigation item interface
export interface NavigationItem {
  path: string;
  label: string;
  icon?: string;
  requiredRoles?: string[]; // Keep for backward compatibility
  requiredPermissions?: string[];
  requiredGroups?: string[]; // New group-based access control
}

// Default navigation items with group restrictions
export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    path: '/user-management',
    label: 'User Management',
    requiredGroups: ['tenant-admin'],
  },
  {
    path: '/group-management',
    label: 'Group Management',
    requiredGroups: ['tenant-admin'],
  },
  {
    path: '/role-management',
    label: 'Role Management',
    requiredGroups: ['tenant-admin'],
  },
  {
    path: '/permission-management',
    label: 'Permission Management',
    requiredGroups: ['tenant-admin'],
  },
  {
    path: '/',
    label: 'Overview',
    requiredGroups: ['platform-admin'],
  },
  {
    path: '/register',
    label: 'Register Tenant',
    requiredGroups: ['platform-admin'],
  },
  {
    path: '/directory',
    label: 'Tenant Directory',
    requiredGroups: ['platform-admin'],
  },
  {
    path: '/super-admins',
    label: 'Super Admins',
    requiredGroups: ['platform-admin'],
  },
  // OMS Navigation Items - Only for tenant users
  {
    path: '/oms',
    label: 'OMS Dashboard',
    requiredGroups: ['tenant-user-ro', 'tenant-user-rw', 'tenant-admin'],
  },
  {
    path: '/oms/customers',
    label: 'Customers',
    requiredGroups: ['tenant-user-ro', 'tenant-user-rw', 'tenant-admin'],
  },
  {
    path: '/oms/products',
    label: 'Products',
    requiredGroups: ['tenant-user-ro', 'tenant-user-rw', 'tenant-admin'],
  },
  {
    path: '/oms/orders',
    label: 'Orders',
    requiredGroups: ['tenant-user-ro', 'tenant-user-rw', 'tenant-admin'],
  },
  {
    path: '/oms/inventory',
    label: 'Inventory',
    requiredGroups: ['tenant-user-ro', 'tenant-user-rw', 'tenant-admin'],
  },
];

// Filter navigation items based on user groups (preferred) or roles (fallback)
export const getVisibleNavigationItems = (userRoles: string[], groups?: Group[]): NavigationItem[] => {
  return NAVIGATION_ITEMS.filter(item => {
    // Check group-based access first (preferred method)
    if (item.requiredGroups && groups) {
      return item.requiredGroups.some(requiredGroup => 
        groups.some(group => group.name === requiredGroup)
      );
    }
    
    // Fallback to role-based access for backward compatibility
    if (item.requiredRoles) {
      return hasAnyRole(userRoles, item.requiredRoles, groups);
    }
    
    // If no restrictions, show to all authenticated users
    return true;
  });
};
