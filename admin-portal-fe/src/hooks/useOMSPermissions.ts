import { useAuth } from '../contexts/AuthContext';

export const useOMSPermissions = () => {
  const { state } = useAuth();
  
  const hasWritePermission = () => {
    if (!state.user?.groups) return false;
    
    // Only account-user-rw and account-admin have write access
    return state.user.groups.some(g => 
      g.name === 'account-user-rw' || g.name === 'account-admin'
    );
  };
  
  const hasReadPermission = () => {
    if (!state.user?.groups) return false;
    
    // All account-user groups have read access
    return state.user.groups.some(g => 
      g.name === 'account-user-ro' || 
      g.name === 'account-user-rw' || 
      g.name === 'account-admin'
    );
  };
  
  return {
    canWrite: hasWritePermission(),
    canRead: hasReadPermission(),
  };
};
