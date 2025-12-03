import { useAuth } from '../contexts/AuthContext';

export const useOMSPermissions = () => {
  const { state } = useAuth();
  
  const hasWritePermission = () => {
    if (!state.user?.groups) return false;
    
    // Only tenant-user-rw and tenant-admin have write access
    return state.user.groups.some(g => 
      g.name === 'tenant-user-rw' || g.name === 'tenant-admin'
    );
  };
  
  const hasReadPermission = () => {
    if (!state.user?.groups) return false;
    
    // All tenant-user groups have read access
    return state.user.groups.some(g => 
      g.name === 'tenant-user-ro' || 
      g.name === 'tenant-user-rw' || 
      g.name === 'tenant-admin'
    );
  };
  
  return {
    canWrite: hasWritePermission(),
    canRead: hasReadPermission(),
  };
};
