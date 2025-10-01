import React from 'react';
import { NavLink } from 'react-router-dom';
import './NavigationPanel.css';

export const NavigationPanel: React.FC = () => {
  return (
    <aside className="navigation-panel">
      <div className="nav-header">
        <h2>Tenant Portal</h2>
      </div>
      <nav className="nav-menu">
        <NavLink to="/" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          Overview
        </NavLink>
        <NavLink to="/register" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          Register Tenant
        </NavLink>
        <NavLink to="/directory" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          Tenant Directory
        </NavLink>
      </nav>
    </aside>
  );
};
