import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { NavigationPanel } from './components/NavigationPanel';
import { Overview } from './views/Overview';
import { TenantRegistration } from './views/TenantRegistration';
import { TenantDirectory } from './views/TenantDirectory';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <NavigationPanel />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/register" element={<TenantRegistration />} />
            <Route path="/directory" element={<TenantDirectory />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
