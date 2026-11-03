'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authAdapter } from './adapter';
import { AuthState, User } from './types';
import { redirectToLogin } from './authHelpers';
import { installSessionFetch } from './sessionFetch';
import { BASE_URL } from '@/services/config';

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData?: Partial<User>) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithProvider: (provider: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const [sessionError, setSessionError] = useState(false);
  const [sessionRetry, setSessionRetry] = useState(0);

  useEffect(() => {
    installSessionFetch(BASE_URL);
    setSessionError(false);
    setState(previous => ({ ...previous, isLoading: true }));
    // Initialize auth and set up listener
    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      try {
        await authAdapter.initialize();
        const user = await authAdapter.getCurrentUser();

        setState({
          user,
          isLoading: false,
          isAuthenticated: !!user,
        });

        // If no user and not on login page, redirect will be handled by getCurrentUser
        if (!user && typeof window !== 'undefined' && window.location.pathname !== '/login') {
          // getCurrentUser already handles redirect, but ensure state is updated
          return;
        }

        // Subscribe to auth state changes
        unsubscribe = authAdapter.onAuthStateChange((user) => {
          setState({
            user,
            isLoading: false,
            isAuthenticated: !!user,
          });
          
          // If user becomes null and not on login page, redirect
          if (!user && typeof window !== 'undefined' && window.location.pathname !== '/login') {
            redirectToLogin(window.location.pathname);
          }
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
        
        if ((error as { status?: number })?.status === 401) {
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            redirectToLogin(window.location.pathname);
          }
        } else {
          setSessionError(true);
        }
      }
    };

    initAuth();

    return () => {
      unsubscribe?.();
    };
  }, [sessionRetry]);

  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const user = await authAdapter.signIn(email, password);
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const signUp = async (email: string, password: string, userData?: Partial<User>) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const user = await authAdapter.signUp(email, password, userData);
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const signOut = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await authAdapter.signOut();
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const signInWithProvider = async (provider: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const user = await authAdapter.signInWithProvider(provider);
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signUp,
        signOut,
        signInWithProvider,
      }}
    >
      {sessionError ? (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <p>Unable to check your sign-in. Your session has been kept.</p>
          <button type="button" className="rounded border px-4 py-2" onClick={() => setSessionRetry(value => value + 1)}>Retry</button>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
