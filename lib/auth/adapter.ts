import { AuthAdapter, User } from './types';

/**
 * =====================================================
 * 🔧 CONFIGURE YOUR AUTH SERVICE HERE
 * =====================================================
 *
 * Replace this mock implementation with your actual auth service.
 * Uncomment one of the examples below or create your own implementation.
 *
 * Supported services (examples below):
 * - Supabase
 * - Firebase Auth
 * - NextAuth.js
 * - Auth0
 * - Clerk
 * - AWS Cognito
 * - Custom API
 */

// =====================================================
// MOCK IMPLEMENTATION (REMOVE THIS IN PRODUCTION)
// =====================================================
class MockAuthAdapter implements AuthAdapter {
  async initialize(): Promise<void> {
    console.warn('🚨 Using Mock Auth Adapter - Replace with real implementation in lib/auth/adapter.ts');
  }

  async getCurrentUser(): Promise<User | null> {
    // Mock: return null (not authenticated)
    return null;
  }

  async signIn(email: string, password: string): Promise<User> {
    console.log('Mock signIn:', email);
    throw new Error('Mock auth - implement real auth service');
  }

  async signUp(email: string, password: string, userData?: Partial<User>): Promise<User> {
    console.log('Mock signUp:', email);
    throw new Error('Mock auth - implement real auth service');
  }

  async signOut(): Promise<void> {
    console.log('Mock signOut');
  }

  signInWithProvider(provider: string): Promise<User> {
    console.log('Mock signInWithProvider:', provider);
    throw new Error('Mock auth - implement real auth service');
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    // Mock: no-op
    return () => {};
  }
}

// =====================================================
// EXAMPLE: SUPABASE IMPLEMENTATION
// =====================================================
/*
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

class SupabaseAuthAdapter implements AuthAdapter {
  async initialize(): Promise<void> {
    // Supabase auto-initializes
  }

  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    return {
      id: user.id,
      email: user.email!,
      name: user.user_metadata.name,
      avatar: user.user_metadata.avatar_url,
    };
  }

  async signIn(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    return {
      id: data.user.id,
      email: data.user.email!,
      name: data.user.user_metadata.name,
    };
  }

  async signUp(email: string, password: string, userData?: Partial<User>): Promise<User> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
      },
    });
    if (error) throw error;

    return {
      id: data.user!.id,
      email: data.user!.email!,
      ...userData,
    };
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async signInWithProvider(provider: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
    });
    if (error) throw error;
    throw new Error('OAuth redirect initiated');
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        callback({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata.name,
        });
      } else {
        callback(null);
      }
    });

    return () => subscription.unsubscribe();
  }
}

export const authAdapter: AuthAdapter = new SupabaseAuthAdapter();
*/

// =====================================================
// EXAMPLE: FIREBASE AUTH IMPLEMENTATION
// =====================================================
/*
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

class FirebaseAuthAdapter implements AuthAdapter {
  async initialize(): Promise<void> {
    // Firebase auto-initializes
  }

  async getCurrentUser(): Promise<User | null> {
    const user = auth.currentUser;
    if (!user) return null;

    return {
      id: user.uid,
      email: user.email!,
      name: user.displayName || undefined,
      avatar: user.photoURL || undefined,
    };
  }

  async signIn(email: string, password: string): Promise<User> {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    return {
      id: user.uid,
      email: user.email!,
      name: user.displayName || undefined,
    };
  }

  async signUp(email: string, password: string, userData?: Partial<User>): Promise<User> {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    return {
      id: user.uid,
      email: user.email!,
      ...userData,
    };
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }

  async signInWithProvider(provider: string): Promise<User> {
    const authProvider = provider === 'google'
      ? new GoogleAuthProvider()
      : new GithubAuthProvider();

    const { user } = await signInWithPopup(auth, authProvider);
    return {
      id: user.uid,
      email: user.email!,
      name: user.displayName || undefined,
    };
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        callback({
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          name: firebaseUser.displayName || undefined,
        });
      } else {
        callback(null);
      }
    });
  }
}

export const authAdapter: AuthAdapter = new FirebaseAuthAdapter();
*/

// =====================================================
// EXAMPLE: CUSTOM API IMPLEMENTATION
// =====================================================
/*
class CustomAPIAuthAdapter implements AuthAdapter {
  private user: User | null = null;
  private listeners: Array<(user: User | null) => void> = [];

  async initialize(): Promise<void> {
    // Check for stored token and validate
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const user = await this.getCurrentUser();
        this.setUser(user);
      } catch (error) {
        localStorage.removeItem('auth_token');
      }
    }
  }

  async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    const response = await fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    return response.json();
  }

  async signIn(email: string, password: string): Promise<User> {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) throw new Error('Sign in failed');

    const { token, user } = await response.json();
    localStorage.setItem('auth_token', token);
    this.setUser(user);
    return user;
  }

  async signUp(email: string, password: string, userData?: Partial<User>): Promise<User> {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...userData }),
    });

    if (!response.ok) throw new Error('Sign up failed');

    const { token, user } = await response.json();
    localStorage.setItem('auth_token', token);
    this.setUser(user);
    return user;
  }

  async signOut(): Promise<void> {
    localStorage.removeItem('auth_token');
    this.setUser(null);
  }

  async signInWithProvider(provider: string): Promise<User> {
    // Redirect to OAuth endpoint
    window.location.href = `/api/auth/oauth/${provider}`;
    throw new Error('OAuth redirect initiated');
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private setUser(user: User | null) {
    this.user = user;
    this.listeners.forEach(listener => listener(user));
  }
}

export const authAdapter: AuthAdapter = new CustomAPIAuthAdapter();
*/

// =====================================================
// 👇 EXPORT YOUR AUTH ADAPTER HERE
// =====================================================
// Replace MockAuthAdapter with your implementation above
export const authAdapter: AuthAdapter = new MockAuthAdapter();
