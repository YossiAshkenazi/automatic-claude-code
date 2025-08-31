// Authentication system exports
export { AuthManager } from './AuthManager';
export { UserManager } from './UserManager';
export { SessionManager } from './SessionManager';
export { PermissionManager } from './PermissionManager';

// Export types
export type { User, UserRole, CreateUserData, UpdateUserData, UserProfile, UserPreferences } from './UserManager';
export type { LoginCredentials, AuthResult, AuthConfig } from './AuthManager';
export type { UserSession, SessionConfig } from './SessionManager';
export type { Permission, RolePermission, UserPermission, PermissionCheck } from './PermissionManager';