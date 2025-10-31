import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NavigationPanel } from './components/NavigationPanel';
import { Overview } from './views/Overview';
import { TenantRegistration } from './views/TenantRegistration';
import { TenantDirectory } from './views/TenantDirectory';
import { SuperAdminManagement } from './views/SuperAdminManagement';
import { UserManagement } from './views/UserManagement';
import { RoleManagement } from './views/RoleManagement';
import { GroupManagement } from './views/GroupManagement';
import { PermissionManagement } from './views/PermissionManagement';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleGuard } from './components/RoleGuard';
import { GroupGuard } from './components/GroupGuard';
import { LoginPage } from './components/LoginPage';
import { useAuth } from './contexts/AuthContext';
import './App.css';

function AppContent() {
  const { state } = useAuth();

  if (!state.isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <NavigationPanel />
      <main className="main-content">
        <Routes>
          <Route 
            path="/" 
            element={
              <GroupGuard 
                allowedGroups={['platform-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to view the overview.</div>}
              >
                <Overview />
              </GroupGuard>
            } 
          />
          
          {/* Tenant Gov Routes - Platform Admin Only */}
          <Route 
            path="/register" 
            element={
              <GroupGuard 
                allowedGroups={['platform-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to register tenants.</div>}
              >
                <TenantRegistration />
              </GroupGuard>
            } 
          />
          
          <Route 
            path="/directory" 
            element={
              <GroupGuard 
                allowedGroups={['platform-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to view the tenant directory.</div>}
              >
                <TenantDirectory />
              </GroupGuard>
            } 
          />
          
          {/* Super Admin Routes - Platform Admin Only */}
          <Route 
            path="/super-admins" 
            element={
              <GroupGuard 
                allowedGroups={['platform-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to manage super admins.</div>}
              >
                <SuperAdminManagement />
              </GroupGuard>
            } 
          />
          
          {/* RBAC Management Routes - Super Admin Only */}
          <Route 
            path="/user-management" 
            element={
              <GroupGuard 
                allowedGroups={['super-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to manage users.</div>}
              >
                <UserManagement />
              </GroupGuard>
            } 
          />

          <Route 
            path="/role-management" 
            element={
              <GroupGuard 
                allowedGroups={['super-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to manage roles.</div>}
              >
                <RoleManagement />
              </GroupGuard>
            } 
          />

          <Route 
            path="/group-management" 
            element={
              <GroupGuard 
                allowedGroups={['super-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to manage groups.</div>}
              >
                <GroupManagement />
              </GroupGuard>
            } 
          />

          <Route 
            path="/permission-management" 
            element={
              <GroupGuard 
                allowedGroups={['super-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to manage permissions.</div>}
              >
                <PermissionManagement />
              </GroupGuard>
            } 
          />
          
          {/* Catch-all route for invalid paths */}
          <Route 
            path="*" 
            element={
              <div className="not-found">
                <h2>Page Not Found</h2>
                <p>The page you're looking for doesn't exist or you don't have permission to access it.</p>
              </div>
            } 
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
