import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TenantApiClient } from '../api/TenantApiClient';
import { TenantRegistrationRequest } from '../models/TenantModel';
import './TenantRegistration.css';

export const TenantRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationData, setRegistrationData] = useState<TenantRegistrationRequest>({
    tenantName: '',
    email: '',
    subscriptionTier: 'public',
    firstName: '',
    lastName: '',
    createdBy: 'admin'
  });

  const handleFieldChange = (field: keyof TenantRegistrationRequest, value: string) => {
    setRegistrationData(prev => ({ ...prev, [field]: value }));
  };

  const submitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const apiClient = TenantApiClient.getInstance();
      const result = await apiClient.registerTenant(registrationData);
      alert(`Tenant registration successful! Tenant ID: ${result.tenantId}`);
      navigate('/directory');
    } catch (error) {
      console.error('Registration error:', error);
      alert(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="registration-view">
      <h1>Register New Tenant</h1>
      <div className="registration-card">
        <form onSubmit={submitRegistration}>
          <div className="form-section">
            <label className="field-label">
              Tenant Name
              <input
                type="text"
                className="field-input"
                value={registrationData.tenantName}
                onChange={(e) => handleFieldChange('tenantName', e.target.value)}
                required
                disabled={isSubmitting}
                placeholder="Enter tenant name"
              />
            </label>
          </div>

          <div className="form-section">
            <label className="field-label">
              Contact Email
              <input
                type="email"
                className="field-input"
                value={registrationData.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                required
                disabled={isSubmitting}
                placeholder="admin@company.com"
              />
            </label>
          </div>

          <div className="admin-section">
            <h3>Admin User Details</h3>
            <p className="admin-info">These details will be used to create the tenant administrator account.</p>
            
            <div className="form-row">
              <div className="form-section half-width">
                <label className="field-label">
                  Admin First Name
                  <input
                    type="text"
                    className="field-input"
                    value={registrationData.firstName}
                    onChange={(e) => handleFieldChange('firstName', e.target.value)}
                    required
                    disabled={isSubmitting}
                    placeholder="John"
                  />
                </label>
              </div>

              <div className="form-section half-width">
                <label className="field-label">
                  Admin Last Name
                  <input
                    type="text"
                    className="field-input"
                    value={registrationData.lastName}
                    onChange={(e) => handleFieldChange('lastName', e.target.value)}
                    required
                    disabled={isSubmitting}
                    placeholder="Doe"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="form-section">
            <label className="field-label">
              Subscription Tier
              <select
                className="field-input"
                value={registrationData.subscriptionTier}
                onChange={(e) => handleFieldChange('subscriptionTier', e.target.value as any)}
                disabled={isSubmitting}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>
          </div>

          <div className="tier-info">
            <h3>Tier Features</h3>
            {registrationData.subscriptionTier === 'public' && (
              <ul>
                <li>Shared infrastructure</li>
                <li>Standard security</li>
                <li>Community support</li>
                <li>Cost-effective solution</li>
              </ul>
            )}
            {registrationData.subscriptionTier === 'private' && (
              <ul>
                <li>Dedicated infrastructure</li>
                <li>Enhanced security</li>
                <li>Priority support</li>
                <li>Custom configurations</li>
                <li>Isolated environment</li>
              </ul>
            )}
          </div>

          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? 'Provisioning...' : 'Register Tenant'}
          </button>
        </form>
      </div>
    </div>
  );
};
