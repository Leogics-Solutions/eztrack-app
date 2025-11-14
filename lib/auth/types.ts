/**
 * Core authentication types
 * These types are service-agnostic and work with any auth provider
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  // Add other user properties your app needs
  [key: string]: any;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Auth adapter interface
 * Implement this interface for your specific auth service
 */
export interface AuthAdapter {
  /**
   * Initialize the auth service
   * Called once when the app starts
   */
  initialize(): Promise<void>;

  /**
   * Get the current authenticated user
   * Should return null if not authenticated
   */
  getCurrentUser(): Promise<User | null>;

  /**
   * Sign in with email and password
   */
  signIn(email: string, password: string): Promise<User>;

  /**
   * Sign up with email and password
   */
  signUp(email: string, password: string, userData?: Partial<User>): Promise<User>;

  /**
   * Sign out the current user
   */
  signOut(): Promise<void>;

  /**
   * Sign in with OAuth provider (Google, GitHub, etc.)
   */
  signInWithProvider(provider: string): Promise<User>;

  /**
   * Subscribe to auth state changes
   * Return an unsubscribe function
   */
  onAuthStateChange(callback: (user: User | null) => void): () => void;
}
