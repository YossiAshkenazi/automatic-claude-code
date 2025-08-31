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
  displayName?: string;
  activeSessions?: number;
  todayActions?: number;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'viewer';
  displayName?: string;
}

export interface UserManagementProps {
  users: User[];
  currentUser: User;
  onCreateUser: (userData: CreateUserData) => Promise<{ success: boolean; error?: string }>;
  onUpdateUser: (userId: string, updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  onDeleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  onResetPassword: (userId: string) => Promise<{ success: boolean; newPassword?: string; error?: string }>;
  loading?: boolean;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  currentUser,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onResetPassword,
  loading = false
}) => {
  const [selectedTab, setSelectedTab] = useState<'users' | 'create'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'manager' | 'viewer'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    username: '',
    email: '',
    password: '',
    role: 'viewer',
    displayName: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  // Filter users based on search term and role filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const validateCreateUser = (): boolean => {
    const validationErrors: Record<string, string> = {};

    if (!createUserData.username.trim()) {
      validationErrors.username = 'Username is required';
    } else if (createUserData.username.length < 3) {
      validationErrors.username = 'Username must be at least 3 characters';
    } else if (users.some(u => u.username === createUserData.username)) {
      validationErrors.username = 'Username already exists';
    }

    if (!createUserData.email.trim()) {
      validationErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createUserData.email)) {
      validationErrors.email = 'Please enter a valid email address';
    } else if (users.some(u => u.email === createUserData.email)) {
      validationErrors.email = 'Email already exists';
    }

    if (!createUserData.password) {
      validationErrors.password = 'Password is required';
    } else if (createUserData.password.length < 8) {
      validationErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleCreateUser = async () => {
    if (!validateCreateUser()) return;

    try {
      const result = await onCreateUser(createUserData);
      if (result.success) {
        setCreateUserData({
          username: '',
          email: '',
          password: '',
          role: 'viewer',
          displayName: ''
        });
        setShowCreateForm(false);
        setSuccessMessage('User created successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ general: result.error || 'Failed to create user' });
      }
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' });
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      const result = await onUpdateUser(userId, updates);
      if (result.success) {
        setEditingUser(null);
        setSuccessMessage('User updated successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ general: result.error || 'Failed to update user' });
      }
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser.id) {
      setErrors({ general: 'You cannot delete your own account' });
      return;
    }

    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await onDeleteUser(userId);
      if (result.success) {
        setSuccessMessage('User deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ general: result.error || 'Failed to delete user' });
      }
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' });
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this user\'s password? They will need to log in with the new password.')) {
      return;
    }

    try {
      const result = await onResetPassword(userId);
      if (result.success) {
        alert(`Password reset successfully. New password: ${result.newPassword}\n\nPlease share this securely with the user.`);
      } else {
        setErrors({ general: result.error || 'Failed to reset password' });
      }
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' });
    }
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
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage user accounts and permissions
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          Create New User
        </Button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-md p-3">
          <p className="text-sm text-green-700 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      {errors.general && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md p-3">
          <p className="text-sm text-red-700 dark:text-red-400">{errors.general}</p>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center mb-4">
                Create New User
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Username
                  </label>
                  <Input
                    value={createUserData.username}
                    onChange={(e) => setCreateUserData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter username"
                    className={errors.username ? 'border-red-500' : ''}
                  />
                  {errors.username && <p className="text-sm text-red-600 mt-1">{errors.username}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={createUserData.email}
                    onChange={(e) => setCreateUserData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <Input
                    type="password"
                    value={createUserData.password}
                    onChange={(e) => setCreateUserData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password"
                    className={errors.password ? 'border-red-500' : ''}
                  />
                  {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Role
                  </label>
                  <select
                    value={createUserData.role}
                    onChange={(e) => setCreateUserData(prev => ({ ...prev, role: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Display Name (Optional)
                  </label>
                  <Input
                    value={createUserData.displayName || ''}
                    onChange={(e) => setCreateUserData(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="Enter display name"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={loading}>
                  {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                  Create User
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search users by username, email, or display name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.displayName || user.username}
                        {user.id === currentUser.id && (
                          <Badge className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                      {user.displayName && user.displayName !== user.username && (
                        <div className="text-xs text-gray-400">@{user.username}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div>
                      {user.activeSessions ? `${user.activeSessions} active sessions` : 'No active sessions'}
                    </div>
                    <div>
                      {user.todayActions ? `${user.todayActions} actions today` : 'No activity today'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingUser(user.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetPassword(user.id)}
                      >
                        Reset Password
                      </Button>
                      {user.id !== currentUser.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || roleFilter !== 'all' ? 'No users found matching your filters.' : 'No users found.'}
            </p>
          </div>
        )}
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{users.length}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Users</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {users.filter(u => u.isActive).length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Active Users</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {users.filter(u => u.role === 'admin').length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Admins</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {users.filter(u => u.lastLoginAt && new Date(u.lastLoginAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Active Today</div>
        </Card>
      </div>
    </div>
  );
};

export default UserManagement;