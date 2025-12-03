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

// OMS Components
import OMSDashboard from './views/OMSDashboard';
import CustomerManagement from './views/CustomerManagement';
import ProductManagement from './views/ProductManagement';
import OrderManagement from './views/OrderManagement';
import InventoryManagement from './views/InventoryManagement';
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
          
          {/* RBAC Management Routes - Tenant Admin Only */}
          <Route 
            path="/user-management" 
            element={
              <GroupGuard 
                allowedGroups={['tenant-admin']}
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
                allowedGroups={['tenant-admin']}
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
                allowedGroups={['tenant-admin']}
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
                allowedGroups={['tenant-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to manage permissions.</div>}
              >
                <PermissionManagement />
              </GroupGuard>
            } 
          />

          {/* OMS Routes - All tenant users + platform admin */}
          <Route 
            path="/oms" 
            element={
              <GroupGuard 
                allowedGroups={['tenant-user-ro', 'tenant-user-rw', 'tenant-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to access Order Management.</div>}
              >
                <OMSDashboard />
              </GroupGuard>
            } 
          />

          <Route 
            path="/oms/customers" 
            element={
              <GroupGuard 
                allowedGroups={['tenant-user-ro', 'tenant-user-rw', 'tenant-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to manage customers.</div>}
              >
                <CustomerManagement />
              </GroupGuard>
            } 
          />

          <Route 
            path="/oms/products" 
            element={
              <GroupGuard 
                allowedGroups={['tenant-user-ro', 'tenant-user-rw', 'tenant-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to manage products.</div>}
              >
                <ProductManagement />
              </GroupGuard>
            } 
          />

          <Route 
            path="/oms/orders" 
            element={
              <GroupGuard 
                allowedGroups={['tenant-user-ro', 'tenant-user-rw', 'tenant-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to manage orders.</div>}
              >
                <OrderManagement />
              </GroupGuard>
            } 
          />

          <Route 
            path="/oms/inventory" 
            element={
              <GroupGuard 
                allowedGroups={['tenant-user-ro', 'tenant-user-rw', 'tenant-admin']}
                fallback={<div className="access-denied">Access Denied: You don't have permission to manage inventory.</div>}
              >
                <InventoryManagement />
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
