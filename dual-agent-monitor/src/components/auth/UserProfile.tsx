import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Badge } from '../ui/Badge';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  avatar?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    browser: boolean;
    sessionAlerts: boolean;
    errorAlerts: boolean;
  };
  dashboard: {
    defaultView: 'sessions' | 'analytics' | 'agents';
    refreshInterval: number;
    maxSessions: number;
  };
}

export interface UserProfileProps {
  user: User;
  profile: UserProfile;
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  onLogout: () => void;
  loading?: boolean;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  profile,
  onUpdateProfile,
  onChangePassword,
  onLogout,
  loading = false
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'security'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>(profile);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const handleProfileUpdate = async () => {
    const validationErrors: Record<string, string> = {};

    if (!formData.displayName?.trim()) {
      validationErrors.displayName = 'Display name is required';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const result = await onUpdateProfile(formData);
      if (result.success) {
        setIsEditing(false);
        setSuccessMessage('Profile updated successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ general: result.error || 'Failed to update profile' });
      }
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' });
    }
  };

  const handlePasswordChange = async () => {
    const validationErrors: Record<string, string> = {};

    if (!passwordData.currentPassword) {
      validationErrors.currentPassword = 'Current password is required';
    }

    if (!passwordData.newPassword) {
      validationErrors.newPassword = 'New password is required';
    } else if (passwordData.newPassword.length < 8) {
      validationErrors.newPassword = 'Password must be at least 8 characters';
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      validationErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const result = await onChangePassword(passwordData.currentPassword, passwordData.newPassword);
      if (result.success) {
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setSuccessMessage('Password changed successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ password: result.error || 'Failed to change password' });
      }
    } catch (error) {
      setErrors({ password: 'An unexpected error occurred' });
    }
  };

  const handlePreferenceChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        ...{ [key]: value }
      }
    }));
  };

  const handleNestedPreferenceChange = (category: string, key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [category]: {
          ...prev.preferences?.[category as keyof UserPreferences],
          [key]: value
        }
      }
    }));
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'manager': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'viewer': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Profile</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your account settings and preferences
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={onLogout}
          className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
        >
          Sign Out
        </Button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-md p-3">
          <p className="text-sm text-green-700 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'profile', label: 'Profile Information' },
            { key: 'preferences', label: 'Preferences' },
            { key: 'security', label: 'Security' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Information Tab */}
      {activeTab === 'profile' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profile Information</h2>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
            ) : (
              <div className="space-x-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleProfileUpdate} disabled={loading}>
                  {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username
                </label>
                <Input
                  value={user.username}
                  disabled={true}
                  className="bg-gray-50 dark:bg-gray-800"
                />
                <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <Input
                  value={user.email}
                  disabled={true}
                  className="bg-gray-50 dark:bg-gray-800"
                />
                <p className="text-xs text-gray-500 mt-1">Contact admin to change email</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Name
                </label>
                <Input
                  value={formData.displayName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                  disabled={!isEditing}
                  className={errors.displayName ? 'border-red-500' : ''}
                />
                {errors.displayName && (
                  <p className="text-sm text-red-600 mt-1">{errors.displayName}</p>
                )}
              </div>
            </div>

            {/* Account Status */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <Badge className={getRoleBadgeColor(user.role)}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account Status
                </label>
                <Badge className={user.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Login
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Member Since
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Preferences</h2>
            <Button onClick={handleProfileUpdate} disabled={loading}>
              {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              Save Preferences
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Appearance */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Appearance</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Theme
                </label>
                <select
                  value={formData.preferences?.theme || 'auto'}
                  onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Language
                </label>
                <select
                  value={formData.preferences?.language || 'en'}
                  onChange={(e) => handlePreferenceChange('language', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>
            </div>

            {/* Notifications */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notifications</h3>
              
              {[
                { key: 'email', label: 'Email notifications' },
                { key: 'browser', label: 'Browser notifications' },
                { key: 'sessionAlerts', label: 'Session alerts' },
                { key: 'errorAlerts', label: 'Error alerts' }
              ].map((notification) => (
                <div key={notification.key} className="flex items-center">
                  <input
                    type="checkbox"
                    id={notification.key}
                    checked={formData.preferences?.notifications?.[notification.key as keyof UserPreferences['notifications']] || false}
                    onChange={(e) => handleNestedPreferenceChange('notifications', notification.key, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={notification.key} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {notification.label}
                  </label>
                </div>
              ))}
            </div>

            {/* Dashboard Settings */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Dashboard</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default View
                  </label>
                  <select
                    value={formData.preferences?.dashboard?.defaultView || 'sessions'}
                    onChange={(e) => handleNestedPreferenceChange('dashboard', 'defaultView', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="sessions">Sessions</option>
                    <option value="analytics">Analytics</option>
                    <option value="agents">Agents</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Refresh Interval (ms)
                  </label>
                  <Input
                    type="number"
                    value={formData.preferences?.dashboard?.refreshInterval || 5000}
                    onChange={(e) => handleNestedPreferenceChange('dashboard', 'refreshInterval', parseInt(e.target.value))}
                    min={1000}
                    max={60000}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Sessions
                  </label>
                  <Input
                    type="number"
                    value={formData.preferences?.dashboard?.maxSessions || 50}
                    onChange={(e) => handleNestedPreferenceChange('dashboard', 'maxSessions', parseInt(e.target.value))}
                    min={10}
                    max={500}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Security Settings</h2>

          <div className="space-y-6">
            {/* Change Password */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Change Password</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className={errors.currentPassword ? 'border-red-500' : ''}
                  />
                  {errors.currentPassword && (
                    <p className="text-sm text-red-600 mt-1">{errors.currentPassword}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className={errors.newPassword ? 'border-red-500' : ''}
                  />
                  {errors.newPassword && (
                    <p className="text-sm text-red-600 mt-1">{errors.newPassword}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className={errors.confirmPassword ? 'border-red-500' : ''}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-600 mt-1">{errors.confirmPassword}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Button onClick={handlePasswordChange} disabled={loading}>
                    {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                    Change Password
                  </Button>
                  {errors.password && (
                    <p className="text-sm text-red-600 mt-2">{errors.password}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Account Actions */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Account Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" onClick={onLogout}>
                  Sign Out of All Devices
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default UserProfile;