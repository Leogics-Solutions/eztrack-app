'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authAdapter } from './adapter';
import { AuthState, User } from './types';

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

  useEffect(() => {
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

        // Subscribe to auth state changes
        unsubscribe = authAdapter.onAuthStateChange((user) => {
          setState({
            user,
            isLoading: false,
            isAuthenticated: !!user,
          });
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    initAuth();

    return () => {
      unsubscribe?.();
    };
  }, []);

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
      {children}
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
