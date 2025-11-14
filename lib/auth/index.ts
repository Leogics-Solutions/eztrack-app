/**
 * Auth module exports
 * Import from here in your app: import { useAuth, AuthProvider } from '@/lib/auth'
 */

export { AuthProvider, useAuth } from './AuthContext';
export type { User, AuthState, AuthAdapter } from './types';
export { authAdapter } from './adapter';
