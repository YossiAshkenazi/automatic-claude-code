import React from 'react';

export interface PermissionGateProps {
  /** Required permission(s) - can be a single permission or array of permissions */
  permissions: string | string[];
  /** User's current permissions */
  userPermissions: string[];
  /** User's role */
  userRole?: 'admin' | 'manager' | 'viewer';
  /** Whether to require ALL permissions (default) or ANY permission */
  requireAll?: boolean;
  /** Content to render when user has permission */
  children: React.ReactNode;
  /** Content to render when user lacks permission */
  fallback?: React.ReactNode;
  /** Show loading state while permissions are being checked */
  loading?: boolean;
  /** Custom permission check function */
  customCheck?: (userPermissions: string[], userRole?: string) => boolean;
  /** Whether to hide the component entirely when no permission (vs showing fallback) */
  hideOnDenied?: boolean;
}

/**
 * PermissionGate component provides role-based access control for UI components
 * 
 * Features:
 * - Single or multiple permission checks
 * - Role-based permissions with admin override
 * - Custom permission validation logic
 * - Graceful fallback rendering
 * - Loading state support
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  permissions,
  userPermissions = [],
  userRole,
  requireAll = true,
  children,
  fallback = null,
  loading = false,
  customCheck,
  hideOnDenied = false
}) => {
  // Show loading state if specified
  if (loading) {
    return (
      <div className="flex items-center justify-center p-2">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Admin users have access to everything (unless custom check overrides this)
  const isAdmin = userRole === 'admin';
  
  // Use custom check if provided
  if (customCheck) {
    const hasPermission = customCheck(userPermissions, userRole);
    if (!hasPermission) {
      return hideOnDenied ? null : <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // Admin override (admins have all permissions by default)
  if (isAdmin) {
    return <>{children}</>;
  }

  // Normalize permissions to array
  const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
  
  // Check if user has required permissions
  const hasPermission = requireAll
    ? requiredPermissions.every(perm => userPermissions.includes(perm))
    : requiredPermissions.some(perm => userPermissions.includes(perm));

  // Return children if user has permission, otherwise return fallback or nothing
  if (hasPermission) {
    return <>{children}</>;
  }

  return hideOnDenied ? null : <>{fallback}</>;
};

/**
 * Hook for checking permissions in functional components
 */
export const usePermissions = (
  userPermissions: string[] = [],
  userRole?: 'admin' | 'manager' | 'viewer'
) => {
  const hasPermission = (
    permissions: string | string[],
    requireAll: boolean = true
  ): boolean => {
    // Admin users have all permissions
    if (userRole === 'admin') {
      return true;
    }

    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    
    return requireAll
      ? requiredPermissions.every(perm => userPermissions.includes(perm))
      : requiredPermissions.some(perm => userPermissions.includes(perm));
  };

  const hasRole = (role: 'admin' | 'manager' | 'viewer'): boolean => {
    return userRole === role;
  };

  const hasAnyRole = (roles: ('admin' | 'manager' | 'viewer')[]): boolean => {
    return userRole ? roles.includes(userRole) : false;
  };

  const isAdmin = (): boolean => userRole === 'admin';
  const isManager = (): boolean => userRole === 'manager';
  const isViewer = (): boolean => userRole === 'viewer';

  return {
    hasPermission,
    hasRole,
    hasAnyRole,
    isAdmin,
    isManager,
    isViewer,
    permissions: userPermissions,
    role: userRole
  };
};

/**
 * Higher-order component for permission-based rendering
 */
export function withPermissions<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermissions: string | string[],
  options: {
    requireAll?: boolean;
    fallback?: React.ReactNode;
    hideOnDenied?: boolean;
  } = {}
) {
  const WithPermissionsComponent: React.FC<P & {
    userPermissions?: string[];
    userRole?: 'admin' | 'manager' | 'viewer';
  }> = ({ userPermissions = [], userRole, ...props }) => {
    return (
      <PermissionGate
        permissions={requiredPermissions}
        userPermissions={userPermissions}
        userRole={userRole}
        requireAll={options.requireAll}
        fallback={options.fallback}
        hideOnDenied={options.hideOnDenied}
      >
        <WrappedComponent {...(props as P)} />
      </PermissionGate>
    );
  };

  WithPermissionsComponent.displayName = `withPermissions(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithPermissionsComponent;
}

/**
 * Predefined permission gates for common use cases
 */
export const AdminOnly: React.FC<{
  children: React.ReactNode;
  userRole?: string;
  fallback?: React.ReactNode;
}> = ({ children, userRole, fallback }) => (
  <PermissionGate
    permissions={[]}
    userPermissions={[]}
    userRole={userRole as any}
    customCheck={() => userRole === 'admin'}
    fallback={fallback}
  >
    {children}
  </PermissionGate>
);

export const ManagerOrAdmin: React.FC<{
  children: React.ReactNode;
  userRole?: string;
  fallback?: React.ReactNode;
}> = ({ children, userRole, fallback }) => (
  <PermissionGate
    permissions={[]}
    userPermissions={[]}
    userRole={userRole as any}
    customCheck={() => ['admin', 'manager'].includes(userRole || '')}
    fallback={fallback}
  >
    {children}
  </PermissionGate>
);

/**
 * Permission-aware button component
 */
export const PermissionButton: React.FC<{
  permissions: string | string[];
  userPermissions: string[];
  userRole?: 'admin' | 'manager' | 'viewer';
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  title?: string;
}> = ({
  permissions,
  userPermissions,
  userRole,
  children,
  onClick,
  className = '',
  disabled = false,
  title
}) => {
  const { hasPermission } = usePermissions(userPermissions, userRole);
  const canPerformAction = hasPermission(permissions);
  
  if (!canPerformAction) {
    return (
      <button
        disabled={true}
        className={`${className} opacity-50 cursor-not-allowed`}
        title={title || 'You do not have permission to perform this action'}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      title={title}
    >
      {children}
    </button>
  );
};

export default PermissionGate;