'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getUserOrganizations,
  setPrimaryOrganization as apiSetPrimaryOrganization,
  type UserOrganization,
} from '@/services/OrganizationService';
import {
  getSelectedOrganizationId,
  setSelectedOrganizationId as persistSelectedOrganizationId,
} from '@/services/apiHelpers';
import { useAuth } from '@/lib/auth';

interface OrganizationContextType {
  /** Organizations the current user can access (for company switcher) */
  organizations: UserOrganization[];
  /** Currently selected organization ID for scoped requests (synced to localStorage) */
  selectedOrganizationId: number | null;
  /** Set the active company context; persists to localStorage so API calls use X-Organization-Id */
  setSelectedOrganizationId: (id: number | null) => void;
  /** Set the user's primary organization (default company when header is omitted) */
  setPrimaryOrganization: (organizationId: number | null) => Promise<void>;
  /** Refresh the list of organizations (e.g. after creating a new company) */
  refetchOrganizations: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [selectedOrganizationId, setSelectedState] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetchOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getUserOrganizations();
      if (res.success && res.data) {
        setOrganizations(res.data);
        const currentStored = getSelectedOrganizationId();
        const primary = res.data.find((o) => o.is_primary);
        if (currentStored !== null && res.data.some((o) => o.id === currentStored)) {
          setSelectedState(currentStored);
        } else if (primary) {
          setSelectedState(primary.id);
          persistSelectedOrganizationId(primary.id);
        } else if (res.data.length > 0) {
          const first = res.data[0];
          setSelectedState(first.id);
          persistSelectedOrganizationId(first.id);
        } else {
          setSelectedState(null);
          persistSelectedOrganizationId(null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organizations');
      setOrganizations([]);
      setSelectedState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Only fetch organizations when user is authenticated (token is available).
  // Avoids "No access token found" on login page or right after login before redirect.
  useEffect(() => {
    if (user) {
      refetchOrganizations();
    } else {
      setError(null);
      setOrganizations([]);
      setSelectedState(null);
      setIsLoading(false);
    }
  }, [user, refetchOrganizations]);

  const setSelectedOrganizationId = useCallback((id: number | null) => {
    setSelectedState(id);
    persistSelectedOrganizationId(id);
  }, []);

  const setPrimaryOrganization = useCallback(async (organizationId: number | null) => {
    await apiSetPrimaryOrganization(organizationId);
    await refetchOrganizations();
  }, [refetchOrganizations]);

  const value: OrganizationContextType = {
    organizations,
    selectedOrganizationId,
    setSelectedOrganizationId,
    setPrimaryOrganization,
    refetchOrganizations,
    isLoading,
    error,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (ctx === undefined) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return ctx;
}
